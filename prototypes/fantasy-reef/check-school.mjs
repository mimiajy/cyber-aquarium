// Local behavior checks. This does not measure browser FPS or replace visual QA.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

const root = fileURLToPath(new URL('../../', import.meta.url));
const ctx = new Proxy({}, { get: (_, name) => name.startsWith('create') ? () => ({ addColorStop() {} }) : (...args) => {
  for (const n of args) if (typeof n === 'number') assert.ok(Number.isFinite(n), `${name} geometry`);
}, set: () => true });
const createCanvas = () => ({ getContext: kind => kind === 'webgl' ? null : ctx });
const math = Object.create(Math); let seed = 14;
math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const sandbox = vm.createContext({ console, Math: math }); sandbox.window = sandbox;
for (const file of ['js/core.js','prototypes/fantasy-reef/warp.js','prototypes/fantasy-reef/fish-school.js','prototypes/fantasy-reef/scene.js']) {
  vm.runInContext(await readFile(path.join(root, file), 'utf8'), sandbox, { filename: file });
}
const { Scene } = sandbox.FantasyReef;
const { SchoolFish, School, angleDelta } = sandbox.ReefSchool;
const images = Object.fromEntries(['depth','coral','fish','tetra','angelfish','jellyfish'].map(key => [key, { width: 1200, height: key === 'jellyfish' ? 1800 : 800 }]));
const result = [];

for (const [width, height] of [[1440,900],[390,844],[320,600]]) {
  for (const count of [10,18,30]) {
    const scene = new Scene(images, width, height, createCanvas);
    scene.setCount(count);
    assert.equal(scene.fish.length, count);
    assert.equal(new Set(scene.fish.map(f => f.kind)).size, 3, 'All species participate in the same count');
    assert.ok(Math.max(...scene.fish.map(f => f.x)) - Math.min(...scene.fish.map(f => f.x)) > width * .45, 'Distributed spawning');
    const visited = new Set(); let yawStep = 0, edgeFrames = 0;
    const started = performance.now();
    for (let step = 0; step < 3600; step++) {
      const before = scene.fish.map(f => ({ heading: f.heading, yaw: f.yaw }));
      scene.update(1 / 60);
      for (let i = 0; i < count; i++) {
        const f = scene.fish[i];
        assert.ok(Number.isFinite(f.x + f.y + f.vx + f.vy + f.beat));
        assert.ok(Math.abs(angleDelta(f.heading, before[i].heading)) <= f.maxTurn / 60 + 1e-8, 'Bounded turning');
        yawStep = Math.max(yawStep, Math.abs(f.yaw - before[i].yaw));
        assert.ok(f.x >= f.radius && f.x <= width - f.radius);
        assert.ok(f.y >= 0 && f.y <= height);
        if (step % 60 === 0) visited.add(`${Math.min(3, Math.floor(f.x / width * 4))}:${Math.min(3, Math.floor(f.y / height * 4))}`);
        if (f.x <= f.radius + 4.001 || f.x >= width - f.radius - 4.001) edgeFrames++;
      }
    }
    const milliseconds = performance.now() - started;
    assert.ok(yawStep < .032, 'No abrupt left/right projection switch');
    assert.ok(visited.size >= 8, 'Fish use multiple depths and lateral zones');
    assert.ok(edgeFrames < count * 3600 * .08, 'No sustained wall pinning');
    const old = scene.fish.slice(0,10);
    scene.setCount(30); scene.setCount(10);
    assert.ok(scene.fish.every((f,i) => f === old[i]), 'Slider preserves surviving fish state');
    scene.setCount(18); scene.draw(ctx);
    const frozen = scene.fish.map(f => [f.x,f.y,f.beat]);
    const time = scene.time;
    scene.setTheme('day', true); scene.draw(ctx);
    assert.equal(scene.dayBlend, 1); assert.equal(scene.time, time);
    assert.deepEqual(scene.fish.map(f => [f.x,f.y,f.beat]), frozen, 'Rendering/paused controls do not advance simulation');
    scene.setTheme('neon'); for (let i=0;i<180;i++) scene.update(1/60);
    assert.ok(scene.dayBlend < .001);
    result.push({ viewport: `${width}x${height}`, count, occupiedCells: visited.size, maxYawStep: Number(yawStep.toFixed(4)), wallPinnedPercent: Number((edgeFrames / count / 3600 * 100).toFixed(2)), simulationMs: Math.round(milliseconds) });
  }
}
console.table(result);

