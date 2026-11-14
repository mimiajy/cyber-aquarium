/* Layered procedural scenery. Expensive gradients and coral are cached on resize. */
(() => {
  'use strict';
  const O = window.CyberAquarium;
  const { TAU, seeded, random, mix, rgba, ellipse, glow, lerp } = O;

  class Environment {
    constructor(width, height) { this.time = 0; this.resize(width, height); }
    resize(width, height) {
      this.width = width; this.height = height;
      this.layers = { neon: this.makeBackdrop('neon'), day: this.makeBackdrop('day') };
      const rng = seeded(730);
      this.plants = Array.from({ length: width < 700 ? 28 : 44 }, (_, i) => {
        const x = rng() * width;
        const edge = Math.abs(x / width - .5) * 2;
        return { x, y: height + 20 + rng() * 24, size: (75 + rng() * 145 + edge * 85) * Math.min(1, height / 800), width: 6 + rng() * 15, phase: rng() * TAU, type: i % 3, color: rng(), front: i % 4 === 0 };
      }).sort((a, b) => a.size - b.size);
      this.dust = Array.from({ length: width < 700 ? 50 : 85 }, () => ({ x: rng() * width, y: rng() * height, radius: .5 + rng() * 1.3, phase: rng() * TAU, speed: 1 + rng() * 5 }));
      this.bubbles = Array.from({ length: width < 700 ? 14 : 25 }, () => this.makeBubble(rng() * height));
    }
    makeBubble(y = this.height + 20) {
      return { x: random(20, this.width - 20), y, size: random(1.7, 5.8), speed: random(12, 29), phase: random(0, TAU) };
    }
    makeBackdrop(mode) {
      const w = this.width, h = this.height, theme = O.themes[mode], rng = seeded(543);
      const canvas = document.createElement('canvas');
      const density = Math.min(1.3, 1920 / w);
      canvas.width = Math.ceil(w * density); canvas.height = Math.ceil(h * density);
      const ctx = canvas.getContext('2d'); ctx.scale(density, density);
      const water = ctx.createLinearGradient(0, 0, w * .18, h);
      water.addColorStop(0, rgba(theme.top)); water.addColorStop(.48, rgba(theme.middle)); water.addColorStop(1, rgba(theme.bottom));
      ctx.fillStyle = water; ctx.fillRect(0, 0, w, h);
      glow(ctx, w * .67, h * .12, w * .64, theme.glow, mode === 'day' ? .2 : .14);
      glow(ctx, w * .92, h * .58, w * .45, [79, 91, 174], mode === 'neon' ? .15 : .04);
      glow(ctx, w * .36, h * .76, w * .35, [29, 137, 150], .12);
      // Broad translucent shafts of light from the surface.
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      const beams = [[.37, -.08, .13, .1], [.54, .12, .08, .065], [.77, .28, .1, .11], [.98, .46, .07, .035]];
      for (const [source, end, spread, alpha] of beams) {
        const g = ctx.createLinearGradient(0, 0, 0, h * .91);
        g.addColorStop(0, `rgba(154,224,233,${alpha * (mode === 'day' ? 1.6 : 1)})`); g.addColorStop(.45, `rgba(109,207,214,${alpha * .45})`); g.addColorStop(1, 'rgba(81,177,203,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(source * w, -10); ctx.lineTo((source + spread * .22) * w, -10); ctx.lineTo((end + spread) * w, h); ctx.lineTo((end - spread) * w, h); ctx.fill();
      }
      ctx.restore();
      // Distant shoal: small, low-contrast silhouettes establish depth.
      for (let i = 0; i < 21; i++) {
        const x = w * (.48 + rng() * .48), y = h * (.25 + rng() * .4), s = 2 + rng() * 4;
        ctx.save(); ctx.translate(x, y); ctx.rotate(-.12);
        ellipse(ctx, 0, 0, s * 1.6, s * .45, rgba([108, 172, 188], .1));
        ctx.fillStyle = rgba([108, 172, 188], .1); ctx.beginPath(); ctx.moveTo(-s, 0); ctx.lineTo(-s * 2.4, -s * .7); ctx.lineTo(-s * 2.4, s * .7); ctx.fill(); ctx.restore();
      }
      // Receding seabed ridges.
      for (let layer = 0; layer < 3; layer++) {
        const y = h - 60 - (2 - layer) * h * .055;
        ctx.beginPath(); ctx.moveTo(0, y + 10);
        ctx.bezierCurveTo(w * .18, y - 60 + layer * 20, w * .33, y + 75, w * .54, y + 17);
        ctx.bezierCurveTo(w * .75, y - 42, w * .86, y - 21, w, y + 12);
        ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
        ctx.fillStyle = mode === 'neon' ? ['#0b3547', '#092d3e', '#072735'][layer] : ['#0d6170', '#0b5160', '#084250'][layer];
        ctx.fill();
      }
      // Rock clusters, partly veiled in water.
      for (let i = 0; i < 15; i++) {
        const x = rng() * w, y = h - 18 - rng() * 48, s = 12 + rng() * 42;
        const rock = ctx.createLinearGradient(x, y - s, x, y + s);
        rock.addColorStop(0, mode === 'day' ? '#28646c' : '#1b4657'); rock.addColorStop(1, mode === 'day' ? '#0b3c4b' : '#092632');
        ellipse(ctx, x, y, s * 1.8, s * .65, rock, rng() * .6 - .3);
      }
      // Branching corals are generated once, with deterministic geometry.
      const corals = [[.075, 155, 4], [.22, 96, 5], [.34, 68, 3], [.59, 90, 4], [.76, 102, 5], [.9, 174, 5], [.98, 96, 4]];
      for (let i = 0; i < corals.length; i++) {
        const [x, size, depth] = corals[i];
        const scale = Math.min(1.15, h / 800) * (w < 700 ? .85 : 1);
        this.coral(ctx, w * x, h - 29 + (i % 2) * 15, size * scale, depth, mode, i * 81 + 2);
      }
      // Small sand lights and pebbles.
      for (let i = 0; i < 130; i++) {
        const x = rng() * w, y = h - rng() * 75, r = .5 + rng() * 1.8;
        ellipse(ctx, x, y, r * 1.4, r * .5, rgba(mode === 'neon' ? [119, 172, 177] : [175, 207, 184], rng() * .23));
      }
      return canvas;
    }
    coral(ctx, x, y, size, depth, mode, seed) {
      const rng = seeded(seed), color = mode === 'neon' ? [131 + rng() * 35, 103 + rng() * 18, 175 + rng() * 35] : [189 + rng() * 35, 126 + rng() * 30, 141 + rng() * 35];
      const branch = (bx, by, len, angle, level, weight) => {
        const ex = bx + Math.cos(angle) * len, ey = by + Math.sin(angle) * len;
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + Math.cos(angle + .15) * len * .5, by + Math.sin(angle + .15) * len * .5, ex, ey);
        ctx.strokeStyle = rgba(color, .48 + (depth - level) * .06); ctx.lineWidth = weight; ctx.lineCap = 'round'; ctx.stroke();
        if (level <= 0) {
          ellipse(ctx, ex, ey, 1.6, 2.2, rgba(mix(color, [225, 206, 246], .4), .8)); return;
        }
        branch(ex, ey, len * (.61 + rng() * .17), angle - .35 - rng() * .28, level - 1, weight * .64);
        branch(ex, ey, len * (.61 + rng() * .17), angle + .35 + rng() * .28, level - 1, weight * .64);
        if (level > 2) branch(ex, ey, len * .61, angle + rng() * .35 - .175, level - 1, weight * .59);
      };
      glow(ctx, x, y - size * .8, size * 1.5, color, mode === 'neon' ? .055 : .025);
      branch(x, y, size * .37, -Math.PI / 2, depth, size * .065);
    }
    update(dt) {
      this.time += dt;
      for (const dust of this.dust) {
        dust.y -= dust.speed * dt; dust.x += Math.sin(this.time * .2 + dust.phase) * dt * 2;
        if (dust.y < -4) dust.y = this.height + 4;
        if (dust.x < -4) dust.x = this.width + 4;
        if (dust.x > this.width + 4) dust.x = -4;
      }
      for (let i = 0; i < this.bubbles.length; i++) {
        const b = this.bubbles[i]; b.y -= b.speed * dt; b.x += Math.sin(this.time * .8 + b.phase) * dt * 5;
        if (b.y < -15) this.bubbles[i] = this.makeBubble();
      }
    }
    drawBackground(ctx, neon) {
      const w = this.width, h = this.height;
      if (neon > .999) ctx.drawImage(this.layers.neon, 0, 0, w, h);
      else {
        ctx.drawImage(this.layers.day, 0, 0, w, h);
        if (neon > .001) { ctx.globalAlpha = neon; ctx.drawImage(this.layers.neon, 0, 0, w, h); ctx.globalAlpha = 1; }
      }
      // Almost imperceptible caustic ribbons keep the water itself alive.
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < 7; i++) {
        ctx.strokeStyle = `rgba(114,204,217,${(.012 + Math.sin(this.time * .3 + i) * .004) * (1.5 - neon * .5)})`;
        ctx.lineWidth = 9 + i * 2; ctx.beginPath();
        const x = w * (.28 + i * .15) + Math.sin(this.time * .14 + i) * 18;
        ctx.moveTo(x, 0); ctx.bezierCurveTo(x - w * .08, h * .2, x - w * .32, h * .6, x - w * .36, h);
        ctx.stroke();
      }
      ctx.restore();
      this.drawPlants(ctx, neon, false);
    }
    drawPlants(ctx, neon, front) {
      for (const plant of this.plants) {
        if (plant.front !== front) continue;
        const t = this.time, s = plant.size;
        const sway = Math.sin(t * .53 + plant.phase) * s * .055;
        const day = mix([26, 119, 124], [65, 166, 143], plant.color);
        const night = mix([25, 84, 115], [49, 133, 143], plant.color);
        const color = mix(day, night, neon);
        ctx.save(); ctx.translate(plant.x, plant.y);
        if (plant.type === 0) {
          // A broad ribbon blade, bending with a slow underwater current.
          const bend = Math.sin(plant.phase) * s * .2 + sway;
          const g = ctx.createLinearGradient(0, 0, 0, -s);
          g.addColorStop(0, rgba(mix(color, [3, 31, 46], .4), .9)); g.addColorStop(.7, rgba(color, .75)); g.addColorStop(1, rgba(mix(color, [106, 186, 170], .3), .75));
          ctx.beginPath(); ctx.moveTo(0, 0);
          ctx.bezierCurveTo(-plant.width, -s * .27, bend - plant.width, -s * .7, bend, -s);
          ctx.bezierCurveTo(bend + plant.width * .2, -s * .65, plant.width, -s * .3, 0, 0); ctx.fillStyle = g; ctx.fill();
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(bend - 3, -s * .55, bend, -s);
          ctx.strokeStyle = rgba(mix(color, [131, 198, 169], .35), .28); ctx.lineWidth = .6; ctx.stroke();
        } else {
          const bend = Math.sin(plant.phase) * s * .19 + sway;
          ctx.strokeStyle = rgba(color, .8); ctx.lineWidth = plant.type === 1 ? 1.5 : 2.3; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(bend * .15, -s * .5, bend, -s); ctx.stroke();
          const count = plant.type === 1 ? 11 : 8;
          for (let j = 1; j < count; j++) {
            const f = j / count, py = -s * f, px = bend * f * f;
            const leafLen = s * (.24 * Math.sin(f * Math.PI) + .025);
            for (const side of [-1, 1]) {
              const tipX = px + side * leafLen + sway * f * .2, tipY = py - leafLen * .5;
              const breadth = plant.type === 1 ? leafLen * .18 : leafLen * .33;
              ctx.beginPath(); ctx.moveTo(px, py);
              ctx.bezierCurveTo(px + side * leafLen * .4, py - breadth * 1.7, tipX - side * leafLen * .2, tipY - breadth, tipX, tipY);
              ctx.bezierCurveTo(tipX - side * leafLen * .2, tipY + breadth, px + side * leafLen * .3, py + breadth * .2, px, py);
              ctx.fillStyle = rgba(mix(color, [109, 179, 159], f * .17), front ? .85 : .66); ctx.fill();
              ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(px + side * leafLen * .5, py - breadth, tipX, tipY);
              ctx.strokeStyle = rgba(mix(color, [139, 203, 169], .3), .26); ctx.lineWidth = .5; ctx.stroke();
            }
          }
        }
        ctx.restore();
      }
    }
    drawAtmosphere(ctx, neon) {
      for (const d of this.dust) {
        const alpha = .13 + (Math.sin(this.time * .7 + d.phase) + 1) * .11;
        ellipse(ctx, d.x, d.y, d.radius, d.radius, rgba([159, 219, 219], alpha));
        if (d.radius > 1.5) glow(ctx, d.x, d.y, 9, [104, 201, 211], alpha * .1);
      }
      for (const b of this.bubbles) {
        ctx.beginPath(); ctx.arc(b.x, b.y, b.size, 0, TAU);
        ctx.strokeStyle = rgba([170, 224, 237], .14 + neon * .04); ctx.lineWidth = .7; ctx.stroke();
        ctx.beginPath(); ctx.arc(b.x - b.size * .15, b.y - b.size * .15, b.size * .72, Math.PI * 1.06, Math.PI * 1.55);
        ctx.strokeStyle = rgba([214, 242, 246], .32); ctx.lineWidth = .8; ctx.stroke();
      }
    }
    drawForeground(ctx, neon) { this.drawPlants(ctx, neon, true); }
  }
  O.Environment = Environment;
})();
