/*
 * The hero and about scene (components/home/Intro.astro).
 *
 * With motion allowed and a hero that fits the screen, html.scene pins the hero and the about
 * section as one stage, 85svh of scroll long (an inline script at the top of the intro sets the
 * class before it is first laid out, so the page never jumps; this module confirms it).
 * Scrolling, the name and the intro rise away, the ring opens and fades, everything else in the
 * collage flies outward, the tiles settle back toward Leon's shoulders and, while he sinks, come
 * up beside the about text as one cluster, thick and turned; the text, the photographs and the
 * ring come in with them. Through the rest of the run the cluster keeps drifting up a little, so
 * nothing stands frozen before the page moves on. Everything is set from the progress, so
 * scrolling back plays it backwards. Progress is eased toward the scroll position by time, so
 * the stage moves with the same weight at any frame rate; the loop stops once it arrives and
 * the landed tiles have settled.
 * Transforms and opacity only.
 */

const intro = document.querySelector<HTMLElement>("[data-intro]");
if (intro) init(intro);

function init(intro: HTMLElement) {
  const root = document.documentElement;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const stage = intro.querySelector<HTMLElement>(".stage")!;
  const hero = intro.querySelector<HTMLElement>(".hero")!;
  const about = intro.querySelector<HTMLElement>("[data-about]")!;
  const collage = intro.querySelector<HTMLElement>("[data-collage]")!;
  const me = collage.querySelector<HTMLElement>(".me")!;
  const pieces = Array.from(collage.querySelectorAll<HTMLElement>(".piece"));
  const tiles = pieces.filter((p) => p.classList.contains("is-tile"));
  const flying = pieces.filter((p) => !p.classList.contains("is-tile"));
  const heroTop = hero.querySelector<HTMLElement>(".hero-top")!;
  const rings = Array.from(collage.querySelectorAll<SVGSVGElement>(".ring"));
  const reveals = Array.from(about.querySelectorAll<HTMLElement>("[data-reveal]"));
  const copy = about.querySelector<HTMLElement>(".about-copy")!;
  // The photographs and the about ring; the right photograph comes a beat after the left. Once
  // the page is idle after its entrance they wait at a trace of opacity (below one level of grey)
  // rather than at none, so the browser paints them then instead of in the middle of the scroll.
  let floor = 0;
  const extras = [
    ...Array.from(about.querySelectorAll<HTMLElement>(".panel")).map((el) => ({ el, lag: el.classList.contains("panel-r") ? 0.03 : 0 })),
    ...Array.from(about.querySelectorAll<SVGSVGElement>(".about-ring")).map((el) => ({ el, lag: 0 })),
  ];

  const vh = () => innerHeight;
  const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const seg = (v: number, a: number, b: number) => clamp((v - a) / (b - a));
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
  // Sine in-out: soft at both ends, without the long flat shoulders of a cubic.
  const ease = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t);

  // The timeline, in scene progress. The phases overlap, so no frame is left half empty.
  const DIP = [0, 0.12]; // the tiles settle back toward his shoulders
  const RISE = [0.04, 0.68]; // and, already growing, come up to the cluster
  const SINK = [0.04, 0.26]; // Leon sinks below the edge, gone as the about text comes in
  const HERE = 0.14; // the about text comes in
  const LANDED = 0.68; // the tiles are in place and float on their own
  // Afloat, once landed: each tile sinks a few pixels and comes back up, out of step with the
  // others, and is at rest within five seconds. It runs in this loop rather than as a CSS
  // animation, because starting one on the 3D tiles re-rasters every slab in a single frame.
  const BOB = 2.4; // seconds down, and as long back up
  const STAGGER = 0.14; // seconds between the tiles
  const AFLOAT = 2 * BOB + 3 * STAGGER;
  const bob = (i: number) => {
    const t = clamp((scene.ft - (i + 1) * STAGGER) / (2 * BOB));
    return 3 - 3 * Math.cos(2 * Math.PI * t); // 0, down to 6px, back to 0
  };

  interface Box {
    cx: number;
    cy: number;
    w: number;
  }
  interface TileMove {
    el: HTMLElement;
    body: HTMLElement;
    /** The tile's own thickness in the hero, from its CSS --depth. */
    depth: number;
    from: Box;
    to: Box;
    r: number;
    rx0: number;
    ry0: number;
    rx: number;
    ry: number;
    rz: number;
    /** Stacking in the cluster, taken once the tile is on its way there. */
    zi: string;
  }
  interface Flyer {
    el: HTMLElement;
    dx: number;
    dy: number;
    spin: number;
  }

  const scene = {
    on: false,
    p: 0, // eased progress, 0 = hero, 1 = about
    target: 0,
    moves: [] as TileMove[],
    flyers: [] as Flyer[],
    visible: true,
    here: false,
    ft: 0, // seconds afloat since the tiles landed
    // Where the intro starts on the page and how far it scrolls, read only on measure.
    top: 0,
    run: 0,
  };

  const box = (el: Element, origin: DOMRect): Box => {
    const r = el.getBoundingClientRect();
    return { cx: r.left + r.width / 2 - origin.left, cy: r.top + r.height / 2 - origin.top, w: r.width };
  };
  const num = (el: HTMLElement, prop: string) => parseFloat(getComputedStyle(el).getPropertyValue(prop)) || 0;

  /** Reads every start and end place with all scene transforms cleared. */
  function measure() {
    const moved = [me, heroTop, ...rings, ...pieces];
    for (const el of moved) el.style.transform = "";
    const origin = stage.getBoundingClientRect();
    const c = collage.getBoundingClientRect();
    const centre = { x: c.left + c.width / 2, y: c.top + c.height / 2 };
    scene.top = intro.getBoundingClientRect().top + scrollY;
    scene.run = intro.offsetHeight - vh();
    scene.moves = tiles.map((el) => {
      const tile = el.querySelector<HTMLElement>(".tile")!;
      const body = tile.querySelector<HTMLElement>(".tile-body")!;
      const slot = about.querySelector<HTMLElement>(`[data-slot="${tile.dataset.tile}"]`)!;
      body.style.transform = "";
      return {
        el,
        body,
        depth: num(tile, "--depth") || 14,
        from: box(el, origin),
        to: box(slot.querySelector(".tile")!, origin),
        r: num(el, "--r") || num(el.querySelector(".piece-in")!, "rotate"),
        rx0: parseFloat(tile.dataset.rx || "12"),
        ry0: parseFloat(tile.dataset.ry || "0"),
        rx: num(slot, "--rx"),
        ry: num(slot, "--ry"),
        rz: num(slot, "--rz"),
        zi: getComputedStyle(slot).getPropertyValue("--zi").trim(),
      };
    });
    scene.flyers = flying.map((el) => {
      const r = el.getBoundingClientRect();
      const dx = r.left + r.width / 2 - centre.x;
      const dy = r.top + r.height / 2 - centre.y;
      const len = Math.hypot(dx, dy) || 1;
      return { el, dx: dx / len, dy: dy / len, spin: Math.sign(dx) * (14 + Math.random() * 10) };
    });
  }

  function render() {
    const p = scene.p;
    const H = vh();
    const W = innerWidth;
    const a = easeOut(seg(p, 0, 0.3));
    const dip = ease(seg(p, DIP[0], DIP[1]));
    // The rise is front-loaded (the square root), so the tiles visibly grow while Leon sinks; it
    // still lands softly.
    const b = ease(Math.sqrt(seg(p, RISE[0], RISE[1])));
    // After landing, the cluster and its text keep drifting up through the rest of the run.
    const hold = seg(p, LANDED, 1) * H * 0.04;
    // The float fades out as the tiles leave the landing, so scrolling back never snaps them.
    const afloat = seg(p, LANDED - 0.05, LANDED);

    heroTop.style.transform = `translate3d(0, ${(-a * H * 0.32).toFixed(2)}px, 0)`;
    heroTop.style.opacity = String(clamp(1 - seg(p, 0, 0.2) * 1.1));

    // The ring opens out round his head and fades first.
    const ro = clamp(1 - seg(p, 0, 0.14));
    for (const r of rings) {
      r.style.transform = `translate3d(0, ${(-a * H * 0.06).toFixed(2)}px, 0) scale(${(1 + a * 0.22).toFixed(4)})`;
      r.style.opacity = String(ro);
      r.style.visibility = ro < 0.01 ? "hidden" : "";
    }

    // Leon stands while the tiles dip behind him, then sinks below the edge.
    const sink = ease(seg(p, SINK[0], SINK[1]));
    me.style.transform = `translate3d(0, ${(sink * 105).toFixed(2)}%, 0)`;
    const mo = clamp(1 - seg(p, 0.18, SINK[1]));
    me.style.opacity = String(mo);
    me.style.visibility = mo < 0.01 ? "hidden" : "";

    for (const f of scene.flyers) {
      const k = easeOut(seg(p, 0, 0.28));
      const x = f.dx * k * W * 0.42;
      const y = Math.max(0, f.dy) * k * H * 0.3 + k * H * 0.1;
      f.el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${(f.spin * k).toFixed(2)}deg) scale(${(1 + k * 0.18).toFixed(4)})`;
      const o = clamp(1 - seg(p, 0.03, 0.24));
      f.el.style.opacity = String(o);
      f.el.style.visibility = o < 0.01 ? "hidden" : "";
    }

    for (const [i, m] of scene.moves.entries()) {
      // Dip: toward his shoulders, a little smaller, as if pushed back. Rise: from there to the
      // slot, growing to its size.
      const toScale = m.to.w / m.from.w;
      // Sideways they move first, so they are clear of the about text by the time it comes in.
      const x = lerp(0, m.to.cx - m.from.cx, easeOut(seg(p, RISE[0], 0.36)));
      const s = lerp(1 - dip * 0.1, toScale, b);
      const y = lerp(dip * H * 0.08, m.to.cy - m.from.cy, b) - hold + bob(i) * s * afloat;
      m.el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${(-m.r * b).toFixed(2)}deg) scale(${s.toFixed(4)})`;
      m.el.style.zIndex = b > 0.5 ? m.zi : "";
      // One transform on the body: the turn, and the thickness as a stretch in depth.
      const thick = lerp(m.depth, 34 / toScale, b) / m.depth;
      m.body.style.transform = `rotateX(${lerp(m.rx0, m.rx, b).toFixed(2)}deg) rotateY(${lerp(m.ry0, m.ry, b).toFixed(2)}deg) rotateZ(${lerp(0, m.rz, b).toFixed(2)}deg) scaleZ(${thick.toFixed(4)})`;
    }

    // The about text rises in as the tiles clear the way; the photographs and the ring arrive as
    // the tiles land. The individual translate leaves their own transform and rotate alone.
    const c = easeOut(seg(p, HERE, 0.34));
    copy.style.opacity = c.toFixed(3);
    copy.style.transform = `translate3d(0, ${((1 - c) * 24 - hold).toFixed(2)}px, 0)`;
    for (const { el, lag } of extras) {
      const s = ease(seg(p, 0.46 + lag, LANDED + lag));
      el.style.opacity = Math.max(s, floor).toFixed(3);
      el.style.translate = `0 ${((1 - s) * 24 - hold).toFixed(2)}px`;
    }

    // Classes change only when their state does.
    const here = p > HERE;
    if (here !== scene.here) {
      scene.here = here;
      about.classList.toggle("is-here", here);
      if (here) for (const el of reveals) el.classList.add("is-in");
    }
  }

  let raf = 0;
  let last = 0;
  function frame(now: number) {
    raf = 0;
    // The time since the last frame (one frame's worth on the first), capped so a stall does
    // not jump the stage.
    const dt = last ? Math.min(64, now - last) : 16.7;
    last = now;
    scene.p += (scene.target - scene.p) * (1 - Math.exp(-dt / 105));
    if (Math.abs(scene.target - scene.p) < 0.0004) scene.p = scene.target;
    // The float's clock runs while the tiles are landed and motion is not paused, and starts
    // over once they have left.
    const paused = root.classList.contains("motion-paused");
    if (scene.p < LANDED - 0.05) scene.ft = 0;
    else if (scene.p >= LANDED && !paused) scene.ft = Math.min(AFLOAT, scene.ft + dt / 1000);
    render();
    const floating = scene.p >= LANDED && scene.ft < AFLOAT && !paused;
    if (scene.visible && (scene.p !== scene.target || floating)) raf = requestAnimationFrame(frame);
    else last = 0;
  }
  const wake = () => {
    if (scene.on && !raf && scene.visible) raf = requestAnimationFrame(frame);
  };

  /** Scroll position to progress, from the measured place: no layout read per scroll. */
  function readScroll() {
    scene.target = scene.run > 0 ? clamp((scrollY - scene.top) / scene.run) : 0;
  }

  // The stacked hero (phones, narrow tablets, portrait screens) never pins; same query as the CSS.
  const stacked = matchMedia("(max-width: 860px), (max-aspect-ratio: 4/5)");
  /** The scene runs only with motion allowed and when the hero fits the screen as it is. */
  function decide() {
    // The hero's own box, not its scrollHeight: the figure runs past its bottom edge on purpose.
    const fits = hero.offsetHeight <= vh() + 4 && !stacked.matches;
    const on = !reducedMotion && fits;
    root.classList.toggle("scene", on);
    about.toggleAttribute("data-hold", on);
    if (on !== scene.on) {
      scene.on = on;
      if (!on) {
        for (const el of [me, heroTop, ...rings, ...pieces]) {
          el.style.transform = "";
          el.style.opacity = "";
          el.style.visibility = "";
          el.style.zIndex = "";
        }
        // Back to each tile's resting angle and thickness.
        for (const m of scene.moves) m.body.style.transform = "";
        for (const el of [copy, ...extras.map((x) => x.el)]) {
          el.style.opacity = "";
          el.style.transform = "";
          el.style.translate = "";
        }
        about.classList.remove("is-here");
        // The about text was waiting for the scene; without it, it is simply shown.
        for (const el of reveals) el.classList.add("is-in");
        scene.here = false;
        scene.p = scene.target = scene.ft = 0;
      }
    }
    if (on) {
      measure();
      readScroll();
      scene.p = scene.target;
      render();
      // Landed already (a reload further down): the float still plays.
      wake();
    }
  }

  if (reducedMotion) return;
  decide();
  // The first layout can still move as the font arrives.
  document.fonts?.ready.then(decide);
  addEventListener(
    "scroll",
    () => {
      if (!scene.on || !scene.visible) return;
      readScroll();
      wake();
    },
    { passive: true },
  );
  let resizeTimer = 0;
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(decide, 120);
  });
  setTimeout(() => {
    const prime = () => {
      floor = 0.002;
      if (scene.on) render();
    };
    if ("requestIdleCallback" in window) requestIdleCallback(prime, { timeout: 2000 });
    else prime();
  }, 2500);
  // Resuming from the pause button picks the float up where it stopped.
  new MutationObserver(wake).observe(root, { attributeFilter: ["class"] });
  new IntersectionObserver(([e]) => {
    scene.visible = e.isIntersecting;
    if (!scene.visible) last = 0;
    if (scene.visible && scene.on) {
      readScroll();
      wake();
    }
  }).observe(intro);
  // Tabbing back into the hero's links while the scene has moved on scrolls back to it; tabbing
  // into the about text before the scene reaches it scrolls on to it, so focus never sits on
  // something unseen.
  heroTop.addEventListener("focusin", () => {
    if (scene.on && scene.p > 0.1) scrollTo({ top: scene.top, behavior: "instant" });
  });
  about.addEventListener("focusin", () => {
    if (scene.on && scene.p < LANDED) scrollTo({ top: scene.top + scene.run, behavior: "instant" });
  });
}
