/*
 * The hero and about scene (components/home/Intro.astro).
 *
 * - The words on the left and the pieces of the collage point at each other: pointing at
 *   "Guitar" lifts the guitar, pointing at a tile lifts all three models and lights "AI".
 * - Under a mouse the collage leans with the pointer, each piece by its own depth.
 * - The scene: with motion allowed and a hero that fits the screen, html.scene pins the hero
 *   and the about section as one stage, 160svh of scroll long. Scrolling, the name and the
 *   side columns rise away, the photographs fly outward, Leon sinks, and the three tiles drop
 *   behind his shoulders, then come up beside the about text, thick and turned, where they
 *   follow the pointer and float. Progress is eased toward the scroll position each frame, so
 *   the stage moves with a little weight. Transforms and opacity only.
 */

const intro = document.querySelector<HTMLElement>("[data-intro]");
if (intro) init(intro);

function init(intro: HTMLElement) {
  const root = document.documentElement;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;

  const stage = intro.querySelector<HTMLElement>(".stage")!;
  const hero = intro.querySelector<HTMLElement>(".hero")!;
  const about = intro.querySelector<HTMLElement>("[data-about]")!;
  const collage = intro.querySelector<HTMLElement>("[data-collage]")!;
  const me = collage.querySelector<HTMLElement>(".me")!;
  const pieces = Array.from(collage.querySelectorAll<HTMLElement>(".piece"));
  const tiles = pieces.filter((p) => p.classList.contains("is-tile"));
  const photos = pieces.filter((p) => p.classList.contains("is-photo"));
  const heroTop = hero.querySelector<HTMLElement>(".hero-top")!;
  const sides = Array.from(hero.querySelectorAll<HTMLElement>(".side"));
  const buttons = Array.from(hero.querySelectorAll<HTMLButtonElement>(".things button"));
  const reveals = Array.from(about.querySelectorAll<HTMLElement>("[data-reveal]"));

  /* ---------------------------------------------------------------- words and pieces */

  let pinned: string | null = null;
  function light(thing: string | null, only?: HTMLElement) {
    collage.classList.toggle("has-focus", !!thing);
    for (const p of pieces) p.classList.toggle("is-on", !!thing && (only ? p === only : p.dataset.thing === thing));
    for (const b of buttons) b.classList.toggle("is-on", b.dataset.thing === thing);
  }
  const rest = () => light(pinned);
  for (const b of buttons) {
    b.addEventListener("pointerenter", () => light(b.dataset.thing!));
    b.addEventListener("pointerleave", rest);
    b.addEventListener("focus", () => light(b.dataset.thing!));
    b.addEventListener("blur", rest);
    b.addEventListener("click", () => {
      pinned = pinned === b.dataset.thing ? null : b.dataset.thing!;
      for (const o of buttons) o.setAttribute("aria-pressed", String(o.dataset.thing === pinned));
      light(pinned);
    });
  }
  for (const p of pieces) {
    p.addEventListener("pointerenter", (e) => {
      if (e.pointerType !== "mouse" || scene.p > 0.05) return;
      light(p.dataset.thing!, p.classList.contains("is-tile") ? undefined : p);
    });
    p.addEventListener("pointerleave", rest);
  }

  /* ---------------------------------------------------------------- the stage */

  const vh = () => innerHeight;
  const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const seg = (v: number, a: number, b: number) => clamp((v - a) / (b - a));
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
  const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  interface Box {
    cx: number;
    cy: number;
    w: number;
  }
  interface TileMove {
    el: HTMLElement;
    tile: HTMLElement;
    from: Box;
    to: Box;
    r: number;
    rx: number;
    ry: number;
    rz: number;
    seed: number;
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
  };
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

  const box = (el: Element, origin: DOMRect): Box => {
    const r = el.getBoundingClientRect();
    return { cx: r.left + r.width / 2 - origin.left, cy: r.top + r.height / 2 - origin.top, w: r.width };
  };
  const num = (el: HTMLElement, prop: string) => parseFloat(getComputedStyle(el).getPropertyValue(prop)) || 0;

  /** Reads every start and end place with all scene transforms cleared. */
  function measure() {
    const moved = [me, heroTop, ...sides, ...pieces];
    for (const el of moved) el.style.transform = "";
    const origin = stage.getBoundingClientRect();
    const c = collage.getBoundingClientRect();
    const centre = { x: c.left + c.width / 2, y: c.top + c.height / 2 };
    scene.moves = tiles.map((el, i) => {
      const slot = about.querySelector<HTMLElement>(`[data-slot="${el.querySelector<HTMLElement>("[data-tile]")!.dataset.tile}"]`)!;
      const target = slot.querySelector(".tile")!;
      return {
        el,
        tile: el.querySelector<HTMLElement>(".tile")!,
        from: box(el, origin),
        to: box(target, origin),
        r: num(el, "--r") || num(el.querySelector(".piece-in")!, "rotate"),
        rx: num(slot, "--rx"),
        ry: num(slot, "--ry"),
        rz: num(slot, "--rz"),
        seed: i * 1.7,
      };
    });
    scene.flyers = photos.map((el) => {
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
    // Act one, the hero clears and the tiles drop behind Leon's shoulders: 0 to 0.36.
    // Act two, he sinks and the tiles come up past him to the about section: 0.38 to 0.86.
    const a = easeOut(seg(p, 0, 0.3));
    const drop = easeInOut(seg(p, 0.04, 0.36));
    const b = easeInOut(seg(p, 0.38, 0.86));
    const pointerOn = finePointer && !reducedMotion;
    const px = pointerOn ? pointer.x : 0;
    const py = pointerOn ? pointer.y : 0;

    heroTop.style.transform = `translate3d(0, ${(-a * H * 0.32).toFixed(2)}px, 0)`;
    const ho = clamp(1 - seg(p, 0, 0.24) * 1.1);
    heroTop.style.opacity = String(ho);
    heroTop.style.visibility = ho < 0.01 ? "hidden" : "";
    sides.forEach((s, i) => {
      const k = easeOut(seg(p, i * 0.03, 0.28 + i * 0.03));
      s.style.transform = `translate3d(0, ${(-k * H * 0.22).toFixed(2)}px, 0)`;
      const so = clamp(1 - k * 1.25);
      s.style.opacity = String(so);
      s.style.visibility = so < 0.01 ? "hidden" : "";
    });

    // Leon stands while the tiles drop behind him, then sinks below the edge.
    const sink = easeInOut(seg(p, 0.3, 0.68));
    me.style.transform = `translate3d(${(-px * 6).toFixed(2)}px, ${(sink * 70 + py * 4).toFixed(2)}%, 0)`;
    const mo = clamp(1 - seg(p, 0.52, 0.68));
    me.style.opacity = String(mo);
    me.style.visibility = mo < 0.01 ? "hidden" : "";

    for (const f of scene.flyers) {
      const depth = parseFloat(f.el.dataset.depth || "1");
      const k = easeOut(seg(p, 0, 0.32));
      const x = f.dx * k * W * 0.42 + px * depth * 16;
      const y = Math.max(0, f.dy) * k * H * 0.3 + k * H * 0.1 + py * depth * 12;
      f.el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${(f.spin * k).toFixed(2)}deg) scale(${(1 + k * 0.18).toFixed(4)})`;
      const o = clamp(1 - seg(p, 0.04, 0.28));
      f.el.style.opacity = String(o);
      f.el.style.visibility = o < 0.01 ? "hidden" : "";
    }

    const t = performance.now() / 1000;
    for (const m of scene.moves) {
      const depth = parseFloat(m.el.dataset.depth || "1");
      // Act one: drop behind the shoulders, a little smaller, as if pushed back.
      const dropY = drop * H * 0.3;
      const back = 1 - drop * 0.32;
      // Act two: from there to the slot, growing to its size.
      const toScale = m.to.w / m.from.w;
      const x = lerp(0, m.to.cx - m.from.cx, b) + (1 - b) * px * depth * 14;
      const y = lerp(dropY, m.to.cy - m.from.cy, b) + (1 - b) * py * depth * 10;
      const s = lerp(back, toScale, b);
      // Afloat in the about section: a slow bob, and the tilt follows the pointer.
      const here = seg(p, 0.86, 1);
      const bob = Math.sin(t * 0.9 + m.seed) * 5 * here;
      m.el.style.transform = `translate3d(${x.toFixed(2)}px, ${(y + bob).toFixed(2)}px, 0) rotate(${(-m.r * b).toFixed(2)}deg) scale(${s.toFixed(4)})`;
      m.tile.style.setProperty("--depth", `${lerp(7, 34 / toScale, b).toFixed(2)}px`);
      m.tile.style.setProperty("--rx", `${(lerp(12, m.rx, b) - py * 10 * b).toFixed(2)}deg`);
      m.tile.style.setProperty("--ry", `${(lerp(0, m.ry, b) + px * 14 * b + Math.sin(t * 0.6 + m.seed) * 3 * here).toFixed(2)}deg`);
      m.tile.style.setProperty("--rz", `${lerp(0, m.rz, b).toFixed(2)}deg`);
    }

    const here = p > 0.62;
    if (here !== scene.here) {
      scene.here = here;
      about.classList.toggle("is-here", here);
      if (here) for (const el of reveals) el.classList.add("is-in");
    }
  }

  /** Hero pieces lean with the pointer while the scene is off (phones, short screens). */
  function renderParallax() {
    for (const p of pieces) {
      const depth = parseFloat(p.dataset.depth || "1");
      p.style.transform = `translate3d(${(pointer.x * depth * 14).toFixed(2)}px, ${(pointer.y * depth * 10).toFixed(2)}px, 0)`;
    }
    me.style.transform = `translate3d(${(-pointer.x * 6).toFixed(2)}px, ${(pointer.y * 4).toFixed(2)}px, 0)`;
  }

  let raf = 0;
  function frame() {
    raf = 0;
    const k = scene.on ? 0.14 : 0;
    scene.p += (scene.target - scene.p) * (scene.on ? k : 1);
    if (Math.abs(scene.target - scene.p) < 0.0004) scene.p = scene.target;
    pointer.x += (pointer.tx - pointer.x) * 0.08;
    pointer.y += (pointer.ty - pointer.y) * 0.08;
    if (scene.on) render();
    else if (finePointer && !reducedMotion) renderParallax();
    const settling =
      Math.abs(scene.target - scene.p) > 0.0004 || Math.abs(pointer.tx - pointer.x) > 0.001 || Math.abs(pointer.ty - pointer.y) > 0.001;
    const floating = scene.on && scene.p > 0.86;
    if (scene.visible && (settling || floating)) raf = requestAnimationFrame(frame);
  }
  const wake = () => {
    if (!raf && scene.visible) raf = requestAnimationFrame(frame);
  };

  function readScroll() {
    if (!scene.on) return;
    const r = intro.getBoundingClientRect();
    const run = r.height - vh();
    scene.target = run > 0 ? clamp(-r.top / run) : 0;
  }

  /** The scene runs only with motion allowed and when the hero fits the screen as it is. */
  function decide() {
    // The hero's own box, not its scrollHeight: the figure runs past its bottom edge on purpose.
    const fits = hero.offsetHeight <= vh() + 4 && innerWidth > 860;
    const on = !reducedMotion && fits;
    if (on !== scene.on) {
      scene.on = on;
      root.classList.toggle("scene", on);
      about.toggleAttribute("data-hold", on);
      if (!on) {
        for (const el of [me, heroTop, ...sides, ...pieces]) {
          el.style.transform = "";
          el.style.opacity = "";
          el.style.visibility = "";
        }
        for (const m of scene.moves) m.tile.removeAttribute("style");
        about.classList.remove("is-here");
      }
    }
    if (on) {
      measure();
      readScroll();
      scene.p = scene.target;
      render();
    }
  }

  if (!reducedMotion) {
    decide();
    // The first layout can still move as the font arrives.
    document.fonts?.ready.then(decide);
    addEventListener("scroll", () => {
      readScroll();
      wake();
    }, { passive: true });
    let resizeTimer = 0;
    addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(decide, 120);
    });
    new IntersectionObserver(([e]) => {
      scene.visible = e.isIntersecting;
      if (scene.visible) wake();
    }).observe(intro);
    if (finePointer) {
      addEventListener(
        "pointermove",
        (e) => {
          if (e.pointerType !== "mouse") return;
          pointer.tx = (e.clientX / innerWidth) * 2 - 1;
          pointer.ty = (e.clientY / innerHeight) * 2 - 1;
          wake();
        },
        { passive: true },
      );
    }
    // The tile entrance animation sits on the inner element; once it ends, measured places hold.
    wake();
  }
}
