(() => {
  'use strict';
  const $=id=>document.getElementById(id), results=[];
  let queue=[],index=0,running=false;
  function next(){
    if(index>=queue.length){running=false;$('start').disabled=false;$('download').disabled=false;$('status').textContent='六组测量完成。可下载原始 JSON；切换不同生产/开发地址后也可重复同一流程。';return;}
    const item=queue[index];
    $('status').textContent=`第 ${index+1}/6 组：${item.engine==='before'?'优化前':'优化后'}，${item.count} 条鱼。请保持前台。`;
    $('runner').src=`runner.html?engine=${item.engine}&count=${item.count}&run=${Date.now()}`;
  }
  $('start').onclick=()=>{
    results.length=0;index=0;queue=[];running=true;$('results').replaceChildren();$('raw').textContent='';
    for(const count of [10,25,50])for(const engine of ['before','after'])queue.push({count,engine});
    $('start').disabled=true;$('download').disabled=true;next();
  };
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==$('runner').contentWindow||!running)return;
    const data=event.data;
    if(data?.type==='reef-error'){running=false;$('start').disabled=false;$('status').textContent=data.message;return;}
    if(data?.type==='reef-ready'&&data.metadata.initialVisibility==='hidden'){$('status').textContent='浏览器报告 document.visibilityState = hidden；等待前台，不生成 FPS 数据。';return;}
    if(data?.type!=='reef-result')return;
    const r=data.result;results.push(r);
    const row=document.createElement('tr');
    const fields=[`${r.engine==='before'?'优化前':'优化后'} / ${r.count}`,r.fps.toFixed(1),`${r.meanFrameMs.toFixed(2)} / ${r.p95FrameMs.toFixed(2)} ms`,r.updateMs.toFixed(3),r.renderSubmitMs.toFixed(3),`${(r.simulationRatio*100).toFixed(1)}%`,r.backend==='WebGL'?r.gpuSourceEpochs.toFixed(0):'无 WebGL'];
    for(const field of fields){const td=document.createElement('td');td.textContent=field;row.append(td);}
    $('results').append(row);$('raw').textContent=JSON.stringify({measuredAt:new Date().toISOString(),results},null,2);index++;next();
  });
  $('download').onclick=()=>{
    const blob=new Blob([$('raw').textContent],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='cyber-aquarium-browser-perf.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
})();
