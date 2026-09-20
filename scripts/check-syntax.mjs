import {readdir, readFile, mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root = new URL('../', import.meta.url);
const files = ['server.mjs'];
for (const dir of ['lib','data','scripts','tests']) {
  for (const file of await readdir(new URL(`${dir}/`,root))) if (file.endsWith('.mjs')) files.push(`${dir}/${file}`);
}
const temp = await mkdtemp(join(tmpdir(),'jev-radar-syntax-'));
try {
  const html = await readFile(new URL('index.html',root),'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  if (!scripts.length) throw new Error('No inline app script found');
  const inline = join(temp,'app.mjs'); await writeFile(inline,scripts.map(x=>x[1]).join('\n'));
  for (const file of [...files.map(x=>fileURLToPath(new URL(x,root))),inline]) {
    const result = spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
    if(result.status!==0) throw new Error(result.stderr || result.error?.message);
  }
  console.log(`Syntax OK: ${files.length + 1} files (including HTML script)`);
} finally {await rm(temp,{recursive:true,force:true});}
