/*
 * Homepage: the demo strip, section entrances, the copy button, live star counts and the
 * closing reel.
 *
 * The strip is a native horizontal scroller with scroll snapping. The frame nearest its
 * centre is lit. While the strip moves, captions keep quiet and a clip you pass is only
 * paused; once it rests, the lit frame's clip plays (a preview encode) and every other clip
 * is unloaded back to its poster, so at most one decoder holds a source at rest. Mouse users
 * can drag it, clicking a dim frame brings it to the centre, and the strip is one tab stop
 * whose frames are stepped through with the arrow keys. Reduced-motion and data-saving
 * visitors keep the posters.
 */

import { compact } from "../lib/format";
import { column, glyphs } from "../lib/odometer";
import { setActivity } from "./activity";

// Arriving by a view transition, everything here waits until it has finished: the strip is
// already in its resting state from the inline script, and setting up now would steal frames
// from the morph. The head script in Base.astro leaves the transition's finished promise here.
const transition = (window as { __vt?: unknown }).__vt;
if (transition) await Promise.resolve(transition).catch(() => {});

// Hidden-until-revealed states only apply once this module runs, so a failed or blocked
// script never leaves the page blank.
document.documentElement.classList.add("reveal");

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
const saveData =
  !!connection?.saveData ||
  /(^|-)2g$|^3g$/.test(connection?.effectiveType ?? "") ||
  matchMedia("(prefers-reduced-data: reduce)").matches;
