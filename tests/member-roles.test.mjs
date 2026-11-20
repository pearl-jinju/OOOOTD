import assert from 'node:assert/strict';
import test from 'node:test';
import {withOperations} from '../backend/operations.mjs';

const owner = '11111111-1111-1111-1111-111111111111';
const member = '22222222-2222-2222-2222-222222222222';

function fixture() {
 const admins = new Set([owner]);
 const changes = [];
 const statements = [];
 const client = {
  release(){},
  async query(sql, values = []) {
   statements.push(sql);
   const [id] = values;
   if (sql.startsWith('SELECT 1 FROM ooootd_admins')) return {rowCount:Number(admins.has(id))};
   if (sql.includes('AS admins FROM ooootd_admins')) return {rows:[{admins:admins.size}]};
   if (sql.includes('AS admin')) return {rows:[{admin:admins.has(id)}]};
   if (sql.startsWith('INSERT INTO ooootd_admins')) admins.add(id);
   if (sql.startsWith('DELETE FROM ooootd_admins')) admins.delete(id);
   if (sql.startsWith('INSERT INTO ooootd_member_role_changes')) changes.push(values);
   return {rows:[]};
  },
 };
 const response = withOperations({},{
  pool:{query:client.query.bind(client),connect:async()=>client},
  verify:async token=>token,
  allowedOrigins:['https://ooootd.onrender.com'],
 });
 const request = (actor, target, role) => response.fetch(new Request('https://test.invalid/admin/members',{
  method:'POST',headers:{Authorization:'Bearer '+actor,'Content-Type':'application/json'},
  body:JSON.stringify({memberId:target,role}),
 }));
 return {admins,changes,statements,request};
}

test('only an administrator can assign roles and the final administrator cannot be removed',async()=>{
 const f = fixture();
 assert.equal((await f.request(member,member,'admin')).status,403);
 assert.equal((await f.request(owner,owner,'member')).status,409);
 assert.deepEqual(f.changes,[]);
 assert(f.admins.has(owner));
 const granted = await f.request(owner,member,'admin');
 assert.equal(granted.status,200);
 assert.equal((await granted.json()).changed,true);
 assert(f.admins.has(member));
 assert.deepEqual(f.changes,[[owner,member,'admin']]);
 assert(f.statements.some(sql=>sql.includes('pg_advisory_xact_lock')));
});

test('an idempotent grant does not duplicate history and revoking your own role reports loss of access',async()=>{
 const f = fixture();
 await f.request(owner,member,'admin');
 const unchanged = await f.request(owner,member,'admin');
 assert.equal((await unchanged.json()).changed,false);
 const revoked = await f.request(owner,owner,'member');
 assert.equal(revoked.status,200);
 assert.equal((await revoked.json()).accessRetained,false);
 assert.deepEqual([...f.admins],[member]);
 assert.deepEqual(f.changes,[[owner,member,'admin'],[owner,owner,'member']]);
});
