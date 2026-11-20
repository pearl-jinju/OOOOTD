const monitoredRoutes = new Set([
 '/weather', '/catalog', '/catalog/expand', '/cron/catalog', '/session',
 '/session/transfer', '/closet', '/profile', '/analyze', '/prices',
]);
const methods = new Set(['GET', 'POST', 'PUT', 'DELETE']);
const operationsPath = '/admin/operations';

export function withOperations(app, {pool, verify, allowedOrigins}) {
 async function operations(request, origin) {
  const headers = {
   'Cache-Control': 'no-store',
   'Vary': 'Origin',
   'X-Content-Type-Options': 'nosniff',
  };
  const reply = (body, status = 200) => Response.json(body, {status, headers});
  if (origin && !allowedOrigins.includes(origin)) return reply({error:'origin_not_allowed'},403);
  if (origin) {
   headers['Access-Control-Allow-Origin'] = origin;
   headers['Access-Control-Allow-Headers'] = 'Authorization';
   headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
  }
  if (request.method === 'OPTIONS') return new Response(null, {status:204, headers});
  if (request.method !== 'GET') return reply({error:'method_not_allowed'},405);

  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  const userId = token ? await verify(token).catch(() => null) : null;
  if (!userId) return reply({error:'login_required'},401);

  try {
   const {rows:[admin]} = await pool.query(`
    SELECT u."emailVerified" AS verified
      FROM ooootd_admins a JOIN neon_auth."user" u ON u.id::text = a.user_id
      WHERE a.user_id = $1
   `,[userId]);
   if (!admin) return reply({error:'access_denied'},403);
   if (!admin.verified) return reply({error:'email_verification_required'},403);

   const [traffic, runs, catalog] = await Promise.all([
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
   ]);
   return reply({traffic:traffic.rows, runs:runs.rows, catalog:catalog.rows});
  } catch {
   console.error('OOOOTD operations report unavailable');
   return reply({error:'operations_unavailable'},503);
  }
 }

 return {async fetch(request, ...context) {
  const path = new URL(request.url).pathname.replace(/\/$/,'') || '/';
  const origin = request.headers.get('origin');
  if (path === operationsPath) return operations(request, origin);
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
   }
  } catch {
   console.error('OOOOTD operations metrics write failed');
  }
  return response;
 }};
}
