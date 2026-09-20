import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {randomUUID, randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {rankCandidates} from './lib/core.mjs';
import {loadRepositoryIssue} from './lib/github.mjs';
import {compareIssues} from './lib/jev.mjs';
import {demoSnapshot} from './data/demo.mjs';

export const APP_VER = '0.2.0';
export function createApp({env = process.env, load = loadRepositoryIssue, compare = compareIssues, now = Date.now, bodyTimeoutMs = 5000} = {}) {
  const snapshots = new Map();
  const csrf = randomUUID();
  let busy = false, usedCalls = 0;
  const maxCalls = Number(env.JEV_MAX_CALLS ?? '20');
  if (!Number.isInteger(maxCalls) || maxCalls < 1 || maxCalls > 100) throw new Error('JEV_MAX_CALLS must be an integer from 1 to 100.');
  const liveEnabled = env.JEV_ENABLE_LIVE === '1';
  const keyConfigured = Boolean(env.OPENROUTER_API_KEY);
  const html = new URL('./index.html', import.meta.url);
  const staticFiles = new Map([['/', [html, 'text/html; charset=utf-8']], ['/index.html', [html, 'text/html; charset=utf-8']], ['/docs/brand.svg', [new URL('./docs/brand.svg', import.meta.url), 'image/svg+xml']]]);
  const json = (res, status, data) => {if (res.destroyed || res.writableEnded) return; res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8'}); res.end(JSON.stringify(data));};
  function body(req) {
    return new Promise((resolveBody, reject) => {
      let size = 0, finished = false; const chunks = [];
      const fail = (message, status = 400) => finish(Object.assign(new Error(message), {status}));
      const onData = chunk => {size += chunk.length; if (size > 8192) fail('Request body is too large.', 413); else chunks.push(chunk);};
      const onEnd = () => {
        let input;
        try {input = JSON.parse(Buffer.concat(chunks).toString('utf8'));} catch {return fail('Invalid request format.');}
        if (!input || typeof input !== 'object' || Array.isArray(input)) return fail('Request must be a JSON object.');
        finish(null, input);
      };
      const onError = () => fail('The request was interrupted.');
      const timer = setTimeout(() => fail('Request body deadline exceeded.', 408), bodyTimeoutMs);
      function finish(error, value) {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        req.off('data', onData); req.off('end', onEnd); req.off('aborted', onError);
        if (error) {req.resume(); reject(error);} else resolveBody(value);
      }
      req.on('data', onData); req.once('end', onEnd); req.once('error', onError); req.once('aborted', onError);
      if (Number(req.headers['content-length']) > 8192) fail('Request body is too large.', 413);
    });
  }
  const server = http.createServer({maxHeaderSize: 8192, headersTimeout: 5000, requestTimeout: 10000, connectionsCheckingInterval: 1000}, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const nonce = randomBytes(18).toString('base64');
    res.setHeader('Content-Security-Policy', `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`);
    const address = server.address();
    const hosts = [`127.0.0.1:${address.port}`, `localhost:${address.port}`];
    if (!hosts.includes(req.headers.host)) return json(res, 403, {error: 'Use the local server address.'});
    const origin = `http://${req.headers.host}`;
    if (req.headers.origin && req.headers.origin !== origin) return json(res, 403, {error: 'Requests from other sites are not allowed.'});
    if (req.headers['sec-fetch-site'] === 'cross-site') return json(res, 403, {error: 'Requests from other sites are not allowed.'});
    try {
      if (!req.url.startsWith('/') || req.url.startsWith('//') || req.url.includes('\\')) throw new Error('Invalid request target.');
      const path = new URL(req.url, origin).pathname;
      if (req.method === 'GET' && staticFiles.has(path)) {
        const [file, contentType] = staticFiles.get(path);
        let bytes = await readFile(file);
        if (contentType.startsWith('text/html')) bytes = bytes.toString('utf8').replace(/<(script|style)>/g, `<$1 nonce="${nonce}">`);
        res.writeHead(200, {'Content-Type': contentType}); return res.end(bytes);
      }
      if (req.method === 'GET' && path === '/api/status') return json(res, 200, {version: APP_VER, liveEnabled, keyConfigured, remainingCalls: maxCalls - usedCalls, csrf});
      if (req.method === 'GET' && path === '/api/demo') return json(res, 200, demoSnapshot());
      if (req.method !== 'POST' || !['/api/preview', '/api/analyze'].includes(path)) return json(res, 404, {error: 'Page not found.'});
      if (req.headers['x-radar-token'] !== csrf || !req.headers['content-type']?.startsWith('application/json')) return json(res, 403, {error: 'Refresh the page and try again.'});
      if (busy) {res.shouldKeepAlive = false; return json(res, 409, {error: 'Another request is in progress. Please wait.'});}
      busy = true;
      try {
        const input = await body(req);
        for (const [id, item] of snapshots) if (now() - item.createdAt > 600000) snapshots.delete(id);
        if (path === '/api/preview') {
          if (typeof input.url !== 'string' || input.url.length > 2048) throw new Error('Enter a valid GitHub issue URL.');
          const result = await load(input.url);
          const candidates = rankCandidates(result.source, result.issues);
          const id = randomUUID();
          while (snapshots.size >= 20) snapshots.delete(snapshots.keys().next().value);
          const snapshot = {id, mode: 'preview', source: result.source, coverage: result.coverage, candidates, createdAt: now()};
          snapshots.set(id, snapshot);
          return json(res, 200, snapshot);
        }
        if (!liveEnabled || !keyConfigured) return json(res, 403, {error: 'Set your API key and start the server with run.ps1 -Live to enable Jev.'});
        const snapshot = snapshots.get(input.id);
        if (!snapshot) return json(res, 410, {error: 'This preview has expired. Load candidates again.'});
        if (snapshot.mode === 'live') return json(res, 200, snapshot);
        if (snapshot.candidates.length > maxCalls - usedCalls) return json(res, 429, {error: 'The Jev call limit for this server session has been reached.'});
        const candidates = [];
        for (const candidate of snapshot.candidates) {
          usedCalls++;
          try {
            const decision = await compare(snapshot.source, candidate.issue, {apiKey: env.OPENROUTER_API_KEY, ...(env.JEV_MODEL ? {model: env.JEV_MODEL} : {})});
            candidates.push({...candidate, decision});
          } catch (error) {candidates.push({...candidate, decision: {relation: 'failed', label: 'Analysis failed', error: error.message, flags: []}});}
        }
        const order = {duplicate: 0, related: 1, insufficient: 2, distinct: 3, failed: 4};
        candidates.sort((a, b) => order[a.decision.relation] - order[b.decision.relation] || b.retrievalScore - a.retrievalScore);
        const result = {...snapshot, mode: 'live', analyzedAt: new Date(now()).toISOString(), candidates};
        snapshots.set(snapshot.id, result);
        return json(res, 200, result);
      } finally {busy = false;}
    } catch (error) {res.shouldKeepAlive = false; return json(res, error.status || 400, {error: error.message || 'Could not complete the request.'});}
  });
  server.maxConnections = 32;
  server.maxRequestsPerSocket = 100;
  server.keepAliveTimeout = 5000;
  return server;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 4318);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be 1–65535');
  createApp().listen(port, '127.0.0.1', () => console.log(`Jev Issue Radar ${APP_VER}: http://127.0.0.1:${port}`));
}
