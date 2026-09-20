import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import http from 'node:http';
import {readFile, mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {buildDemo} from '../scripts/build-demo.mjs';
import {readJson} from '../lib/http.mjs';
import {parseIssueUrl,normalizeIssue,rankCandidates,evidenceLines,pairState,decisionQuestions,parseDecision,LIMITS} from '../lib/core.mjs';
import {compareIssues} from '../lib/jev.mjs';
import {loadRepositoryIssue} from '../lib/github.mjs';
import {createApp} from '../server.mjs';
import {demoSource,demoIssues,demoDecision,demoSnapshot} from '../data/demo.mjs';

const state=()=>pairState(demoSource,demoIssues[0]);
const valid=(patch={})=>({answers:Object.fromEntries(Object.entries({relation:'duplicate',reason:'same_reproduction',source_evidence:'L3',candidate_evidence:'L3',...patch}).map(([key,choice])=>[key,{type:'choice',choice,confidence:0.95}]))});
const raw=(number=1,extra={})=>({number,title:'Crash on file open',body:'Open a file and the editor crashes',html_url:'https://github.com/test/project/issues/'+number,...extra});
const loaded=()=>({source:demoSource,issues:demoIssues,coverage:{repository:'example/atlas-notes',issueCount:4,description:'test fixture'}});
async function app(t,options={}) {
  const server=createApp({env:{},load:async()=>loaded(),...options});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
  const base='http://127.0.0.1:'+server.address().port;
  const status=await (await fetch(base+'/api/status')).json();
  const post=(path,payload={url:demoSource.url},headers={})=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json','X-Radar-Token':status.csrf,...headers},body:JSON.stringify(payload)});
  return{server,base,status,post};
}

test('GitHub URL canonicalization strips fragments and accepts closed issues',()=>{
  assert.deepEqual(parseIssueUrl(' https://github.com/a/my.repo/issues/17#issuecomment-1 '),{owner:'a',repo:'my.repo',number:17,url:'https://github.com/a/my.repo/issues/17'});
});
test('untrusted origins, credentials, ports, PRs and unsafe issue IDs are rejected',()=>{
  for(const url of ['http://github.com/a/b/issues/1','https://github.com.evil.test/a/b/issues/1','https://me@github.com/a/b/issues/1','https://github.com:444/a/b/issues/1','https://github.com/a/b/pull/1','https://127.0.0.1/a/b/issues/1','https://github.com/a/b/issues/0','https://github.com/a/b/issues/9007199254740992','javascript:alert(1)'])assert.throws(()=>parseIssueUrl(url));
});
test('PR entries are excluded before URL parsing',()=>assert.equal(normalizeIssue({...raw(),pull_request:{}}),null));
test('inconsistent issue identifiers are rejected',()=>assert.throws(()=>normalizeIssue(raw(2,{html_url:raw(1).html_url}))));
test('null bodies and object labels normalize without author data',()=>{
  const issue=normalizeIssue(raw(1,{body:null,labels:[{name:'bug'}],user:{login:'private-name'}}));
  assert.equal(issue.body,'');assert.deepEqual(issue.labels,['bug']);assert.equal(issue.user,undefined);
});
test('long reports are marked truncated',()=>{
  const issue=normalizeIssue(raw(1,{body:'x'.repeat(LIMITS.body+1)}));
  assert.equal(issue.body.length,LIMITS.body);assert.equal(issue.truncated,true);
});
test('retrieval removes source and duplicate URLs without mutating its input',()=>{
  const input=[demoSource,...demoIssues,demoIssues[0]];const before=JSON.stringify(input);
  const ranked=rankCandidates(demoSource,input);
  assert.equal(ranked.length,4);assert.ok(ranked.every(x=>x.issue.url!==demoSource.url));
  assert.equal(JSON.stringify(input),before);
});
test('retrieval enforces limit and deterministic ordering under input permutation',()=>{
  assert.equal(rankCandidates(demoSource,demoIssues,0).length,0);
  assert.equal(rankCandidates(demoSource,demoIssues,-1).length,0);
  assert.deepEqual(rankCandidates(demoSource,demoIssues).map(x=>x.issue.number),rankCandidates(demoSource,[...demoIssues].reverse()).map(x=>x.issue.number));
});
test('diagnostic overlap outranks unrelated content',()=>{
  const a=normalizeIssue(raw(1));const b=normalizeIssue(raw(2));const c=normalizeIssue(raw(3,{title:'Add theme',body:'Color palette and fonts'}));
  assert.equal(rankCandidates(a,[c,b])[0].issue.number,2);
});
test('evidence uses only original lines and stable IDs',()=>{
  const lines=evidenceLines(demoSource).lines;
  assert.equal(lines[2].id,'L3');assert.ok(demoSource.body.includes(lines[2].text));
  assert.equal(new Set(lines.map(x=>x.id)).size,lines.length);
});
test('per-line and line-count truncation are visible to the decision policy',()=>{
  assert.ok(evidenceLines({...demoSource,body:'a'.repeat(361)}).truncated);
  assert.ok(evidenceLines({...demoSource,body:Array(65).fill('line').join('\n')}).truncated);
});
test('questions constrain relation, reason, and evidence IDs',()=>{
  const q=decisionQuestions(state());
  assert.deepEqual(Object.keys(q.relation.criteria),['duplicate','related','distinct','insufficient']);
  assert.ok(q.source_evidence.criteria.L3);assert.ok(q.source_evidence.criteria.none);
});
test('valid classification grounds quotes in the supplied source',()=>{
  const d=parseDecision(valid(),state());assert.equal(d.relation,'duplicate');
  assert.equal(d.sourceEvidence.text,state().source.lines[2].text);
});
test('malformed or fabricated model choice is an error',()=>{
  for(const patch of [{relation:'closed'},{source_evidence:'L999'},{reason:'invented'}])assert.throws(()=>parseDecision(valid(patch),state()));
  assert.throws(()=>parseDecision({},state()));
  const response=valid();delete response.answers.reason;assert.throws(()=>parseDecision(response,state()));
});
test('missing source evidence cannot become a duplicate candidate',()=>{
  const d=parseDecision(valid({source_evidence:'none'}),state());assert.equal(d.relation,'insufficient');assert.equal(d.rawRelation,'duplicate');
});
test('contradictory relation and reason are downgraded',()=>assert.equal(parseDecision(valid({reason:'different_cause'}),state()).relation,'insufficient'));
test('low, invalid or missing confidence cannot pass the duplicate gate',()=>{
  for(const value of [0.79,-1,2,NaN,'0.99',undefined]){const response=valid();response.answers.relation.confidence=value;assert.equal(parseDecision(response,state()).relation,'insufficient');}
});
test('truncation cannot silently yield a strong duplicate candidate',()=>{
  const s=state();s.source.truncated=true;assert.equal(parseDecision(valid(),s).relation,'insufficient');
});
test('related and distinct are not converted into duplicate by high confidence',()=>{
  assert.equal(parseDecision(valid({relation:'related',reason:'shared_symptom'}),state()).relation,'related');
  assert.equal(parseDecision(valid({relation:'distinct',reason:'different_cause'}),state()).relation,'distinct');
});
test('provider sends typed choices to the dedicated OpenRouter endpoint',async()=>{
  let request;const result=await compareIssues(demoSource,demoIssues[0],{apiKey:'test-only-not-real',fetchImpl:async(url,options)=>{request={url,options};return Response.json({...valid(),model:'test-model',usage:{cost:0.0001}});}});
  assert.equal(request.url,'https://openrouter.ai/api/alpha/decisions');assert.equal(request.options.method,'POST');
  const sent=JSON.parse(request.options.body);assert.equal(sent.questions.relation.type,'choice');
  assert.equal(sent.model,'typesafe/jev-1.13');assert.equal(result.costUsd,0.0001);
  assert.ok(!JSON.stringify(result).includes('test-only-not-real'));
});
test('provider does not fabricate missing cost metadata',async()=>{
  const result=await compareIssues(demoSource,demoIssues[0],{apiKey:'test',fetchImpl:async()=>Response.json(valid())});assert.equal(result.costUsd,null);
});
test('provider failures are explicit and never expose response bodies',async()=>{
  await assert.rejects(()=>compareIssues(demoSource,demoIssues[0],{}),/OPENROUTER_API_KEY/);
  await assert.rejects(()=>compareIssues(demoSource,demoIssues[0],{apiKey:'test',fetchImpl:async()=>new Response('secret-provider-body',{status:401})}),error=>error.message.includes('401')&&!error.message.includes('secret-provider-body'));
  await assert.rejects(()=>compareIssues(demoSource,demoIssues[0],{apiKey:'test',fetchImpl:async()=>{throw Error('network');}}),/connection/);
});
test('late response bodies cannot be accepted after the deadline',async()=>{
  // Keep the event loop alive because AbortSignal.timeout uses an unref'ed timer.
  const keepAlive=setInterval(()=>{},1000);let cancelled=false;
  try {await assert.rejects(()=>compareIssues(demoSource,demoIssues[0],{apiKey:'test',timeoutMs:20,fetchImpl:async()=>new Response(new ReadableStream({cancel(){cancelled=true;}}))}),/deadline/);assert.equal(cancelled,true);}
  finally {clearInterval(keepAlive);}
});
test('public GitHub importer paginates, omits PRs, and uses no authorization',async()=>{
  const urls=[];const fetchImpl=async(url,options)=>{urls.push(url);assert.equal(options.headers.Authorization,undefined);assert.equal(options.redirect,'error');if(url.includes('/issues/1'))return Response.json(raw());if(url.endsWith('page=1'))return Response.json(Array.from({length:100},(_,i)=>raw(i+2,{...(i%2?{pull_request:{}}:{})})));return Response.json([raw(200)]);};
  const r=await loadRepositoryIssue(raw().html_url,{fetchImpl});assert.equal(r.coverage.pages,2);assert.equal(r.issues.length,51);assert.equal(r.coverage.limited,false);assert.equal(urls.length,3);
});
test('GitHub page cap is reported instead of claiming complete coverage',async()=>{
  const r=await loadRepositoryIssue(raw().html_url,{fetchImpl:async url=>Response.json(url.includes('/issues/1')?raw():Array.from({length:100},(_,i)=>raw(i+2)))});
  assert.equal(r.coverage.pages,3);assert.equal(r.coverage.limited,true);
});
test('GitHub errors distinguish not-found and quota limits',async()=>{
  for(const[status,pattern]of[[404,/not found/],[403,/rate limit/],[429,/rate limit/]])await assert.rejects(()=>loadRepositoryIssue(raw().html_url,{fetchImpl:async()=>new Response('',{status})}),pattern);
});
test('demo is explicitly labeled and never invokes any external provider',async t=>{
  const a=await app(t,{load:()=>{throw Error('unexpected');},compare:()=>{throw Error('unexpected');}});
  const result=await(await fetch(a.base+'/api/demo')).json();
  assert.equal(result.mode,'demo');assert.equal(result.candidates.length,4);assert.equal(result.candidates[0].decision.model,'demo-fixture');
});
test('preview fetches candidate reports without making a Jev call',async t=>{
  let calls=0;const a=await app(t,{compare:()=>{calls++;}});
  const result=await(await a.post('/api/preview',{url:raw().html_url})).json();
  assert.equal(result.mode,'preview');assert.equal(calls,0);assert.ok(result.candidates.every(x=>!x.decision));
});
test('local server rejects cross-origin requests and missing CSRF tokens',async t=>{
  const a=await app(t);assert.equal((await a.post('/api/preview',{}, {'X-Radar-Token':'wrong'})).status,403);
  assert.equal((await a.post('/api/preview',{}, {Origin:'https://evil.example'})).status,403);
  // fetch rewrites Host; use a raw HTTP request to actually exercise the server guard.
  const status=await new Promise((resolve,reject)=>{const req=http.get(a.base+'/api/status',{headers:{Host:'evil.example'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);});
  assert.equal(status,403);
});
test('local server never serves source files, environment files or parent paths',async t=>{
  const a=await app(t);for(const path of ['/server.mjs','/.env','/package.json','/../README.md'])assert.equal((await fetch(a.base+path)).status,404);
});
test('live mode is opt-in, independent of key availability',async t=>{
  const a=await app(t,{env:{OPENROUTER_API_KEY:'test-key'}});const preview=await(await a.post('/api/preview')).json();
  assert.equal((await a.post('/api/analyze',{id:preview.id})).status,403);assert.equal(a.status.liveEnabled,false);
});
test('repeated analysis returns cached results without duplicate billing',async t=>{
  let calls=0;const a=await app(t,{env:{JEV_ENABLE_LIVE:'1',OPENROUTER_API_KEY:'test'},compare:async(_,candidate)=>{calls++;return demoDecision(candidate);}});
  const preview=await(await a.post('/api/preview')).json();
  for(let i=0;i<2;i++){const result=await(await a.post('/api/analyze',{id:preview.id})).json();assert.equal(result.mode,'live');assert.equal(result.candidates[0].decision.relation,'duplicate');}
  assert.equal(calls,4);
});
test('partial provider failure is preserved as failure, never distinct',async t=>{
  const a=await app(t,{env:{JEV_ENABLE_LIVE:'1',OPENROUTER_API_KEY:'test'},compare:async(_,candidate)=>{if(candidate.number===219)throw Error('provider unavailable');return demoDecision(candidate);}});
  const preview=await(await a.post('/api/preview')).json();const result=await(await a.post('/api/analyze',{id:preview.id})).json();
  assert.equal(result.candidates.find(x=>x.issue.number===219).decision.relation,'failed');
});
test('call limit is checked before any part of a new batch is billed',async t=>{
  let calls=0;const a=await app(t,{env:{JEV_ENABLE_LIVE:'1',OPENROUTER_API_KEY:'test',JEV_MAX_CALLS:'3'},compare:async()=>{calls++;}});
  const preview=await(await a.post('/api/preview')).json();assert.equal((await a.post('/api/analyze',{id:preview.id})).status,429);assert.equal(calls,0);
});

test('invalid call limits cannot silently enable the default paid allowance',()=>{
  for(const limit of ['0','-1','3oops','1.5','101',''])assert.throws(()=>createApp({env:{JEV_MAX_CALLS:limit}}),/JEV_MAX_CALLS must be/);
});
test('expired previews cannot be analyzed',async t=>{
  let clock=1000;const a=await app(t,{env:{JEV_ENABLE_LIVE:'1',OPENROUTER_API_KEY:'test'},now:()=>clock});
  const preview=await(await a.post('/api/preview')).json();clock+=600001;
  assert.equal((await a.post('/api/analyze',{id:preview.id})).status,410);
});
test('concurrent preview is rejected while an existing request is active',async t=>{
  let release,entered;const entry=new Promise(r=>entered=r);const wait=new Promise(r=>release=r);
  const a=await app(t,{load:async()=>{entered();await wait;return loaded();}});
  const first=a.post('/api/preview');await entry;
  assert.equal((await a.post('/api/preview')).status,409);release();assert.equal((await first).status,200);
});

test('malformed request targets return 400 and leave the process usable',async t=>{
  const a=await app(t);
  for(const path of ['//[','http://[','/\\evil.example']){
    const status=await new Promise((resolve,reject)=>{http.get({hostname:'127.0.0.1',port:a.server.address().port,path},res=>{res.resume();resolve(res.statusCode);}).on('error',reject);});
    assert.equal(status,400);
  }
  assert.equal((await fetch(a.base+'/api/status')).status,200);
});

test('request schemas and byte limits fail before importing any issues',async t=>{
  let calls=0;const a=await app(t,{load:async()=>{calls++;return loaded();}});
  for(const input of [null,[],1,{}, {url:42},{url:'x'.repeat(2049)}])assert.equal((await a.post('/api/preview',input)).status,400);
  assert.equal((await a.post('/api/preview',{url:'x'.repeat(9000)})).status,413);
  assert.equal(calls,0);
});

test('chunked request bodies cannot bypass the byte cap',async t=>{
  const a=await app(t);
  const status=await new Promise((resolve,reject)=>{
    const req=http.request(a.base+'/api/preview',{method:'POST',headers:{'Content-Type':'application/json','X-Radar-Token':a.status.csrf,'Transfer-Encoding':'chunked'}},res=>{res.resume();resolve(res.statusCode);});
    req.on('error',reject);req.write('x'.repeat(5000));req.end('x'.repeat(5000));
  });
  assert.equal(status,413);assert.equal((await a.post('/api/preview')).status,200);
});

test('unfinished bodies reserve the slot, time out, and release it',async t=>{
  const a=await app(t,{bodyTimeoutMs:150});
  let started;
  const waiting=new Promise(resolve=>started=resolve);
  a.server.once('request',()=>started());
  const slow=new Promise((resolve,reject)=>{
    const req=http.request(a.base+'/api/preview',{method:'POST',headers:{'Content-Type':'application/json','X-Radar-Token':a.status.csrf,'Content-Length':100}},res=>{res.resume();resolve(res.statusCode);});
    req.on('error',reject);req.flushHeaders();req.write('{');
  });
  await waiting;assert.equal((await a.post('/api/preview')).status,409);
  assert.equal(await slow,408);assert.equal((await a.post('/api/preview')).status,200);
});

test('disconnect during upload releases the slot without crashing',async t=>{
  const a=await app(t);let started;
  const waiting=new Promise(resolve=>started=resolve);a.server.once('request',()=>started());
  const req=http.request(a.base+'/api/preview',{method:'POST',headers:{'Content-Type':'application/json','X-Radar-Token':a.status.csrf,'Content-Length':100}});
  req.on('error',()=>{});req.write('{');await waiting;
  req.destroy();
  // A subsequent request may arrive before the close event; retry only the busy response.
  let status;
  for(let i=0;i<20;i++){await new Promise(r=>setTimeout(r,5));status=(await a.post('/api/preview')).status;if(status!==409)break;}
  assert.equal(status,200);
});

test('HTML uses fresh nonces and no unrestricted inline scripts',async t=>{
  const a=await app(t);const nonces=[];
  for(let i=0;i<2;i++){
    const response=await fetch(a.base);const csp=response.headers.get('content-security-policy');
    assert.ok(!csp.includes('unsafe-inline'));assert.match(csp,/frame-ancestors 'none'/);
    const nonce=csp.match(/script-src 'nonce-([^']+)'/)[1];nonces.push(nonce);
    const html=await response.text();assert.ok(html.includes(`<script nonce="${nonce}">`));assert.ok(html.includes(`<style nonce="${nonce}">`));
  }
  assert.notEqual(nonces[0],nonces[1]);
  assert.equal((await fetch(a.base+'/api/status',{headers:{'Sec-Fetch-Site':'cross-site'}})).status,403);
});

test('upstream JSON byte limits reject declared and streamed overflow',async()=>{
  await assert.rejects(()=>readJson(new Response('{}',{headers:{'Content-Length':'9999'}}),{maxBytes:100}),/too large/);
  let cancelled=false;
  const body=new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('x'.repeat(101)));},cancel(){cancelled=true;}});
  await assert.rejects(()=>readJson(new Response(body),{maxBytes:100}),/too large/);assert.equal(cancelled,true);
  assert.deepEqual(await readJson(new Response('{"ok":true}'),{maxBytes:11}),{ok:true});
});

