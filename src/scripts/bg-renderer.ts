/*
 * Monochrome dithered noise background.
 *
 * A WebGL2 port of two effects from shader-effects-inc/shaders (MIT):
 * `SimplexNoise` (MaterialX gradient noise, z-walked over time) feeding `Dither`
 * (ordered Bayer 4x4, custom colours). The WGSL is taken from the library's compiled
 * shader snapshots. Using the library itself would add ~700 KB gzipped and require
 * WebGPU, so the two effects are inlined instead.
 *
 * The canvas is rendered at one pixel per dither cell and scaled up with
 * `image-rendering: pixelated`, so a full-screen frame is a few hundred thousand
 * fragments. The radial fade is applied in the shader rather than with a CSS mask, which
 * would cost an extra composited layer every frame. The noise drifts slowly, so it runs at
 * 20 fps (10 while videos play), holds still while the page scrolls, stops when the tab
 * is hidden, and draws a single still frame for prefers-reduced-motion. Context creation
 * and shader linking are synchronous and can take hundreds of milliseconds on slow GPUs,
 * which is why this normally runs in a worker (see background.ts).
 */

const FPS = 20;
const FPS_WITH_VIDEO = 10;

const props = {
  scale: 0.55,
  seed: 7,
  speed: 0.09,
  contrast: 1.4,
  balance: 0,
  noiseA: "#000000",
  noiseB: "#ffffff",
  threshold: 0.3,
  spread: 1,
  inkA: "#000000",
  inkB: "#262626",
};

const VERT = `#version 300 es
in vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
precision highp int;

uniform vec2 uCells;
uniform float uAnimTime;
uniform float uScale, uSeed, uContrast, uBalance, uThreshold, uSpread;
uniform vec3 uNoiseA, uNoiseB, uInkA, uInkB;
out vec4 outColor;

float mxFade(float t) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }
uint mxRotl32(uint x, int k) { return (x << uint(k)) | (x >> uint(32 - k)); }
uint mxBjfinal(uint a, uint b, uint c) {
  c ^= b; c -= mxRotl32(b, 14);
  a ^= c; a -= mxRotl32(c, 11);
  b ^= a; b -= mxRotl32(a, 25);
  c ^= b; c -= mxRotl32(b, 16);
  a ^= c; a -= mxRotl32(c, 4);
  b ^= a; b -= mxRotl32(a, 14);
  c ^= b; c -= mxRotl32(b, 24);
  return c;
}
uint mxHashInt(int x, int y, int z) {
  uint seed = 3735928559u + (3u << 2u) + 13u;
  return mxBjfinal(seed + uint(x), seed + uint(y), seed + uint(z));
}
float mxGradient(uint hash, float x, float y, float z) {
  uint h = hash & 15u;
  float u = h < 8u ? x : y;
  float inner = (h == 12u || h == 14u) ? x : z;
  float v = h < 4u ? y : inner;
  return ((h & 1u) != 0u ? -u : u) + ((h & 2u) != 0u ? -v : v);
}
float mxTrilerp(float v0, float v1, float v2, float v3, float v4, float v5, float v6, float v7, float s, float t, float r) {
  float s1 = 1.0 - s, t1 = 1.0 - t, r1 = 1.0 - r;
  return r1 * (t1 * (v0 * s1 + v1 * s) + t * (v2 * s1 + v3 * s))
       + r  * (t1 * (v4 * s1 + v5 * s) + t * (v6 * s1 + v7 * s));
}
float mxNoise(vec3 p) {
  ivec3 i = ivec3(floor(p));
  vec3 f = p - vec3(i);
  float u = mxFade(f.x), v = mxFade(f.y), w = mxFade(f.z);
  float r = mxTrilerp(
    mxGradient(mxHashInt(i.x,     i.y,     i.z    ), f.x,       f.y,       f.z),
    mxGradient(mxHashInt(i.x + 1, i.y,     i.z    ), f.x - 1.0, f.y,       f.z),
    mxGradient(mxHashInt(i.x,     i.y + 1, i.z    ), f.x,       f.y - 1.0, f.z),
    mxGradient(mxHashInt(i.x + 1, i.y + 1, i.z    ), f.x - 1.0, f.y - 1.0, f.z),
    mxGradient(mxHashInt(i.x,     i.y,     i.z + 1), f.x,       f.y,       f.z - 1.0),
    mxGradient(mxHashInt(i.x + 1, i.y,     i.z + 1), f.x - 1.0, f.y,       f.z - 1.0),
    mxGradient(mxHashInt(i.x,     i.y + 1, i.z + 1), f.x,       f.y - 1.0, f.z - 1.0),
    mxGradient(mxHashInt(i.x + 1, i.y + 1, i.z + 1), f.x - 1.0, f.y - 1.0, f.z - 1.0),
    u, v, w);
  return 0.982 * r;
}

float ditherBayerQuad(float a, float b) { return b * 3.0 + a * 2.0 - a * b * 4.0; }
float bayer4(vec2 coord) {
  vec2 t = mod(coord, 8.0);
  vec2 q2 = mod(t, 2.0);
  vec2 q4h = floor(mod(t, 4.0) / 2.0);
  return (ditherBayerQuad(q2.x, q2.y) * 4.0 + ditherBayerQuad(q4h.x, q4h.y)) / 16.0;
}

vec3 linearToSrgb(vec3 c) {
  return mix(pow(c, vec3(0.41666)) * 1.055 - 0.055, c * 12.92, vec3(lessThanEqual(c, vec3(0.0031308))));
}

void main() {
  vec2 cell = floor(gl_FragCoord.xy);
  cell.y = uCells.y - 1.0 - cell.y;
  vec2 uv = (cell + 0.5) / uCells;

  // SimplexNoise
  vec2 domain = vec2(uv.x * uCells.x / uCells.y, uv.y) * exp(uScale) + uSeed;
  float n = mxNoise(vec3(domain, uAnimTime * 0.5));
  float k = 1.0 - clamp((n * (uContrast + 1.0) + uBalance) * 0.5 + 0.5, 0.0, 1.0);
  vec3 src = mix(uNoiseA, uNoiseB, k);

  // Dither (bayer4, custom colours)
  float lum = dot(src, vec3(0.299, 0.587, 0.114));
  float d = 0.5 + (bayer4(cell) - 0.5) * uSpread;
  float ink = step(d, lum + (uThreshold - 0.5));

  // Radial fade from the top centre over the black page, (140% 100% at 50% 0%): 1 -> 0.35.
  float fade = mix(1.0, 0.35, clamp((length(vec2((uv.x - 0.5) / 1.4, uv.y)) - 0.25) / 0.5, 0.0, 1.0));
  outColor = vec4(linearToSrgb(mix(uInkA, uInkB, ink)) * fade, 1.0);
}`;

