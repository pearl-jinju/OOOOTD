import assert from 'node:assert/strict';
import test from 'node:test';
import {createLaunchRecorder} from '../assets/site-launch.js';

const event = {
 id:'12345678-1234-1234-1234-123456789abc',type:'visit',occurredAt:'2026-11-23T07:00:00.000Z',
};
const now = () => Date.parse('2026-11-23T07:01:00.000Z');
const getApiUrl = async () => 'https://api.invalid';

function fakeStorage() {
 const data = new Map();
 return {
  get length(){return data.size},
  key:index=>[...data.keys()][index],
  getItem:key=>data.get(key),
  setItem:(key,value)=>data.set(key,value),
  removeItem:key=>data.delete(key),
 };
}

test('retains an offline launch across reloads and removes it only after DB acknowledgement', async () => {
 const storage = fakeStorage();
 const offline = createLaunchRecorder({event,storage,getApiUrl,now,send:async () => {throw Error('offline')}});
 assert.equal(await offline.flush(),true);
 assert.equal(storage.length,1);
 const acknowledged = [];
 const recovered = createLaunchRecorder({storage,getApiUrl,now,send:async (url,record) => {
  acknowledged.push(record);
  return {ok:true};
 }});
 assert.equal(await recovered.flush(),false);
 assert.deepEqual(acknowledged,[event]);
 assert.equal(storage.length,0);
});

test('a rejected member token still allows the same launch to be recorded anonymously', async () => {
 const attempts = [];
 const recorder = createLaunchRecorder({event,storage:fakeStorage(),getApiUrl,now,send:async (url,record,token) => {
  attempts.push([record.id,token]);
  return token ? {ok:false,status:401} : {ok:true};
 }});
 recorder.attachMember('expired-token');
 assert.equal(await recorder.flush(),false);
 assert.deepEqual(attempts,[[event.id,'expired-token'],[event.id,undefined]]);
});
