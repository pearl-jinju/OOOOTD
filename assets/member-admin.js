const roles = {member:'일반 회원',manager:'중간 관리자',admin:'관리자'};

export function connectMemberAdmin(request, onAccessLost) {
 const byId = id => document.getElementById('admin-'+id);
 const form = byId('members-search');
 const query = byId('members-query');
 const members = byId('members-rows');
 const history = byId('role-history');
 const status = byId('members-status');
 const previous = byId('members-prev');
 const next = byId('members-next');
 let revision = 0;
 let offset = 0;

 async function save(member, role, button) {
  const before = revision;
  role.disabled = button.disabled = true;
  try {
   const response = await request('/admin/members','POST',{memberId:member.id,role:role.value});
   const data = await response.json();
   if (!data.accessRetained && response.ok) {
    onAccessLost(data.role);
    return;
   }
   if (before !== revision) return;
   if (!response.ok) {
    status.textContent = data.error === 'last_admin'
     ? '마지막 관리자의 권한은 해제할 수 없어요.' : '권한을 저장하지 못했어요.';
    return;
   }
   await load('권한을 저장했어요.');
  } catch {
   if (before === revision) status.textContent = '권한을 저장하지 못했어요.';
  } finally {
   role.disabled = false;
   button.disabled = role.value === member.role;
  }
 }

 function addMember(member) {
  const tr = members.insertRow();
  tr.insertCell().textContent = member.name || '이름 없음';
  tr.insertCell().textContent = member.email + ' · ' + member.id.slice(-6);
  const role = document.createElement('select');
  role.className = 'city-select';
  role.setAttribute('aria-label',(member.name||member.email) + ' 권한');
  for (const [value,label] of Object.entries(roles)) role.add(new Option(label,value));
  role.value = member.role;
  tr.insertCell().append(role);
  const button = document.createElement('button');
  button.className = 'admin-button';
  button.type = 'button';
  button.textContent = '저장';
  button.disabled = true;
  role.addEventListener('change',()=>{button.disabled=role.value===member.role;});
  button.addEventListener('click',()=>save(member,role,button));
  tr.insertCell().append(button);
 }

 async function load(message = '') {
  const current = ++revision;
  members.replaceChildren();
  history.replaceChildren();
  previous.disabled = next.disabled = true;
  status.textContent = '회원 목록을 불러오는 중…';
  try {
   const params = new URLSearchParams({q:query.value.trim(),offset});
   const response = await request('/admin/members?'+params);
   const data = await response.json();
   if (current !== revision) return;
   if (!response.ok) throw Error();
   for (const member of data.members) addMember(member);
   for (const event of data.history) {
    const tr = history.insertRow();
    const date = new Date(event.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'});
    for (const value of [date,event.actor,event.member,roles[event.role]]) tr.insertCell().textContent=value;
   }
   previous.disabled = offset===0;
   next.disabled = !data.hasMore;
   status.textContent = message || (data.members.length ? '' : '검색 조건에 맞는 회원이 없어요.');
  } catch {
   if (current === revision) status.textContent = '회원 목록을 불러오지 못했어요.';
  }
 }

 form.addEventListener('submit',event=>{event.preventDefault();offset=0;load();});
 previous.addEventListener('click',()=>{offset=Math.max(0,offset-20);load();});
 next.addEventListener('click',()=>{offset+=20;load();});

 return {load,reset() {
  revision++;
  offset=0;
  query.value='';
  status.textContent='';
  previous.disabled=next.disabled=true;
  members.replaceChildren();
  history.replaceChildren();
 }};
}
