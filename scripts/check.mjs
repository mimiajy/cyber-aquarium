// Dependency-free checks. Canvas stubs verify drawing calls, not browser appearance.
import assert from 'node:assert/strict';
import { readFile, access, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = file => readFile(path.join(root, file), 'utf8');
const scripts = (await readdir(path.join(root, 'js'))).filter(f => f.endsWith('.js'));
for (const script of [...scripts.map(f => `js/${f}`), 'server.mjs', 'scripts/check.mjs']) {
  execFileSync(process.execPath, ['--check', path.join(root, script)], { stdio: 'pipe' });
}
console.log('✓ JavaScript syntax');

const html = await read('index.html');
for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
  if (/^(?:https?:|\.\/$)/.test(match[1])) continue;
  await access(path.join(root, match[1]));
}
const vendor = await read('assets/vendor/p5.min.js');
assert.match(vendor.slice(0, 500), /p5\.js v1\.11\.3/);
assert.ok(vendor.length > 500_000);
assert.ok((await read('assets/vendor/p5.LICENSE.txt')).length > 10_000);
assert.doesNotMatch(html, /(?:src|href)="https?:/);
console.log('✓ Local assets, pinned p5.js, license, no CDN dependency');

let drawingCalls = 0;
const gradient = { addColorStop() {} };
const ctx = new Proxy({}, {
  get: (_, key) => {
    if (String(key).startsWith('create')) return () => gradient;
    return (...args) => {
      for (const arg of args) if (typeof arg === 'number') assert.ok(Number.isFinite(arg), `${String(key)} received ${arg}`);
      if (key === 'ellipse') assert.ok(args[2] >= 0 && args[3] >= 0, 'Ellipse radius');
      drawingCalls++;
    };
  },
  set: () => true,
});
const storage = new Map();
let clock = 0;
const context = vm.createContext({
  console, Math: Object.create(Math), setTimeout, clearTimeout,
  localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
  performance: { now: () => clock },
  CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
  document: { createElement: () => ({ getContext: () => ctx }), getElementById: () => ({}) },
  matchMedia: () => ({ matches: false }), dispatchEvent() {},
  p5: class { frameRate() {} },
});
context.window = context;
let seed = 123;
context.Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
for (const file of ['core', 'creatures', 'environment', 'aquarium']) vm.runInContext(await read(`js/${file}.js`), context, { filename: `${file}.js` });
const O = context.CyberAquarium;
const world = new O.Aquarium();
world.resize(1440, 900); world.setCount(18);
assert.equal(world.fish.length, 18); assert.equal(world.jellies.length, 3);
assert.ok(world.fish.every(f => Math.abs(f.angle) < .31), 'Initial body pitch stays horizontal');
world.setCount(100); assert.equal(world.fish.length, 30);
world.setCount(-1); assert.equal(world.fish.length, 10);
world.setTheme('day'); assert.equal(JSON.parse(storage.get('cyber-aquarium-settings')).theme, 'day');
console.log('✓ Initial population, horizontal orientation, count bounds, settings persistence');

const a = new O.Fish(600, 400, 0), b = new O.Fish(610, 400, 1);
a.vx = b.vx = a.vy = b.vy = 0;
const neighbors = { width: 1440, height: 900, fish: [a, b], food: [], jellies: [] };
const before = b.x - a.x;
for (let i = 0; i < 90; i++) { a.update(1 / 60, neighbors); b.update(1 / 60, neighbors); }
assert.ok(b.x - a.x > before + 20, 'Overlapping fish separate');
console.log('✓ Close fish separate');

const eater = new O.Fish(600, 400, 1);
eater.vx = 0; eater.vy = 0; world.fish = [eater]; world.food = [];
assert.equal(world.feed(750, 400), true);
assert.equal(world.feed(750, 400), false, 'Rapid clicks are throttled');
const pellets = [...world.food];
for (let i = 0; i < 900 && !pellets.some(f => f.eaten); i++) world.update(1 / 60);
assert.ok(pellets.some(f => f.eaten), 'Fish reaches and consumes falling food');
console.log('✓ Feeding, pursuit, consumption and click throttle');

world.setPaused(true);
const frozen = [world.time, eater.x, eater.y, world.environment.time];
for (let i = 0; i < 5; i++) world.draw(ctx, 1 / 24);
assert.deepEqual([world.time, eater.x, eater.y, world.environment.time], frozen);
clock += 1000;
assert.equal(world.feed(), false, 'Paused scene rejects feeding');
world.setPaused(false); world.draw(ctx, 1 / 60);
assert.ok(world.time > frozen[0]);
console.log('✓ Pause freezes simulation; resume advances it');

world.fish = []; world.setCount(30);
for (let i = 0; i < 6000; i++) world.update(1 / 60);
assert.ok(world.fish.every(f => Number.isFinite(f.x + f.y + f.vx + f.vy) && f.x >= 0 && f.x <= world.width && f.y >= 0 && f.y <= world.height));
world.setTheme('neon'); world.draw(ctx, 1 / 60);
world.resize(320, 640); world.draw(ctx, 1 / 60);
assert.ok(drawingCalls > 1000);
world.food = [];
for (let i = 0; i < 100; i++) { clock += 250; world.feed(160, 300); }
assert.ok(world.food.length <= 56 && world.particles.length <= 140 && world.ripples.length <= 12);
for (let i = 0; i < 1800; i++) world.update(1 / 60);
assert.equal(world.food.length, 0, 'Old food expires');
console.log('✓ 100-second simulation, desktop/narrow canvas calls, bounded effects, food expiry');
console.log('\nAll checks passed. These checks do not measure browser layout or FPS.');
