export function connectAccount(auth, onSessionChange) {
 const byId = id => document.getElementById('account-' + id);
 const panel = byId('panel');
 if (!panel) return;
 const form = byId('form'), email = byId('email'), name = byId('name');
 const password = byId('password'), submit = byId('submit'), mode = byId('mode');
 const signOut = byId('sign-out'), status = byId('status');
 let signingUp = false;

 function showUser(user) {
  byId('label').textContent = user ? '내 계정' : '로그인 · 회원가입';
  form.hidden = Boolean(user);
  signOut.hidden = !user;
  status.textContent = user ? '로그인되었습니다.' : '';
 }
 function showMode() {
  byId('name-label').hidden = !signingUp;
  name.required = signingUp;
  submit.textContent = signingUp ? '가입하기' : '로그인';
  mode.textContent = signingUp ? '로그인으로 돌아가기' : '회원가입';
  password.autocomplete = signingUp ? 'new-password' : 'current-password';
  password.minLength = signingUp ? 8 : 0;
  password.value = '';
  status.textContent = '';
 }
 function busy(value) {
  submit.disabled = value;
  mode.disabled = value;
  signOut.disabled = value;
 }
 if (!auth) {
  form.hidden = true;
  status.textContent = '계정 서비스 설정이 필요합니다.';
  return;
 }
 mode.addEventListener('click', () => { signingUp = !signingUp; showMode(); });
 form.addEventListener('submit', async event => {
  event.preventDefault();
  busy(true);
  status.textContent = '처리 중입니다.';
  const credentials = {email:email.value.trim(), password:password.value};
  try {
   const result = signingUp
    ? await auth.signUp.email({...credentials,name:name.value.trim(),callbackURL:location.origin+'/'})
    : await auth.signIn.email(credentials);
   if (result.error) throw Error();
   const session = await auth.getSession();
   if (session.error) throw Error();
   showUser(session.data?.user);
   if (!session.data?.user) status.textContent = '이메일을 확인한 뒤 로그인해 주세요.';
   onSessionChange();
  } catch {
   status.textContent = signingUp ? '가입에 실패했습니다. 입력 정보와 이메일을 확인해 주세요.' : '로그인에 실패했습니다. 이메일과 비밀번호를 확인해 주세요.';
  } finally {
   password.value = '';
   busy(false);
  }
 });
 signOut.addEventListener('click', async () => {
  busy(true);
  try {
   const result = await auth.signOut();
   if (result.error) throw Error();
   signingUp = false;
   form.reset();
   showMode();
   showUser(null);
   onSessionChange();
  } catch {
   status.textContent = '로그아웃에 실패했습니다. 다시 시도해 주세요.';
  } finally { busy(false); }
 });
 busy(true);
 auth.getSession().then(result => {
  if (result.error) throw Error();
  showUser(result.data?.user);
  if (result.data?.user) onSessionChange();
 }).catch(() => {
  status.textContent = '로그인 상태를 불러오지 못했습니다.';
 }).finally(() => busy(false));
}
