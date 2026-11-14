/* A 2D texture grid, not a 3D scene. One reusable GPU surface prevents alpha
 * seams between sprite strips. Canvas fallback keeps unsupported devices usable.
 */
(() => {
  'use strict';
  const vertex = `
    attribute vec2 uv;
    varying vec2 texcoord;
    uniform vec2 size;
    uniform vec2 target;
    uniform float time;
    uniform float phase;
    uniform float kind;
    uniform float hungry;
    uniform float swimBeat;
    uniform float tailPower;
    uniform float finPower;
    uniform float fishProfile;
    void main() {
      texcoord = uv;
      vec2 p = (uv - .5) * size;
      if (kind < .5) {
        float tail = pow(1. - uv.x, 2.3);
        p.y += sin(uv.x * 8.2 - swimBeat + phase)
          * size.y * (.006 + tail * .085) * tailPower;
        p.x += sin(uv.x * 7. - swimBeat + phase) * size.x * .006 * tail * tailPower;
        float outer = smoothstep(.12, .43, abs(uv.y - .5));
        float headMask = 1. - smoothstep(.69, .91, uv.x);
        p.x += sin(uv.y * 9. - swimBeat * .52 + phase) * size.x * .018 * outer * headMask * finPower;
        p.y += sin(uv.x * 8. - swimBeat * .61 + phase) * size.y * .012 * outer * headMask * finPower;
        if (fishProfile > 1.5) {
          p.x += sin(uv.y * 12. - swimBeat * .41 + phase) * size.x * .018 * outer * headMask;
        }
      } else if (kind < 1.5) {
        float bell = 1. - smoothstep(.15, .37, uv.y);
        float tail = smoothstep(.2, .95, uv.y);
        p.x *= 1. + sin(time * 1.24 + phase) * .043 * bell;
        p.x += (sin(uv.y * 7.2 - time * .87 + phase) * .045
          + sin(uv.y * 15. - time * 1.13 + phase) * .009) * size.x * tail;
        p.y += sin(time * 1.24 + phase) * size.y * .011 * bell;
      } else {
        vec2 a = (uv - vec2(.26,.67)) / vec2(.14,.15);
        vec2 b = (uv - vec2(.45,.78)) / vec2(.12,.12);
        float soft = exp(-dot(a,a) * 2.) + exp(-dot(b,b) * 2.);
        p.x += sin(time * .7 + uv.x * 11. + uv.y * 8. + phase) * size.x * .012 * soft;
        p.y += sin(time * .65 + uv.x * 14. + phase) * size.y * .006 * soft;
        p.x += sin(time * .48 + uv.y * 5. + phase) * size.x * .002 * pow(1. - uv.y, 2.);
      }
      vec2 pixel = p + target * .5;
      gl_Position = vec4(pixel.x / target.x * 2. - 1., 1. - pixel.y / target.y * 2., 0., 1.);
    }
  `;
  const fragment = `
    precision mediump float;
    varying vec2 texcoord;
    uniform sampler2D image;
    void main() { gl_FragColor = texture2D(image, texcoord); }
  `;
  class SpriteWarp {
    constructor(createCanvas) {
      this.canvas = createCanvas(1024, 1024); this.gl = null; this.textures = new Map();
      try {
        const gl = this.canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: true, depth: false, stencil: false });
        if (!gl) return;
        this.gl = gl;
        const compile = (kind, code) => {
          const shader = gl.createShader(kind); gl.shaderSource(shader, code); gl.compileShader(shader);
          if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
          return shader;
        };
        this.program = gl.createProgram();
        gl.attachShader(this.program, compile(gl.VERTEX_SHADER, vertex)); gl.attachShader(this.program, compile(gl.FRAGMENT_SHADER, fragment)); gl.linkProgram(this.program);
        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(this.program));
        gl.useProgram(this.program);
        const points = [], indices = [], nx = 40, ny = 56;
        for (let y = 0; y <= ny; y++) for (let x = 0; x <= nx; x++) points.push(x / nx, y / ny);
        for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
          const a = y * (nx + 1) + x, b = a + 1, c = a + nx + 1, d = c + 1;
          indices.push(a, c, b, b, c, d);
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.STATIC_DRAW);
        const attr = gl.getAttribLocation(this.program, 'uv'); gl.enableVertexAttribArray(attr); gl.vertexAttribPointer(attr, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW); this.count = indices.length;
        this.uniforms = Object.fromEntries(['size', 'target', 'time', 'phase', 'kind', 'hungry', 'image', 'swimBeat', 'tailPower', 'finPower', 'fishProfile'].map(key => [key, gl.getUniformLocation(this.program, key)]));
        gl.uniform1i(this.uniforms.image, 0); gl.activeTexture(gl.TEXTURE0);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        this.canvas.addEventListener?.('webglcontextlost', event => { event.preventDefault(); this.gl = null; });
      } catch { this.gl = null; }
    }
    draw(ctx, image, width, height, kind, time, phase, hungry = false, motion = {}) {
      const gl = this.gl;
      if (!gl || gl.isContextLost()) {
        if (kind === 0) {
          // CPU fallback still bends the tail and breathes the fins. Adjacent
          // strips do not overlap, avoiding the former bright alpha bands.
          const count = 28, beat = motion.beat ?? time * 4.8;
          for (let i = 0; i < count; i++) {
            const u = i / count, tail = (1 - u) ** 2.3;
            const dy = Math.sin(u * 8.2 - beat + phase) * height * (.006 + tail * .085) * (motion.tail ?? 1);
            const finMask = Math.max(0, 1 - u / .9);
            const stretch = 1 + Math.sin(beat * .61 + u * 8) * .025 * (motion.fins ?? .6) * finMask;
            ctx.drawImage(image, i * image.width / count, 0, image.width / count, image.height,
              (u - .5) * width, -height * stretch * .5 + dy, width / count, height * stretch);
          }
          return;
        }
        const breath = kind === 1 ? 1 + Math.sin(time * 1.24 + phase) * .025 : 1;
        ctx.drawImage(image, -width * breath * .5, -height * .5, width * breath, height);
        return;
      }
      if (!this.textures.has(image)) {
        const texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        this.textures.set(image, texture);
      }
      gl.bindTexture(gl.TEXTURE_2D, this.textures.get(image));
      const tw = width + 32, th = height + 32;
      const density = Math.min(1.5, 1024 / Math.max(tw, th));
      const rw = Math.max(1, Math.ceil(tw * density)), rh = Math.max(1, Math.ceil(th * density));
      gl.viewport(0, 0, rw, rh); gl.enable(gl.SCISSOR_TEST); gl.scissor(0, 0, rw, rh);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(this.uniforms.size, width, height); gl.uniform2f(this.uniforms.target, tw, th);
      gl.uniform1f(this.uniforms.time, time); gl.uniform1f(this.uniforms.phase, phase);
      gl.uniform1f(this.uniforms.kind, kind); gl.uniform1f(this.uniforms.hungry, hungry ? 1 : 0);
      gl.uniform1f(this.uniforms.swimBeat, motion.beat ?? time * (hungry ? 7.5 : 4.8));
      gl.uniform1f(this.uniforms.tailPower, motion.tail ?? 1); gl.uniform1f(this.uniforms.finPower, motion.fins ?? 0);
      gl.uniform1f(this.uniforms.fishProfile, motion.profile ?? 0);
      gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
      ctx.drawImage(this.canvas, 0, 1024 - rh, rw, rh, -tw * .5, -th * .5, tw, th);
    }
  }
  globalThis.SpriteWarp = SpriteWarp;
})();
