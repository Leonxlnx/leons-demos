/*
 * Homepage: the demo strip, section reveals, the copy button and the closing reel.
 *
 * The strip is a native horizontal scroller with scroll snapping. The frame nearest its
 * centre is lit and, once the page has loaded and the strip has settled, plays a preview
 * encode of its clip; every other clip is unloaded back to its poster, so at most one
 * decoder runs. Mouse users can drag it, clicking a dimmed frame brings it to the centre,
 * and the strip is one tab stop whose frames are stepped through with the arrow keys.
 * Reduced-motion and data-saving visitors keep the posters.
 */

import { compact } from "../lib/format";
import { setActivity } from "./activity";

// Hidden-until-revealed states only apply once this module runs, so a failed or blocked
// script never leaves the page blank.
document.documentElement.classList.add("reveal");

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
const saveData =
  !!connection?.saveData ||
  /(^|-)2g$|^3g$/.test(connection?.effectiveType ?? "") ||
  matchMedia("(prefers-reduced-data: reduce)").matches;
const behavior: ScrollBehavior = reducedMotion ? "auto" : "smooth";
const root = document.documentElement;

/* ------------------------------------------------------------------ posters */

// A poster that fails to load leaves the frame's own background instead of a broken icon.
for (const img of document.querySelectorAll<HTMLImageElement>(".frame img, .reel img")) {
  const hide = () => (img.style.visibility = "hidden");
  if (img.complete && img.naturalWidth === 0 && img.currentSrc) hide();
  else img.addEventListener("error", hide, { once: true });
}

/* ------------------------------------------------------------------ strip */

const strip = document.querySelector<HTMLElement>(".strip");
const frames = strip ? Array.from(strip.querySelectorAll<HTMLElement>(".frame")) : [];
const motionButton = document.querySelector<HTMLButtonElement>(".motion");
let paused = false;

if (strip && frames.length) {
  try {
    initStrip(strip);
  } catch (err) {
    strip.classList.remove("is-live");
    console.error(err);
  }
}

