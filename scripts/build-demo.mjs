import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {demoSnapshot} from '../data/demo.mjs';

const root = new URL('../', import.meta.url);
export async function buildDemo(output = new URL('dist/', root)) {
  let html = await readFile(new URL('index.html', root), 'utf8');
  const {version} = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
  const script = html.match(/<script>([\s\S]*?)<\/script>/);
  const style = html.match(/<style>([\s\S]*?)<\/style>/);
  if (!script || !style) throw new Error('Missing app script or styles.');
  const asset = (text, extension) => `app.${createHash('sha256').update(text).digest('hex').slice(0, 12)}.${extension}`;
  const js = asset(script[1], 'js'), css = asset(style[1], 'css');
  const sample = JSON.stringify(demoSnapshot()).replace(/</g, '\\u003c');
  const policy = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; base-uri 'none'; form-action 'none'";
  html = html.replace('<html lang="en">', '<html lang="en" data-hosted-demo="true">')
    .replace('<meta charset="utf-8">', `<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="app-version" content="${version}">`)
    .replace(style[0], `<link rel="stylesheet" href="./${css}">`)
    .replace(script[0], `<script type="application/json" id="sample-data">${sample}</script>\n<script src="./${js}" defer></script>`)
    .replace('id="search" class="search-card"', 'id="search" class="search-card" hidden')
    .replace('id="hosted-intro" class="search-card" hidden', 'id="hosted-intro" class="search-card"')
    .replace('</head>', '<link rel="canonical" href="https://patrick-sch03.github.io/jev-issue-radar/"><meta property="og:title" content="Jev Issue Radar — try the sample"><meta property="og:description" content="Compare likely duplicate GitHub issues and inspect the evidence. No installation or API key needed for the sample."></head>');
  await mkdir(output, {recursive: true});
  await writeFile(new URL(js, output), script[1]);
  await writeFile(new URL(css, output), style[1]);
  await writeFile(new URL('index.html', output), html);
  await writeFile(new URL('.nojekyll', output), '');
  return {version, files: ['index.html', js, css, '.nojekyll']};
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildDemo();
  console.log(`Built public sample ${result.version}: ${result.files.join(', ')}`);
}
