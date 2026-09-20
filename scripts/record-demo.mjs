import {createRequire} from 'node:module';
import {mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {startStaticDemo} from './static-demo-server.mjs';

// Encode actual browser screenshots into an animation; no fabricated UI or model output.
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const sharp = require(process.env.SHARP_MODULE || 'sharp');
const local = await startStaticDemo();
const browser = await chromium.launch({headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? {channel: process.env.PLAYWRIGHT_CHANNEL} : {})});
const page = await browser.newPage({viewport: {width: 1180, height: 800}, colorScheme: 'light', reducedMotion: 'reduce'});
const frames = [], delays = [], captions = [];
const artifacts = new URL('../artifacts/', import.meta.url);await mkdir(artifacts, {recursive: true});
async function frame(name, delay) {
  await page.evaluate(() => document.fonts.ready);
  const bytes = await page.screenshot();frames.push(bytes);delays.push(delay);captions.push(name);
  await writeFile(new URL(`tour-${frames.length}.png`, artifacts), bytes);
}
try {
  await page.goto(local.url);await page.getByText('Demo results', {exact: true}).waitFor();
  await frame('Open the public sample: no setup and no live AI', 2500);
  await page.getByRole('button', {name: 'Compare sample reports'}).click();
  await page.getByRole('button', {name: 'Duplicates', exact: true}).click();
  await frame('Filter likely duplicates and inspect both passages', 4000);
  await page.getByRole('button', {name: 'Related', exact: true}).click();
  await frame('Compare a related report with a different trigger', 3000);
  await page.getByRole('button', {name: 'Needs review', exact: true}).click();
  await frame('Sparse reports stay marked as insufficient', 2500);
  await page.getByRole('button', {name: 'Duplicates', exact: true}).click();
  await page.locator('#theme').click();
  await frame('Review the same evidence in dark mode', 3000);
  const output = new URL('../docs/demo-tour.gif', import.meta.url);
  await sharp(frames, {join: {animated: true}}).gif({delay: delays, loop: 0, colours: 128, effort: 7, dither: 0}).toFile(fileURLToPath(output));
  const metadata = await sharp(fileURLToPath(output), {animated: true}).metadata();
  const report = {kind: 'Actual public sample UI screenshots; hand-authored synthetic decisions', width: metadata.width, height: metadata.pageHeight,
    frames: metadata.pages, durationMs: delays.reduce((sum, x) => sum + x, 0), captions};
  await writeFile(new URL('../docs/demo-tour.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} finally {await browser.close();await local.close();}
