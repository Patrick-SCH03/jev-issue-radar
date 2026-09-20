import {normalizeIssue, pairState, parseDecision} from '../lib/core.mjs';

const raw = (number, title, body, state = 'open') => ({number, title, body, state, html_url: `https://github.com/example/atlas-notes/issues/${number}`, labels: ['editor'], updated_at: '2026-09-20T00:00:00Z'});
export const demoSource = normalizeIssue(raw(248, 'Pressing Enter duplicates the last character during Korean input', 'Environment: Windows 11, Chrome 128, Atlas Notes 2.4\nSteps: type Korean in the editor and press Enter before IME composition ends.\nActual: the final character is duplicated before the newline.\nExpected: commit the composition once and insert a newline.'));
export const demoIssues = [
  normalizeIssue(raw(219, 'Korean IME commits the final character twice on Enter', 'Environment: Windows 11 / Chrome 128 / Atlas Notes 2.4\nSteps: type Korean in the editor, then press Enter during composition.\nActual: the final composing character is committed twice before the newline.\nExpected: commit once and insert a newline.')),
  normalizeIssue(raw(187, 'Autosave interrupts Korean IME composition', 'Environment: Windows 11, Chrome 128, Atlas Notes 2.4\nSteps: autosave runs every five seconds while composing Korean. Enter is not pressed.\nActual: the composing character is split, not duplicated.')),
  normalizeIssue(raw(163, 'Pressing Enter sends two search requests', 'Environment: Windows 11, Chrome 128, Atlas Notes 2.4\nSteps: type English in the search box and press Enter. The editor is unaffected.\nCause: both keydown and submit handlers send a search request. This is unrelated to IME composition.')),
  normalizeIssue(raw(104, 'Korean input behaves oddly on Enter', 'Korean input sometimes behaves oddly when I press Enter.', 'closed')),
];

const annotations = {
  219: ['duplicate', 'same_reproduction', 'L3', 'L3', 0.96],
  187: ['related', 'shared_symptom', 'L3', 'L3', 0.83],
  163: ['distinct', 'different_cause', 'L3', 'L4', 0.94],
  104: ['insufficient', 'missing_context', 'L3', 'L2', 0.79],
};
export function demoDecision(candidate) {
  const [relation, reason, source, evidence, confidence] = annotations[candidate.number];
  const answers = Object.fromEntries(Object.entries({relation, reason, source_evidence: source, candidate_evidence: evidence}).map(([key, choice]) => [key, {type: 'choice', choice, confidence}]));
  return {...parseDecision({answers}, pairState(demoSource, candidate)), latencyMs: null, costUsd: 0, model: 'demo-fixture'};
}
