import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {compareIssues} from '../lib/jev.mjs';
import {demoSource, demoIssues, demoDecision} from '../data/evaluation-fixtures.mjs';
import {readJson} from '../lib/http.mjs';

// Opt-in only. Four synthetic pairs, no automatic retries and no GitHub writes.
if (process.env.JEV_SMOKE_APPROVED !== '1') throw new Error('Set JEV_SMOKE_APPROVED=1 only after approving this paid smoke test.');
if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is missing');
const capUsd = 0.10, reserveUsd = 0.025;
const folder = new URL('../reports/', import.meta.url);
const path = new URL('live-smoke.json', folder);
await mkdir(folder, {recursive: true});
let previous;
try {previous = JSON.parse(await readFile(path, 'utf8'));} catch (error) {if (error.code !== 'ENOENT') throw error;}
if (previous?.attempts?.length) throw new Error('A smoke report already exists. Refusing an accidental second paid run.');

const pricingSignal = AbortSignal.timeout(15000);
const pricingResponse = await fetch('https://openrouter.ai/api/v1/models/typesafe/jev-1.13/endpoints', {signal: pricingSignal, redirect: 'error'});
if (!pricingResponse.ok) throw new Error('Could not verify current Jev pricing');
const pricingData = await readJson(pricingResponse, {maxBytes: 512 * 1024, signal: pricingSignal});
const endpoints = pricingData?.data?.endpoints;
if (!Array.isArray(endpoints) || !endpoints.length) throw new Error('Missing provider pricing');
for (const endpoint of endpoints) {
  const input = Number(endpoint.pricing?.prompt), output = Number(endpoint.pricing?.completion);
  if (!Number.isFinite(input) || input < 0 || input > 0.042 / 1e6 || output !== 0) throw new Error('Unexpected pricing: paid smoke test stopped before inference');
}
const report = {createdAt: new Date().toISOString(), inputLanguage: 'en', fixtureVersion: 'english-v1', capUsd, model: 'typesafe/jev-1.13', kind: 'synthetic integration smoke; not a quality benchmark', attempts: []};
const save = () => writeFile(path, JSON.stringify(report, null, 2));
for (const candidate of demoIssues) {
  const reserved = report.attempts.reduce((sum, x) => sum + (x.costUsd ?? reserveUsd), 0);
  if (reserved + reserveUsd > capUsd + 1e-12) throw new Error('Approved budget exhausted');
  const attempt = {candidate: candidate.number, expected: demoDecision(candidate).relation, reservedUsd: reserveUsd, status: 'reserved'};
  report.attempts.push(attempt); await save();
  try {
    const decision = await compareIssues(demoSource, candidate, {apiKey: process.env.OPENROUTER_API_KEY, model: report.model});
    Object.assign(attempt, {status: 'ok', ...decision});
    console.log(JSON.stringify({candidate: candidate.number, expected: attempt.expected, actual: decision.relation, raw: decision.rawRelation, latencyMs: decision.latencyMs, costUsd: decision.costUsd}));
  } catch (error) {attempt.status = 'failed'; attempt.error = error.message; console.log(JSON.stringify({candidate:candidate.number,status:'failed',error:error.message}));}
  await save();
  if (attempt.costUsd > reserveUsd || attempt.status !== 'ok' || attempt.costUsd === null) break;
}
report.totalKnownCostUsd = report.attempts.reduce((sum, x) => sum + (x.costUsd ?? 0), 0);
report.unknownCostAttempts = report.attempts.filter(x => x.costUsd == null).length;
report.matches = report.attempts.filter(x => x.status === 'ok' && x.relation === x.expected).length;
await save();
console.log(JSON.stringify({attempts:report.attempts.length,matches:report.matches,totalKnownCostUsd:report.totalKnownCostUsd,unknownCostAttempts:report.unknownCostAttempts}));
