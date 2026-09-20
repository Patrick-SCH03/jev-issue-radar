import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {createApp} from '../server.mjs';
import {demoSource,demoIssues,demoDecision} from '../data/demo.mjs';

// Optional QA dependency; the actual app and core tests need no npm packages.
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const artifacts=new URL('../artifacts/',import.meta.url);await mkdir(artifacts,{recursive:true});
let calls=0;
const server=createApp({env:{JEV_ENABLE_LIVE:'1',OPENROUTER_API_KEY:'local-test-placeholder'},load:async url=>{
  if(!url.startsWith('https://github.com/'))throw Error('Enter a valid GitHub issue URL.');
  return {source:demoSource,issues:demoIssues,coverage:{repository:'example/atlas-notes',issueCount:4,description:'Browser test fixture'}};
},compare:async(_,candidate)=>{calls++;return demoDecision(candidate);}});
server.listen(0,'127.0.0.1');await once(server,'listening');
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
const page=await browser.newPage({viewport:{width:1440,height:1000},colorScheme:'light'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const check=async(name,fn)=>{await fn();console.log('PASS '+name);};
try{
  await page.goto(base);
  await page.getByText('Demo results',{exact:true}).waitFor();
  await check('demo visibly labels synthetic judgments',async()=>{assert.match(await page.locator('#message').innerText(),/fixed/);assert.equal(await page.locator('.candidate').count(),4);assert.equal(calls,0);});
  await check('duplicate filter and original evidence',async()=>{await page.getByRole('button',{name:'Duplicates',exact:true}).click();assert.equal(await page.locator('.candidate').count(),1);assert.match(await page.locator('#detail').innerText(),/Korean IME/);assert.match(await page.locator('blockquote').first().innerText(),/Steps/);});
  await check('insufficient filter and closed issue',async()=>{await page.getByRole('button',{name:'Needs review',exact:true}).click();assert.equal(await page.locator('.candidate').count(),1);assert.match(await page.locator('#detail').innerText(),/Closed issue/);});
  await check('expanded raw reports and model metadata',async()=>{await page.getByText('Full reports and analysis details',{exact:true}).click();assert.equal(await page.locator('details[open]').count(),1);assert.match(await page.locator('details').innerText(),/demo-fixture/);});
  await check('export downloads labeled JSON',async()=>{const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Export JSON'}).click();const download=await pending;assert.match(download.suggestedFilename(),/demo\.json$/);await download.saveAs(fileURLToPath(new URL('demo-export.json',artifacts)));});
  await check('valid GitHub preview is unclassified and free',async()=>{await page.getByLabel('GitHub issue URL').fill('https://github.com/example/atlas-notes/issues/248');await page.getByRole('button',{name:'Find candidates'}).click();await page.getByText('Candidates loaded',{exact:true}).waitFor();assert.equal(calls,0);assert.equal(await page.locator('#m-duplicate').innerText(),'—');});
  await check('analyze replaces preview with provider decisions (mock)',async()=>{await page.getByRole('button',{name:'Compare 4 with Jev'}).click();await page.getByText('Jev results',{exact:true}).waitFor();assert.equal(calls,4);assert.equal(await page.locator('#m-duplicate').innerText(),'1');});
  await check('invalid input is visible and preserves last result',async()=>{await page.getByLabel('GitHub issue URL').fill('https://invalid.example/issue');await page.getByRole('button',{name:'Find candidates'}).click();await page.locator('#message.error').waitFor();assert.match(await page.locator('#message').innerText(),/URL/);assert.equal(await page.locator('.candidate').count(),4);});
  await page.getByRole('button',{name:'Explore demo'}).click();await page.getByText('Demo results',{exact:true}).waitFor();
  await page.getByLabel('GitHub issue URL').fill('');
  await page.getByRole('button',{name:'Duplicates',exact:true}).click();
  for(const width of [1440,768,375])for(const scheme of ['light','dark']){
    await page.setViewportSize({width,height:1000});
    const current=await page.locator('html').getAttribute('data-theme');if(current!==scheme)await page.locator('#theme').click();
    await check('no overflow '+width+' '+scheme,async()=>{const sizes=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));assert.ok(sizes.scroll<=sizes.client,JSON.stringify(sizes));});
    await page.screenshot({path:fileURLToPath(new URL('demo-'+width+'-'+scheme+'.png',artifacts)),fullPage:true});
  }
  await check('theme toggle exposes its current action',async()=>assert.match(await page.locator('#theme').getAttribute('aria-label'),/light/));
  await check('no browser runtime errors',async()=>assert.deepEqual(errors,[]));
  console.log('Browser smoke complete; API calls were mocked, zero paid requests.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
