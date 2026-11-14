// Copy-only production build: preserve rendering and script order exactly.
import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { root, dist, verifyDist } from './verify-dist.mjs';

execFileSync(process.execPath, [path.join(root, 'scripts/check.mjs')], { cwd: root, stdio: 'inherit' });
for (const script of ['build.mjs', 'verify-dist.mjs']) {
  execFileSync(process.execPath, ['--check', path.join(root, 'scripts', script)], { stdio: 'pipe' });
}
// Reject unintended editor/temp files instead of silently publishing them.
async function checkSource(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === '.DS_Store') continue;
    if (entry.name.startsWith('.') || entry.isSymbolicLink() || /(?:~|\.bak|\.log|\.map)$/.test(entry.name)) {
      throw new Error(`Unexpected runtime source file: ${path.join(directory, entry.name)}`);
    }
    if (entry.isDirectory()) await checkSource(path.join(directory, entry.name));
  }
}
for (const directory of ['css', 'js', 'assets']) await checkSource(path.join(root, directory));
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const item of ['index.html', 'css', 'js', 'assets']) {
  await cp(path.join(root, item), path.join(dist, item), { recursive: true, filter: source => path.basename(source) !== '.DS_Store' });
}
await writeFile(path.join(dist, '.nojekyll'), '');
const result = await verifyDist();
await writeFile(path.join(root, 'build-report.json'), JSON.stringify({ builtAt: new Date().toISOString(), output: 'dist', ...result }, null, 2) + '\n');
console.log(`\n✓ Production build: ${result.files.length} files, ${(result.totalBytes / 1024 / 1024).toFixed(2)} MiB`);
console.log(`✓ ${result.references} local resource references resolved; all runtime files unchanged.`);
console.log(`\nGitHub Pages artifact directory:\n${dist}\n`);
console.log('No files have been uploaded or published.');
