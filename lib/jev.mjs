import {performance} from 'node:perf_hooks';
import {pairState, decisionQuestions, parseDecision} from './core.mjs';
import {readJson} from './http.mjs';

export const JEV_MODEL = 'typesafe/jev-1.13';

// The provider integration and real Choice decision call intentionally live together.
export async function compareIssues(source, candidate, {apiKey, model = JEV_MODEL, fetchImpl: fetcher = fetch, timeoutMs = 20000} = {}) {
  if (!apiKey) throw new Error('Set OPENROUTER_API_KEY on the server before running a comparison.');
  const state = pairState(source, candidate);
  const request = {model, state, questions: decisionQuestions(state)};
  const start = performance.now();
  const signal = AbortSignal.timeout(timeoutMs);
  let response;
  try {
    response = await fetcher('https://openrouter.ai/api/alpha/decisions', {
      method: 'POST', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`},
      body: JSON.stringify(request), signal, redirect: 'error',
    });
  } catch { throw new Error('The Jev connection timed out or failed. Try again.'); }
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Jev request failed (HTTP ${response.status}). Check your API key, credits and rate limits.`);
  }
  let data;
  try { data = await readJson(response, {maxBytes: 256 * 1024, signal}); }
  catch { throw new Error(signal.aborted ? 'The Jev response exceeded the deadline. Try again.' : 'Could not read the Jev response within the 256 KiB limit.'); }
  if (performance.now() - start > timeoutMs) throw new Error('The Jev response exceeded the deadline. Try again.');
  const cost = data?.usage?.cost;
  return {
    ...parseDecision(data, state), latencyMs: Math.round(performance.now() - start),
    costUsd: typeof cost === 'number' && Number.isFinite(cost) && cost >= 0 ? cost : null,
    model: typeof data.model === 'string' ? data.model.slice(0, 100) : model,
  };
}
