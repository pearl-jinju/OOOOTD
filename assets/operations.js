export function connectOperations(auth, apiUrl) {
 const panel = document.getElementById('operations');
 const open = document.getElementById('operations-open');
 const status = document.getElementById('operations-status');
 const report = document.getElementById('operations-report');
 let revision = 0;

 function rows(id, records, keys) {
  const body = document.getElementById(id);
  body.replaceChildren();
  for (const record of records) {
   const row = body.insertRow();
   for (const key of keys) row.insertCell().textContent = record[key] ?? '—';
  }
 }

 async function refresh(loadReport = false) {
  const current = ++revision;
  if (!loadReport) open.hidden = true;
  report.hidden = true;
  status.textContent = '';
  for (const id of ['operations-traffic','operations-runs','operations-catalog']) {
   document.getElementById(id).replaceChildren();
  }
  try {
   const session = await auth.getSession();
   if (current !== revision) return;
   if (!session.data?.user) {
    panel.close();
    return;
   }
   const result = await auth.token();
   if (current !== revision) return;
   const token = result.data?.token;
   if (result.error || !token) throw Error('Session token unavailable');
   const accessPath = loadReport ? '/admin/operations' : '/admin/operations/access';
   const response = await fetch(apiUrl + accessPath, {
    headers: {Authorization: 'Bearer ' + token},
    signal: AbortSignal.timeout(15000),
   });
   const data = await response.json();
   if (current !== revision) return;
   if (!response.ok) {
    if (panel.open) status.textContent = '운영 데이터를 불러오지 못했습니다.';
    return;
   }
   open.hidden = false;
   if (!loadReport) return;
   rows('operations-traffic', data.traffic, ['method','route','status','requests','avg_ms','max_ms']);
   rows('operations-runs', data.runs.map(run => ({
    ...run, created_at: new Date(run.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}),
   })), ['created_at','kind','status','collected','count']);
   rows('operations-catalog', data.catalog, ['category','products']);
   report.hidden = false;
  } catch {
   if (current === revision && panel.open) status.textContent = '운영 데이터를 불러오지 못했습니다.';
  }
 }

 open.addEventListener('click', () => {
  if (!panel.open) panel.showModal();
  refresh(true);
 });
 document.getElementById('operations-refresh').addEventListener('click',() => refresh(true));
 return refresh;
}
