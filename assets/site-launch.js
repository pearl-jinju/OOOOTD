const storagePrefix = 'ooootd-launch:';
const maxAge = 7 * 24 * 60 * 60 * 1000;
const maxPending = 100;
const flushBatch = 10;

export function createLaunchRecorder({event, storage, getApiUrl, send, now = Date.now}) {
 const storageKey = id => storagePrefix + id;
 let current = event;
 let flushing;
 let pendingMemberToken;

 function remove(id) {
  try { storage?.removeItem(storageKey(id)); } catch {}
  if (current?.id === id) current = null;
 }

 if (event) {
  try { storage?.setItem(storageKey(event.id),JSON.stringify(event)); } catch {}
 }

 function pending() {
  const entries = new Map();
  if (current) entries.set(current.id,current);
  try {
   for (let index = 0; index < (storage?.length ?? 0); index++) {
    const key = storage.key(index);
    if (!key?.startsWith(storagePrefix)) continue;
    let record;
    try { record = JSON.parse(storage.getItem(key)); } catch { continue; }
    if (record?.id && key === storageKey(record.id)) entries.set(record.id,record);
   }
  } catch {}
  const valid = [...entries.values()]
   .sort((a,b) => (a.id === current?.id ? -1 : b.id === current?.id ? 1 : Date.parse(b.occurredAt) - Date.parse(a.occurredAt)))
   .filter(record => {
    const time = Date.parse(record.occurredAt);
    const age = now() - time;
    if (Number.isFinite(time) && age >= -300000 && age <= maxAge) return true;
    remove(record.id);
    return false;
   });
  for (const record of valid.splice(maxPending)) remove(record.id);
  return valid;
 }

 async function transmit(apiUrl, record, token) {
  try {
   const result = await send(apiUrl,record,token);
   if (result.ok) remove(record.id);
   return result;
  } catch {
   return null;
  }
 }

 async function flush() {
  if (flushing) return flushing;
  flushing = (async () => {
   const records = pending();
   if (!records.length && !pendingMemberToken) return false;
   const apiUrl = await getApiUrl();
   if (pendingMemberToken && event) {
    const token = pendingMemberToken;
    const result = await transmit(apiUrl,event,token);
    if (pendingMemberToken === token && (result?.ok || [401,403].includes(result?.status))) pendingMemberToken = undefined;
   }
   for (const record of records.slice(0,flushBatch)) {
    if (record.id === event?.id && !current) continue;
    if (!(await transmit(apiUrl,record))?.ok) break;
   }
   return Boolean(pending().length || pendingMemberToken);
  })().finally(() => { flushing = undefined; });
  return flushing;
 }

 return {
  flush,
  attachMember(token) {
   if (event && token) pendingMemberToken = token;
  },
 };
}

let launch;
let retryTimer;
let delay = 5000;
let configRequest;

async function getApiUrl() {
 configRequest ??= fetch('/cloud-config.json',{signal:AbortSignal.timeout(5000)}).then(async response => {
  if (!response.ok) throw Error('Application configuration unavailable');
  const {apiUrl} = await response.json();
  if (typeof apiUrl !== 'string') throw Error('Application API unavailable');
  return apiUrl;
 }).catch(error => {
  configRequest = undefined;
  throw error;
 });
 return configRequest;
}

function tryDelivery() {
 if (!launch) return;
 clearTimeout(retryTimer);
 const reschedule = () => {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = setTimeout(tryDelivery,delay);
  delay = Math.min(2 * delay,60000);
 };
 void launch.flush().then(waiting => {
  if (waiting) reschedule();
  else delay = 5000;
 },reschedule);
}

export function attachLaunchMember(token) {
 launch?.attachMember(token);
 tryDelivery();
}

if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
 let storage;
 try { storage = window.localStorage; } catch {}
 launch = createLaunchRecorder({
  event:{id:crypto.randomUUID(),type:'visit',occurredAt:new Date().toISOString()},
  storage,
  getApiUrl,
  send:(apiUrl,record,token) => fetch(apiUrl+'/site/activity',{
   method:'POST',
   headers:token ? {'Content-Type':'text/plain','Authorization':'Bearer '+token} : {'Content-Type':'text/plain'},
   body:JSON.stringify(record),keepalive:true,signal:AbortSignal.timeout(8000),
  }),
 });
 window.addEventListener('online',tryDelivery);
 window.addEventListener('pageshow',tryDelivery);
 document.addEventListener('visibilitychange',() => {
  if (document.visibilityState === 'visible') tryDelivery();
 });
 tryDelivery();
}
