export function connectAccount(auth, onSessionChange) {
 const byId = id => document.getElementById('account-' + id);
 const panel = byId('panel');
 if (!panel) return;
 const form = byId('form'), email = byId('email'), name = byId('name');
 const password = byId('password'), submit = byId('submit');
 const login = byId('login'), signup = byId('signup'), menu = byId('menu');
 const content = byId('content');
 const confirmation = byId('password-confirm'), google = byId('google');
 const signOut = byId('sign-out'), status = byId('status');
 let signingUp = false;

 function showUser(user) {
  login.hidden = signup.hidden = Boolean(user);
  menu.hidden = !user;
  updateExpanded();
  form.hidden = Boolean(user);
  signOut.hidden = !user;
  status.textContent = user ? '로그인되었습니다.' : '';
 }
 function showMode() {
  byId('name-label').hidden = !signingUp;
  name.required = signingUp;
  byId('password-confirm-label').hidden = !signingUp;
  confirmation.required = signingUp;
  confirmation.value = '';
  byId('password-hint').hidden = !signingUp;
  form.setAttribute('aria-label', signingUp ? '이메일 회원가입' : '이메일 로그인');
  submit.textContent = signingUp ? '가입하기' : '로그인';
  password.autocomplete = signingUp ? 'new-password' : 'current-password';
  password.minLength = signingUp ? 8 : 0;
  password.value = '';
  status.textContent = '';
 }
 function updateExpanded() {
  login.setAttribute('aria-expanded', String(!content.hidden && !login.hidden && !signingUp));
  signup.setAttribute('aria-expanded', String(!content.hidden && !signup.hidden && signingUp));
  menu.setAttribute('aria-expanded', String(!content.hidden && !menu.hidden));
 }
 function openForm(signupMode) {
  signingUp = signupMode;
  showMode();
  content.hidden = false;
  updateExpanded();
  if (auth) (signingUp ? name : email).focus({preventScroll: true});
  else status.textContent = '계정 서비스 설정이 필요합니다.';
 }
 login.addEventListener('click', () => openForm(false));
 signup.addEventListener('click', () => openForm(true));
 menu.addEventListener('click', () => {
  content.hidden = !content.hidden;
  updateExpanded();
 });
 function busy(value) {
  submit.disabled = value;
  login.disabled = value;
  signup.disabled = value;
  google.disabled = value;
  signOut.disabled = value;
 }
 if (!auth) {
  form.hidden = true;
  return;
 }
 form.addEventListener('submit', async event => {
  event.preventDefault();
  if (signingUp && password.value !== confirmation.value) {
   status.textContent = '비밀번호와 비밀번호 확인이 일치하지 않습니다.';
   confirmation.focus();
   return;
  }
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
   confirmation.value = '';
   busy(false);
  }
 });
 google.addEventListener('click', async () => {
  busy(true);
  status.textContent = 'Google 로그인으로 이동 중입니다.';
  try {
   const result = await auth.signIn.social({provider:'google', callbackURL:location.origin+'/'});
   if (result.error) throw Error();
  } catch {
   status.textContent = 'Google 로그인에 실패했습니다. 다시 시도해 주세요.';
  } finally {
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
   content.hidden = true;
   showUser(null);
   login.focus();
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