function hexToLinear(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
}

export interface BgState {
  scrolling: boolean;
  videos: number;
  hidden: boolean;
}

export interface BgRenderer {
  resize(w: number, h: number): void;
  setState(state: BgState): void;
}

/** Runs in the background worker, or on the main thread where OffscreenCanvas is missing. */
export function createRenderer(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  cells: { w: number; h: number },
  state: BgState,
  reducedMotion: boolean,
  onReady: () => void,
): BgRenderer | null {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "low-power",
    preserveDrawingBuffer: false,
  }) as WebGL2RenderingContext | null;
  if (!gl) return null;

  const shader = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aLoc = gl.getAttribLocation(prog, "a");
  gl.enableVertexAttribArray(aLoc);
  gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);

  const u = (name: string) => gl.getUniformLocation(prog, name);
  gl.uniform1f(u("uScale"), props.scale);
  gl.uniform1f(u("uSeed"), props.seed);
  gl.uniform1f(u("uContrast"), props.contrast);
  gl.uniform1f(u("uBalance"), props.balance);
  gl.uniform1f(u("uThreshold"), props.threshold);
  gl.uniform1f(u("uSpread"), props.spread);
  gl.uniform3fv(u("uNoiseA"), hexToLinear(props.noiseA));
  gl.uniform3fv(u("uNoiseB"), hexToLinear(props.noiseB));
  gl.uniform3fv(u("uInkA"), hexToLinear(props.inkA));
  gl.uniform3fv(u("uInkB"), hexToLinear(props.inkB));
  const uCells = u("uCells");
  const uAnimTime = u("uAnimTime");

  const t0 = performance.now();
  const draw = (now: number) => {
    gl.uniform1f(uAnimTime, ((now - t0) / 1000) * props.speed);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const resize = (w: number, h: number) => {
    if (canvas.width === w && canvas.height === h) return;
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
    gl.uniform2f(uCells, w, h);
    draw(performance.now());
  };

  resize(cells.w, cells.h);
  onReady();

  const raf = (cb: FrameRequestCallback) =>
    typeof requestAnimationFrame === "function" ? requestAnimationFrame(cb) : setTimeout(() => cb(performance.now()), 16);
  const cancel = (id: number) => (typeof cancelAnimationFrame === "function" ? cancelAnimationFrame(id) : clearTimeout(id));
  let frame = 0;
  let last = 0;
  const loop = (now: number) => {
    frame = raf(loop);
    if (state.scrolling) return;
    const fps = state.videos > 0 ? FPS_WITH_VIDEO : FPS;
    if (now - last < 1000 / fps - 2) return;
    last = now;
    draw(now);
  };
  const setState = (next: BgState) => {
    state = next;
    cancel(frame);
    frame = state.hidden || reducedMotion ? 0 : raf(loop);
  };
  setState(state);

  return { resize, setState };
}
