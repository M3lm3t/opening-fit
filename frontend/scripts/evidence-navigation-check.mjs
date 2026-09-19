import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { MELMET_REGRESSION_FIXTURE } from '../src/lib/fixtures/melmetRegressionFixture.js';
import { evidenceAction } from '../src/lib/reportEvidence.js';
import { reportActionUrl } from '../src/lib/reportViews.js';
import { buildFoundationalWeeklyPlan } from '../src/lib/thisWeekTraining.js';

const root = path.resolve(process.env.EVIDENCE_BUNDLE || 'android/app/src/main/assets/public');
const output = path.resolve('../.release-build/evidence-fix');
await mkdir(output, {recursive:true});
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file = path.join(root, pathname.includes('.') ? pathname : 'index.html');
  try {
    const bytes = await readFile(file);
    const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.json':'application/json'};
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.end(bytes);
  } catch { res.statusCode = 404; res.end(); }
});
await new Promise(resolve => server.listen(4190, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:4190';
const browser = await chromium.launch({headless:true});
const repair = {recommendationId:'old:opening',opening:'Opening',openingName:'Opening',role:'played_as_white',repertoireRole:'white',verdict:'repair',sample:{games:10,scoreRate:20},evidenceGameIds:['missing']};
const incomplete = {analysisCompleted:true,username:'Restored',gamesAnalysed:10,topOpenings:[{name:'Opening',games:10}],reportDecision:{schemaVersion:5,recommendations:[repair],primaryProblem:repair,trainingPriority:null,primaryAction:{type:'collect_more_games',label:'Collect more games',recommendationId:null}}};
const valid = structuredClone(MELMET_REGRESSION_FIXTURE);
const absent = {analysisCompleted:true,username:'Restored',totalGames:10,reportDecision:null};
const compact = {...valid,analysis_game_index:valid.analysis_game_index.map(game=>({gameId:game.gameId,opening:game.opening,playerColour:game.playerColour,playerResult:game.playerResult,relationship:game.relationship,firstWhiteMove:game.moves?.[0]}))};
const target = valid.reportDecision.recommendations[1];
const savedFoundation=buildFoundationalWeeklyPlan({report:{topOpenings:[{name:'Opening',games:10}]}});
// Older cloud plans retain their display title independently of today's catalogue.
savedFoundation.primaryGoal='Build a reliable Opening foundation';
try {
  for(const native of [false,true]) {
    for(const [name,report] of Object.entries({valid,absent,compact,incomplete})) {
      const page = await browser.newPage({viewport:{width:390,height:844}});
      const errors=[];
      page.on('pageerror', error=>errors.push(error.message));
      page.on('console', message=>{if(message.text().includes('Opening Fit runtime error:'))errors.push(message.text());});
      await page.route('**/*', route=>route.request().url().startsWith(origin) ? route.continue() : route.abort());
      await page.addInitScript(({report,native,savedFoundation})=>{
        localStorage.setItem('openingFit:lastAnalysis',JSON.stringify({analysis:report,username:report.username,platform:'chess.com'}));
        localStorage.setItem('openingFit:thisWeekTraining:local',JSON.stringify({plan:savedFoundation,pendingTaskIds:[]}));
        if(native) {
          window.CapacitorCustomPlatform={name:'android'};
          window.Capacitor={
            PluginHeaders:[
              {name:'App',methods:[{name:'getLaunchUrl',rtype:'promise'},{name:'addListener',rtype:'callback'},{name:'removeListener',rtype:'promise'}]},
              {name:'StatusBar',methods:['setOverlaysWebView','setStyle','setBackgroundColor'].map(name=>({name,rtype:'promise'}))},
              {name:'SplashScreen',methods:[{name:'hide',rtype:'promise'}]},
            ],
            nativePromise:async()=>({}),nativeCallback:()=> 'test-listener',
          };
        }
      },{report,native,savedFoundation});
      const healthy=async()=>{
        assert.equal(await page.locator('.appCrashFallback').count(),0,`${native}/${name}: global error boundary`);
        assert.deepEqual(errors,[],`${native}/${name}: runtime errors`);
      };
      await page.goto(origin+'/train');
      await page.waitForTimeout(700);
      if(name==='incomplete') await page.getByRole('heading',{name:'Training evidence unavailable'}).waitFor();
      await healthy();
      if(native) assert.equal(await page.locator('html.of-android-app').count(),1);
      if(name==='incomplete') {
        await page.goto(origin+'/dashboard');
        const button=page.getByRole('button',{name:'Review evidence',exact:true});
        await button.waitFor();
        const history=await page.evaluate(()=>window.history.length);
        await button.evaluate(element=>{for(let i=0;i<5;i++)element.click();});
        await page.waitForURL('**#report-evidence');
        await page.getByRole('button',{name:'Analyse games to rebuild evidence'}).waitFor();
        assert.equal(await page.evaluate(()=>window.history.length),history+1);
        assert.ok(new URL(page.url()).searchParams.get('decision'));
        await healthy();
        await page.goBack();
        await button.waitFor();
        await button.click();
        await page.waitForURL('**#report-evidence');
        await healthy();
      }
      const action=evidenceAction(name==='absent' ? null : target);
      await page.goto(origin+reportActionUrl(action));
      await page.getByRole('heading',{name:'Games, filters, confidence and report tools'}).waitFor();
      if(name==='valid'||name==='compact') await page.getByRole('region',{name:'Requested opening evidence'}).waitFor();
      if(name==='absent') await page.getByText('Detailed evidence was not retained in this saved report.',{exact:false}).waitFor();
      await healthy();
      if(name==='valid'||name==='compact') {
        const row=page.getByRole('button',{name:/^View evidence for /}).first();
        await row.click();
        await page.getByRole('region',{name:'Requested opening evidence'}).waitFor();
        await healthy();
        await page.goto(origin+'/report');
        await page.getByRole('button',{name:'View evidence and methodology',exact:true}).click();
        await page.waitForURL('**#report-evidence');
        await page.getByText('Showing the evidence retained in this report.',{exact:true}).waitFor();
        await healthy();
        await page.goto(origin+'/report#report-priorities');
        const supporting=page.getByRole('button',{name:'View supporting games',exact:true}).first();
        if(await supporting.count()) {
          await supporting.click();
          await page.waitForURL('**#report-evidence');
          await healthy();
        }
      }
      await page.goto(origin+reportActionUrl({...action,decisionId:'stale:unmatched'}));
      await page.getByRole('button',{name:'Analyse games to rebuild evidence'}).waitFor();
      assert.equal(await page.getByRole('region',{name:'Requested opening evidence'}).count(),0);
      await page.locator('.reportContextNotice').scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
      await healthy();
      await page.screenshot({path:path.join(output,`evidence-${native?'android':'web'}-${name}.png`)});
      console.log(`PASS ${native?'Android bridge simulation':'web'}: ${name}, restored report, evidence navigation, stale target, no runtime/boundary errors`);
      await page.close();
    }
  }
} finally {await browser.close();server.close();}
