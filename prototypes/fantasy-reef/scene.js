/* Independent art study. Sprite deformation is intentionally separate from fish AI.
 * No production rendering code is modified. Also usable by a native Canvas QA runner.
 */
(() => {
  'use strict';
  const O = globalThis.CyberAquarium;
  const { clamp, lerp, seeded, TAU } = O;
  class Scene {
    constructor(images, width, height, createCanvas) {
      this.images = images; this.createCanvas = createCanvas;
      this.warp = new globalThis.SpriteWarp(createCanvas);
      this.time = 0; this.glow = .85; this.parallax = { x: 0, y: 0 };
      this.pointer = { x: 0, y: 0 }; this.food = []; this.sparks = [];
      this.lastFeed = -Infinity; this.fish = []; this.jellies = [];
      this.school = new globalThis.ReefSchool.School(); this.count = 18;
      this.theme = 'neon'; this.dayBlend = 0;
      this.width = width; this.height = height;
      const rng = seeded(264);
      this.dust = Array.from({ length: 75 }, (_, i) => ({ x: rng(), y: rng(), z: .2 + rng() * .8, phase: rng() * TAU, big: i % 14 === 0 }));
      this.resize(width, height);
    }
    resize(width, height) {
      const sx = width / this.width, sy = height / this.height;
      this.width = width; this.height = height; this.mobile = width < 700;
      if (!this.fish.length) {
        this.school.setCount(this, this.count);
      } else for (const f of this.fish) {
        f.x *= sx; f.y *= sy; f.resize(this);
        f.x = clamp(f.x, f.radius + 4, width - f.radius - 4);
        f.y = clamp(f.y, 85 + f.radius, height - 100 - f.radius);
      }
      for (const f of this.food) { f.x *= sx; f.y *= sy; }
      this.sparks = [];
      this.placeJellies();
      this.backdrop = this.makeBackdrop('neon');
      this.dayBackdrop = this.makeBackdrop('day');
    }
    setCount(count) { return this.school.setCount(this, count); }
    setTheme(theme, snap = false) {
      if (!['neon','day'].includes(theme)) return;
      this.theme = theme; if (snap) this.dayBlend = theme === 'day' ? 1 : 0;
    }
    placeJellies() {
      const w = this.width, h = this.height;
      const mainH = this.mobile ? Math.min(h * .49, w * 1.02) : Math.min(h * .64, w * .43);
      this.jellies = [
        { x: w * (this.mobile ? .67 : .66), y: h * (this.mobile ? .44 : .43), height: mainH, size: mainH * .18, phase: 0 },
        { x: w * (this.mobile ? .29 : .45), y: h * (this.mobile ? .39 : .32), height: mainH * .52, size: mainH * .095, phase: 2.6 },
      ];
    }
    makeBackdrop(mode) {
      const w = this.width, h = this.height;
      const backdrop = this.createCanvas(w + 40, h + 40);
      const c = backdrop.getContext('2d'), bw = w + 40, bh = h + 40;
      const im = this.images.depth;
      // Portrait crops are completed by the separate near-reef patches below.
      const scale = Math.max(bw / im.width, bh / im.height);
      const dw = im.width * scale, dh = im.height * scale;
      c.drawImage(im, (bw - dw) * .5, (bh - dh) * .5, dw, dh);
      c.fillStyle = mode === 'day' ? 'rgba(2, 17, 46, .12)' : 'rgba(2, 17, 46, .36)'; c.fillRect(0, 0, bw, bh);
      const depth = c.createLinearGradient(0, 0, 0, bh);
      depth.addColorStop(0, 'rgba(5,26,50,.04)'); depth.addColorStop(.5, 'rgba(3,22,52,.08)'); depth.addColorStop(1, mode === 'day' ? 'rgba(1,13,35,.28)' : 'rgba(1,13,35,.5)');
      c.fillStyle = depth; c.fillRect(0, 0, bw, bh);
      // A faint midground garden softens the transition into the near reef.
      c.globalAlpha = .18;
      const cw = w * (this.mobile ? .65 : .28), ch = cw * this.images.coral.height / this.images.coral.width;
      c.drawImage(this.images.coral, w * .43 - cw * .5, h * .85 - ch * .5, cw, ch);
      c.globalAlpha = 1;
      return backdrop;
    }
    sparkle(x, y, count = 4) {
      const rng = seeded(Math.floor(this.time * 1000) + 17);
      for (let i = 0; i < count; i++) this.sparks.push({ x, y, vx: (rng() - .5) * 28, vy: -8 - rng() * 12, life: 1 });
      if (this.sparks.length > 80) this.sparks.splice(0, this.sparks.length - 80);
    }
    feed(x = this.width * .5, y = this.height * .57) {
      if (this.time - this.lastFeed < .3) return false;
      this.lastFeed = this.time;
      const rng = seeded(Math.floor(this.time * 912) + 73);
      for (let i = 0; i < 5; i++) this.food.push({ x: clamp(x + (rng() - .5) * 24, 25, this.width - 25), y: clamp(y + (rng() - .5) * 16, 120, this.height - 140), life: 18, vy: 7 + rng() * 4, phase: rng() * TAU, eaten: false });
      if (this.food.length > 25) this.food.splice(0, this.food.length - 25);
      this.sparkle(x, y, 8); return true;
    }
    update(dt) {
      this.time += dt;
      this.dayBlend = lerp(this.dayBlend, this.theme === 'day' ? 1 : 0, 1 - Math.exp(-dt * 2.5));
      this.parallax.x = lerp(this.parallax.x, this.pointer.x, 1 - Math.exp(-dt * 1.8));
      this.parallax.y = lerp(this.parallax.y, this.pointer.y, 1 - Math.exp(-dt * 1.8));
      this.placeJellies();
      for (const j of this.jellies) {
        j.x += Math.sin(this.time * .21 + j.phase) * (this.mobile ? 9 : 21);
        j.y += Math.sin(this.time * .41 + j.phase) * 11;
      }
      for (const f of this.food) { f.life -= dt; f.y += f.vy * dt; f.x += Math.sin(this.time * .6 + f.phase) * 2 * dt; }
      this.food = this.food.filter(f => !f.eaten && f.life > 0 && f.y < this.height - 110);
      this.school.update(this, dt);
      for (const p of this.sparks) { p.life -= dt * .55; p.x += p.vx * dt; p.y += p.vy * dt; }
      this.sparks = this.sparks.filter(p => p.life > 0);
    }
    draw(ctx) {
      const w = this.width, h = this.height, t = this.time;
      ctx.save();
      ctx.drawImage(this.backdrop, -20 - this.parallax.x * 4, -20 - this.parallax.y * 2);
      if (this.dayBlend > .001) {
        ctx.globalAlpha = this.dayBlend; ctx.drawImage(this.dayBackdrop, -20 - this.parallax.x * 4, -20 - this.parallax.y * 2); ctx.globalAlpha = 1;
      }
      this.drawRays(ctx);
      // Back jelly is smaller and dimmer; both are genuine animated objects.
      this.drawJelly(ctx, this.jellies[1], .65);
      for (const fish of [...this.fish].sort((a, b) => a.depth - b.depth)) this.drawFish(ctx, fish);
      this.drawJelly(ctx, this.jellies[0], 1);
      for (const f of this.food) {
        if (f.eaten) continue;
        ctx.globalAlpha = Math.min(1, f.life);
        O.glow(ctx, f.x, f.y, 8, [239, 213, 156], .12);
        O.ellipse(ctx, f.x, f.y, 1.6, 2.0, '#e0d4a5');
      }
      ctx.globalAlpha = 1;
      this.drawCorals(ctx);
      // Suspended motes cross all image layers and connect the whole scene.
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      for (const p of this.dust) {
        const x = ((p.x * w + Math.sin(t * .16 + p.phase) * 13 + this.parallax.x * p.z * 8) % w + w) % w;
        const y = ((p.y * h - t * (2 + p.z * 4)) % h + h) % h;
        const a = (.09 + p.z * .17) * (.65 + Math.sin(t * .6 + p.phase) * .35);
        O.ellipse(ctx, x, y, p.big ? 1.5 : .5 + p.z * .5, p.big ? 1.9 : .5 + p.z * .5, `rgba(162,226,221,${a})`);
        if (p.big) O.glow(ctx, x, y, 9, [106, 214, 208], .07);
      }
      for (const p of this.sparks) O.ellipse(ctx, p.x, p.y, 1.3 * p.life, 1.3 * p.life, `rgba(238,218,163,${p.life * .7})`);
      ctx.restore(); ctx.restore();
    }
    drawFish(ctx, f) {
      const im = this.images[f.species.asset], width = f.artWidth, height = width * im.height / im.width;
      ctx.save(); ctx.translate(f.x + this.parallax.x * (2 + f.depth * 4), f.y + this.parallax.y * f.depth * 3);
      ctx.rotate(f.angle + f.bank);
      ctx.scale(f.yaw, 1);
      ctx.globalAlpha = f.opacity;
      this.warp.draw(ctx, im, width, height, 0, this.time, f.phase, f.hungry, f.motion);
      ctx.restore();
    }
    drawJelly(ctx, j, depth) {
      const im = this.images.jellyfish, height = j.height, width = height * im.width / im.height;
      ctx.save(); ctx.translate(j.x + this.parallax.x * depth * 5, j.y + this.parallax.y * depth * 3);
      ctx.rotate(Math.sin(this.time * .27 + j.phase) * .055 + (depth < 1 ? -.11 : .08));
      const bellY = -height * .37;
      O.glow(ctx, 0, bellY + width * .12, width * .49, [104, 208, 216], .10 * this.glow * depth);
      ctx.globalAlpha = Math.min(1, (.7 + this.glow * .22) * depth);
      this.warp.draw(ctx, im, width, height, 1, this.time, j.phase);
      // Light is concentrated inside the bell, with no luminous outline pass.
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'screen';
      O.glow(ctx, 0, bellY + width * .16, width * .24, [128, 219, 220], .055 * this.glow * depth);
      ctx.restore();
    }
    drawCorals(ctx) {
      const w = this.width, h = this.height;
      const patches = this.mobile
        ? [{ x: w * .10, y: h * .83, width: w * .98, flip: 1, phase: 0, alpha: .9 }, { x: w * .91, y: h * .93, width: w * .97, flip: -1, phase: 2, alpha: .8 }]
        : [{ x: w * .18, y: h * .79, width: w * .43, flip: 1, phase: 0, alpha: .86 }, { x: w * .86, y: h * .87, width: w * .43, flip: -1, phase: 2, alpha: .79 }];
      for (const p of patches) {
        const im = this.images.coral, height = p.width * im.height / im.width;
        ctx.save(); ctx.translate(p.x + this.parallax.x * 12, p.y + this.parallax.y * 7); ctx.scale(p.flip, 1);
        ctx.globalAlpha = p.alpha;
        this.warp.draw(ctx, im, p.width, height, 2, this.time, p.phase);
        // Soft-tissue tentacle strokes sit over the two painted anemones. Rigid
        // coral remains visually stable; only very fine ends catch the current.
        ctx.globalAlpha = .13;
        for (const [cx, cy, radius] of [[.26,.67,.072], [.45,.78,.06]]) {
          const x = (cx - .5) * p.width, y = (cy - .5) * height;
          for (let k = 0; k < 21; k++) {
            const angle = k / 21 * TAU, r = p.width * radius;
            const sway = Math.sin(this.time * .7 + k * .41 + p.phase) * r * .11;
            ctx.beginPath(); ctx.moveTo(x, y);
            ctx.bezierCurveTo(x + Math.cos(angle) * r * .5, y + Math.sin(angle) * r * .48,
              x + Math.cos(angle) * r + sway, y + Math.sin(angle) * r * .8,
              x + Math.cos(angle) * r * 1.1 + sway, y + Math.sin(angle) * r * .9 - r * .15);
            ctx.strokeStyle = '#a8ddd2'; ctx.lineWidth = Math.max(.6, p.width * .0013); ctx.lineCap = 'round'; ctx.stroke();
          }
        }
        ctx.restore();
      }
    }
    drawRays(ctx) {
      const w = this.width, h = this.height;
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < 4; i++) {
        const x = w * (.42 + i * .09) + Math.sin(this.time * .15 + i) * 9;
        const g = ctx.createLinearGradient(x, 0, x - w * .18, h * .8);
        const a = .022 + (Math.sin(this.time * .24 + i) + 1) * .006;
        g.addColorStop(0, `rgba(135,220,217,${a})`); g.addColorStop(1, 'rgba(81,180,202,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + w * .03, 0);
        ctx.lineTo(x - w * .13, h); ctx.lineTo(x - w * .25, h); ctx.fill();
      }
      ctx.restore();
    }
  }
  globalThis.FantasyReef = { Scene };
})();