const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
const scrollTimelines = CSS.supports("animation-timeline: view()");
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
  let moving = false;
  let firstStart = 0;

  const centreOf = (f: HTMLElement) => f.offsetLeft + f.offsetWidth / 2;
  const targetFor = (f: HTMLElement) => centreOf(f) - strip.clientWidth / 2;
  const frameOf = (el: EventTarget | null) => (el instanceof Element ? el.closest<HTMLElement>(".frame") : null);
  const videoOf = (f: HTMLElement | null) => f?.querySelector("video") ?? null;

  function nearest(c = strip.scrollLeft + strip.clientWidth / 2): HTMLElement {
    return frames.reduce((a, b) => (Math.abs(centreOf(b) - c) < Math.abs(centreOf(a) - c) ? b : a));
  }

  /** The preview encode that fits the frame: about 360p on phones and at 1x, 720p above. */
  function source(v: HTMLVideoElement): string {
    const { sd, hd, src } = v.dataset;
    const pixels = (v.closest("a")?.clientHeight ?? 0) * devicePixelRatio;
    const big = innerWidth > 700 && pixels > 480;
    return (big ? hd : sd) || sd || hd || src!;
  }

  /** Unloads a clip back to its poster. */
  function release(f: HTMLElement) {
    const v = videoOf(f);
    f.classList.remove("playing");
    if (!v || !v.hasAttribute("src")) return;
    v.pause();
    v.removeAttribute("src");
    v.load();
  }

  function play(f: HTMLElement) {
    const v = videoOf(f);
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
          setActivity({ videos: 0 });
        },
        { once: true },
      );
    } else if (!f.classList.contains("playing")) {
      // Its first frame arrived while another frame was lit, so `show` declined then.
      if (v.readyState >= 2) f.classList.add("playing");
      else v.addEventListener("playing", () => lit === f && f.classList.add("playing"), { once: true });
    }
    v.play().catch(() => {});
    setActivity({ videos: 1 });
  }

  function stop() {
    clearTimeout(firstStart);
    videoOf(lit)?.pause();
    setActivity({ videos: 0 });
  }

  /** Moves the lit state. A clip passed on the way is paused, not unloaded. */
  let developTimer = 0;
  function light(f: HTMLElement) {
    if (lit === f) return;
    if (lit) {
      videoOf(lit)?.pause();
      lit.classList.remove("is-lit", "is-developing");
      lit.querySelector("a")?.setAttribute("tabindex", "-1");
    }
    lit = f;
    f.classList.add("is-lit");
    f.querySelector("a")!.tabIndex = 0;
    // Without scroll timelines the colour develops on a short clock instead of with the hand.
    // Only the lit frame develops: a frame passed in a flick drops back to its print at once.
    if (!scrollTimelines && !reducedMotion) {
      clearTimeout(developTimer);
      f.classList.add("is-developing");
      developTimer = window.setTimeout(() => f.classList.remove("is-developing"), 260);
    }
  }

  /** At rest: the lit clip plays and every other clip lets go of its source. */
  function settle() {
    moving = false;
    strip.dataset.state = "settled";
    if (!lit) return;
    for (const f of frames) if (f !== lit) release(f);
    if (ready) play(lit);
  }

  // One tab stop: only the lit frame is in the tab order; arrow keys move between frames.
  links.forEach((a) => (a.tabIndex = -1));
  strip.classList.add("is-live");
  light(nearest());

  let raf = 0;
  let settleTimer = 0;
  const hasScrollEnd = "onscrollend" in window;
  strip.addEventListener(
    "scroll",
    () => {
      if (!moving) {
        moving = true;
        strip.dataset.state = "moving";
      }
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => light(nearest()));
      if (!hasScrollEnd) {
        clearTimeout(settleTimer);
        settleTimer = window.setTimeout(() => !strip.classList.contains("is-dragging") && settle(), 140);
      }
    },
    { passive: true },
  );
  if (hasScrollEnd) strip.addEventListener("scrollend", () => !strip.classList.contains("is-dragging") && settle());

  // A pointer click on a frame that was dim when the press began centres it; a click on the
  // lit frame, or Enter on the focused one, opens its post.
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
  // The cleanup of a throw's glide still in flight; a new drag cancels it, or it would bring
  // snapping back in the middle of that drag.
  let cancelGlide: (() => void) | null = null;
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
        cancelGlide?.();
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
      const cancel = () => {
        clearTimeout(fallback);
        strip.removeEventListener("scrollend", done);
        if (cancelGlide === cancel) cancelGlide = null;
      };
      const done = () => {
        cancel();
        strip.classList.remove("is-dragging");
        settle();
      };
      const fallback = setTimeout(done, 900);
      strip.addEventListener("scrollend", done);
      cancelGlide = cancel;
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
      if (visible && lit && !moving) play(lit);
      else stop();
    },
    { threshold: 0.35 },
  ).observe(strip);
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : lit && !moving && play(lit)));

  // Nothing downloads before the page itself has loaded; the first clip then starts a beat later.
  const start = () => {
    ready = true;
    light(nearest());
    firstStart = window.setTimeout(() => !moving && lit && play(lit), 450);
  };
  const idle = () => ("requestIdleCallback" in window ? requestIdleCallback(start, { timeout: 1500 }) : setTimeout(start, 300));
  if (document.readyState === "complete") idle();
  else addEventListener("load", idle, { once: true });

  // Pause button: stops the clip, the closing reel and the background (WCAG 2.2.2). Its name
  // stays "Pause …" and aria-pressed carries the state, as a toggle button should.
  if (motionButton && !reducedMotion) {
    motionButton.hidden = false;
    const icon = motionButton.querySelector("use")!;
    motionButton.addEventListener("click", () => {
      paused = !paused;
      root.classList.toggle("motion-paused", paused);
      setActivity({ paused });
      motionButton.setAttribute("aria-pressed", String(paused));
      icon.setAttribute("href", paused ? "#i-play" : "#i-pause");
      if (paused) stop();
      else if (lit && !moving) play(lit);
    });
  }
}

/* ------------------------------------------------------------------ entrances */

// Each block gets .is-in once, the first time it is on screen. A batch that arrives together
// staggers through --b (at most four steps), so a fast scroll never queues a long cascade.
const revealed = document.querySelectorAll<HTMLElement>("[data-reveal], [data-odo]");
if ("IntersectionObserver" in window) {
  const reveal = (threshold: number) => {
    const io = new IntersectionObserver(
      (entries) => {
        let b = 0;
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          (e.target as HTMLElement).style.setProperty("--b", String(Math.min(b++, 3)));
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold },
    );
    return io;
  };
  const blocks = reveal(0.05);
  const figures = reveal(0.35);
  revealed.forEach((el) => (el.hasAttribute("data-odo") ? figures : blocks).observe(el));
} else {
  revealed.forEach((el) => el.classList.add("is-in"));
}
// Tabbing into a block that has not been revealed yet reveals it.
document.addEventListener("focusin", (e) => {
  (e.target as Element).closest?.("[data-reveal], [data-odo]")?.classList.add("is-in");
});

