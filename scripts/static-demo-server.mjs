import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {once} from 'node:events';
import {buildDemo} from './build-demo.mjs';

// QA server: serve only the generated artifact, under a project Pages-style prefix.
export async function startStaticDemo() {
  const build = await buildDemo();
  const assets = new Map(await Promise.all(build.files.map(async file => [file, await readFile(new URL('../dist/' + file, import.meta.url))])));
  const prefix = '/jev-issue-radar/';
  const server = http.createServer((req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname;
    const name = path.startsWith(prefix) ? path.slice(prefix.length) || 'index.html' : '';
    if (req.method !== 'GET' || !assets.has(name)) {res.writeHead(404); res.end(); return;}
    const type = name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html';
    res.writeHead(200, {'Content-Type': type + '; charset=utf-8'}); res.end(assets.get(name));
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  return {url: `http://127.0.0.1:${server.address().port}${prefix}`, close: async () => {server.closeAllConnections(); await new Promise(resolve => server.close(resolve));}};
}
