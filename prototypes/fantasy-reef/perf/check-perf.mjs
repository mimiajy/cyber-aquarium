import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile,writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { cpus } from 'node:os';
const dir=new URL('../',import.meta.url),root=new URL('../../../',import.meta.url);
const ctx=new Proxy({globalAlpha:1},{get:(target,key)=>key in target?target[key]:String(key).startsWith('create')?()=>({addColorStop(){}}):()=>{},set:(target,key,v)=>{target[key]=v;return true;}});
const create=()=>({getContext:k=>k==='webgl'?null:ctx});
const images=Object.fromEntries(['fish','tetra','angelfish','coral','depth','jellyfish'].map(key=>[key,{width:1200,height:key==='jellyfish'?1800:800}]));
async function runtime(before){
  const s=vm.createContext({console,Math});s.window=s;
  vm.runInContext(await readFile(new URL('js/core.js',root),'utf8'),s);
  for(const name of ['warp','fish-school','scene'])vm.runInContext(await readFile(new URL(`${before?'perf/baseline/':''}${name}.js`,dir),'utf8'),s);
  vm.runInContext(await readFile(new URL('performance.js',dir),'utf8'),s);
  vm.runInContext(await readFile(new URL('timing.js',dir),'utf8'),s);
  return s;
}
const old=await runtime(true),now=await runtime(false);
const scene=(r,n)=>{const s=new r.FantasyReef.Scene(images,1280,720,create);r.ReefPerf.populate(s,n);return s;};
for(const n of [10,25,50]){
  const a=scene(old,n),b=scene(now,n);
  for(let step=0;step<1200;step++){
    if(step===300){a.feed(600,330);b.feed(600,330);}
    a.update(1/60);b.update(1/60);
    for(let i=0;i<n;i++)for(const key of ['x','y','vx','vy','heading','turnRate','beat','group','speed'])assert.equal(b.fish[i][key],a.fish[i][key],`Behavior changed: ${n}/${step}/${i}/${key}`);
    assert.equal(b.food.filter(f=>f.eaten).length,a.food.filter(f=>f.eaten).length);
  }
}
console.log('PASS: 10/25/50 fish, 1200 fixed steps each, motion/state identical to baseline including feeding.');
const clock=[];
for(const fps of [60,30,20,10]){
  const stepper=new now.ReefTiming.FrameStepper();let x=0,oldX=0;
  for(let i=0;i<fps*3;i++){stepper.advance(1/fps,dt=>{x+=31*dt;});oldX+=31*Math.min(.04,1/fps);}
  assert.ok(Math.abs(x-93)<1e-9);
  clock.push({syntheticRenderFPS:fps,oldDistance:oldX,newDistance:x,expectedDistance:93});
}
console.log('PASS: 3 seconds of synthetic 60/30/20/10 Hz all advance exactly 3 simulation seconds.');
function measure(s,steps){const t=performance.now();for(let i=0;i<steps;i++)s.update(1/60);return (performance.now()-t)/steps;}
const median=a=>a.slice().sort((x,y)=>x-y)[Math.floor(a.length/2)];
const cpu=[];
for(const n of [10,25,50]){
  const before=[],after=[];
  for(let repeat=0;repeat<7;repeat++){
    for(const [r,bucket] of repeat%2?[[now,after],[old,before]]:[[old,before],[now,after]]){
      const s=scene(r,n);measure(s,180);bucket.push(measure(s,1200));
    }
  }
  cpu.push({count:n,beforeUpdateMs:median(before),afterUpdateMs:median(after),beforeSamples:before,afterSamples:after});
}
const report={measuredAt:new Date().toISOString(),backend:`Node ${process.version}; ${cpus()[0]?.model}; VM CPU simulation only`,viewport:'1280x720 logical; no drawing in CPU timings',baselineCommit:'85180cd',samplesPerVersion:7,stepsPerSample:1200,cpu,clock,behavior:'Exact numeric equality across 10/25/50,1200 steps with feeding',browserFPS:'Not measured by this script. Use perf/index.html in a foreground browser.'};
await writeFile(new URL('cpu-results.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.table(cpu.map(r=>({count:r.count,beforeMs:r.beforeUpdateMs.toFixed(4),afterMs:r.afterUpdateMs.toFixed(4),change:`${((r.afterUpdateMs/r.beforeUpdateMs-1)*100).toFixed(1)}%`})));
console.table(clock);
