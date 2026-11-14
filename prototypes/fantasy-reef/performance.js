/* Optional, local-only telemetry. No network, storage, or per-frame DOM writes. */
(() => {
  'use strict';
  const percentile=(values,p)=>values.length ? values[Math.min(values.length-1,Math.floor(values.length*p))] : 0;
  class Recorder {
    constructor(capacity=16384) {
      this.delta=new Float64Array(capacity); this.update=new Float64Array(capacity); this.render=new Float64Array(capacity);
      this.capacity=capacity; this.reset();
    }
    reset() { this.count=0; this.total=0; this.steps=0; this.simulated=0; this.clamped=0; }
    record(delta,update,render,steps=1,simulated=delta,clamped=0) {
      if (this.count>=this.capacity) return;
      const i=this.count++; this.delta[i]=delta; this.update[i]=update; this.render[i]=render;
      this.total+=delta; this.steps+=steps; this.simulated+=simulated; this.clamped+=clamped;
    }
    summary() {
      if (!this.count) return null;
      const delta=Array.from(this.delta.subarray(0,this.count)).sort((a,b)=>a-b);
      let update=0,render=0,long=0;
      for(let i=0;i<this.count;i++){update+=this.update[i];render+=this.render[i];if(this.delta[i]>25)long++;}
      return {frames:this.count,fps:this.count*1000/this.total,meanFrameMs:this.total/this.count,p50FrameMs:percentile(delta,.5),p95FrameMs:percentile(delta,.95),p99FrameMs:percentile(delta,.99),updateMs:update/this.count,renderSubmitMs:render/this.count,over25ms:long,simulationRatio:this.simulated/this.total,clampedMs:this.clamped};
    }
  }
  function addHud(getInfo) {
    const box=document.createElement('aside'); box.id='perf-hud'; box.setAttribute('aria-label','本地性能测量');
    box.style.cssText='position:fixed;right:18px;top:100px;z-index:25;padding:12px 15px;background:#061d2fed;border:1px solid #9ed3cd55;border-radius:10px;color:#cfebe4;font:11px/1.8 ui-monospace,monospace;white-space:pre;pointer-events:none';
    document.body.append(box);
    const rec=new Recorder();
    const timer=setInterval(()=>{
      const info=getInfo(),s=rec.summary();
      box.textContent=document.hidden?'性能测量：后台暂停，不计入 FPS':s?`${s.fps.toFixed(1)} FPS · p95 ${s.p95FrameMs.toFixed(1)} ms\n更新 ${s.updateMs.toFixed(2)} / 提交 ${s.renderSubmitMs.toFixed(2)} ms\n时间推进 ${(s.simulationRatio*100).toFixed(1)}% · 鱼 ${info.count}\n画布 ${info.width}×${info.height} · ${info.backend}\n图集绘制批次 ${info.epochs} · 清屏 ${info.clears}`:'等待前台动画帧…';
      rec.reset();
    },1000);
    return {rec,destroy(){clearInterval(timer);box.remove();}};
  }
  function populate(scene,count) {
    scene.setCount(Math.min(count,30));
    // Only the stress-test harness exceeds the normal 10–30 slider limit.
    const order=['tetra','tetra','reef','tetra','reef','angel','tetra','reef','tetra','angel'];
    while(scene.fish.length<count){const slot=scene.fish.length;scene.fish.push(new ReefSchool.SchoolFish(scene.school.nextId++,order[slot%10],scene,slot));}
    scene.count=count; scene.syncRenderOrder?.();
  }
  globalThis.ReefPerf={Recorder,addHud,populate};
})();
