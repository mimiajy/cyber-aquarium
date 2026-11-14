// Render-call contract only: no fake FPS or GPU timing from this mock.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile, writeFile } from 'node:fs/promises';
const study=new URL('../',import.meta.url),root=new URL('../../../',import.meta.url);
const images={};
for(const name of ['fish','tetra','angelfish','jellyfish','coral','depth']){
  const png=await readFile(new URL(`assets/${name}.png`,study));
  images[name]={name,width:png.readUInt32BE(16),height:png.readUInt32BE(20)};
}
async function runtime(before){
  const s=vm.createContext({Math});s.window=s;
  vm.runInContext(await readFile(new URL('js/core.js',root),'utf8'),s);
  for(const name of ['warp','fish-school','scene'])vm.runInContext(await readFile(new URL(`${before?'perf/baseline/':''}${name}.js`,study),'utf8'),s);
  vm.runInContext(await readFile(new URL('performance.js',study),'utf8'),s);
  return s;
}
function surfaces(){
  const log=[],shaders=[],uniforms={},draws=[];let image,viewport,radials=0;
  const gl=new Proxy({
    isContextLost:()=>false,getShaderParameter:()=>true,getProgramParameter:()=>true,getAttribLocation:()=>0,
    getUniformLocation:(_p,name)=>name,getParameter:()=>4096,
    shaderSource:(_shader,code)=>shaders.push(code),
    bindTexture:(_type,tex)=>{image=tex;},texImage2D:(...args)=>{Object.assign(image,{name:args.at(-1).name});},
    viewport:(...values)=>{viewport=values;},uniform2f:(key,...v)=>{uniforms[key]=v;},uniform1f:(key,v)=>{uniforms[key]=v;},
    clear:()=>log.push('clear'),drawElements:()=>{draws.push({image:image.name,viewport:[...viewport],uniforms:structuredClone(uniforms)});log.push('write');},
  },{get:(target,key)=>key in target?target[key]:String(key).startsWith('create')?()=>({}):String(key).toUpperCase()===key?key:()=>{}});
  let gpuCanvas;
  const context=()=>new Proxy({globalAlpha:1,drawImage:(source,...args)=>{if(source===gpuCanvas)log.push({copy:args});},createRadialGradient:()=>{radials++;return{addColorStop(){}};},createLinearGradient:()=>({addColorStop(){}})},
    {get:(target,key)=>key in target?target[key]:()=>{},set:(target,key,v)=>{target[key]=v;return true;}});
  const create=(width,height)=>{
    const canvas={width,height,addEventListener(){},getContext:kind=>kind==='webgl'?gl:context()};
    if(!gpuCanvas)gpuCanvas=canvas;return canvas;
  };
  const reset=()=>{log.length=draws.length=0;radials=0;};
  return {create,context,log,shaders,draws,reset,get radials(){return radials;},get canvas(){return gpuCanvas;}};
}
const old=await runtime(true),now=await runtime(false),results=[];
for(const [width,height] of [[1280,720],[390,844]])for(const count of [10,25,50]){
  const a=surfaces(),b=surfaces();
  const before=new old.FantasyReef.Scene(images,width,height,a.create),after=new now.FantasyReef.Scene(images,width,height,b.create);
  old.ReefPerf.populate(before,count);now.ReefPerf.populate(after,count);
  assert.deepEqual(b.shaders,a.shaders,'Deformation shader changed');
  before.update(1/60);after.update(1/60);
  before.draw(a.context());after.draw(b.context()); // Warm textures/glow cache.
  a.reset();b.reset();before.draw(a.context());after.draw(b.context());
  const copies=log=>log.filter(item=>typeof item==='object');
  assert.equal(a.draws.length,count+4);assert.equal(b.draws.length,count+4);
  const epochs=log=>{let dirty=false,n=0;for(const item of log){if(item==='write')dirty=true;else if(typeof item==='object'&&dirty){n++;dirty=false;}}return n;};
  assert.equal(epochs(a.log),count+4);assert.equal(epochs(b.log),1);
  assert.equal(b.log.filter(x=>x==='clear').length,1);
  const commands=after.spriteCommands;
  for(let i=0;i<commands.length;i++){
    const c=commands[i],oldDraw=a.draws[i],newDraw=b.draws.find(d=>d.image===c.image.name&&d.uniforms.phase===c.phase&&d.uniforms.size[0]===c.width);
    assert.ok(newDraw);assert.deepEqual(newDraw.uniforms,oldDraw.uniforms);
    assert.equal(c.rw,oldDraw.viewport[2]);assert.equal(c.rh,oldDraw.viewport[3]);
    assert.deepEqual(copies(b.log)[i].copy.slice(4),copies(a.log)[i].copy.slice(4),'Destination geometry changed');
    assert.ok(c.sx>=0&&c.sy>=0&&c.sx+c.rw<=b.canvas.width&&c.sy+c.rh<=b.canvas.height);
    for(let j=0;j<i;j++){const d=commands[j];assert.ok(c.sx+c.rw<=d.sx||d.sx+d.rw<=c.sx||c.sy+c.rh<=d.sy||d.sy+d.rh<=c.sy,'Overlapping atlas tiles');}
  }
  assert.equal(b.radials,0);
  results.push({width,height,count,beforeSourceEpochs:epochs(a.log),afterSourceEpochs:epochs(b.log),beforeClears:a.log.filter(x=>x==='clear').length,afterClears:1,draws:b.draws.length,beforeRadialGradients:a.radials,afterRadialGradients:b.radials,atlas:`${b.canvas.width}x${b.canvas.height}`});
  after.setCount(10);after.resize(width+12,height+4);after.draw(b.context());assert.equal(after.warp.cursor,14);
}
await writeFile(new URL('render-contract-results.json',import.meta.url),JSON.stringify({scope:'Mock call contract; not GPU timing or FPS',results},null,2)+'\n');
console.table(results);console.log('PASS: original shaders, uniforms, tile resolution, destination geometry; non-overlapping atlas, one source-write epoch. Resize/count changes passed.');
