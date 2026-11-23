import {parseTriggerDelivery} from '@neon/functions/triggers';

const monitoredRoutes = new Set([
 '/weather', '/catalog', '/catalog/expand', '/cron/catalog', '/session',
 '/session/transfer', '/closet', '/profile', '/analyze', '/prices',
]);
const methods = new Set(['GET', 'POST', 'PUT', 'DELETE']);
const operationsPath = '/admin/operations';
const manageMembersPath = '/admin/members';
const activityPath = '/member/activity';
const siteActivityPath = '/site/activity';
const dailyReportKind = 'catalog_daily_report';
const dailyReportPath = '/cron/catalog-report';

const automationScope = `(kind IN ('catalog_cleanup','catalog_daily_report') OR
 (kind='catalog_refresh' AND details->>'source'='musinsa_root_scan'))`;
export const automationReportsSql = `
 WITH automation_runs AS NOT MATERIALIZED (
  SELECT id::text AS id, id AS sequence, kind, status, created_at, details
    FROM agent_runs WHERE ${automationScope}
 )
 SELECT job.kind, to_jsonb(success) - 'sequence' AS "lastSuccess",
        to_jsonb(latest) - 'sequence' AS latest
 FROM (VALUES ('catalog_daily_report'), ('catalog_refresh'), ('catalog_cleanup')) AS job(kind)
 LEFT JOIN LATERAL (
  SELECT * FROM automation_runs WHERE kind=job.kind AND status='success'
   ORDER BY (details->>'report_date') DESC NULLS LAST, sequence DESC LIMIT 1
 ) AS success ON true
 LEFT JOIN LATERAL (
  SELECT * FROM automation_runs WHERE kind=job.kind ORDER BY sequence DESC LIMIT 1
 ) AS latest ON true
`;

export const dailyCatalogReportSql = `
 WITH report_day AS (
  SELECT ($1::timestamptz AT TIME ZONE 'Asia/Seoul')::date - 1 AS day
 ), bounds AS (
  SELECT day, day::timestamp AT TIME ZONE 'Asia/Seoul' AS starts_at,
              (day + 1)::timestamp AT TIME ZONE 'Asia/Seoul' AS ends_at FROM report_day
 ), source AS (
  SELECT id::text AS id, kind, status, created_at,
         CASE WHEN kind='catalog_refresh' THEN details->'collected' ELSE details->'retired' END AS quantity
    FROM agent_runs CROSS JOIN bounds
   WHERE created_at >= starts_at AND created_at < ends_at
     AND (kind='catalog_cleanup' OR (kind='catalog_refresh' AND details->>'source'='musinsa_root_scan'))
 ), totals AS (
  SELECT count(*) FILTER (WHERE status='success') AS succeeded,
         count(*) FILTER (WHERE status='failed') AS failed,
         count(*) FILTER (WHERE status='no_data') AS no_data,
         sum(CASE WHEN kind='catalog_refresh' AND status='success' AND jsonb_typeof(quantity)='number'
                  THEN quantity::numeric END) AS collected,
         sum(CASE WHEN kind='catalog_cleanup' AND status='success' AND jsonb_typeof(quantity)='number'
                  THEN quantity::numeric END) AS retired,
         coalesce(jsonb_agg(to_jsonb(source) ORDER BY source.created_at, source.id), '[]'::jsonb) AS source_runs
    FROM source
 )
 INSERT INTO agent_runs (kind, status, details)
 SELECT '${dailyReportKind}',
        CASE WHEN succeeded > 0 THEN 'success' WHEN failed > 0 THEN 'failed' ELSE 'no_data' END,
        jsonb_strip_nulls(to_jsonb(totals) || jsonb_build_object(
         'report_date', day, 'period_start', starts_at, 'reference_at', ends_at, 'scheduled_at', $1::timestamptz,
         'reason', CASE WHEN succeeded > 0 THEN NULL
                        WHEN failed > 0 THEN 'source_runs_failed' ELSE 'no_daily_source_runs' END))
   FROM bounds CROSS JOIN totals
  WHERE NOT EXISTS (
   SELECT 1 FROM agent_runs
    WHERE kind='${dailyReportKind}' AND details->>'report_date'=day::text
  )
 RETURNING status, details->>'report_date' AS report_date
`;

