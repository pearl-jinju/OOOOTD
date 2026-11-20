import {connectMemberAdmin} from './member-admin.js?v=tiers';

export async function closetMemberHeaders(auth,path,method) {
 if (!auth || !(path==='/closet' && method==='POST' || method==='DELETE' && /^\/closet\/\d+$/.test(path))) return {};
 try {
  const {data} = await auth.getSession();
  if (!data?.user) return {};
  let token = data.session?.token;
  if (typeof token !== 'string' || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token)) token = (await auth.token()).data?.token;
  return token ? {'X-OOOOTD-Member':token} : {};
 } catch {
  return {};
 }
}

export function connectOperations(auth, apiUrl) {
 const panel = document.getElementById('operations');
 const open = document.getElementById('operations-open');
 const status = document.getElementById('operations-status');
 const report = document.getElementById('operations-report');
 const accountStatus = document.getElementById('operations-account-status');
 const filter = document.getElementById('operations-member-filter');
 const memberSelect = document.getElementById('operations-member-select');
 const sectionTitle = document.getElementById('operations-section-title');
 const sectionButtons = [...panel.querySelectorAll('[data-operations-section]')];
 const views = [...panel.querySelectorAll('[data-operations-view]')];
 const memberViews = new Set(['logins','visits','searches','closet']);
 let revision = 0;
 let selectedView = 'overview';
 let reportAvailable = false;
 let canManageRoles = false;
 const manageButton = panel.querySelector('[data-operations-section="members"]');

 async function authorizedRequest(session,path,method = 'GET',body) {
  const send = token => fetch(apiUrl+path,{
   method, headers:{Authorization:'Bearer '+token,...(body ? {'Content-Type':'application/json'} : {})},
   body:body ? JSON.stringify(body) : undefined, signal:AbortSignal.timeout(15000),
  });
  const sessionToken = session.data.session?.token;
  let response;
  if (typeof sessionToken==='string' && /^[\w-]+\.[\w-]+\.[\w-]+$/.test(sessionToken)) {
   response = await send(sessionToken);
  }
  if (!response || response.status===401) {
   const result = await auth.token();
   const token = result.data?.token;
   if (result.error || !token) throw Error('Session token unavailable');
   if (token!==sessionToken || !response) response=await send(token);
  }
  return response;
 }

 const memberAdmin=connectMemberAdmin(async (path,method,body) => {
  const session=await auth.getSession();
  if (!session.data?.user) throw Error('Member session required');
  return authorizedRequest(session,path,method,body);
 },async role => {
  panel.close();
  await refresh();
  accountStatus.textContent=role==='manager' ? '중간 관리자 권한으로 변경됐어요.' : '일반 회원 권한으로 변경됐어요.';
 });

 function showView(section) {
  if (section==='members' && !canManageRoles) section='overview';
  selectedView = section;
  for (const button of sectionButtons) {
   const active = button.dataset.operationsSection === section;
   if (active) {
    button.setAttribute('aria-current','page');
    sectionTitle.textContent = button.textContent;
   } else {
    button.removeAttribute('aria-current');
   }
  }
  for (const view of views) view.hidden = view.dataset.operationsView !== section;
  filter.hidden = !reportAvailable || !memberViews.has(section);
  panel.querySelector('.admin-body').scrollTop = 0;
 }
 for (const button of sectionButtons) {
  button.addEventListener('click',() => {
   showView(button.dataset.operationsSection);
   if (selectedView==='members') memberAdmin.load();
  });
 }

 async function recordActivity(type, query) {
  const session = await auth.getSession();
  if (session.error) return;
  const user = session.data?.user;
  const sessionToken = session.data?.session?.token;
  const validSessionToken = typeof sessionToken === 'string' && /^[\w-]+\.[\w-]+\.[\w-]+$/.test(sessionToken);
  const body = JSON.stringify({id:crypto.randomUUID(),type,query});
  const send = token => fetch(apiUrl + '/site/activity', {
   method:'POST', headers:{'Content-Type':'application/json', ...(token ? {Authorization:'Bearer '+token} : {})},
   body, signal:AbortSignal.timeout(8000),
  });
  if (!user) {
   await send(null);
   return;
  }
  if (validSessionToken && (await send(sessionToken)).status !== 401) return;
  const result = await auth.token();
  if (!result.error && result.data?.token) await send(result.data.token);
 }
 document.getElementById('catalog-search-form').addEventListener('submit', event => {
  event.preventDefault();
  const query = document.getElementById('catalog-search').value.trim();
  if (query) recordActivity('search',query).catch(() => {});
 });
 recordActivity('visit').catch(() => {});

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
  if (!loadReport) {
   open.hidden = true;
   reportAvailable = false;
   canManageRoles = false;
   manageButton.hidden = true;
   memberAdmin.reset();
   memberSelect.value = '';
   showView('overview');
  }
  report.hidden = true;
  status.textContent = loadReport ? '운영 데이터를 불러오는 중…' : '';
  accountStatus.textContent = '';
  for (const id of ['operations-traffic','operations-runs','operations-catalog','operations-member-logins','operations-visits','operations-searches','operations-closet-activity']) {
   document.getElementById(id).replaceChildren();
  }
  try {
   const session = await auth.getSession();
   if (current !== revision) return;
   if (!session.data?.user) {
    panel.close();
    return;
   }
   const memberId = memberSelect.value;
   const accessPath = loadReport
    ? '/admin/operations' + (memberId ? '?member='+encodeURIComponent(memberId) : '')
    : '/member/activity';
   const response = await authorizedRequest(session,accessPath,loadReport ? 'GET' : 'POST');
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
   canManageRoles = data.canManageRoles === true;
   manageButton.hidden = !canManageRoles;
   if (selectedView==='members' && !canManageRoles) {
    memberAdmin.reset();
    showView('overview');
   }
   const options = data.members ?? [];
   memberSelect.replaceChildren(new Option('전체 회원과 비회원',''),new Option('비회원','guest'),
    ...options.map(member=>new Option(
     [member.name,member.member,member.id.slice(-6)].filter(Boolean).join(' · '),member.id)));
   memberSelect.value = memberId;
   const memberLogins = data.memberLogins ?? [];
   document.getElementById('operations-member-empty').hidden = memberLogins.length > 0;
   rows('operations-member-logins', memberLogins.map(event => ({
    ...event, created_at: new Date(event.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}),
   })), ['created_at','member']);
   for (const [type,keys] of [['visits',['created_at','member']],['searches',['created_at','member','search_term']]]) {
    const events = data[type] ?? [];
    document.getElementById('operations-'+type+'-empty').hidden = events.length > 0;
    rows('operations-'+type, events.map(event=>({
     ...event, created_at:new Date(event.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}),
    })), keys);
   }
   const closetActivity = data.closetActivity ?? [];
   document.getElementById('operations-closet-empty').hidden = closetActivity.length > 0;
   const categoryLabels = {outer:'아우터',top:'상의',bottom:'하의',shoes:'신발'};
   rows('operations-closet-activity', closetActivity.map(event=>({
    ...event,
    created_at:new Date(event.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}),
    action:event.action==='added'?'추가':'삭제',
    category:categoryLabels[event.category]??event.category,
   })), ['created_at','member','action','category','garment_name']);
   rows('operations-traffic', data.traffic, ['method','route','status','requests','avg_ms','max_ms']);
   rows('operations-runs', data.runs.map(run => ({
    ...run, created_at: new Date(run.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}),
   })), ['created_at','kind','status','collected','count']);
   rows('operations-catalog', data.catalog, ['category','products']);
   document.getElementById('operations-metric-members').textContent = options.filter(member=>!member.id.startsWith('device:')).length.toLocaleString('ko-KR');
   document.getElementById('operations-metric-requests').textContent =
    data.traffic.reduce((total,row)=>total + row.requests,0).toLocaleString('ko-KR');
   document.getElementById('operations-metric-products').textContent =
    data.catalog.reduce((total,row)=>total + row.products,0).toLocaleString('ko-KR');
   reportAvailable = true;
   report.hidden = false;
   status.textContent = '';
   filter.hidden = !memberViews.has(selectedView);
   if (selectedView==='members') memberAdmin.load();
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
 memberSelect.addEventListener('change',() => refresh(true));
 return refresh;
}
