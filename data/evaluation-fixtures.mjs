import {normalizeIssue, pairState, parseDecision} from '../lib/core.mjs';

const raw = (number, title, body, state = 'open') => ({number, title, body, state, html_url: `https://github.com/example/atlas-notes/issues/${number}`, labels: ['editor'], updated_at: '2026-09-20T00:00:00Z'});
export const demoSource = normalizeIssue(raw(248, '한글 입력 후 Enter를 누르면 마지막 글자가 두 번 들어가요', '환경: Windows 11, Chrome 128, Atlas Notes 2.4\n재현: 편집기에 한글을 입력하고 조합이 끝나기 전에 Enter를 눌러요.\n실제 동작: 마지막 글자가 중복되고 줄이 바뀌어요.\n기대 동작: 한글 조합을 한 번만 확정하고 줄을 바꿔야 해요.'));
export const demoIssues = [
  normalizeIssue(raw(219, 'Korean IME commits the final character twice on Enter', 'Environment: Windows 11 / Chrome 128 / Atlas Notes 2.4\nSteps: type Korean in the editor, then press Enter during composition.\nActual: the final composing character is committed twice before the newline.\nExpected: commit once and insert a newline.')),
  normalizeIssue(raw(187, '한글 입력 중 자동 저장하면 조합이 끊겨요', '환경: Windows 11, Chrome 128, Atlas Notes 2.4\n재현: 한글 조합 중 5초 간격 자동 저장이 실행돼요. Enter는 누르지 않아요.\n실제 동작: 조합 중인 글자가 분리돼요. 글자가 중복되지는 않아요.')),
  normalizeIssue(raw(163, 'Enter 키를 누르면 검색 요청이 두 번 전송돼요', '환경: Windows 11, Chrome 128, Atlas Notes 2.4\n재현: 검색창에 영어를 입력하고 Enter를 눌러요. 편집기에서는 발생하지 않아요.\n원인: 검색 폼의 keydown과 submit 핸들러가 각각 요청을 보내요. 한글 조합과 무관해요.')),
  normalizeIssue(raw(104, '한글 Enter 문제', '한글 입력이 이상해요. Enter를 누를 때 가끔 그래요.', 'closed')),
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
