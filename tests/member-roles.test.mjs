import assert from 'node:assert/strict';
import test from 'node:test';
import {withOperations} from '../backend/operations.mjs';

const owner = '11111111-1111-1111-1111-111111111111';
const member = '22222222-2222-2222-2222-222222222222';

function fixture() {
 const roles = new Map([[owner,'admin']]);
 const changes = [];
 const statements = [];
 const client = {
  release(){},
  async query(sql, values = []) {
   statements.push(sql);
   const [id,role] = values;
   if (sql.startsWith('SELECT 1 FROM ooootd_admins')) return {rowCount:Number(roles.get(id)==='admin')};
   if (sql.startsWith('SELECT access_role')) return {rows:roles.has(id)?[{access_role:roles.get(id)}]:[]};
   if (sql.includes('AS admins FROM ooootd_admins')) return {rows:[{admins:[...roles.values()].filter(x=>x==='admin').length}]};
   if (sql.includes("coalesce(a.access_role,'member') AS role")) return {rows:[{role:roles.get(id)??'member'}]};
   if (sql.includes('AS role') && sql.includes('WHERE user_id=$1')) return {rows:[{role:roles.get(id)??'member'}]};
   if (sql.includes('INSERT INTO ooootd_admins')) roles.set(id,role);
   if (sql.startsWith('DELETE FROM ooootd_admins')) roles.delete(id);
   if (sql.startsWith('INSERT INTO ooootd_member_role_changes')) changes.push(values);
   return {rows:[]};
  },
 };
 const response = withOperations({},{
  pool:{query:client.query.bind(client),connect:async()=>client},
  verify:async token=>token,
  allowedOrigins:['https://ooootd.onrender.com'],
 });
 const get = (actor,path) => response.fetch(new Request('https://test.invalid'+path,{
  headers:{Authorization:'Bearer '+actor},
 }));
 const write = (actor,target,role) => response.fetch(new Request('https://test.invalid/admin/members',{
  method:'POST',headers:{Authorization:'Bearer '+actor,'Content-Type':'application/json'},
  body:JSON.stringify({memberId:target,role}),
 }));
 return {roles,changes,statements,get,write};
}

test('a manager can enter the console but cannot open or write the permissions endpoint',async()=>{
 const f = fixture();
 assert.equal((await f.get(member,'/admin/operations')).status,403);
 assert.equal((await f.write(owner,member,'manager')).status,200);
 const report = await f.get(member,'/admin/operations');
 assert.equal(report.status,200);
 assert.equal((await report.json()).canManageRoles,false);
 assert.equal((await f.get(member,'/admin/members')).status,403);
 assert.equal((await f.write(member,member,'admin')).status,403);
 assert.deepEqual(f.changes,[[owner,member,'manager']]);
});

test('the final full administrator remains protected even when a manager exists',async()=>{
 const f = fixture();
 await f.write(owner,member,'manager');
 for (const role of ['member','manager']) assert.equal((await f.write(owner,owner,role)).status,409);
 assert.equal(f.roles.get(owner),'admin');
 assert.equal(f.changes.length,1);
 assert(f.statements.some(sql=>sql.includes('pg_advisory_xact_lock')));
});

test('an unchanged grant is idempotent and a self-demotion disables permission editing',async()=>{
 const f = fixture();
 await f.write(owner,member,'admin');
 const unchanged = await f.write(owner,member,'admin');
 assert.equal((await unchanged.json()).changed,false);
 const downgraded = await f.write(owner,owner,'manager');
 assert.equal(downgraded.status,200);
 assert.equal((await downgraded.json()).accessRetained,false);
 assert.equal((await f.get(owner,'/admin/operations')).status,200);
 assert.equal((await f.get(owner,'/admin/members')).status,403);
 assert.deepEqual([...f.roles],[[owner,'manager'],[member,'admin']]);
 assert.deepEqual(f.changes,[[owner,member,'admin'],[owner,owner,'manager']]);
});
