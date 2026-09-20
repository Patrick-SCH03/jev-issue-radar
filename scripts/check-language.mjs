import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

// Enforce the repository's English convention without restricting users' issue text.
const root = new URL('../', import.meta.url);
const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {cwd: fileURLToPath(root), encoding: 'utf8'}).split('\0').filter(Boolean);
const failures = []; let checked = 0;
for (const file of new Set(files)) {
  if (!/\.(md|mjs|js|json|html|css|yml|yaml|ps1|svg|txt)$/i.test(file) && file !== 'LICENSE') continue;
  let text;
  try {text = await readFile(new URL(file, root), 'utf8');} catch (error) {if (error.code === 'ENOENT') continue; throw error;}
  checked++;
  for (const [index, line] of text.split('\n').entries()) if (/\p{Script=Hangul}/u.test(line)) failures.push(`${file}:${index + 1}`);
}
if (failures.length) throw new Error('Non-English repository text found at: ' + failures.join(', '));
console.log(`Language OK: ${checked} text files checked; no Hangul characters found.`);
