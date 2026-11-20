const monitoredRoutes = new Set([
 '/weather', '/catalog', '/catalog/expand', '/cron/catalog', '/session',
 '/session/transfer', '/closet', '/profile', '/analyze', '/prices',
]);
const methods = new Set(['GET', 'POST', 'PUT', 'DELETE']);
const operationsPath = '/admin/operations';
const activityPath = '/member/activity';
const siteActivityPath = '/site/activity';

export function withOperations(app, {pool, verify, allowedOrigins}) {
 async function operations(request, origin, path) {
  const activity = path === activityPath;
  const siteActivity = path === siteActivityPath;
  const method = activity || siteActivity ? 'POST' : 'GET';
  const headers = {
   'Cache-Control': 'no-store',
   'Vary': 'Origin',
   'X-Content-Type-Options': 'nosniff',
  };
  const reply = (body, status = 200) => Response.json(body, {status, headers});
  if ((siteActivity || origin) && !allowedOrigins.includes(origin)) return reply({error:'origin_not_allowed'},403);
  if (origin) {
   headers['Access-Control-Allow-Origin'] = origin;
   headers['Access-Control-Allow-Headers'] = siteActivity ? 'Authorization, Content-Type' : 'Authorization';
   headers['Access-Control-Allow-Methods'] = method + ', OPTIONS';
  }
  if (request.method === 'OPTIONS') return new Response(null, {status:204, headers});
  if (request.method !== method) return reply({error:'method_not_allowed'},405);

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
     SELECT EXISTS(SELECT 1 FROM ooootd_admins WHERE user_id=$1) AS admin
    `,[userId]).catch(() => {
     console.error('OOOOTD member login recording failed');
     return pool.query('SELECT EXISTS(SELECT 1 FROM ooootd_admins WHERE user_id=$1) AS admin',[userId]);
    });
    return reply({admin:member.admin});
   }
   const {rowCount} = await pool.query('SELECT 1 FROM ooootd_admins WHERE user_id=$1',[userId]);
   if (!rowCount) return reply({error:'access_denied'},403);
   if (path !== operationsPath) {
    console.info('OOOOTD administrator access confirmed');
    return reply({admin:true});
   }

   const [traffic, runs, catalog, memberLogins, visits, searches] = await Promise.all([
    pool.query(`
     SELECT route, method, status, sum(requests)::int AS requests,
            round(sum(elapsed_ms) / sum(requests)::numeric)::int AS avg_ms,
            max(max_ms)::int AS max_ms
       FROM ooootd_api_minutes WHERE minute >= now() - interval '24 hours'
      GROUP BY route, method, status ORDER BY route, method, status
    `),
    pool.query(`
     SELECT kind, status, created_at, details->'count' AS count,
            details->'collected' AS collected
       FROM agent_runs WHERE kind IN ('catalog_refresh','catalog_expand')
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
      ORDER BY l.created_at DESC, l.session_id DESC LIMIT 100
    `),
    ...['visit','search'].map(type=>pool.query(`
     SELECT e.created_at,e.search_term,
            CASE WHEN e.user_id IS NULL THEN '비회원'
                 ELSE coalesce(left(split_part(u.email,'@',1),2) || '***@' ||
                               split_part(u.email,'@',2), '탈퇴한 회원') END AS member
       FROM ooootd_site_activity e
       LEFT JOIN neon_auth."user" u ON u.id::text=e.user_id
      WHERE e.event_type=$1 AND e.created_at >= now() - interval '30 days'
      ORDER BY e.created_at DESC, e.event_id DESC LIMIT 100
    `,[type])),
   ]);
   return reply({
    traffic:traffic.rows, runs:runs.rows, catalog:catalog.rows, memberLogins:memberLogins.rows,
    visits:visits.rows, searches:searches.rows,
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
  if (accessOnly || path === operationsPath || path === activityPath || path === siteActivityPath) return operations(request, origin, path);
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
   }
  } catch (error) {
   console.error('OOOOTD operations metrics write failed', /^[A-Z0-9]{5}$/.test(error?.code) ? error.code : 'unknown');
  }
  return response;
 }};
}