function initStrip(strip: HTMLElement) {
  const links = frames.map((f) => f.querySelector("a")!);
  const broken = new WeakSet<HTMLVideoElement>();
  let lit: HTMLElement | null = null;
  let ready = false;
  let visible = true;
  let playTimer = 0;

  const centreOf = (f: HTMLElement) => f.offsetLeft + f.offsetWidth / 2;
  const targetFor = (f: HTMLElement) => centreOf(f) - strip.clientWidth / 2;
  const frameOf = (el: EventTarget | null) => (el instanceof Element ? el.closest<HTMLElement>(".frame") : null);

  function nearest(c = strip.scrollLeft + strip.clientWidth / 2): HTMLElement {
    return frames.reduce((a, b) => (Math.abs(centreOf(b) - c) < Math.abs(centreOf(a) - c) ? b : a));
  }

  /** The preview encode that fits the frame: about 360p on phones and at 1x, 720p above. */
  function source(v: HTMLVideoElement): string {
    const { sd, hd, src } = v.dataset;
    const pixels = v.parentElement!.clientHeight * devicePixelRatio;
    const big = innerWidth > 700 && pixels > 480;
    return (big ? hd : sd) || sd || hd || src!;
  }

  function release(f: HTMLElement | null) {
    const v = f?.querySelector("video");
    if (!f || !v) return;
    f.classList.remove("playing");
    if (!v.hasAttribute("src")) return;
    v.pause();
    v.removeAttribute("src");
    v.load();
    setActivity({ videos: 0 });
  }

  function play(f: HTMLElement) {
    const v = f.querySelector("video");
    if (!v || broken.has(v) || !ready || !visible || paused || saveData || reducedMotion || document.hidden) return;
    if (!v.hasAttribute("src")) {
      v.src = source(v);
      const show = () => lit === f && v.hasAttribute("src") && f.classList.add("playing");
      if (typeof v.requestVideoFrameCallback === "function") v.requestVideoFrameCallback(show);
      else v.addEventListener("playing", show, { once: true });
      v.addEventListener(
        "error",
        () => {
          broken.add(v);
          release(f);
        },
        { once: true },
      );
    }
    v.play().catch(() => {});
    setActivity({ videos: 1 });
  }

  function stop() {
    clearTimeout(playTimer);
    lit?.querySelector("video")?.pause();
    setActivity({ videos: 0 });
  }

  function light(f: HTMLElement) {
    if (lit !== f) {
      release(lit);
      lit?.classList.remove("is-lit");
      lit?.querySelector("a")?.setAttribute("tabindex", "-1");
      lit = f;
      f.classList.add("is-lit");
      f.querySelector("a")!.tabIndex = 0;
    }
    clearTimeout(playTimer);
    playTimer = window.setTimeout(() => lit === f && play(f), 450);
  }

  // One tab stop: only the lit frame is in the tab order; arrow keys move between frames.
  links.forEach((a) => (a.tabIndex = -1));
  strip.classList.add("is-live");
  light(nearest());

  let raf = 0;
  strip.addEventListener(
    "scroll",
    () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => light(nearest()));
    },
    { passive: true },
  );

  // A pointer click on a frame that was dimmed when the press began centres it; a click on
  // the lit frame, or Enter on the focused one, opens its post.
  let pressLit: HTMLElement | null = null;
  strip.addEventListener("pointerdown", () => (pressLit = lit), true);
  strip.addEventListener("click", (e) => {
    const f = frameOf(e.target);
    if (!f || e.detail === 0) return;
    if (dragged || f !== pressLit) {
      e.preventDefault();
      if (!dragged) strip.scrollTo({ left: targetFor(f), behavior });
    }
  });

  // Keyboard focus centres its frame. Pointer focus does not, or a press would start a scroll.
  strip.addEventListener("focusin", (e) => {
    const f = frameOf(e.target);
    if (f && f !== lit && (e.target as Element).matches(":focus-visible")) {
      strip.scrollTo({ left: targetFor(f), behavior });
    }
  });
  strip.addEventListener("keydown", (e) => {
    const i = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (i < 0) return;
    const step = { ArrowLeft: -1, ArrowRight: 1, Home: -i, End: links.length - 1 - i }[e.key];
    const next = step === undefined ? undefined : links[i + step];
    if (!next || next === links[i]) return;
    e.preventDefault();
    next.focus({ preventScroll: true });
  });

  // Mouse drag. Touch and trackpads scroll natively.
  let dragged = false;
  strip.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    dragged = false;
    const startX = e.clientX;
    const startLeft = strip.scrollLeft;
    let lastX = e.clientX;
    let lastT = e.timeStamp;
    let velocity = 0;
    const move = (m: PointerEvent) => {
      const dx = m.clientX - startX;
      if (!dragged && Math.abs(dx) < 6) return;
      if (!dragged) {
        dragged = true;
        strip.classList.add("is-dragging");
      }
      velocity = (m.clientX - lastX) / Math.max(1, m.timeStamp - lastT);
      lastX = m.clientX;
      lastT = m.timeStamp;
      strip.scrollLeft = startLeft - dx;
    };
    const up = (u: PointerEvent) => {
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", up);
      removeEventListener("pointercancel", up);
      if (!dragged) return;
      // A throw carries a little further; a drag that came to rest before release does not.
      if (u.timeStamp - lastT > 80) velocity = 0;
      const f = nearest(strip.scrollLeft - velocity * 220 + strip.clientWidth / 2);
      strip.scrollTo({ left: targetFor(f), behavior });
      // Snapping comes back once the glide has finished, or it would cut the glide short.
      const done = () => {
        clearTimeout(fallback);
        strip.removeEventListener("scrollend", done);
        strip.classList.remove("is-dragging");
      };
      const fallback = setTimeout(done, 900);
      strip.addEventListener("scrollend", done);
      setTimeout(() => (dragged = false), 0);
    };
    addEventListener("pointermove", move);
    addEventListener("pointerup", up);
    addEventListener("pointercancel", up);
  });
  strip.addEventListener("dragstart", (e) => e.preventDefault());

  // Clips play only while the strip is on screen and the tab is visible.
  new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      if (visible && lit) light(lit);
      else stop();
    },
    { threshold: 0.35 },
  ).observe(strip);
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : lit && light(lit)));

  // Nothing downloads before the page itself has loaded.
  const start = () => {
    ready = true;
    light(nearest());
  };
  const idle = () => ("requestIdleCallback" in window ? requestIdleCallback(start, { timeout: 1500 }) : setTimeout(start, 300));
  if (document.readyState === "complete") idle();
  else addEventListener("load", idle, { once: true });

  // Pause button: stops the clip and the closing reel (WCAG 2.2.2).
  if (motionButton && !reducedMotion) {
    motionButton.hidden = false;
    const label = motionButton.querySelector(".sr-only")!;
    const icon = motionButton.querySelector("use")!;
    motionButton.addEventListener("click", () => {
      paused = !paused;
      root.classList.toggle("motion-paused", paused);
      motionButton.setAttribute("aria-pressed", String(paused));
      label.textContent = paused ? "Play clips and moving pictures" : "Pause clips and moving pictures";
      icon.setAttribute("href", paused ? "#i-play" : "#i-pause");
      if (paused) stop();
      else if (lit) light(lit);
    });
  }
}

