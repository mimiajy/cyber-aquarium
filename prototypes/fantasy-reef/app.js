(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('reef'), ctx = canvas.getContext('2d', { alpha: false });
  let scene, paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let frame = 0, last = 0, toastTimer, down = null, resizeTimer;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const images = {};
  const assetFiles = { fish: 'fish.png', tetra: 'tetra.png', angelfish: 'angelfish.png', jellyfish: 'jellyfish.png', coral: 'coral.png', depth: 'depth.png' };
  let settings = {};
  try { settings = JSON.parse(localStorage.getItem('fantasy-reef-settings')) || {}; } catch { /* Storage is optional. */ }
  function save() {
    if (!scene) return;
    try { localStorage.setItem('fantasy-reef-settings', JSON.stringify({ count: scene.count, theme: scene.theme, glow: scene.glow })); } catch { /* Private browsing still works. */ }
  }
  function syncPopulation() {
    if (!scene) return;
    $('fish-count').value = scene.count; $('fish-count-output').textContent = scene.count;
    $('fish-count').setAttribute('aria-valuetext', `${scene.count} 条鱼，包含三个鱼种`);
    $('population-summary').textContent = `${scene.count} 条鱼 · 3 个鱼种`;
    const counts = Object.entries(ReefSchool.species).map(([kind, spec]) => `${spec.name} ${scene.fish.filter(f => f.kind === kind).length} 条`).join('，');
    $('population-summary').title = counts;
    canvas.setAttribute('aria-label', `风格化奇幻海底：${counts}、两只发光水母和珊瑚花园。点击海水可投喂。`);
  }
  function setTheme(theme) {
    if (!scene) return;
    scene.setTheme(theme, paused || document.hidden);
    for (const button of document.querySelectorAll('[data-theme]')) button.setAttribute('aria-pressed', String(button.dataset.theme === scene.theme));
    save(); draw();
  }

  function message(text) {
    $('message').textContent = text; $('message').classList.add('visible');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('message').classList.remove('visible'); $('message').textContent = ''; }, 2800);
  }
  function draw() { if (scene && ctx) scene.draw(ctx); }
  function tick(now) {
    frame = 0;
    if (document.hidden || paused || !scene) return;
    const dt = Math.min(.04, Math.max(.001, (now - last) / 1000 || 1 / 60)); last = now;
    scene.update(dt); draw(); frame = requestAnimationFrame(tick);
  }
  function run() {
    if (!paused && !document.hidden && scene && !frame) { last = performance.now(); frame = requestAnimationFrame(tick); }
  }
  function setPaused(value) {
    paused = value; cancelAnimationFrame(frame); frame = 0;
    $('pause-symbol').textContent = paused ? '▷' : 'Ⅱ';
    $('pause-label').textContent = paused ? '继续' : '暂停';
    $('pause').setAttribute('aria-label', paused ? '恢复动画' : '暂停动画');
    $('pause').setAttribute('aria-pressed', String(paused));
    run(); draw();
  }
  function feed(x, y) {
    if (!scene) return;
    if (paused) { message('恢复海流后，再给小鱼送惊喜吧'); return; }
    if (scene.feed(x, y)) { $('hint').textContent = '一点小小的惊喜，正在慢慢下沉'; }
  }
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const density = Math.min(devicePixelRatio || 1, w < 700 ? 1.4 : 1.5);
    canvas.width = Math.round(w * density); canvas.height = Math.round(h * density);
    if (ctx) ctx.setTransform(density, 0, 0, density, 0, 0);
    if (scene) { scene.resize(w, h); draw(); }
  }
  function clean() {
    const active = document.body.classList.toggle('clean');
    $('restore-ui').hidden = !active;
    if (active) $('restore-ui').focus(); else $('clean').focus();
  }
  $('pause').addEventListener('click', () => setPaused(!paused));
  $('feed').addEventListener('click', () => feed());
  $('light').addEventListener('input', e => { if (scene) { scene.glow = Number(e.target.value) / 100; save(); draw(); } });
  $('fish-count').addEventListener('input', e => { if (scene) { scene.setCount(e.target.value); syncPopulation(); save(); draw(); } });
  for (const button of document.querySelectorAll('[data-theme]')) button.addEventListener('click', () => setTheme(button.dataset.theme));
  $('clean').addEventListener('click', clean); $('restore-ui').addEventListener('click', clean);
  $('about').addEventListener('click', () => $('art-notes').showModal());
  $('close-notes').addEventListener('click', () => $('art-notes').close());
  $('back-to-reef').addEventListener('click', () => $('art-notes').close());
  document.addEventListener('keydown', e => {
    if ($('art-notes').open || e.repeat || e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|BUTTON|A|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); setPaused(!paused); }
    if (e.code === 'KeyG') feed();
    if (e.code === 'KeyH') clean();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else run(); });
  reduced.addEventListener('change', e => { if (e.matches) setPaused(true); });
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 120); });
  canvas.addEventListener('pointerdown', e => {
    if (e.button !== 0 && e.pointerType !== 'touch') return;
    down = { x: e.clientX, y: e.clientY, id: e.pointerId }; canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointercancel', () => { down = null; });
  canvas.addEventListener('pointerup', e => {
    if (down && down.id === e.pointerId && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 13) feed(e.clientX, e.clientY);
    down = null;
  });
  canvas.addEventListener('pointermove', e => {
    if (!scene || paused) return;
    scene.pointer.x = (e.clientX / innerWidth - .5) * 2; scene.pointer.y = (e.clientY / innerHeight - .5) * 2;
  });
  canvas.addEventListener('pointerleave', () => { if (scene) { scene.pointer.x = 0; scene.pointer.y = 0; } });

  Promise.all(Object.entries(assetFiles).map(([key, file]) => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => { images[key] = image; resolve(); };
    image.onerror = () => reject(new Error(`无法加载 assets/${file}`));
    image.src = `assets/${file}`;
  }))).then(() => {
    if (!ctx) throw new Error('浏览器未能创建 Canvas 2D 画布');
    scene = new FantasyReef.Scene(images, innerWidth, innerHeight, (w, h) => {
      const buffer = document.createElement('canvas'); buffer.width = w; buffer.height = h; return buffer;
    });
    scene.setCount(settings.count ?? 18);
    scene.setTheme(settings.theme === 'day' ? 'day' : 'neon', true);
    if (Number.isFinite(settings.glow)) scene.glow = CyberAquarium.clamp(settings.glow, .55, 1.3);
    $('light').value = Math.round(scene.glow * 100);
    resize(); syncPopulation(); setPaused(paused); setTheme(scene.theme); $('loading').classList.add('is-ready');
    setTimeout(() => { $('loading').hidden = true; }, 700);
    // Read-only access helps local inspection without changing production globals.
    window.reefStudy = { get scene() { return scene; }, get paused() { return paused; } };
  }).catch(error => {
    $('loading-label').textContent = `${error.message}。请从项目根目录运行 npm start 后打开样板链接。`;
    document.querySelector('.loading-orb').hidden = true;
  });
})();
