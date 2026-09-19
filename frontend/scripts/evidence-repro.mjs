import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { SAMPLE_REPORT } from '../src/fixtures/sampleReport.js';
import { MELMET_REGRESSION_FIXTURE } from '../src/lib/fixtures/melmetRegressionFixture.js';
const root = path.resolve(process.env.EVIDENCE_BUNDLE || '../.release-build/evidence-fix/v18-apk/assets/public');
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file = path.join(root, pathname.includes('.') ? pathname : 'index.html');
  try { const bytes = await readFile(file); res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream'); res.end(bytes); }
  catch { res.statusCode = 404; res.end(); }
});
await new Promise(resolve => server.listen(4189, '127.0.0.1', resolve));
const browser = await chromium.launch({headless:true});
try {
 const base={...(process.env.EVIDENCE_FUZZ ? MELMET_REGRESSION_FIXTURE : SAMPLE_REPORT),sampleMode:false,sample_mode:false,source:'restored',isDemo:false};
 const repair={recommendationId:'old:opening',opening:'Opening',openingName:'Opening',role:'played_as_white',repertoireRole:'white',verdict:'repair',sample:{games:10,scoreRate:20},evidenceGameIds:['missing']};
 const cases=process.env.EVIDENCE_FUZZ ? Object.fromEntries(Object.keys(base.reportDecision).map(key=>[key,{...base,analysis_game_index:[],reportDecision:{...base.reportDecision,[key]:null}}])) : {repair:{analysisCompleted:true,username:'Restored',gamesAnalysed:10,topOpenings:[{name:'Opening',games:10}],reportDecision:{schemaVersion:5,recommendations:[repair],primaryProblem:repair,trainingPriority:null,primaryAction:{type:'collect_more_games',label:'Collect more games',recommendationId:null}}},minimal:{analysisCompleted:true, username:'Restored', totalGames:10, top_openings:[], reportDecision:null}};
 for (const [name, report] of Object.entries(cases)) {
 const page = await browser.newPage({viewport:{width:390,height:844}});
 page.on('pageerror', e => console.log(name,'PAGEERROR',e.stack));
 page.on('console', m => {if(m.type()==='error') console.log(name,'CONSOLE',m.text().slice(0,1800));});
 await page.route('**/*', route => route.request().url().startsWith('http://127.0.0.1:4189') ? route.continue() : route.abort());
 await page.addInitScript(report => {localStorage.setItem('openingFit:lastAnalysis',JSON.stringify({analysis:report,username:report.username,platform:'chess.com'}));}, report);
 for(const route of process.env.EVIDENCE_FUZZ ? ['/report?reportAction=open_evidence#report-evidence'] : ['/train','/dashboard','/report?reportAction=open_evidence#report-evidence']) {
 await page.goto('http://127.0.0.1:4189'+route); await page.waitForTimeout(500);
 if(route==='/train') { const start=page.getByRole('button',{name:'Start free action',exact:true}); if(await start.count()) {await start.click();await page.waitForTimeout(700);} }
 if(route==='/dashboard') {const review=page.getByRole('button',{name:'Review evidence',exact:true}); console.log(name,'REVIEW BUTTON',await review.count());if(await review.count()){await review.click();await page.waitForTimeout(700);}}
 console.log(name,route,process.env.EVIDENCE_FUZZ ? await page.locator('.crashDetails').allTextContents() : (await page.locator('body').innerText()).slice(-14000));
 }
 await page.close();
 }
} finally {await browser.close();server.close();}