for (const kind of ['reef','tetra','angel']) {
  const world = { width: 1440, height: 900, time: 0, food: [], fish: [], jellies: [], sparkle() {} };
  const fish = new SchoolFish(40, kind, world, 0);
  fish.x = 500; fish.y = 450; fish.heading = 0; fish.vx = fish.cruise; fish.vy = 0;
  world.fish = [fish]; const food = { x: 690, y: 460, life: 18, eaten: false }; world.food = [food];
  const school = new School(); let steps = 0;
  for (;steps<1080&&!food.eaten;steps++) { world.time += 1/60; food.y += 4/60; food.life -= 1/60; school.update(world,1/60); }
  assert.ok(food.eaten, `${kind} must reach and consume food`);
  console.log(`✓ ${kind} consumes food in ${(steps/60).toFixed(2)} simulation seconds`);
}

const separate = new Scene(images,1440,900,createCanvas);
separate.fish = [new SchoolFish(70,'tetra',separate,0),new SchoolFish(71,'tetra',separate,0)];
separate.fish.forEach((f,i)=>{ f.x=700;f.y=450;f.heading=i?0:Math.PI;f.vx=Math.cos(f.heading)*f.cruise;f.vy=0; });
for(let i=0;i<180;i++)separate.update(1/60);
assert.ok(Math.hypot(separate.fish[0].x-separate.fish[1].x,separate.fish[0].y-separate.fish[1].y)>25,'Coincident fish separate without NaN');
console.log('✓ Coincident fish separate; food pursuit, all-species count, pause-safe controls and smooth turns passed.');
const socialWorld = { width:3000, height:2000, time:0, food:[], jellies:[], sparkle() {} };
function controlledFish() {
  const f = new SchoolFish(90,'tetra',socialWorld,0);
  Object.assign(f,{x:690,y:920,heading:0,vx:f.cruise,vy:0,phase:0}); return f;
}
const solo=controlledFish(), social=controlledFish();
solo.update(1/60,socialWorld,[]);
social.update(1/60,socialWorld,[{id:91,kind:'tetra',x:770,y:975,vx:35,vy:20,depth:social.depth,artWidth:social.artWidth}]);
assert.ok(social.heading>solo.heading+.00001,'Cohesion/alignment react to a same-species neighbor');
const targetA={x:840,y:920,life:18,eaten:false}, targetB={x:835,y:920,life:18,eaten:false};
socialWorld.food=[targetA,targetB]; const sticky=controlledFish(); sticky.target=targetA;
sticky.update(1/60,socialWorld,[]); assert.equal(sticky.target,targetA,'Small distance differences do not cause food-target chatter');
targetB.x=sticky.x+25; targetB.y=sticky.y;
sticky.update(1/60,socialWorld,[]); assert.equal(sticky.target,targetB,'A materially closer food can replace the target');
console.log('✓ Neighbor cohesion/alignment and food-target hysteresis passed.');
const resized = new Scene(images,1440,900,createCanvas);
resized.setCount(30); const identities=resized.fish.map(f=>f.id);
resized.resize(320,600);
assert.deepEqual(resized.fish.map(f=>f.id),identities,'Resize preserves all existing fish');
assert.ok(resized.fish.every(f=>f.x>=f.radius&&f.x<=320-f.radius));
console.log('✓ Narrow resize preserves population and keeps sprites inside the viewport.');
console.log('Browser rendering speed and visual schooling still require browser QA.');