test('upstream invalid JSON and oversized payloads expose no raw content',async()=>{
  for(const response of [new Response('private-invalid-json'),new Response(JSON.stringify({...valid(),padding:'x'.repeat(256*1024)}))]){
    await assert.rejects(()=>compareIssues(demoSource,demoIssues[0],{apiKey:'test',fetchImpl:async()=>response}),error=>/read the Jev response/.test(error.message)&&!error.message.includes('private-invalid-json'));
  }
  await assert.rejects(()=>loadRepositoryIssue(raw().html_url,{fetchImpl:async()=>new Response('x'.repeat(8*1024*1024+1))}),/8 MiB/);
  await assert.rejects(()=>loadRepositoryIssue(raw().html_url,{fetchImpl:async url=>Response.json(url.includes('/issues/1')?raw():Array.from({length:101},(_,i)=>raw(i+2)))}),/invalid issue list/);
});

test('issue metadata has bounded labels and tolerates malformed label collections',()=>{
  assert.deepEqual(normalizeIssue(raw(1,{labels:{name:'bug'}})).labels,[]);
  const issue=normalizeIssue(raw(1,{labels:Array(100).fill('x'.repeat(10000)),updated_at:'x'.repeat(1000)}));
  assert.equal(issue.labels.length,10);assert.equal(issue.labels[0].length,100);assert.equal(issue.updatedAt.length,40);
});

