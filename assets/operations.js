export function connectOperations(auth, apiUrl) {
 const panel = document.getElementById('operations');
 const open = document.getElementById('operations-open');
 const status = document.getElementById('operations-status');
 const report = document.getElementById('operations-report');
 const accountStatus = document.getElementById('operations-account-status');
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
  status.textContent = accountStatus.textContent = '';
  for (const id of ['operations-traffic','operations-runs','operations-catalog','operations-member-logins']) {
   document.getElementById(id).replaceChildren();
  }
  try {
   const session = await auth.getSession();
   if (current !== revision) return;
   if (!session.data?.user) {
    panel.close();
    return;
   }
   const accessPath = loadReport ? '/admin/operations' : '/member/activity';
   const useToken = token => fetch(apiUrl + accessPath, {
    method: loadReport ? 'GET' : 'POST',
    headers: {Authorization: 'Bearer ' + token},
    signal: AbortSignal.timeout(15000),
   });
   const sessionToken = session.data.session?.token;
   let response;
   if (typeof sessionToken === 'string' && /^[\w-]+\.[\w-]+\.[\w-]+$/.test(sessionToken)) {
    response = await useToken(sessionToken);
   }
   if (current !== revision) return;
   if (!response || response.status === 401) {
    const result = await auth.token();
    if (current !== revision) return;
    const token = result.data?.token;
    if (result.error || !token) throw Error('Session token unavailable');
    if (token !== sessionToken || !response) response = await useToken(token);
   }
   const data = await response.json();
   if (current !== revision) return;
   if (!response.ok) {
    if (response.status !== 403 || loadReport) throw Error('Admin request failed');
    return;
   }
   if (!loadReport) {
    open.hidden = data.admin !== true;
    return;
   }
   open.hidden = false;
   const memberLogins = data.memberLogins ?? [];
   document.getElementById('operations-member-empty').hidden = memberLogins.length > 0;
   rows('operations-member-logins', memberLogins.map(event => ({
    ...event, created_at: new Date(event.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}),
   })), ['created_at','member']);
   rows('operations-traffic', data.traffic, ['method','route','status','requests','avg_ms','max_ms']);
   rows('operations-runs', data.runs.map(run => ({
    ...run, created_at: new Date(run.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}),
   })), ['created_at','kind','status','collected','count']);
   rows('operations-catalog', data.catalog, ['category','products']);
   report.hidden = false;
  } catch {
   if (current !== revision) return;
   if (panel.open) status.textContent = '운영 데이터를 불러오지 못했습니다.';
   else accountStatus.textContent = '계정 권한을 확인하지 못했어요. 내 계정 메뉴를 다시 열어 주세요.';
  }
 }

 document.getElementById('account-menu').addEventListener('click', () => {
  if (!document.getElementById('account-content').hidden && open.hidden) refresh();
 });
 open.addEventListener('click', () => {
  if (!panel.open) panel.showModal();
  refresh(true);
 });
 document.getElementById('operations-refresh').addEventListener('click',() => refresh(true));
 return refresh;
}
