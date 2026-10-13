/*
 * Homepage: the demo strip, section reveals, the copy button and the closing reel.
 *
 * The strip is a native horizontal scroller with scroll snapping. The frame nearest its
 * centre is lit and, once the strip settles, plays its clip; every other clip is unloaded
 * back to its poster, so at most one decoder runs. Mouse users can drag it, clicking a
 * dimmed frame brings it to the centre, and arrow keys step through the frames.
 * Reduced-motion users keep the posters and instant scrolling.
 */

import { setActivity } from "./activity";

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const behavior: ScrollBehavior = reducedMotion ? "auto" : "smooth";

/* ------------------------------------------------------------------ strip */

const strip = document.querySelector<HTMLElement>(".strip");
if (strip) initStrip(strip);

function initStrip(strip: HTMLElement) {
  const frames = Array.from(strip.querySelectorAll<HTMLElement>(".frame"));
  const links = frames.map((f) => f.querySelector("a")!);
  let lit: HTMLElement | null = null;
  let playTimer = 0;
  let visible = true;

  const centreOf = (f: HTMLElement) => f.offsetLeft + f.offsetWidth / 2;
  const targetFor = (f: HTMLElement) => centreOf(f) - strip.clientWidth / 2;

  function nearest(): HTMLElement {
    const c = strip.scrollLeft + strip.clientWidth / 2;
    let best = frames[0];
    let d = Infinity;
    for (const f of frames) {
      const dist = Math.abs(centreOf(f) - c);
      if (dist < d) [best, d] = [f, dist];
    }
    return best;
  }

  function release(f: HTMLElement | null) {
    const v = f?.querySelector("video");
    if (!f || !v || !v.hasAttribute("src")) return;
    v.pause();
    f.classList.remove("playing");
    v.removeAttribute("src");
    v.load();
  }

  function play(f: HTMLElement) {
    const v = f.querySelector("video");
    if (!v || reducedMotion || !visible || document.hidden) return;
    if (!v.hasAttribute("src")) {
      v.src = v.dataset.src!;
      const show = () => lit === f && f.classList.add("playing");
      if (typeof v.requestVideoFrameCallback === "function") v.requestVideoFrameCallback(show);
      else v.addEventListener("playing", show, { once: true });
      v.addEventListener("error", () => release(f), { once: true });
    }
    v.play().catch(() => {});
    setActivity({ videos: 1 });
  }

  function light(f: HTMLElement) {
    if (lit !== f) {
      release(lit);
      lit?.classList.remove("is-lit");
      lit = f;
      f.classList.add("is-lit");
    }
    clearTimeout(playTimer);
    playTimer = window.setTimeout(() => lit === f && play(f), 450);
  }

  function pauseAll() {
    clearTimeout(playTimer);
    const v = lit?.querySelector("video");
    v?.pause();
    setActivity({ videos: 0 });
  }

  let raf = 0;
  strip.addEventListener(
    "scroll",
    () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => light(nearest()));
    },
    { passive: true },
  );

  // Clicking a dimmed frame centres it; clicking the lit frame opens its post.
  strip.addEventListener("click", (e) => {
    if (dragged) {
      e.preventDefault();
      return;
    }
    const f = (e.target as Element).closest<HTMLElement>(".frame");
    if (f && f !== lit) {
      e.preventDefault();
      strip.scrollTo({ left: targetFor(f), behavior });
    }
  });

  // Keyboard: focus centres the frame, arrow keys move to its neighbours.
  strip.addEventListener("focusin", (e) => {
    const f = (e.target as Element).closest<HTMLElement>(".frame");
    if (f && f !== lit) strip.scrollTo({ left: targetFor(f), behavior });
  });
  strip.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const i = links.indexOf(document.activeElement as HTMLAnchorElement);
    const next = links[i + (e.key === "ArrowRight" ? 1 : -1)];
    if (i < 0 || !next) return;
    e.preventDefault();
    next.focus({ preventScroll: true });
  });

  // Mouse drag. Touch and trackpads scroll natively.
  let dragged = false;
  let startX = 0;
  let startLeft = 0;
  let lastX = 0;
  let lastT = 0;
  let velocity = 0;
  strip.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    dragged = false;
    startX = lastX = e.clientX;
    startLeft = strip.scrollLeft;
    lastT = e.timeStamp;
    velocity = 0;
    const move = (m: PointerEvent) => {
      const dx = m.clientX - startX;
      if (!dragged && Math.abs(dx) < 6) return;
      if (!dragged) {
        dragged = true;
        strip.classList.add("is-dragging");
        strip.setPointerCapture(e.pointerId);
      }
      const dt = Math.max(1, m.timeStamp - lastT);
      velocity = (m.clientX - lastX) / dt;
      lastX = m.clientX;
      lastT = m.timeStamp;
      strip.scrollLeft = startLeft - dx;
    };
    const up = () => {
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", up);
      removeEventListener("pointercancel", up);
      if (!dragged) return;
      // Carry the throw a little, then settle on the nearest frame.
      const projected = strip.scrollLeft - velocity * 220;
      const c = projected + strip.clientWidth / 2;
      const f = frames.reduce((a, b) => (Math.abs(centreOf(b) - c) < Math.abs(centreOf(a) - c) ? b : a));
      strip.classList.remove("is-dragging");
      strip.scrollTo({ left: targetFor(f), behavior });
      setTimeout(() => (dragged = false), 0);
    };
    addEventListener("pointermove", move);
    addEventListener("pointerup", up);
    addEventListener("pointercancel", up);
  });
  strip.addEventListener("dragstart", (e) => e.preventDefault());

  // Only play while the strip is on screen and the tab is visible.
  new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      if (visible && lit) light(lit);
      else pauseAll();
    },
    { threshold: 0.35 },
  ).observe(strip);
  document.addEventListener("visibilitychange", () => (document.hidden ? pauseAll() : lit && light(lit)));

  const start = () => light(frames.find((f) => f.hasAttribute("data-start")) ?? nearest());
  if (document.readyState === "complete") start();
  else addEventListener("load", start, { once: true });
  // A frame lit before load still shows; the clip waits for the page.
  lit = nearest();
  lit.classList.add("is-lit");
}

/* ------------------------------------------------------------------ reveals */

const revealed = document.querySelectorAll("[data-reveal], [data-reveal-group]");
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
  );
  revealed.forEach((el) => io.observe(el));
} else {
  revealed.forEach((el) => el.classList.add("is-in"));
}

/* ------------------------------------------------------------------ copy */

for (const b of document.querySelectorAll<HTMLButtonElement>("[data-copy]")) {
  let reset = 0;
  b.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(b.dataset.copy!);
      b.textContent = "Copied";
    } catch {
      b.textContent = "Select and copy";
    }
    clearTimeout(reset);
    reset = window.setTimeout(() => (b.textContent = "Copy"), 1600);
  });
}

/* ------------------------------------------------------------------ reel */

const reel = document.querySelector(".reel");
if (reel) {
  new IntersectionObserver(([e]) => reel.classList.toggle("is-paused", !e.isIntersecting)).observe(reel);
}