test('retrieval weights, normalization and query-order overlap stay stable',()=>{
  const source=normalizeIssue(raw(1,{title:'alpha beta',body:'gamma'}));
  const a=normalizeIssue(raw(2,{title:'alpha',body:'beta gamma delta'}));
  const b=normalizeIssue(raw(3,{title:'beta',body:'alpha delta'}));
  const results=rankCandidates(source,[b,a]);
  const common=Math.log(1+2/3),rare=Math.log(1+2/2);
  assert.deepEqual(results.map(x=>[x.issue.number,x.retrievalScore,x.overlap]),[
    [2,Number(((3*common+rare)/Math.sqrt(1.04)).toFixed(4)),['alpha','beta','gamma']],
    [3,Number((3*common/Math.sqrt(1.03)).toFixed(4)),['alpha','beta']],
  ]);
});

test('translated report keeps measured choices, costs and original provenance explicit',async()=>{
  const report=JSON.parse(await readFile(new URL('../docs/live-smoke-2026-09-20.json',import.meta.url),'utf8'));
  assert.equal(report.presentation.translated,true);assert.match(report.presentation.originalReport,/2c6a807/);
  assert.deepEqual(report.attempts.map(x=>x.relation),['duplicate','distinct','distinct','related']);
  assert.equal(report.matches,2);assert.ok(Math.abs(report.totalKnownCostUsd-0.000294084)<1e-12);
});

test('public artifact embeds the same synthetic snapshot and blocks outbound connections',async t=>{
  const folder=await mkdtemp(join(tmpdir(),'jev-demo-test-'));
  t.after(()=>rm(folder,{recursive:true,force:true}));
  const output=pathToFileURL(folder+'/');const build=await buildDemo(output);
  assert.equal(build.files.length,4);assert.ok(build.files.every(file=>!file.includes('server')&&!file.includes('env')));
  const html=await readFile(new URL('index.html',output),'utf8');
  const embedded=JSON.parse(html.match(/id="sample-data">([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(embedded,demoSnapshot());assert.match(html,/connect-src 'none'/);
  assert.match(html,/data-hosted-demo="true"/);assert.match(html,/id="search" class="search-card" hidden/);
  assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<style>'));
  for(const asset of build.files.filter(x=>/\.(js|css)$/.test(x)))assert.ok(html.includes('./'+asset));
});
