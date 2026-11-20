export function connectOperations(auth, apiUrl) {
 const panel = document.getElementById('operations');
 const open = document.getElementById('operations-open');
 const status = document.getElementById('operations-status');
 const verifyForm = document.getElementById('operations-verify');
 const send = document.getElementById('operations-send');
 const report = document.getElementById('operations-report');
 const otp = document.getElementById('operations-otp');
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
  verifyForm.hidden = report.hidden = true;
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
   if (response.status === 403 && data.error === 'email_verification_required') {
    verifyForm.hidden = open.hidden = false;
    return;
   }
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

 async function emailAction(action, onFailure) {
  const current = revision;
  const submit = verifyForm.querySelector('[type="submit"]');
  send.disabled = submit.disabled = true;
  try {
   const session = await auth.getSession();
   if (!session.data?.user?.email || current !== revision) return;
   await action(session.data.user.email, current);
  } catch {
   if (current === revision) status.textContent = onFailure;
  } finally {
   send.disabled = submit.disabled = false;
  }
 }

 send.addEventListener('click', () => emailAction(async (email,current) => {
  const result = await auth.emailOtp.sendVerificationOtp({email,type:'email-verification'});
  if (result.error) throw Error();
  if (current === revision) {
   status.textContent = '인증 코드를 보냈어요.';
   otp.focus();
  }
 },'인증 코드를 보내지 못했어요. 잠시 뒤 다시 시도해 주세요.'));

 verifyForm.addEventListener('submit', event => {
  event.preventDefault();
  const code = otp.value.trim();
  emailAction(async (email,current) => {
   const result = await auth.emailOtp.verifyEmail({email,otp:code});
   if (result.error) throw Error();
   if (current !== revision) return;
   verifyForm.reset();
   await refresh(true);
  },'인증에 실패했어요. 코드와 만료 시간을 확인해 주세요.');
 });

 open.addEventListener('click', () => {
  if (!panel.open) panel.showModal();
  refresh(true);
 });
 document.getElementById('operations-refresh').addEventListener('click',() => refresh(true));
 return refresh;
}