async function runDailyCatalogReport(pool, scheduledAt) {
 const client = await pool.connect();
 try {
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(7100302)');
  const {rows:[report]} = await client.query(dailyCatalogReportSql,[scheduledAt]);
  await client.query('COMMIT');
  return report ?? {status:'already_recorded'};
 } catch (error) {
  await client.query('ROLLBACK');
  throw error;
 } finally {
  client.release();
 }
}

async function changeMemberRole(pool, actorId, memberId, role) {
 const client = await pool.connect();
 try {
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(7100301)');
  const change = async () => {
   const {rowCount:authorized} = await client.query("SELECT 1 FROM ooootd_admins WHERE user_id=$1 AND access_role='admin'",[actorId]);
   if (!authorized) return {status:403,error:'access_denied'};
   const {rows:[member]} = await client.query(`
    SELECT coalesce(a.access_role,'member') AS role
      FROM neon_auth."user" u LEFT JOIN ooootd_admins a ON a.user_id=u.id::text
     WHERE u.id=$1::text::uuid
   `,[memberId]);
   if (!member) return {status:404,error:'member_not_found'};
   if (member.role === role) return {status:200,role,changed:false,accessRetained:true};
   if (member.role === 'admin' && role !== 'admin') {
    const {rows:[count]} = await client.query(`
     SELECT count(*)::int AS admins FROM ooootd_admins a JOIN neon_auth."user" u ON u.id::text=a.user_id
      WHERE a.access_role='admin'
    `);
    if (count.admins < 2) return {status:409,error:'last_admin'};
   }
   if (role === 'member') {
    await client.query('DELETE FROM ooootd_admins WHERE user_id=$1',[memberId]);
   } else {
    await client.query(`
     INSERT INTO ooootd_admins(user_id,access_role) VALUES($1,$2)
     ON CONFLICT(user_id) DO UPDATE SET access_role=excluded.access_role
    `,[memberId,role]);
   }
   await client.query('INSERT INTO ooootd_member_role_changes(actor_id,member_id,role) VALUES($1,$2,$3)',[actorId,memberId,role]);
   return {status:200,role,changed:true,accessRetained:role==='admin' || actorId!==memberId};
  };
  const result = await change();
  await client.query('COMMIT');
  return result;
 } catch (error) {
  await client.query('ROLLBACK');
  throw error;
 } finally {
  client.release();
 }
}

