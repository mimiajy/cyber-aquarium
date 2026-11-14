// Controller/DOM/buffer regression checks. DSP is checked separately in a browser.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const audioSource=await readFile(new URL('../prototypes/fantasy-reef/audio.js',import.meta.url),'utf8');
const timers=new Map();let timerId=0,created=0;
class Param {
  constructor(){this.value=0;this.events=[];}
  cancelScheduledValues(t){this.events.push(['cancel',t]);}
  setValueAtTime(v,t){this.events.push(['set',v,t]);}
  linearRampToValueAtTime(v,t){this.events.push(['ramp',v,t]);}
}
class Node {
  constructor(){for(const key of ['gain','frequency','Q','pan','detune','threshold','knee','ratio','attack','release'])this[key]=new Param();this.connections=[];}
  connect(target){this.connections.push(target);return target;}
  start(){this.started=true;}
}
class Context {
  constructor(){created++;this.sampleRate=8000;this.currentTime=0;this.state='suspended';this.destination={};this.listeners=[];this.nodes=[];}
  addEventListener(_event,fn){this.listeners.push(fn);}
  node(){const n=new Node();this.nodes.push(n);return n;}
  createGain(){return this.node();} createBiquadFilter(){return this.node();} createConvolver(){return this.node();}
  createOscillator(){return this.node();} createStereoPanner(){return this.node();} createBufferSource(){return this.node();} createDynamicsCompressor(){return this.node();}
  createBuffer(channels,length,sampleRate){const data=Array.from({length:channels},()=>new Float32Array(length));return{length,sampleRate,duration:length/sampleRate,getChannelData:i=>data[i]};}
  async resume(){this.state='running';this.listeners.forEach(fn=>fn());}
  async suspend(){this.state='suspended';this.listeners.forEach(fn=>fn());}
}
const env={console,URL,Float32Array,Math,AudioContext:Context,setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id)};
const s=vm.createContext(env);s.window=s;vm.runInContext(audioSource,s);
const sound=new s.ReefAudio.Soundscape();assert.equal(created,0);assert.equal(sound.playing,false);
sound.setVolume(.5);assert.equal(created,0);await sound.setEnabled(true);
assert.equal(created,1);assert.equal(sound.playing,true);assert.equal(sound.envelope.to,.275);assert.equal(sound.envelope.end,2.4);
sound.context.currentTime=1.2;const previous=sound.valueAt(1.2);sound.setVolume(.8);assert.equal(sound.envelope.from,previous);assert.equal(sound.envelope.end,1.45);
const nodeCount=sound.context.nodes.length;sound.context.currentTime=2;
await sound.setEnabled(false);assert.equal(sound.envelope.to,0);assert.equal(sound.playing,false);assert.equal(sound.envelope.end,3.6);
await sound.setEnabled(true);assert.equal(timers.size,0);assert.equal(sound.context.nodes.length,nodeCount,'Toggling reuses graph');assert.equal(created,1);
await sound.setEnabled(false);for(const fn of timers.values())fn();timers.clear();assert.equal(sound.context.state,'suspended');
sound.setVolume(2);assert.equal(sound.volume,1);sound.setVolume(-1);assert.equal(sound.volume,0);
let resolveResume;const deferred=new Context();deferred.resume=()=>{deferred.state='running';return new Promise(r=>{resolveResume=r;});};
const race=new s.ReefAudio.Soundscape({contextFactory:()=>deferred});const pending=race.toggle();await race.toggle();resolveResume();await pending;assert.equal(race.playing,false,'Delayed resume cannot override a later mute');timers.clear();
const water=s.ReefAudio.waterBuffer(new Context());assert.equal(water.duration,24);
for(let ch=0;ch<2;ch++){
  const data=water.getChannelData(ch);let energy=0,maxDelta=0;
  for(let i=0;i<data.length;i++){assert.ok(Number.isFinite(data[i]));energy+=data[i]*data[i];if(i)maxDelta=Math.max(maxDelta,Math.abs(data[i]-data[i-1]));}
  assert.ok(Math.sqrt(energy/data.length)>.01);assert.ok(Math.abs(data.at(-1)-data[0])<=maxDelta,'Water loop has no extra boundary jump');
}
// Exercise the actual page event handlers before image loading completes.
const html=await readFile(new URL('../index.html',import.meta.url),'utf8'),elements=new Map();
const element=id=>{if(!elements.has(id))elements.set(id,{value:35,textContent:'',attrs:{},events:{},setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,fn){this.events[k]=fn;},focus(){},getContext(){return{};}});return elements.get(id);};
for(const match of html.matchAll(/id="([^"]+)"/g))element(match[1]);
const doc={currentScript:{src:'https://example.test/cyber-aquarium/prototypes/fantasy-reef/app.js'},getElementById:element,querySelectorAll:()=>[],addEventListener(){},body:{classList:{toggle:()=>true}}};
const stored=new Map([['cyber-aquarium-audio-volume','.42']]);
s.document=doc;s.location={search:''};s.URLSearchParams=URLSearchParams;s.matchMedia=()=>({matches:false,addEventListener(){}});
s.localStorage={getItem:k=>stored.get(k)??null,setItem:(k,v)=>stored.set(k,v)};s.ReefTiming={FrameStepper:class{}};s.ReefPerf={};s.cancelAnimationFrame=()=>{};s.addEventListener=()=>{};s.Image=class{};
const beforePage=created;vm.runInContext(await readFile(new URL('../prototypes/fantasy-reef/app.js',import.meta.url),'utf8'),s);
assert.equal(created,beforePage,'Saved volume must not autoplay');assert.equal(element('music-volume').value,42);
await element('music').events.click();assert.equal(element('music').attrs['aria-pressed'],'true');
element('pause').events.click();assert.equal(element('music').attrs['aria-pressed'],'true','Animation pause does not mute');
element('clean').events.click();assert.equal(element('music').attrs['aria-pressed'],'true','Immersion does not mute');
element('music-volume').events.input({target:{value:'25'}});assert.equal(stored.get('cyber-aquarium-audio-volume'),'0.25');
await element('music').events.click();assert.equal(element('music').attrs['aria-pressed'],'false');timers.clear();
console.log('✓ Audio: silent initial/saved-volume load, gesture start, fade continuity, volume bounds, graph reuse, delayed-resume race, suspension and water-loop seam.');
console.log('✓ Actual UI wiring: pause/immersion keep music, toggle/volume work independently. No DSP or audible-quality claim from mocks.');