/* ------------------------------------------------------------------ copy */

for (const b of document.querySelectorAll<HTMLButtonElement>("[data-copy]")) {
  const status = b.parentElement?.querySelector("[role=status]");
  const after = b.querySelector<HTMLElement>(".roll > span + span");
  let reset = 0;
  b.addEventListener("click", async () => {
    let ok = true;
    try {
      await navigator.clipboard.writeText(b.dataset.copy!);
    } catch {
      ok = false;
    }
    if (after) after.textContent = ok ? "Copied" : "Select and copy";
    b.classList.add("is-done");
    if (status) status.textContent = ok ? "Install command copied" : "Copy failed, select the command to copy it";
    clearTimeout(reset);
    reset = window.setTimeout(() => {
      b.classList.remove("is-done");
      // Back to the short label, so a failed copy does not leave the pill wide.
      setTimeout(() => after && (after.textContent = "Copied"), 300);
      if (status) status.textContent = "";
    }, 1600);
  });
}

/* ------------------------------------------------------------------ stars */

// Star counts are baked in at build time and refreshed here from GitHub's search API: one
// request for every repo on the page, at most once in ten minutes per visitor (a failure
// waits as long), so a visitor stays far below its unauthenticated limits. It runs after load
// and again when the tab comes back. A count that changes before its section is revealed is
// simply swapped; the Taste Skill figure, once rolled, ticks the changed digits from the old
// count to the new one.
const STARS_KEY = "gh-stars";
const STARS_TTL = 10 * 60_000;
const starred = Array.from(document.querySelectorAll<HTMLElement>("[data-repo]"));

type StarCache = { at: number; stars: Record<string, number> | null };

function readStars(): StarCache | null {
  try {
    const c = JSON.parse(localStorage.getItem(STARS_KEY) ?? "null") as StarCache | null;
    return c && Date.now() - c.at < STARS_TTL ? c : null;
  } catch {
    return null;
  }
}

function writeStars(stars: StarCache["stars"]) {
  try {
    localStorage.setItem(STARS_KEY, JSON.stringify({ at: Date.now(), stars }));
  } catch {}
}

/** Rebuilds a figure's glyphs for a new count; once rolled, only the changed ones roll again. */
function setFigure(fig: HTMLElement, value: number) {
  const box = fig.querySelector<HTMLElement>(".glyphs");
  const sr = fig.querySelector(".sr-only");
  if (sr) sr.textContent = value.toLocaleString("en-US");
  const text = compact(value);
  if (!box || box.textContent!.replace(/\s/g, "") === text) return;
  // Scoped styles match Astro's data-astro-cid-* attribute, so new glyphs take the box's.
  const scope = Array.from(box.attributes).filter((a) => a.name.startsWith("data-astro-cid"));
  const make = (cls?: string) => {
    const el = document.createElement("span");
    scope.forEach((a) => el.setAttribute(a.name, a.value));
    if (cls) el.className = cls;
    return el;
  };
  const rolled = !!fig.closest("[data-odo]")?.classList.contains("is-in");
  const old = Array.from(box.children, (g) => g.textContent!.trim());
  const next = glyphs(text);
  // Glyphs line up only when the figure keeps its shape (95K → 97K); otherwise all roll.
  const aligned = old.length === next.length;
  const rewound: HTMLElement[] = [];
  const nodes = next.map((g, i) => {
    const was = aligned ? old[i] : undefined;
    if ("digit" in g) {
      const el = make("odo");
      el.textContent = String(g.digit);
      const from = was !== undefined && /^\d$/.test(was) ? Number(was) : undefined;
      const { col, rows } = column(g.digit, rolled ? from : undefined);
      el.style.setProperty("--o", String(g.order));
      el.style.setProperty("--col", `"${col}"`);
      el.style.setProperty("--rows", String(rows));
      if (rolled && from !== g.digit) rewound.push(el);
      return el;
    }
    const el = make("unit");
    el.append(make());
    el.firstElementChild!.textContent = g.unit;
    if (rolled && was !== g.unit) rewound.push(el);
    return el;
  });
  rewound.forEach((el) => el.classList.add("rewind"));
  box.replaceChildren(...nodes);
  if (!rewound.length) return;
  // Paint the rewound glyphs at their start first, so letting go of .rewind rolls them.
  void box.offsetWidth;
  requestAnimationFrame(() => requestAnimationFrame(() => rewound.forEach((el) => el.classList.remove("rewind"))));
}

