// Verify the exact static payload without requiring a browser or dependencies.
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const dist = path.join(root, 'dist');

async function walk(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = path.posix.join(prefix, entry.name);
    assert.ok(!entry.isSymbolicLink(), `Symlink in output: ${relative}`);
    if (entry.isDirectory()) files.push(...await walk(path.join(directory, entry.name), relative));
    else files.push(relative);
  }
  return files.sort();
}

export async function verifyDist() {
  const files = await walk(dist);
  const sourceFiles = ['index.html', ...await walk(path.join(root, 'css'), 'css'), ...await walk(path.join(root, 'js'), 'js'), ...await walk(path.join(root, 'assets'), 'assets')].filter(file => path.basename(file) !== '.DS_Store').sort();
  assert.deepEqual(files, [...sourceFiles, '.nojekyll'].sort(), 'Only runtime files and the Pages marker belong in dist');
  const manifest = [];
  for (const file of files) {
    const data = await readFile(path.join(dist, file));
    if (file === '.nojekyll') assert.equal(data.length, 0);
    else {
      const original = await readFile(path.join(root, file));
      assert.ok(data.equals(original), `Production file differs from source: ${file}`);
      assert.ok(data.length > 0, `Empty output: ${file}`);
    }
    manifest.push({ file, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
    if (file.endsWith('.js')) execFileSync(process.execPath, ['--check', path.join(dist, file)], { stdio: 'pipe' });
  }

  let references = 0;
  const testedBases = ['/', '/cyber-aquarium/'];
  async function checkReference(from, value) {
    if (value.startsWith('#') || value.startsWith('data:')) return;
    assert.ok(!/^(?:[a-z]+:)?\/\//i.test(value), `External resource in ${from}: ${value}`);
    for (const base of testedBases) {
      const url = new URL(value, new URL(from, `https://static.example${base}`));
      assert.ok(url.pathname.startsWith(base), `Resource escapes Pages subpath: ${from} → ${value}`);
      const target = decodeURIComponent(url.pathname.slice(base.length));
      const resolved = target.endsWith('/') || !target ? `${target}index.html` : target;
      assert.ok((await stat(path.join(dist, resolved))).isFile(), `Missing resource at ${base}: ${from} → ${value}`);
    }
    references++;
  }
  for (const file of files.filter(f => /\.(html|css|svg)$/.test(f))) {
    const source = await readFile(path.join(dist, file), 'utf8');
    for (const match of source.matchAll(/(?:src|href)=["']([^"']+)["']/g)) await checkReference(file, match[1]);
    for (const match of source.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/g)) await checkReference(file, match[1]);
  }
  // App code uses only in-browser state; the bundled general-purpose p5 library
  // contains unused network helpers, so audit the app rather than its entire API.
  for (const file of sourceFiles.filter(f => f.startsWith('js/'))) {
    const source = await readFile(path.join(dist, file), 'utf8');
    assert.doesNotMatch(source, /\b(?:fetch|loadImage|loadFont|loadJSON|loadSound|loadStrings|httpGet|httpPost)\s*\(|\b(?:XMLHttpRequest|WebSocket|EventSource)\b|(?:localhost|127\.0\.0\.1)(?=[:/"'])/, `Review network dependency in ${file}`);
  }
  return { files: manifest, references, testedBases, totalBytes: manifest.reduce((sum, f) => sum + f.bytes, 0) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await verifyDist();
  console.log(`✓ dist: ${result.files.length} files, ${result.references} local references, ${result.totalBytes} bytes`);
  console.log('✓ Runtime files match source byte for byte; no local server or API dependency in app code.');
}
