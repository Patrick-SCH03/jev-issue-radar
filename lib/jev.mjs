import {performance} from 'node:perf_hooks';
import {pairState, decisionQuestions, parseDecision} from './core.mjs';

export const JEV_ENDPOINT = 'https://openrouter.ai/api/alpha/decisions';
export const JEV_MODEL = 'typesafe/jev-1.13';

// The provider integration and real Choice decision call intentionally live together.
export async function compareIssues(source, candidate, {apiKey, model = JEV_MODEL, fetchImpl = fetch, timeoutMs = 20000} = {}) {
  if (!apiKey) throw new Error('Set OPENROUTER_API_KEY on the server before running a comparison.');
  const state = pairState(source, candidate);
  const request = {model, state, questions: decisionQuestions(state)};
  const start = performance.now();
  let response;
  try {
    response = await fetchImpl(JEV_ENDPOINT, {
      method: 'POST', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`},
      body: JSON.stringify(request), signal: AbortSignal.timeout(timeoutMs), redirect: 'error',
    });
  } catch { throw new Error('The Jev connection timed out or failed. Try again.'); }
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Jev request failed (HTTP ${response.status}). Check your API key, credits and rate limits.`);
  }
  let data;
  try { data = await response.json(); } catch { throw new Error('Could not read the Jev response.'); }
  if (performance.now() - start > timeoutMs) throw new Error('The Jev response exceeded the deadline. Try again.');
  const cost = data?.usage?.cost;
  return {
    ...parseDecision(data, state), latencyMs: Math.round(performance.now() - start),
    costUsd: typeof cost === 'number' && Number.isFinite(cost) && cost >= 0 ? cost : null,
    model: typeof data.model === 'string' ? data.model.slice(0, 100) : model,
  };
}
