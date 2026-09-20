import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {loadRepositoryIssue} from '../lib/github.mjs';
import {rankCandidates} from '../lib/core.mjs';

// Explicit network command: reads public GitHub reports, never calls Jev or writes GitHub.
// Report text stays in memory; output contains only references and retrieval measurements.
const fixture = JSON.parse(await readFile(new URL('../data/public-cases.json', import.meta.url), 'utf8'));
const report = {createdAt: new Date().toISOString(), baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim(),
  kind: 'Current-window retrieval check of three preselected public duplicate pairs; not model accuracy', paidCalls: 0, cases: []};
for (const item of fixture.cases) {
  const start = performance.now();
  try {
    const loaded = await loadRepositoryIssue(item.source);
    const candidates = rankCandidates(loaded.source, loaded.issues);
    const rank = candidates.findIndex(x => x.issue.url.toLowerCase() === item.canonical.toLowerCase());
    report.cases.push({...item, status: 'ok', canonicalInScan: loaded.issues.some(x => x.url.toLowerCase() === item.canonical.toLowerCase()),
      canonicalTop5Rank: rank < 0 ? null : rank + 1, candidates: candidates.map(x => ({url: x.issue.url, score: x.retrievalScore})),
      coverage: loaded.coverage, elapsedMs: Math.round(performance.now() - start)});
  } catch (error) {report.cases.push({...item, status: 'failed', error: error.message});}
}
report.completed = report.cases.filter(x => x.status === 'ok').length;
report.foundInTop5 = report.cases.filter(x => x.canonicalTop5Rank != null).length;
const folder = new URL('../reports/', import.meta.url); await mkdir(folder, {recursive: true});
await writeFile(new URL('public-cases.json', folder), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({completed: report.completed, foundInTop5: report.foundInTop5, cases: report.cases.map(({id, status, canonicalInScan, canonicalTop5Rank, elapsedMs, error}) => ({id, status, canonicalInScan, canonicalTop5Rank, elapsedMs, error})), paidCalls: 0}));
if (report.completed !== fixture.cases.length) process.exitCode = 1;
