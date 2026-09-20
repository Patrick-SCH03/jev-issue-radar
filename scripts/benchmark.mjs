import {performance} from 'node:perf_hooks';
import {cpus} from 'node:os';
import {mkdir, writeFile} from 'node:fs/promises';
import {once} from 'node:events';
import {execFileSync} from 'node:child_process';
import {normalizeIssue, rankCandidates, LIMITS} from '../lib/core.mjs';
import {createApp} from '../server.mjs';

// Deterministic, synthetic local workload. No GitHub or paid provider requests.
const label = process.argv[2] ?? 'current';
if (!/^[a-z0-9-]+$/.test(label)) throw new Error('Use a simple lowercase result label.');
const source = normalizeIssue({number: 1, title: 'Editor composition commit crash', body: 'composition editor commit crash windows enter', html_url: 'https://github.com/example/benchmark/issues/1'});
const issues = Array.from({length: 300}, (_, i) => normalizeIssue({number: i + 2,
  title: `Editor composition log ${i}`, html_url: `https://github.com/example/benchmark/issues/${i + 2}`,
  body: ('composition commit crash ' + Array.from({length: 1600}, (_, j) => `trace${i}_${j}`).join(' ')).slice(0, LIMITS.body)}));
const summary = samples => {
  const sorted = [...samples].sort((a, b) => a - b);
  const pick = p => Number(sorted[Math.ceil(sorted.length * p) - 1].toFixed(2));
  return {samples: samples.length, p50Ms: pick(0.5), p95Ms: pick(0.95), maxMs: pick(1)};
};
async function measure(fn, count, warmup = 5) {
  for (let i = 0; i < warmup; i++) await fn();
  const samples = [];
  for (let i = 0; i < count; i++) {const start = performance.now(); await fn(); samples.push(performance.now() - start);}
  return summary(samples);
}
const ranking = await measure(() => rankCandidates(source, issues), 30);
const server = createApp({env: {}, load: async () => ({source, issues, coverage: {repository: 'example/benchmark', issueCount: issues.length}})});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const base = 'http://127.0.0.1:' + server.address().port;
async function request(path, options) {
  const response = await fetch(base + path, options);
  if (!response.ok) throw new Error(`Benchmark request failed: ${response.status}`);
  return response.json();
}
try {
  const {csrf} = await request('/api/status');
  const demo = await measure(() => request('/api/demo'), 30);
  const preview = await measure(() => request('/api/preview', {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Radar-Token': csrf}, body: JSON.stringify({url: source.url})}), 20);
  const result = {label, createdAt: new Date().toISOString(), baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim(),
    environment: {node: process.version, platform: process.platform, arch: process.arch, cpu: cpus()[0]?.model},
    workload: {issues: issues.length, bodyCharactersPerIssue: LIMITS.body, warmupIterations: 5, network: 'Loopback only; GitHub is stubbed; Jev is never called'},
    ranking, demoHttp: demo, previewHttp: preview,
    maxRssMiB: Number((process.resourceUsage().maxRSS / 1024).toFixed(2))};
  const dir = new URL('../artifacts/', import.meta.url); await mkdir(dir, {recursive: true});
  await writeFile(new URL(`benchmark-${label}.json`, dir), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} finally {server.closeAllConnections(); await new Promise(resolve => server.close(resolve));}
