import test from 'node:test';
import assert from 'node:assert/strict';
import { evidenceAction, resolveReportEvidence } from './reportEvidence.js';
import { reportActionFromLocation, reportActionUrl } from './reportViews.js';
import { buildFoundationalWeeklyPlan } from './thisWeekTraining.js';
import { readPersistedReport } from './reportPersistence.js';
import { navigateApp } from '../appNavigation.js';

const target = { recommendationId:'old:opening', opening:'Opening', openingName:'Opening', role:'played_as_white', repertoireRole:'white', verdict:'repair', sample:{games:10,scoreRate:20}, evidenceGameIds:['missing'] };
const report = { analysisCompleted:true, username:'Restored', gamesAnalysed:10, topOpenings:[{name:'Opening',games:10}], reportDecision:{schemaVersion:5,recommendations:[target],primaryProblem:target,trainingPriority:null,primaryAction:{type:'collect_more_games',label:'Collect more games',recommendationId:null}} };

test('valid evidence resolves to the actual retained recommendation', () => {
  const result = resolveReportEvidence(report, evidenceAction(target));
  assert.equal(result.status, 'available');
  assert.equal(result.target, target);
});
test('absent and explicit null evidence are bounded states', () => {
  for (const value of [null, {}, {reportDecision:null}, {reportDecision:{recommendations:[null]}}]) {
    assert.equal(resolveReportEvidence(value, evidenceAction(null)).status, 'absent');
    assert.equal(resolveReportEvidence(value, evidenceAction(target)).target, null);
  }
});
test('compact and older unversioned cloud/local reports retain summary evidence without inventing games', () => {
  for (const saved of [report, {analysis:report}, {schemaVersion:1,analysis:report}]) {
    const restored = readPersistedReport({getItem:()=>JSON.stringify(saved)});
    assert.equal(restored.ok, true);
    const result = resolveReportEvidence(restored.analysis, evidenceAction(target));
    assert.equal(result.status, 'available');
    assert.match(result.message, /source games may be unavailable/);
    assert.equal(buildFoundationalWeeklyPlan({report:restored.analysis}), null);
  }
  assert.ok(buildFoundationalWeeklyPlan({report:{analysisCompleted:true}})?.foundation);
});
test('stale, conflicting, and unmatched targets never fall back to a different opening', () => {
  const captured = evidenceAction(target,'summary',{analysisId:'old'});
  assert.equal(resolveReportEvidence({...report,analysisId:'current'},captured).status,'stale');
  for (const changes of [{decisionId:'gone'},{openingId:'gone'},{diagnosisId:'gone'},{repertoireRole:'black_vs_e4'},{reportId:'old'}]) {
    const result = resolveReportEvidence({...report,analysisId:'current'}, {...evidenceAction(target),...changes});
    assert.equal(result.status, 'stale');
    assert.equal(result.target, null);
  }
});
test('legacy name-only evidence targets are supported', () => {
  assert.equal(resolveReportEvidence(report,evidenceAction({openingName:'Opening',role:'played_as_white'})).target,target);
  assert.equal(resolveReportEvidence(report,evidenceAction({openingName:'Opening',slot:'white_primary'})).target,target);
  assert.equal(evidenceAction({canonical_opening_id:'saved-opening'}).openingId,'saved-opening');
});
test('ambiguous names and unverifiable report identities do not select an arbitrary target', () => {
  const ambiguous={reportDecision:{recommendations:[target,{...target,recommendationId:'second'}]}};
  assert.equal(resolveReportEvidence(ambiguous,evidenceAction({openingName:'Opening'})).status,'stale');
  assert.equal(resolveReportEvidence(report,{...evidenceAction(target),reportId:'unverifiable'}).status,'stale');
});
test('older report-level evidence links remain overviews, not unmatched recommendation targets', () => {
  const current={...report,reportDecision:{...report.reportDecision,decisionId:'report:decision'}};
  assert.equal(resolveReportEvidence(current,{...evidenceAction(null),decisionId:'report:decision'}).status,'overview');
});
test('Android same-origin navigation retains identity, supports restore and deduplicates repeated presses', () => {
  const previous = globalThis.window;
  const events = [];
  let pushes = 0;
  const location = new URL('https://localhost/train');
  globalThis.window = {location,history:{pushState(_state,_title,url){pushes++;location.href=new URL(url,location).href;}},dispatchEvent:event=>events.push(event),setTimeout:()=>0};
  try {
    const action = evidenceAction(target);
    const route = {view:'report',path:'/report',target:'evidence-table',reportAction:action};
    for(let i=0;i<5;i++) navigateApp(route,{setView:view=>assert.equal(view,'report'),delays:[]});
    assert.equal(pushes,1);
    assert.equal(location.origin,'https://localhost');
    assert.equal(location.hash,'#report-evidence');
    assert.deepEqual(reportActionFromLocation(location),action);
    assert.equal(resolveReportEvidence(report,reportActionFromLocation(location)).target,target);
    assert.equal(events.length,5);
    assert.equal(reportActionUrl(action,location),location.pathname+location.search+location.hash);
  } finally {globalThis.window=previous;}
});