export function withOperations(app, {pool, verify, allowedOrigins}) {
 async function operations(request, origin, path) {
  const activity = path === activityPath;
  const siteActivity = path === siteActivityPath;
  const manageMembers = path === manageMembersPath;
  const acceptedMethods = manageMembers ? ['GET','POST'] : [activity || siteActivity ? 'POST' : 'GET'];
  const headers = {
   'Cache-Control': 'no-store',
   'Vary': 'Origin',
   'X-Content-Type-Options': 'nosniff',
  };
  const reply = (body, status = 200) => Response.json(body, {status, headers});
  if ((siteActivity || origin) && !allowedOrigins.includes(origin)) return reply({error:'origin_not_allowed'},403);
  if (origin) {
   headers['Access-Control-Allow-Origin'] = origin;
   headers['Access-Control-Allow-Headers'] = siteActivity || manageMembers ? 'Authorization, Content-Type' : 'Authorization';
   headers['Access-Control-Allow-Methods'] = [...acceptedMethods,'OPTIONS'].join(', ');
  }
  if (request.method === 'OPTIONS') return new Response(null, {status:204, headers});
  if (!acceptedMethods.includes(request.method)) return reply({error:'method_not_allowed'},405);

  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!token && !siteActivity) return reply({error:'login_required'},401);
  let userId;
  try {
   if (token) userId = await verify(token);
  } catch (error) {
   const code = /^[A-Z_]+$/.test(error?.code) ? error.code : 'unknown';
   console.info('OOOOTD administrator token rejected', code);
  }
  if (!userId && (!siteActivity || token)) return reply({error:'login_required'},401);

  try {
   if (siteActivity) {
    if (Number(request.headers.get('content-length')) > 2048) return reply({error:'invalid_activity'},413);
    const data = await request.json().catch(() => null);
    if (!data || typeof data.id !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(data.id) ||
       !['search','visit'].includes(data.type)) return reply({error:'invalid_activity'},400);
    const redacted = typeof data.query === 'string'
     ? data.query.replace(/[\w.+%-]+@[\w.-]+\.[a-z]{2,}/gi,'[이메일]')
       .replace(/(?:\+?\d[\d(). -]{6,}\d)/g,'[번호]').trim().slice(0,120) : '';
    if (data.type === 'search' && !redacted) return reply({error:'invalid_activity'},400);
    await pool.query(`
     INSERT INTO ooootd_site_activity (event_id,event_type,user_id,search_term)
      VALUES ($1::uuid,$2,$3,$4) ON CONFLICT(event_id) DO NOTHING
    `,[data.id,data.type,userId??null,data.type==='search'?redacted:null]);
    return reply({recorded:true});
   }
   if (activity) {
    const {rows:[member]} = await pool.query(`
     WITH recorded AS (
      INSERT INTO ooootd_member_logins (session_id, user_id, created_at)
       SELECT id::text, "userId"::text, "createdAt" FROM neon_auth.session
       WHERE "userId" = $1::text::uuid AND "expiresAt" > now()
         AND "createdAt" >= now() - interval '30 days'
      ON CONFLICT (session_id) DO NOTHING
     )
     SELECT coalesce((SELECT access_role FROM ooootd_admins WHERE user_id=$1),'member') AS role
    `,[userId]).catch(() => {
     console.error('OOOOTD member login recording failed');
     return pool.query("SELECT coalesce((SELECT access_role FROM ooootd_admins WHERE user_id=$1),'member') AS role",[userId]);
    });
    return reply({admin:member.role!=='member',canManageRoles:member.role==='admin'});
   }
   const {rows:[operator]} = await pool.query('SELECT access_role FROM ooootd_admins WHERE user_id=$1',[userId]);
   if (!operator) return reply({error:'access_denied'},403);
   const canManageRoles = operator.access_role==='admin';
   if (manageMembers) {
    if (!canManageRoles) return reply({error:'access_denied'},403);
    if (request.method === 'POST') {
     if (Number(request.headers.get('content-length')) > 1024) return reply({error:'invalid_role_change'},413);
     const data = await request.json().catch(() => null);
     if (!data || typeof data.memberId !== 'string' ||
         !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(data.memberId) ||
         !['member','manager','admin'].includes(data.role)) return reply({error:'invalid_role_change'},400);
     const {status,...result} = await changeMemberRole(pool,userId,data.memberId.toLowerCase(),data.role);
     return reply(result,status);
    }

    const params = new URL(request.url).searchParams;
    const search = (params.get('q')||'').trim().slice(0,120);
    const offset = Number(params.get('offset')||0);
    if (!Number.isSafeInteger(offset) || offset<0 || offset>100000) return reply({error:'invalid_offset'},400);
    const [list, history] = await Promise.all([
     pool.query(`
      SELECT u.id::text AS id, u.name,
             left(split_part(u.email,'@',1),2) || '***@' || split_part(u.email,'@',2) AS email,
             coalesce(a.access_role,'member') AS role
        FROM neon_auth."user" u LEFT JOIN ooootd_admins a ON a.user_id=u.id::text
       WHERE strpos(lower(u.email),lower($1))>0 OR strpos(lower(coalesce(u.name,'')),lower($1))>0
       ORDER BY u.name NULLS LAST, u.email, u.id LIMIT 21 OFFSET $2::integer
     `,[search,offset]),
     pool.query(`
      SELECT r.created_at,r.role,
             coalesce(actor.name,'탈퇴한 회원') || ' · ' || right(r.actor_id,6) AS actor,
             coalesce(member.name,'탈퇴한 회원') || ' · ' || right(r.member_id,6) AS member
        FROM ooootd_member_role_changes r
        LEFT JOIN neon_auth."user" actor ON actor.id::text=r.actor_id
        LEFT JOIN neon_auth."user" member ON member.id::text=r.member_id
       ORDER BY r.created_at DESC,r.id DESC LIMIT 30
     `),
    ]);
    return reply({members:list.rows.slice(0,20),hasMore:list.rows.length>20,history:history.rows});
   }
   if (path !== operationsPath) {
    console.info('OOOOTD administrator access confirmed');
    return reply({admin:true,canManageRoles});
   }

   const memberId = new URL(request.url).searchParams.get('member');
   if (memberId !== null && memberId !== 'guest' &&
       !/^(?:device:)?[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(memberId)) {
    return reply({error:'invalid_member'},400);
   }
   const [traffic, runs, catalog, memberLogins, visits, searches, members, closetActivity, automationReports] = await Promise.all([
    pool.query(`
     SELECT route, method, status, sum(requests)::int AS requests,
            round(sum(elapsed_ms) / sum(requests)::numeric)::int AS avg_ms,
            max(max_ms)::int AS max_ms
       FROM ooootd_api_minutes WHERE minute >= now() - interval '24 hours'
      GROUP BY route, method, status ORDER BY route, method, status
    `),
    pool.query(`
     SELECT id::text AS id, kind, status, created_at, details->'count' AS count,
            details->'collected' AS collected, details->'retired' AS retired
       FROM agent_runs WHERE kind IN ('catalog_refresh','catalog_expand','catalog_cleanup')
      ORDER BY id DESC LIMIT 30
    `),
    pool.query(`
     SELECT data->>'category' AS category, count(*)::int AS products
       FROM catalog_items WHERE active GROUP BY 1 ORDER BY 1
    `),
    pool.query(`
     SELECT l.created_at, coalesce(left(split_part(u.email,'@',1),2) || '***@' ||
            split_part(u.email,'@',2), '탈퇴한 회원') AS member
       FROM ooootd_member_logins l
       LEFT JOIN neon_auth."user" u ON u.id::text = l.user_id
      WHERE l.created_at >= now() - interval '30 days'
        AND ($1::text IS NULL OR l.user_id=$1)
      ORDER BY l.created_at DESC, l.session_id DESC LIMIT 100
    `,[memberId]),
    ...['visit','search'].map(type=>pool.query(`
     SELECT e.created_at,e.search_term,
            CASE WHEN e.user_id IS NULL THEN '비회원'
                 ELSE coalesce(left(split_part(u.email,'@',1),2) || '***@' ||
                               split_part(u.email,'@',2), '탈퇴한 회원') END AS member
       FROM ooootd_site_activity e
       LEFT JOIN neon_auth."user" u ON u.id::text=e.user_id
      WHERE e.event_type=$1 AND e.created_at >= now() - interval '30 days'
        AND ($2::text IS NULL OR e.user_id=$2 OR ($2='guest' AND e.user_id IS NULL))
      ORDER BY e.created_at DESC, e.event_id DESC LIMIT 100
    `,[type,memberId])),
    pool.query(`
     WITH recent_members AS (
      SELECT user_id FROM ooootd_member_logins WHERE created_at >= now() - interval '30 days'
      UNION
      SELECT user_id FROM ooootd_site_activity
       WHERE user_id IS NOT NULL AND created_at >= now() - interval '30 days'
      UNION
      SELECT coalesce(member_id,closet_owner_id) AS user_id FROM ooootd_closet_activity
       WHERE created_at >= now() - interval '30 days'
     )
     SELECT r.user_id AS id, u.name,
            coalesce(left(split_part(u.email,'@',1),2) || '***@' ||
                     split_part(u.email,'@',2),
                     CASE WHEN r.user_id LIKE 'device:%' THEN '브라우저 옷장' ELSE '탈퇴한 회원' END) AS member
       FROM recent_members r LEFT JOIN neon_auth."user" u ON u.id::text=r.user_id
      ORDER BY u.name NULLS LAST, member, r.user_id
    `),
    pool.query(`
     SELECT a.created_at,a.action,a.garment_name,a.category,
            coalesce(left(split_part(u.email,'@',1),2) || '***@' || split_part(u.email,'@',2),
                     CASE WHEN a.member_id IS NULL THEN '브라우저 옷장 · ' || right(a.closet_owner_id,6)
                          ELSE '탈퇴한 회원' END) AS member
       FROM ooootd_closet_activity a
       LEFT JOIN neon_auth."user" u ON u.id::text=a.member_id
      WHERE a.created_at >= now() - interval '30 days'
        AND ($1::text IS NULL OR a.member_id=$1 OR
             (a.member_id IS NULL AND (a.closet_owner_id=$1 OR $1='guest')))
      ORDER BY a.created_at DESC, a.id DESC LIMIT 100
    `,[memberId]),
    pool.query(automationReportsSql),
   ]);
   return reply({
    canManageRoles, traffic:traffic.rows, runs:runs.rows, catalog:catalog.rows, memberLogins:memberLogins.rows,
    visits:visits.rows, searches:searches.rows, members:members.rows, closetActivity:closetActivity.rows,
    automationReports:automationReports.rows,
   });
  } catch {
   console.error(siteActivity ? 'OOOOTD site activity recording failed' : activity ? 'OOOOTD member login recording failed' : 'OOOOTD operations report unavailable');
   return reply({error:'operations_unavailable'},503);
  }
 }

 return {async fetch(request, ...context) {
  const path = new URL(request.url).pathname.replace(/\/$/,'') || '/';
  const origin = request.headers.get('origin');
  const accessOnly = path === operationsPath + '/access';
  if (path === dailyReportPath && request.method === 'POST') {
   const delivery = await parseTriggerDelivery(request);
   if (!delivery.ok || delivery.invocation.type !== 'schedule' ||
       delivery.invocation.trigger.name !== 'daily-catalog-report') {
    return Response.json({error:'trigger_required'},{status:401});
   }
   const scheduledAt = delivery.invocation.data.scheduledAt;
   try {
    return Response.json(await runDailyCatalogReport(pool,scheduledAt));
   } catch (error) {
    const sqlstate = /^[A-Z0-9]{5}$/.test(error?.code) ? error.code : null;
    await pool.query("INSERT INTO agent_runs (kind,status,details) VALUES ($1,'failed',$2::jsonb)",
     [dailyReportKind,JSON.stringify({reason:'daily_report_unavailable',scheduled_at:scheduledAt,sqlstate})]).catch(() => {});
    return Response.json({error:'report_unavailable'},{status:503});
   }
  }
  if (accessOnly || path === operationsPath || path === activityPath || path === siteActivityPath || path === manageMembersPath) return operations(request, origin, path);
  const route = /^\/closet\/\d+$/.test(path) ? '/closet/:id' : path;
  const monitor = methods.has(request.method) &&
   (monitoredRoutes.has(route) || route === '/closet/:id') &&
   (!origin || allowedOrigins.includes(origin));
  if (!monitor) return app.fetch(request, ...context);

  const start = performance.now();
  const response = await app.fetch(request, ...context);
  const elapsed = Math.round(performance.now() - start);
  try {
   await pool.query(`
    INSERT INTO ooootd_api_minutes (minute, route, method, status, elapsed_ms, max_ms)
     VALUES (date_trunc('minute',now()),$1,$2,$3,$4::integer,$4::integer)
     ON CONFLICT (minute, route, method, status) DO UPDATE
     SET requests = ooootd_api_minutes.requests + 1,
         elapsed_ms = ooootd_api_minutes.elapsed_ms + excluded.elapsed_ms,
         max_ms = greatest(ooootd_api_minutes.max_ms, excluded.max_ms)
   `,[route,request.method,response.status,elapsed]);
   if (path === '/cron/catalog' && response.ok) {
    await pool.query("DELETE FROM ooootd_api_minutes WHERE minute < now() - interval '7 days'");
    await pool.query("DELETE FROM ooootd_member_logins WHERE created_at < now() - interval '30 days'");
    await pool.query("DELETE FROM ooootd_site_activity WHERE created_at < now() - interval '30 days'");
    await pool.query("DELETE FROM ooootd_closet_activity WHERE created_at < now() - interval '30 days'");
   }
  } catch (error) {
   console.error('OOOOTD operations metrics write failed', /^[A-Z0-9]{5}$/.test(error?.code) ? error.code : 'unknown');
  }
  return response;
 }};
}