/* ------------------------------------------------------------------ reveals */

/** Counts a figure up from zero once, in the same short form it ends on (95K, 5.2M). */
function countUp(el: HTMLElement) {
  const to = Number(el.dataset.count);
  if (!to || reducedMotion) return;
  // Hold the final width so the caption beside it does not move while the digits change.
  el.style.display = "inline-block";
  el.style.minWidth = `${el.getBoundingClientRect().width}px`;
  const start = performance.now();
  const step = (now: number) => {
    const p = Math.min(1, (now - start) / 1500);
    el.textContent = compact(Math.round(to * (1 - Math.pow(1 - p, 4))));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

const revealed = document.querySelectorAll("[data-reveal], [data-reveal-group]");
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("is-in");
        e.target.querySelectorAll<HTMLElement>("[data-count]").forEach(countUp);
        io.unobserve(e.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
  );
  revealed.forEach((el) => io.observe(el));
} else {
  revealed.forEach((el) => el.classList.add("is-in"));
}
// Tabbing into a block that has not been revealed yet reveals it.
document.addEventListener("focusin", (e) => {
  (e.target as Element).closest?.("[data-reveal], [data-reveal-group]")?.classList.add("is-in");
});

/* ------------------------------------------------------------------ copy */

for (const b of document.querySelectorAll<HTMLButtonElement>("[data-copy]")) {
  const status = b.parentElement?.querySelector("[role=status]");
  let reset = 0;
  b.addEventListener("click", async () => {
    let text: string;
    try {
      await navigator.clipboard.writeText(b.dataset.copy!);
      text = "Copied";
    } catch {
      text = "Select and copy";
    }
    b.textContent = text;
    if (status) status.textContent = text === "Copied" ? "Install command copied" : "Copy failed, select the command to copy it";
    clearTimeout(reset);
    reset = window.setTimeout(() => {
      b.textContent = "Copy";
      if (status) status.textContent = "";
    }, 1600);
  });
}

/* ------------------------------------------------------------------ reel */

// The closing reel drifts left on its own and picks up the page's scroll speed, in either
// direction, then eases back. It stops under the mouse, with focus inside, when paused and
// off screen. Without this script it runs as a plain CSS loop.
const reel = document.querySelector<HTMLElement>(".reel");
const track = reel?.querySelector<HTMLElement>(".reel-track");
if (reel && track && !reducedMotion && "IntersectionObserver" in window) {
  reel.classList.add("is-js");
  const close = reel.closest("footer") ?? reel;
  const BASE = 26; // px per second
  let x = 0;
  let boost = 0;
  let lastY = scrollY;
  let last = 0;
  let raf = 0;
  let hovering = false;
  let onScreen = false;

  addEventListener(
    "scroll",
    () => {
      boost = Math.max(-2400, Math.min(2400, boost + (scrollY - lastY) * 1.5));
      lastY = scrollY;
    },
    { passive: true },
  );
  reel.addEventListener("pointerenter", () => (hovering = true));
  reel.addEventListener("pointerleave", () => (hovering = false));

  const frame = (now: number) => {
    const dt = Math.min(0.064, (now - last) / 1000);
    last = now;
    boost *= Math.pow(0.03, dt);
    const held = hovering || paused || root.classList.contains("motion-paused") || close.matches(":focus-within");
    x -= (held ? 0 : BASE + boost) * dt;
    const period = (track.scrollWidth + 8) / 2;
    if (period > 0) x = ((x % period) - period) % period;
    track.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0)`;
    raf = onScreen ? requestAnimationFrame(frame) : 0;
  };
  new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    if (onScreen && !raf) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }).observe(reel);
}
