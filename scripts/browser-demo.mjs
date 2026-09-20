import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {startStaticDemo} from './static-demo-server.mjs';

const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const local = process.env.DEMO_URL ? null : await startStaticDemo();
const url = process.env.DEMO_URL || local.url;
const artifacts = new URL('../artifacts/', import.meta.url); await mkdir(artifacts, {recursive: true});
const browser = await chromium.launch({headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? {channel: process.env.PLAYWRIGHT_CHANNEL} : {})});
const page = await browser.newPage({viewport: {width: 1440, height: 1000}, colorScheme: 'light'});
const errors = [], requests = [], failedResponses = [], passed = [];
page.on('pageerror', e => errors.push(e.message));
page.on('request', req => requests.push(req.url()));
page.on('response', res => {if (res.status() >= 400) failedResponses.push({url: res.url(), status: res.status()});});
async function check(name, fn) {await fn(); passed.push(name); console.log('PASS ' + name);}
try {
  await page.goto(url); await page.getByText('Demo results', {exact: true}).waitFor();
  await check('sample is clearly labeled and requires no server or key', async () => {
    assert.match(await page.locator('#hosted-intro').innerText(), /synthetic.*hand-authored/);
    assert.equal(await page.locator('#search').isVisible(), false);
    assert.equal(await page.locator('#analyze').isVisible(), false);
    assert.equal(await page.locator('.candidate').count(), 4);
  });
  await check('sample CTA reaches the evidence workspace', async () => {
    await page.getByRole('button', {name: 'Compare sample reports'}).click();
    assert.equal(await page.locator('[data-filter="duplicate"]').evaluate(el => el === document.activeElement), true);
  });
  await check('duplicate filter shows the paired source passages', async () => {
    await page.getByRole('button', {name: 'Duplicates', exact: true}).click();
    assert.equal(await page.locator('.candidate').count(), 1);assert.equal(await page.locator('blockquote').count(), 2);
    assert.match(await page.locator('#detail').innerText(), /Illustrative confidence/);
  });
  await check('related and insufficient cases remain inspectable', async () => {
    await page.getByRole('button', {name: 'Related', exact: true}).click();assert.match(await page.locator('#detail').innerText(), /Autosave/);
    await page.getByRole('button', {name: 'Needs review', exact: true}).click();assert.match(await page.locator('#detail').innerText(), /Closed issue/);
    await page.getByText('Full reports and analysis details', {exact: true}).click();assert.equal(await page.locator('details[open]').count(), 1);
  });
  await check('export retains sample provenance and contains no credentials', async () => {
    const pending = page.waitForEvent('download');await page.getByRole('button', {name: 'Export JSON'}).click();
    const download = await pending;const output = fileURLToPath(new URL('hosted-demo-export.json', artifacts));await download.saveAs(output);
    const result = JSON.parse(await readFile(output, 'utf8'));assert.equal(result.mode, 'demo');assert.equal(result.candidates.length, 4);
    assert.ok(result.candidates.every(x => x.decision.model === 'demo-fixture'));assert.ok(!('csrf' in result));
  });
  await check('repository and setup links have concrete destinations', async () => {
    assert.equal(await page.getByRole('link', {name: 'Analyze your own issues'}).getAttribute('href'), 'https://github.com/Patrick-SCH03/jev-issue-radar#quickstart');
    assert.equal(await page.getByRole('link', {name: 'Star on GitHub'}).getAttribute('href'), 'https://github.com/Patrick-SCH03/jev-issue-radar');
  });
  await page.getByRole('button', {name: 'Duplicates', exact: true}).click();
  for (const width of [1440, 768, 375]) for (const scheme of ['light', 'dark']) {
    await page.setViewportSize({width, height: 1000});
    if (await page.locator('html').getAttribute('data-theme') !== scheme) await page.locator('#theme').click();
    await check(`no horizontal overflow at ${width}px in ${scheme}`, async () => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)));
    await page.screenshot({path: fileURLToPath(new URL(`public-demo-${width}-${scheme}.png`, artifacts)), fullPage: true});
  }
  await check('no API calls or third-party requests occur', async () => {
    const base = new URL(url);assert.ok(requests.filter(x => /^https?:/.test(x)).every(x => new URL(x).origin === base.origin && new URL(x).pathname.startsWith(base.pathname)));
    assert.ok(requests.every(x => !x.includes('/api/')));
  });
  await check('no script errors or unsuccessful asset requests', async () => {assert.deepEqual(errors, []);assert.deepEqual(failedResponses, []);});
  await writeFile(new URL('public-demo-qa.json', artifacts), JSON.stringify({url, version: await page.locator('#version').innerText(), passed, errors, requests, failedResponses}, null, 2));
  console.log(`${passed.length} public-demo checks passed; no paid requests.`);
} finally {await browser.close();await local?.close();}