function showStars(stars: Record<string, number>) {
  for (const el of starred) {
    const n = stars[el.dataset.repo!.toLowerCase()];
    if (!Number.isFinite(n)) continue;
    if (el.matches(".figure")) setFigure(el, n);
    else {
      const count = el.querySelector(".count");
      const text = compact(n);
      if (count && count.textContent !== text) count.textContent = text;
    }
  }
}

async function fetchStars(repos: string[]): Promise<Record<string, number>> {
  const q = repos.map((r) => `repo:${r}`).join(" ");
  const res = await fetch(`https://api.github.com/search/repositories?${new URLSearchParams({ q, per_page: String(repos.length) })}`, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  const { items } = (await res.json()) as { items: { full_name: string; stargazers_count: number }[] };
  return Object.fromEntries(items.map((r) => [r.full_name.toLowerCase(), r.stargazers_count]));
}

if (starred.length) {
  const repos = [...new Set(starred.map((el) => el.dataset.repo!.toLowerCase()))];
  const cached = readStars();
  if (cached?.stars) showStars(cached.stars);
  // The last attempt is kept in memory as well, for when storage is unavailable.
  let tried = cached?.at ?? 0;
  let busy = false;
  const refresh = () => {
    if (busy || Date.now() - tried < STARS_TTL) return;
    // Another tab may have fetched since.
    const c = readStars();
    if (c) {
      tried = c.at;
      if (c.stars) showStars(c.stars);
      return;
    }
    busy = true;
    tried = Date.now();
    fetchStars(repos)
      .then(
        (stars) => {
          writeStars(stars);
          showStars(stars);
        },
        () => writeStars(null),
      )
      .finally(() => (busy = false));
  };
  // After load and idle, so the request never competes with the strip's first clip.
  const idle = () => ("requestIdleCallback" in window ? requestIdleCallback(refresh, { timeout: 3000 }) : setTimeout(refresh, 0));
  if (document.readyState === "complete") idle();
  else addEventListener("load", idle, { once: true });
  document.addEventListener("visibilitychange", () => !document.hidden && refresh());
}

/* ------------------------------------------------------------------ reel */

// The closing reel is ink on paper: dithered prints whose colour develops under the mouse.
// The colour posters are only requested on mouse devices, as the reel approaches the screen,
// so they are there for the first hover and phones never download them. The reel drifts left
// on its own and picks up the page's scroll speed, in either direction, with a little mass;
// it stops under the mouse, with focus inside, when paused and off screen. Without this
// script it runs as a plain CSS loop.
const reel = document.querySelector<HTMLElement>(".reel");
const track = reel?.querySelector<HTMLElement>(".reel-track");
if (reel && finePointer && "IntersectionObserver" in window) {
  const near = new IntersectionObserver(
    ([e]) => {
      if (!e.isIntersecting) return;
      near.disconnect();
      reel.querySelectorAll<HTMLImageElement>(".tint[data-src]").forEach((img) => (img.src = img.dataset.src!));
    },
    { rootMargin: "800px 0px" },
  );
  near.observe(reel);
}
if (reel && track && !reducedMotion && "IntersectionObserver" in window) {
  reel.classList.add("is-js");
  const close = reel.closest("footer") ?? reel;
  const BASE = 26; // px per second
  let x = 0;
  let speed = BASE;
  let boost = 0;
  let lastY = scrollY;
  let last = 0;
  let raf = 0;
  let hovering = false;
  let onScreen = false;

  addEventListener(
    "scroll",
    () => {
      // Only scroll seen while the reel is on screen counts, or a long scroll down the page
      // would store up and send the reel racing in.
      if (onScreen) boost = Math.max(-2400, Math.min(2400, boost + (scrollY - lastY) * 1.5));
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
    const target = held ? 0 : BASE + boost;
    speed += (target - speed) * (1 - Math.pow(1 - 0.08, dt * 60));
    x -= speed * dt;
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
