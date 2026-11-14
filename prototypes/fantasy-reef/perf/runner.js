(() => {
  'use strict';
  const q=new URLSearchParams(location.search), before=q.get('engine')==='before';
  const count=[10,25,50].includes(Number(q.get('count'))) ? Number(q.get('count')) : 10;
  const send=data=>parent.postMessage(data,location.origin);
  const loadScript=src=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(Error(src));document.head.append(s);});
  async function main() {
    for(const name of ['warp','fish-school','scene']) await loadScript(`${before?'baseline/':'../'}${name}.js`);
    const images={};
    await Promise.all(['fish','tetra','angelfish','jellyfish','coral','depth'].map(key=>new Promise((resolve,reject)=>{
      const im=new Image();im.onload=()=>{images[key]=im;resolve();};im.onerror=()=>reject(Error(key));im.src=`../assets/${key}.png`;
    })));
    const canvas=document.getElementById('view'),ctx=canvas.getContext('2d',{alpha:false});
    const width=1280,height=720,density=1.5;canvas.width=width*density;canvas.height=height*density;ctx.scale(density,density);
    const create=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
    const scene=new FantasyReef.Scene(images,width,height,create);ReefPerf.populate(scene,count);
    const rec=new ReefPerf.Recorder(),clock=new ReefTiming.FrameStepper();
    const label=document.getElementById('label');let last=0,active=0,invalid=false,measuring=false,frame=0;
    const schedule=()=>{if(!frame&&!document.hidden)frame=requestAnimationFrame(tick);};
    const counters={draws:0,clears:0,epochs:0,copies:0};let dirty=false;
    const gl=scene.warp.gl;
    if(gl){
      const draw=gl.drawElements.bind(gl),clear=gl.clear.bind(gl),copy=ctx.drawImage.bind(ctx);
      gl.drawElements=(...args)=>{counters.draws++;dirty=true;return draw(...args);};
      gl.clear=(...args)=>{counters.clears++;return clear(...args);};
      ctx.drawImage=(source,...args)=>{
        if(source===scene.warp.canvas){counters.copies++;if(dirty){counters.epochs++;dirty=false;}}
        return copy(source,...args);
      };
    }
    const metadata={engine:before?'before':'after',baseline:'85180cd',count,width,height,density,backingWidth:canvas.width,backingHeight:canvas.height,backend:gl?'WebGL':'Canvas fallback',userAgent:navigator.userAgent,scope:'Scene kernel only; no main-page CSS UI blur',initialVisibility:document.visibilityState};
    scene.draw(ctx);
    label.textContent=document.hidden?'浏览器报告当前标签页在后台，置于前台后自动开始。':'即将开始真实动画帧测量…';
    send({type:'reef-ready',metadata});
    document.addEventListener('visibilitychange',()=>{
      last=0;
      if(document.hidden){cancelAnimationFrame(frame);frame=0;}
      if(document.hidden&&measuring)invalid=true;
      if(document.hidden)label.textContent='浏览器报告当前标签页在后台，暂停测量。';
      if(!document.hidden)schedule();
    });
    const update=dt=>scene.update(dt);let totalEpochs=0,totalClears=0,totalDraws=0,totalCopies=0;
    function tick(now){
      frame=0;
      if(document.hidden){last=0;return;}
      if(invalid){send({type:'reef-error',message:'测量中标签页进入后台，本组无效，请保持前台后重新开始。'});return;}
      if(!last){last=now;schedule();return;}
      const delta=Math.max(0,(now-last)/1000);last=now;active+=delta;
      const started=performance.now();let simulated,steps,clamped=0;
      if(before){simulated=Math.min(.04,Math.max(.001,delta));scene.update(simulated);steps=1;}
      else{const prior=clock.simulated,drop=clock.dropped;steps=clock.advance(delta,update);simulated=clock.simulated-prior;clamped=clock.dropped-drop;}
      const updated=performance.now();
      counters.draws=counters.clears=counters.epochs=counters.copies=0;dirty=false;scene.draw(ctx);
      const rendered=performance.now();
      if(active>=3){
        measuring=true;rec.record(delta*1000,updated-started,rendered-updated,steps,simulated*1000,clamped*1000);
        totalEpochs+=counters.epochs;totalClears+=counters.clears;totalDraws+=counters.draws;totalCopies+=counters.copies;
      }
      label.textContent=`${before?'优化前':'优化后'} · ${count} fish · ${gl?'WebGL':'Canvas fallback'} · ${active<3?'预热':`测量 ${Math.min(12,active-3).toFixed(0)}/12s`}`;
      if(active>=15){
        const result={...metadata,...rec.summary(),gpuSourceEpochs:totalEpochs/rec.count,gpuClears:totalClears/rec.count,gpuDraws:totalDraws/rec.count,canvasCopies:totalCopies/rec.count};
        send({type:'reef-result',result});return;
      }
      schedule();
    }
    schedule();
  }
  main().catch(error=>send({type:'reef-error',message:error.message}));
})();
