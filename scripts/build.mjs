// Copy-only production build: preserve rendering and script order exactly.
import { cp, mkdir, rm, writeFile, lstat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { root, dist, verifyDist } from './verify-dist.mjs';
import { runtimeFiles } from './runtime-files.mjs';

execFileSync(process.execPath, [path.join(root, 'scripts/check.mjs')], { cwd: root, stdio: 'inherit' });
for(const check of ['scripts/check-audio.mjs','prototypes/fantasy-reef/check-school.mjs','prototypes/fantasy-reef/perf/check-render.mjs']) {
  execFileSync(process.execPath,[path.join(root,check)],{cwd:root,stdio:'inherit'});
}
for (const script of ['build.mjs', 'verify-dist.mjs','runtime-files.mjs']) {
  execFileSync(process.execPath, ['--check', path.join(root, 'scripts', script)], { stdio: 'pipe' });
}
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const item of runtimeFiles) {
  const source=path.join(root,item);
  if(!(await lstat(source)).isFile())throw Error(`Unexpected runtime source: ${item}`);
  const target=path.join(dist,item);await mkdir(path.dirname(target),{recursive:true});
  await cp(source,target);
}
await writeFile(path.join(dist, '.nojekyll'), '');
const result = await verifyDist();
await writeFile(path.join(root, 'build-report.json'), JSON.stringify({ builtAt: new Date().toISOString(), output: 'dist', ...result }, null, 2) + '\n');
console.log(`\n✓ Production build: ${result.files.length} files, ${(result.totalBytes / 1024 / 1024).toFixed(2)} MiB`);
console.log(`✓ ${result.references} local resource references resolved; all runtime files unchanged.`);
console.log(`\nGitHub Pages artifact directory:\n${dist}\n`);
console.log('No files have been uploaded or published.');
