import assert from 'node:assert/strict';
import test from 'node:test';
import {latestAutomationRun} from '../assets/automation-report.js';

const recorded = {
 id:'102', status:'no_data', created_at:'2026-11-23T18:17:20Z',
 details:{reason:'no_observations',github_run_id:'53',github_run_attempt:'1'},
};
const workflow = {
 id:53, status:'completed', conclusion:'success', run_attempt:1, run_started_at:'2026-11-23T18:17:00Z',
};

test('Actions success preserves a matching no-data result in the DB', () => {
 assert.equal(latestAutomationRun(recorded,workflow),recorded);
});

test('A failed retry without a DB record is the latest execution', () => {
 const retry = {...workflow,run_attempt:2,conclusion:'failure',run_started_at:'2026-11-23T18:45:00Z',
  failureReason:'운영 DB 연결 설정이 비어 있어요.'};
 const latest = latestAutomationRun(recorded,retry);
 assert.equal(latest.status,'failed');
 assert.equal(latest.details.message,retry.failureReason);
 assert.match(latest.url,/\/runs\/53$/);
});

test('An older Actions result does not override a more recent DB result', () => {
 assert.equal(latestAutomationRun(recorded,{...workflow,id:52}),recorded);
});
