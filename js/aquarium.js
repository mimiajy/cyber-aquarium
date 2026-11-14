/* Simulation owner: p5 schedules frames; entities render to its native 2D context. */
(() => {
  'use strict';
  const O = window.CyberAquarium;
  const { TAU, random, clamp, lerp, rgba, ellipse, glow } = O;
  const positions = [[.48,.44],[.64,.24],[.8,.4],[.88,.61],[.58,.63],[.37,.67],[.21,.62],[.71,.72],[.84,.25],[.49,.77],[.92,.38],[.4,.52],[.62,.47],[.75,.54],[.3,.77],[.86,.74],[.53,.32],[.13,.72]];
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('cyber-aquarium-settings')) || {}; } catch { /* Storage is optional, including file:// and private browsing. */ }
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  class Aquarium {
    constructor() {
      this.width = 1; this.height = 1; this.fish = []; this.jellies = [];
      this.food = []; this.particles = []; this.ripples = [];
      this.theme = saved.theme === 'day' ? 'day' : 'neon';
      this.neon = this.theme === 'neon' ? 1 : 0;
      this.count = Number.isInteger(saved.count) ? clamp(saved.count, 10, 30) : 18;
      this.paused = reducedMotion; this.time = 0; this.lastFeed = -Infinity;
      this.lastTrail = 0; this.pointer = null; this.sketch = null;
    }
    save() {
      try { localStorage.setItem('cyber-aquarium-settings', JSON.stringify({ theme: this.theme, count: this.count })); } catch { /* Nothing needs persistent storage to work. */ }
    }
    setTheme(theme) {
      if (!['day', 'neon'].includes(theme)) return;
      this.theme = theme; this.save();
      window.dispatchEvent(new CustomEvent('ocean:change'));
    }
    setCount(count) {
      this.count = clamp(Math.round(Number(count) || 18), 10, 30);
      while (this.fish.length < this.count) {
        const i = this.fish.length, pos = positions[i];
        this.fish.push(new O.Fish(pos ? this.width * pos[0] : random(this.width * .35, this.width * .9), pos ? this.height * pos[1] : random(this.height * .25, this.height * .72), i, this.creatureScale));
      }
      this.fish.length = this.count;
      this.save(); window.dispatchEvent(new CustomEvent('ocean:change'));
    }
    setPaused(paused) {
      this.paused = !!paused;
      if (this.sketch) this.sketch.frameRate(this.paused ? 24 : 60);
      window.dispatchEvent(new CustomEvent('ocean:change'));
    }
    resize(w, h) {
      const sx = w / this.width, sy = h / this.height;
      const oldScale = this.creatureScale || 1;
      this.width = w; this.height = h; this.creatureScale = clamp(w / 1150, .65, 1.12);
      for (const fish of this.fish) { fish.x *= sx; fish.y *= sy; fish.size *= this.creatureScale / oldScale; fish.baseSpeed *= this.creatureScale / oldScale; }
      for (const food of this.food) { food.x *= sx; food.y *= sy; }
      this.particles = []; this.ripples = [];
      if (this.environment) this.environment.resize(w, h); else this.environment = new O.Environment(w, h);
      this.jellies = [new O.Jellyfish(w * .61, h * .29, 32 * this.creatureScale, 0), new O.Jellyfish(w * .83, h * .51, 26 * this.creatureScale, 1), new O.Jellyfish(w * .46, h * .59, 19 * this.creatureScale, 2)];
    }
    feed(x = this.width * .59, y = this.height * .38) {
      if (this.paused) { this.notify('海洋暂停中，恢复后再投喂吧'); return false; }
      const now = performance.now();
      if (now - this.lastFeed < 220) return false;
      this.lastFeed = now;
      x = clamp(x, 25, this.width - 25); y = clamp(y, 90, this.height - 130);
      for (let i = 0; i < 7; i++) this.food.push({ x: x + random(-17, 17), y: y + random(-12, 12), vx: random(-6, 6), vy: random(8, 15), life: random(18, 24), phase: random(0, TAU), eaten: false });
      if (this.food.length > 56) this.food.splice(0, this.food.length - 56);
      this.ripples.push({ x, y, life: 1, max: random(40, 60) });
      if (this.ripples.length > 12) this.ripples.shift();
      this.sparkle(x, y, 8, 'meal');
      window.dispatchEvent(new CustomEvent('ocean:feed'));
      return true;
    }
    notify(message) { window.dispatchEvent(new CustomEvent('ocean:notify', { detail: message })); }
    sparkle(x, y, count = 2, kind = 'water') {
      for (let i = 0; i < count; i++) {
        const angle = random(0, TAU), speed = random(5, kind === 'meal' ? 24 : 12);
        this.particles.push({ x: x + random(-4, 4), y: y + random(-4, 4), vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 5, life: 1, decay: random(.45, 1), size: random(.7, 2), kind });
      }
      if (this.particles.length > 140) this.particles.splice(0, this.particles.length - 140);
    }
    update(dt) {
      this.time += dt; this.environment.update(dt);
      for (const jelly of this.jellies) jelly.update(dt, this);
      for (const food of this.food) {
        food.life -= dt; food.x += (food.vx + Math.sin(this.time + food.phase) * 3) * dt;
        food.y += food.vy * dt;
      }
      this.food = this.food.filter(f => !f.eaten && f.life > 0 && f.y < this.height - 90);
      for (const fish of this.fish) fish.update(dt, this);
      for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= p.decay * dt; }
      this.particles = this.particles.filter(p => p.life > 0);
      for (const ripple of this.ripples) ripple.life -= dt * .6;
      this.ripples = this.ripples.filter(r => r.life > 0);
    }
    draw(ctx, frameDt) {
      this.neon = lerp(this.neon, this.theme === 'neon' ? 1 : 0, 1 - Math.exp(-frameDt * 2.7));
      if (!this.paused) this.update(frameDt);
      const n = this.neon;
      this.environment.drawBackground(ctx, n);
      for (const jelly of this.jellies) jelly.draw(ctx, n);
      for (const fish of this.fish) fish.draw(ctx, n);
      for (const food of this.food) {
        if (food.eaten) continue;
        const a = Math.min(1, food.life);
        glow(ctx, food.x, food.y, 10, [255, 202, 135], .2 * a);
        ellipse(ctx, food.x, food.y, 2.1, 2.5, rgba([255, 214, 146], a), Math.sin(food.phase + this.time) * .4);
      }
      for (const ripple of this.ripples) {
        const f = 1 - ripple.life;
        for (let i = 0; i < 2; i++) {
          const radius = Math.max(.1, f * ripple.max - i * 9);
          ctx.beginPath(); ctx.ellipse(ripple.x, ripple.y, radius, radius * .64, -.2, 0, TAU);
          ctx.strokeStyle = rgba([159, 227, 232], ripple.life * .27); ctx.lineWidth = .8; ctx.stroke();
        }
      }
      for (const p of this.particles) {
        const color = p.kind === 'meal' ? [255, 203, 152] : [164, 237, 240];
        ellipse(ctx, p.x, p.y, p.size * p.life, p.size * p.life, rgba(color, p.life * .7));
      }
      this.environment.drawAtmosphere(ctx, n);
      this.environment.drawForeground(ctx, n);
    }
    start() {
      if (typeof window.p5 !== 'function') {
        document.getElementById('ocean-canvas').innerHTML = '<div class="error-card">未能加载本地绘图库。请检查 assets/vendor/p5.min.js 是否完整。</div>';
        return;
      }
      const world = this, host = document.getElementById('ocean-canvas');
      window.p5.disableFriendlyErrors = true;
      this.sketch = new window.p5(p => {
        p.setup = () => {
          p.pixelDensity(Math.min(window.devicePixelRatio || 1, 1.5));
          const canvas = p.createCanvas(host.clientWidth, host.clientHeight);
          canvas.elt.setAttribute('role', 'img');
          canvas.elt.setAttribute('aria-label', '梦幻海底场景：自由游动的小鱼、发光水母和摇曳水草。可用投喂按钮或 G 键喂鱼。');
          world.resize(p.width, p.height); world.setCount(world.count);
          p.frameRate(world.paused ? 24 : 60);
          let down = null;
          canvas.elt.addEventListener('pointerdown', event => {
            if (event.button !== 0 && event.pointerType !== 'touch') return;
            down = { x: event.clientX, y: event.clientY, id: event.pointerId };
            canvas.elt.setPointerCapture(event.pointerId);
          });
          canvas.elt.addEventListener('pointerup', event => {
            if (down && down.id === event.pointerId && Math.hypot(down.x - event.clientX, down.y - event.clientY) < 15) {
              const rect = canvas.elt.getBoundingClientRect(); world.feed(event.clientX - rect.left, event.clientY - rect.top);
            }
            down = null;
          });
          canvas.elt.addEventListener('pointercancel', () => { down = null; });
          canvas.elt.addEventListener('pointermove', event => {
            if (world.paused || performance.now() - world.lastTrail < 35) return;
            const rect = canvas.elt.getBoundingClientRect();
            world.sparkle(event.clientX - rect.left, event.clientY - rect.top, 2);
            world.lastTrail = performance.now();
          });
          window.dispatchEvent(new CustomEvent('ocean:ready'));
        };
        p.draw = () => world.draw(p.drawingContext, clamp(p.deltaTime / 1000 || 1 / 60, .001, .04));
        let resizeTimer;
        p.windowResized = () => {
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(() => {
            if (!host.clientWidth || !host.clientHeight) return;
            p.resizeCanvas(host.clientWidth, host.clientHeight);
            world.resize(p.width, p.height);
          }, 100);
        };
        document.addEventListener('visibilitychange', () => { if (document.hidden) p.noLoop(); else p.loop(); });
      }, host);
    }
  }
  O.Aquarium = Aquarium;
  O.world = new Aquarium();
  O.world.start();
})();
