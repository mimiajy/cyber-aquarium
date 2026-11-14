/* Shared drawing and motion helpers. No network or build step required. */
window.CyberAquarium = (() => {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const lerp = (a, b, t) => a + (b - a) * t;
  const random = (a, b) => a + Math.random() * (b - a);
  const rgba = (rgb, a = 1) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
  const mix = (a, b, t) => a.map((n, i) => Math.round(lerp(n, b[i], t)));
  const length = (x, y) => Math.hypot(x, y);
  const normalize = (x, y) => { const d = Math.hypot(x, y) || 1; return [x / d, y / d]; };
  const seeded = (seed) => () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let n = Math.imul(seed ^ seed >>> 15, 1 | seed);
    n = n + Math.imul(n ^ n >>> 7, 61 | n) ^ n;
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
  const ellipse = (ctx, x, y, rx, ry, color, angle = 0) => {
    ctx.fillStyle = color; ctx.beginPath();
    ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), angle, 0, TAU); ctx.fill();
  };
  const glow = (ctx, x, y, radius, color, alpha) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, rgba(color, alpha)); g.addColorStop(.3, rgba(color, alpha * .42)); g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  };
  const themes = {
    neon: { top: [9, 37, 67], middle: [8, 50, 69], bottom: [3, 23, 39], glow: [61, 175, 188], coral: [136, 101, 194], plant: [36, 124, 143] },
    day: { top: [29, 129, 157], middle: [13, 108, 132], bottom: [5, 49, 68], glow: [117, 239, 219], coral: [225, 141, 148], plant: [47, 157, 153] },
  };
  return { TAU, clamp, lerp, random, rgba, mix, length, normalize, seeded, ellipse, glow, themes };
})();
