/* Add new species here; all creatures share update(dt, world) and draw(ctx). */
(() => {
  'use strict';
  const O = window.CyberAquarium;
  const { TAU, random, clamp, lerp, normalize, rgba, ellipse, glow } = O;
  const palettes = [
    { body: [239, 178, 104], light: [255, 224, 156], fin: [221, 126, 99] },
    { body: [103, 208, 198], light: [192, 247, 214], fin: [64, 154, 179] },
    { body: [154, 144, 221], light: [219, 209, 255], fin: [129, 101, 203] },
    { body: [227, 143, 165], light: [255, 208, 198], fin: [172, 93, 154] },
    { body: [122, 180, 227], light: [199, 230, 255], fin: [74, 117, 200] },
    { body: [202, 199, 131], light: [246, 238, 181], fin: [126, 168, 147] },
  ];

  class Fish {
    constructor(x, y, index, scale = 1) {
      this.x = x; this.y = y; this.index = index;
      this.phase = random(0, TAU); this.type = index % 5;
      this.size = random(22, 34) * (this.type === 1 ? 1.05 : 1) * scale;
      this.baseSpeed = random(29, 48) * scale;
      this.angle = random(-.3, .3);
      const direction = index % 3 === 0 ? -1 : 1;
      this.vx = Math.cos(this.angle) * this.baseSpeed * direction;
      this.vy = Math.sin(this.angle) * this.baseSpeed * direction;
      this.palette = palettes[index % palettes.length];
      this.flip = this.vx > 0 ? 1 : -1;
      this.time = this.phase; this.hungry = false;
    }

    update(dt, world) {
      this.time += dt;
      let ax = 0, ay = 0, near = 0, cx = 0, cy = 0, avx = 0, avy = 0;
      for (const fish of world.fish) {
        if (fish === this) continue;
        const dx = this.x - fish.x, dy = this.y - fish.y;
        const d = Math.hypot(dx, dy);
        if (d < 160 && d > 0) {
          near++; cx += fish.x; cy += fish.y; avx += fish.vx; avy += fish.vy;
          const separation = this.size + fish.size + 14;
          if (d < separation) { ax += dx / d * (1 - d / separation) * 110; ay += dy / d * (1 - d / separation) * 110; }
        }
      }
      if (near) {
        ax += (cx / near - this.x) * .027 + (avx / near - this.vx) * .11;
        ay += (cy / near - this.y) * .027 + (avy / near - this.vy) * .11;
      }
      let target = null, nearest = Math.min(480, world.width * .55);
      for (const food of world.food) {
        if (food.eaten) continue;
        const d = Math.hypot(food.x - this.x, food.y - this.y);
        if (d < nearest) { nearest = d; target = food; }
      }
      this.hungry = !!target;
      if (target) {
        const [dx, dy] = normalize(target.x - this.x, target.y - this.y);
        const speed = this.baseSpeed * 2.15 * clamp(nearest / 40, .4, 1);
        ax += (dx * speed - this.vx) * 1.35;
        ay += (dy * speed - this.vy) * 1.35;
        if (nearest < this.size * .62 + 7) { target.eaten = true; world.sparkle(target.x, target.y, 4, 'meal'); }
      } else {
        ax += Math.cos(this.time * .51 + this.phase) * 8;
        ay += Math.sin(this.time * .67 + this.phase * 2) * 11;
        const [dx, dy] = normalize(this.vx, this.vy);
        ax += (dx * this.baseSpeed - this.vx) * .45;
        ay += (dy * this.baseSpeed - this.vy) * .45;
      }
      for (const jelly of world.jellies) {
        const dx = this.x - jelly.x, dy = this.y - jelly.y;
        const d = Math.hypot(dx, dy);
        if (d < jelly.size + this.size + 20 && d > 1) {
          ax += dx / d * 22; ay += dy / d * 22;
        }
      }
      const margin = this.size + 45;
      const bottom = world.height - Math.min(140, world.height * .18);
      if (this.x < margin) ax += (margin - this.x) * 1.4;
      if (this.x > world.width - margin) ax -= (this.x - world.width + margin) * 1.4;
      if (this.y < 115) ay += (115 - this.y) * .75;
      if (this.y > bottom) ay -= (this.y - bottom) * .8;
      // Keep the left title area quieter, without introducing an invisible wall.
      if (!target && this.x < world.width * .34 && this.y < world.height * .55) ax += 8;
      this.vx += clamp(ax, -140, 140) * dt; this.vy += clamp(ay, -140, 140) * dt;
      const speed = Math.hypot(this.vx, this.vy), max = this.baseSpeed * (target ? 2.3 : 1.4);
      if (speed > max) { this.vx *= max / speed; this.vy *= max / speed; }
      this.x = clamp(this.x + this.vx * dt, 10, world.width - 10);
      this.y = clamp(this.y + this.vy * dt, 70, world.height - 60);
      const facing = this.vx >= 0 ? 1 : -1;
      this.flip = lerp(this.flip, facing, 1 - Math.exp(-4.2 * dt));
      this.angle = lerp(this.angle, Math.atan2(this.vy, Math.abs(this.vx) + 9) * facing, 1 - Math.exp(-3 * dt));
      // Initial left-facing fish use a mirrored body, not a full rotation.
      if (Math.abs(this.angle) > 1.1) this.angle = clamp(this.angle, -1.1, 1.1);
    }

    draw(ctx, neon) {
      const s = this.size, p = this.palette;
      const beat = Math.sin(this.time * (this.hungry ? 14 : 8) + this.phase);
      const tall = this.type === 1 ? .74 : this.type === 2 ? .57 : this.type === 4 ? .29 : .43;
      const long = this.type === 4 ? 1.22 : 1;
      ctx.save(); ctx.translate(this.x, this.y);
      ctx.rotate(this.angle); ctx.scale((Math.abs(this.flip) * .8 + .2) * (this.flip >= 0 ? 1 : -1), 1);
      if (neon > .2) glow(ctx, 0, 0, s * 2.3, p.body, .05 * neon);

      // Flexible forked tail, with fine fin rays.
      ctx.fillStyle = rgba(p.fin, .78); ctx.strokeStyle = rgba(p.light, .36); ctx.lineWidth = .65;
      ctx.beginPath(); ctx.moveTo(-s * .77, 0);
      ctx.bezierCurveTo(-s * 1.1, -s * .09, -s * 1.43, -s * (.47 + beat * .1), -s * 1.52, -s * .49);
      ctx.quadraticCurveTo(-s * (1.33 + beat * .06), 0, -s * 1.52, s * .49);
      ctx.bezierCurveTo(-s * 1.25, s * (.4 - beat * .09), -s, s * .1, -s * .77, 0); ctx.fill(); ctx.stroke();
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath(); ctx.moveTo(-s * .9, 0); ctx.lineTo(-s * 1.43, i * s * .19 + beat * s * .05); ctx.stroke();
      }
      // Dorsal and ventral fins remain translucent.
      ctx.fillStyle = rgba(p.fin, .55);
      ctx.beginPath(); ctx.moveTo(-s * .6, -s * tall * .65);
      ctx.quadraticCurveTo(-s * .32, -s * (tall + .5), s * .24, -s * (tall + .15));
      ctx.lineTo(s * .52, -s * tall * .5); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-s * .48, s * tall * .6);
      ctx.quadraticCurveTo(-s * .13, s * (tall + .34), s * .28, s * tall * .7); ctx.fill();
      if (this.type === 1) {
        ctx.strokeStyle = rgba(p.light, .43); ctx.lineWidth = .9;
        for (let i = 0; i < 2; i++) {
          ctx.beginPath(); ctx.moveTo(s * (.12 + i * .15), s * .48);
          ctx.quadraticCurveTo(-s * .05, s * 1.4, -s * .45 + beat * 2, s * 1.6); ctx.stroke();
        }
      }
      const bodyPath = () => {
        ctx.beginPath(); ctx.moveTo(s * long, -s * .035);
        ctx.bezierCurveTo(s * .65, -s * tall * 1.12, -s * .23, -s * tall * 1.3, -s * .94, 0);
        ctx.bezierCurveTo(-s * .4, s * tall * 1.15, s * .59, s * tall, s * long, s * .035);
        ctx.closePath();
      };
      const body = ctx.createLinearGradient(0, -s * tall, s * .1, s * tall);
      body.addColorStop(0, rgba(p.light, .98)); body.addColorStop(.4, rgba(p.body, .98)); body.addColorStop(1, rgba(p.fin, .92));
      bodyPath(); ctx.fillStyle = body; ctx.fill();
      ctx.save(); bodyPath(); ctx.clip();
      if (this.type === 1 || this.type === 2) {
        ctx.strokeStyle = rgba([31, 57, 87], this.type === 1 ? .35 : .21);
        ctx.lineWidth = s * (this.type === 1 ? .15 : .11);
        for (let i = 0; i < 3; i++) {
          const x = (i * .43 - .47) * s;
          ctx.beginPath(); ctx.moveTo(x - s * .15, -s); ctx.quadraticCurveTo(x + s * .25, 0, x - s * .05, s); ctx.stroke();
        }
      } else if (this.type === 4) {
        ctx.strokeStyle = rgba(p.light, .7); ctx.lineWidth = s * .055;
        ctx.beginPath(); ctx.moveTo(-s, 0); ctx.quadraticCurveTo(0, -s * .15, s * 1.2, -s * .02); ctx.stroke();
      } else {
        ctx.fillStyle = rgba(p.light, .22);
        for (let i = 0; i < 12; i++) { const x = (i % 4 * .29 - .6) * s, y = (Math.floor(i / 4) * .18 - .19) * s; ellipse(ctx, x, y, s * .025, s * .018, rgba(p.light, .28)); }
      }
      ctx.restore();
      ctx.strokeStyle = rgba(p.light, .28); ctx.lineWidth = .8;
      ctx.beginPath(); ctx.moveTo(s * .43, -s * tall * .65); ctx.quadraticCurveTo(s * .2, 0, s * .45, s * tall * .65); ctx.stroke();
      ctx.fillStyle = rgba(p.light, .32);
      ctx.beginPath(); ctx.moveTo(s * .2, s * .035); ctx.quadraticCurveTo(-s * .25, s * (.5 + beat * .09), -s * .37, s * .16); ctx.fill();
      ellipse(ctx, s * .67, -s * .12, s * .065, s * .065, rgba(p.light, .9));
      ellipse(ctx, s * .68, -s * .12, s * .037, s * .042, '#122a38');
      ellipse(ctx, s * .69, -s * .135, s * .012, s * .012, '#f8ffff');
      ctx.restore();
    }
  }

  class Jellyfish {
    constructor(x, y, size, index) {
      this.x = x; this.y = y; this.originX = x; this.originY = y;
      this.size = size; this.time = index * 2.7; this.index = index;
      this.color = [[170, 155, 247], [107, 218, 229], [214, 153, 223]][index % 3];
    }
    update(dt, world) {
      this.time += dt;
      this.x = this.originX + Math.sin(this.time * .19 + this.index) * Math.min(55, world.width * .05);
      this.y = this.originY + Math.sin(this.time * .36) * 24 + Math.cos(this.time * .7) * 5;
    }
    draw(ctx, neon) {
      const s = this.size, t = this.time, pulse = 1 + Math.sin(t * 1.8) * .075;
      ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(Math.sin(t * .35) * .09);
      glow(ctx, 0, 5, s * 3.2, this.color, .075 + neon * .065);
      // Sinuous strands each have a different phase and length.
      for (let i = 0; i < 11; i++) {
        const x = (i - 5) / 5 * s * .71;
        const len = s * (1.8 + Math.sin(i * 2.3) * .55);
        ctx.beginPath(); ctx.moveTo(x, s * .13);
        for (let k = 1; k <= 22; k++) {
          const f = k / 22;
          const sway = Math.sin(f * 7 - t * 1.2 + i * .7) * s * .17 * f;
          ctx.lineTo(x * (1 - f * .35) + sway + Math.sin(t * .7) * f * s * .25, s * .14 + f * len);
        }
        ctx.strokeStyle = rgba(this.color, .18 + (i % 3) * .12 + neon * .1); ctx.lineWidth = i % 3 === 0 ? s * .075 : .8;
        ctx.lineCap = 'round'; ctx.stroke();
      }
      // Two particularly fine, long trailing tendrils.
      for (const side of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(side * s * .58, 0);
        ctx.bezierCurveTo(side * s * .6, s * 1.7, side * s * .9 + Math.sin(t) * s * .2, s * 2.2, Math.sin(t * .5 + side) * s * .7, s * 3.05);
        ctx.strokeStyle = rgba(this.color, .4); ctx.lineWidth = .7; ctx.stroke();
      }
      ctx.scale(pulse, 1 / pulse);
      const bell = ctx.createRadialGradient(0, -s * .45, 0, 0, 0, s * 1.2);
      bell.addColorStop(0, rgba(this.color, .12)); bell.addColorStop(.68, rgba(this.color, .18)); bell.addColorStop(1, rgba(this.color, .5));
      ctx.beginPath(); ctx.moveTo(-s, s * .1);
      ctx.bezierCurveTo(-s * 1.04, -s * 1.1, s * 1.04, -s * 1.1, s, s * .1);
      ctx.quadraticCurveTo(0, s * .44, -s, s * .1); ctx.fillStyle = bell; ctx.fill();
      ctx.strokeStyle = rgba(this.color, .68); ctx.lineWidth = 1.1; ctx.stroke();
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath(); ctx.moveTo(0, -s * .72);
        ctx.quadraticCurveTo(s * i * .12, -s * .42, s * i * .43, s * .13);
        ctx.strokeStyle = rgba(this.color, .22); ctx.lineWidth = .65; ctx.stroke();
      }
      for (let i = 0; i < 4; i++) ellipse(ctx, (i - 1.5) * s * .18, -s * .08 + Math.sin(i * 2) * s * .08, s * .13, s * .06, rgba(this.color, .37));
      ctx.beginPath(); ctx.moveTo(-s * .98, s * .11);
      ctx.quadraticCurveTo(0, s * .38, s * .98, s * .11);
      ctx.strokeStyle = rgba([213, 233, 255], .64); ctx.lineWidth = 1.4; ctx.stroke();
      for (let i = 0; i < 13; i++) { const x = (i / 12 * 2 - 1) * s; ellipse(ctx, x, s * (.1 + (1 - (x / s) ** 2) * .12), 1, 1.3, rgba([220, 234, 255], .6)); }
      ctx.restore();
    }
  }
  Object.assign(O, { Fish, Jellyfish });
})();
