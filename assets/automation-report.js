const actionsUrl = 'https://github.com/pearl-jinju/OOOOTD/actions';
const actionsApi = 'https://api.github.com/repos/pearl-jinju/OOOOTD/actions';
const jobs = [
 {kind:'catalog_refresh', title:'상품 수집', runName:'catalog-collect', metric:'수집 상품', field:'collected'},
 {kind:'catalog_cleanup', title:'상품 정리', runName:'catalog-prune', metric:'추천에서 제외한 상품', field:'retired'},
];
const unsuccessful = new Set(['failure','timed_out','action_required','startup_failure','stale','cancelled','skipped','neutral']);
export const runStatus = {
 success:'성공', failed:'실패', no_data:'자료 없음', in_progress:'실행 중', queued:'대기 중',
 cancelled:'취소', skipped:'건너뜀',
};
const reasonLabels = {
 no_observations:'정리에 사용할 상품 관측 기록이 없어요.',
 github_failed:'Actions에서 실행이 실패했어요.',
 github_unrecorded:'운영 DB에 결과가 기록되지 않았어요.',
 github_pending:'Actions에서 작업이 끝나기를 기다리고 있어요.',
 github_cancelled:'Actions에서 실행이 취소되거나 건너뛰었어요.',
};
const dateFormat = new Intl.DateTimeFormat('ko-KR',{
 timeZone:'Asia/Seoul', dateStyle:'short', timeStyle:'medium',
});
export const formatRunTime = value => value ? dateFormat.format(new Date(value)) : '—';

export function latestAutomationRun(record, github) {
 if (!github) return record;
 const createdAt = github.run_started_at ?? github.created_at;
 const sameAttempt = record?.details?.github_run_id === String(github.id) &&
  Number(record?.details?.github_run_attempt) === github.run_attempt;
 if (sameAttempt && !unsuccessful.has(github.conclusion)) return record;
 if (sameAttempt && record.status === 'failed' && github.conclusion === 'failure') return record;
 if (!sameAttempt && record && new Date(record.created_at) >= new Date(createdAt)) return record;
 let status, reason;
 if (['failure','timed_out','action_required','startup_failure','stale'].includes(github.conclusion)) {
  status = 'failed';
  reason = 'github_failed';
 } else if (['cancelled','skipped','neutral'].includes(github.conclusion)) {
  status = github.conclusion === 'cancelled' ? 'cancelled' : 'skipped';
  reason = 'github_cancelled';
 } else if (github.status === 'completed') {
  status = 'no_data';
  reason = 'github_unrecorded';
 } else {
  status = github.status === 'in_progress' ? 'in_progress' : 'queued';
  reason = 'github_pending';
 }
 return {
  created_at:createdAt, status, details:github.failureReason ? {message:github.failureReason} : {reason},
  url:actionsUrl+'/runs/'+github.id,
 };
}

function runReason(run, job) {
 if (run.status === 'success') return job.kind === 'catalog_refresh' ? '상품 목록을 갱신했어요.' : '정리 기준을 적용했어요.';
 const details = run.details ?? {};
 return reasonLabels[details.reason] ?? details.message ??
  (details.sqlstate ? 'DB 오류 '+details.sqlstate : details.error ?? '기록된 사유가 없어요.');
}

export async function fetchAutomationRuns() {
 const workflow = actionsApi+'/workflows/catalog-maintenance.yml/runs';
 const response = await fetch(workflow+'?branch=main&per_page=100',{
  signal:AbortSignal.timeout(5000),
 });
 if (!response.ok) throw Error('Actions run history unavailable');
 const {workflow_runs:runs} = await response.json();
 return new Map(await Promise.all(jobs.map(async job => {
  const run = runs.filter(run => run.display_title === job.runName && Number.isSafeInteger(run.id))
   .sort((left,right) => new Date(right.run_started_at ?? right.created_at) -
                        new Date(left.run_started_at ?? left.created_at))[0];
  if (run?.conclusion === 'failure' && Number.isSafeInteger(run.run_attempt)) {
   try {
    const response = await fetch(`${actionsApi}/runs/${run.id}/attempts/${run.run_attempt}/jobs`,{
     signal:AbortSignal.timeout(3000),
    });
    if (response.ok) {
     const {jobs:attemptJobs} = await response.json();
     const step = attemptJobs.flatMap(item => item.steps ?? []).find(item => item.conclusion === 'failure');
     if (step) run.failureReason = step.name === 'Check database connection setting'
      ? '운영 DB 연결 설정이 비어 있어요.'
      : step.name+' 단계에서 실패했어요.';
    }
   } catch {
    // The run link is still available when the step lookup fails.
   }
  }
  return [job.kind,run];
 })));
}

function paragraph(text) {
 const p = document.createElement('p');
 p.textContent = text;
 return p;
}

export function renderAutomationReports(container, reports, githubRuns, openSource) {
 const rows = [];
 for (const job of jobs) {
  const report = reports.find(item => item.kind === job.kind);
  const success = report?.lastSuccess;
  const latest = latestAutomationRun(report?.latest, githubRuns?.get(job.kind));
  const block = document.createElement('section');
  const heading = document.createElement('h5');
  heading.textContent = job.title;
  const columns = document.createElement('div');
  columns.className = 'admin-report-columns';
  const left = document.createElement('div');
  const right = document.createElement('div');
  left.className = right.className = 'admin-metric';
  left.append(paragraph('마지막 성공 보고서'));
  if (success) {
   const value = success.details?.[job.field];
   if (Number.isFinite(value)) {
    const metric = document.createElement('button');
    metric.type = 'button';
    metric.className = 'admin-report-source';
    metric.textContent = value.toLocaleString('ko-KR')+'개';
    metric.setAttribute('aria-label', `${job.metric} ${metric.textContent}의 원본 실행 기록 열기`);
    metric.addEventListener('click', () => openSource(success));
    left.append(paragraph(job.metric), metric);
   } else {
    left.append(paragraph('보고서에 집계 숫자가 없어요.'));
   }
   left.append(paragraph('기준 시각 · '+formatRunTime(success.details?.reference_at ?? success.created_at)));
  } else {
   left.append(paragraph('성공 보고서가 아직 없어요.'));
  }
  right.append(paragraph('최신 실행'));
  if (latest) {
   const summary = paragraph([formatRunTime(latest.created_at),runStatus[latest.status] ?? latest.status,runReason(latest,job)].join(' · '));
   if (latest.url) {
    const link = document.createElement('a');
    link.href = latest.url;
    link.textContent = 'Actions 원본 기록';
    summary.append(' ',link);
   }
   right.append(summary);
  } else {
   right.append(paragraph('확인된 실행 기록이 없어요.'));
  }
  columns.append(left,right);
  block.append(heading,columns);
  rows.push(block);
 }
 container.replaceChildren(...rows);
}
