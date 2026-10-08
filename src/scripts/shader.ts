const canvas = document.querySelector<HTMLCanvasElement>(".hero-canvas");

const FRAG = `
precision mediump float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = r * p * 2.02; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes.xy;
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes.xy) / uRes.y;
  float t = uTime * 0.045;
  vec2 m = (uMouse - 0.5) * 0.25;

  vec2 q = vec2(fbm(p * 1.6 + t + m), fbm(p * 1.6 - t + 4.7));
  vec2 r = vec2(fbm(p * 1.4 + 3.0 * q + vec2(1.7, 9.2) + t * 1.4), fbm(p * 1.4 + 3.0 * q + vec2(8.3, 2.8) - t));
  float f = fbm(p * 1.2 + 3.2 * r);

  vec3 base = vec3(0.035, 0.035, 0.045);
  vec3 lime = vec3(0.78, 1.0, 0.24);
  vec3 cyan = vec3(0.24, 0.84, 1.0);
  vec3 violet = vec3(0.55, 0.42, 1.0);

  vec3 col = base;
  col = mix(col, violet * 0.35, smoothstep(0.35, 0.9, length(q)) * 0.55);
  col = mix(col, cyan * 0.30, smoothstep(0.45, 0.95, r.x) * 0.5);
  col += lime * pow(smoothstep(0.55, 0.95, f), 3.0) * 0.55;

  float lines = smoothstep(0.92, 1.0, sin(f * 60.0) * 0.5 + 0.5) * smoothstep(0.4, 0.8, f);
  col += lines * 0.05;

  float vig = smoothstep(1.25, 0.2, length((uv - vec2(0.5, 0.42)) * vec2(1.1, 1.4)));
  col *= mix(0.25, 1.0, vig);
  col *= smoothstep(0.0, 0.35, uv.y) * 0.85 + 0.15;

  gl_FragColor = vec4(col, 1.0);
}`;

const VERT = `attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }`;

function init(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });
  if (!gl) return;

  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  };
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "a");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, "uRes");
  const uTime = gl.getUniformLocation(prog, "uTime");
  const uMouse = gl.getUniformLocation(prog, "uMouse");

  const scale = 0.5;
  const resize = () => {
    const w = Math.max(1, Math.floor(canvas.clientWidth * scale));
    const h = Math.max(1, Math.floor(canvas.clientHeight * scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  };

  const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
  window.addEventListener(
    "pointermove",
    (e) => {
      mouse.tx = e.clientX / innerWidth;
      mouse.ty = 1 - e.clientY / innerHeight;
    },
    { passive: true },
  );

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const start = performance.now() - 20000;
  let visible = true;
  let raf = 0;

  const draw = (now: number) => {
    resize();
    mouse.x += (mouse.tx - mouse.x) * 0.03;
    mouse.y += (mouse.ty - mouse.y) * 0.03;
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, (now - start) / 1000);
    gl.uniform2f(uMouse, mouse.x, mouse.y);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const loop = (now: number) => {
    draw(now);
    raf = visible && !document.hidden ? requestAnimationFrame(loop) : 0;
  };
  const kick = () => {
    if (!reduce && !raf && visible && !document.hidden) raf = requestAnimationFrame(loop);
  };

  draw(performance.now());
  canvas.classList.add("ready");
  if (reduce) {
    window.addEventListener("resize", () => draw(performance.now()));
    return;
  }
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    kick();
  }).observe(canvas);
  document.addEventListener("visibilitychange", kick);
  kick();
}

if (canvas) init(canvas);
