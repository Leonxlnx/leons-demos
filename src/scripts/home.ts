/*
 * Homepage: section entrances, the pause button, the Munich clock, the copy button, live star
 * counts and the closing reel. The hero and about scene has its own script (intro.ts).
 */

import { compact } from "../lib/format";
import { column, glyphs } from "../lib/odometer";

// Arriving by a view transition, everything here waits until it has finished, so setting up
// does not steal frames from the morph. The head script in Base.astro leaves the transition's
// finished promise here.
const transition = (window as { __vt?: unknown }).__vt;
if (transition) await Promise.resolve(transition).catch(() => {});

// Hidden-until-revealed states only apply once this module runs, so a failed or blocked
// script never leaves the page blank.
document.documentElement.classList.add("reveal");

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const root = document.documentElement;
let paused = false;

/* ------------------------------------------------------------------ pause */

// One button pauses everything that moves on its own: the reel, the films, the waveform and the
// collage (WCAG 2.2.2). Its name stays "Pause …" and aria-pressed carries the state.
const motionButton = document.querySelector<HTMLButtonElement>(".motion");
if (motionButton && !reducedMotion) {
  motionButton.hidden = false;
  const icon = motionButton.querySelector("use")!;
  motionButton.addEventListener("click", () => {
    paused = !paused;
    root.classList.toggle("motion-paused", paused);
    motionButton.setAttribute("aria-pressed", String(paused));
    icon.setAttribute("href", paused ? "#i-play" : "#i-pause");
  });
  // It shows only while something that moves for longer than five seconds is on screen: the
  // waveform, a film or the reel (.has-motion). The collage settles within five seconds, so the
  // hero and about need none. Without an observer it simply stays.
  const moving = document.querySelectorAll("[data-listen], [data-film], .reel");
  if ("IntersectionObserver" in window) {
    const seen = new Set<Element>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) seen.add(e.target);
        else seen.delete(e.target);
      }
      root.classList.toggle("has-motion", seen.size > 0);
    });
    moving.forEach((el) => io.observe(el));
  } else root.classList.add("has-motion");
  // At the end it parks under the reel and scrolls away with it, clear of the email: that is
  // CSS alone (position: sticky, in index.astro).
}

/* ------------------------------------------------------------------ clocks */

const clocks = Array.from(document.querySelectorAll<HTMLTimeElement>("[data-clock]"));
if (clocks.length) {
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
  const tick = () => {
    const now = new Date();
    for (const c of clocks) {
      c.textContent = fmt.format(now);
      c.dateTime = now.toISOString();
      c.hidden = false;
    }
  };
  tick();
  setInterval(tick, 10_000);
}

/* ------------------------------------------------------------------ entrances */

// Each block gets .is-in once, the first time it is on screen. A batch that arrives together
// staggers through --b (at most four steps), so a fast scroll never queues a long cascade.
// Blocks inside a held section ([data-hold], the about text while the scene runs) are left to
// their scene.
const revealed = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal], [data-odo]")).filter((el) => !el.closest("[data-hold]"));
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
  const idle = () => ("requestIdleCallback" in window ? requestIdleCallback(refresh, { timeout: 3000 }) : setTimeout(refresh, 0));
  if (document.readyState === "complete") idle();
  else addEventListener("load", idle, { once: true });
  document.addEventListener("visibilitychange", () => !document.hidden && refresh());
}

/* ------------------------------------------------------------------ reel */

// The closing reel drifts left on its own and picks up the page's scroll speed, in either
// direction, with a little mass; it eases to a stop when paused. The drift is one Web Animation,
// run by the compositor, so while the reel simply drifts the page does no work at all. A scroll
// only changes the animation's playback rate, and frames are asked for only while that rate
// eases back to the drift or down to a stop. Off screen it holds where it is. The loop's length
// is measured only when the track resizes. Without this script it runs as a plain CSS loop.
const reel = document.querySelector<HTMLElement>(".reel");
const track = reel?.querySelector<HTMLElement>(".reel-track");
const stills = Array.from(document.querySelectorAll<HTMLImageElement>(".reel img"));

// A still that has not arrived waits unseen and fades in when it does, instead of popping into
// its frame; one that fails leaves the plain frame.
for (const img of stills) {
  const hide = () => (img.style.visibility = "hidden");
  if (img.complete) {
    if (img.naturalWidth === 0 && img.currentSrc) hide();
    continue;
  }
  img.classList.add("is-waiting");
  img.addEventListener("load", () => img.classList.remove("is-waiting"), { once: true });
  img.addEventListener("error", hide, { once: true });
}
// Lazy stills in a clipped strip are only fetched as they slide in, so once the reel is a screen
// away they are all asked for at once.
if (reel && "IntersectionObserver" in window) {
  const near = new IntersectionObserver(
    ([e]) => {
      if (!e.isIntersecting) return;
      stills.forEach((img) => (img.loading = "eager"));
      near.disconnect();
    },
    { rootMargin: "100% 0px" },
  );
  near.observe(reel);
}

if (reel && track && !reducedMotion && "IntersectionObserver" in window && "animate" in track) {
  reel.classList.add("is-js");
  const BASE = 24; // px per second
  // The drift starts this many loops in: run backwards, an animation ends at its start, and no
  // scroll back up is long enough to get there.
  const LEAD = 1000;
  const loop = (length: number) => (length / BASE) * 1000; // ms
  let anim: Animation | undefined;
  let period = 0;
  let speed = BASE; // what the reel moves at now, px per second
  let boost = 0;
  let lastY = scrollY;
  let last = 0;
  let raf = 0;
  let onScreen = false;

  const setSpeed = (v: number) => {
    speed = v;
    anim?.updatePlaybackRate(v / BASE);
  };

  // One loop is one list and the gap after it. A new length rebuilds the drift at the same point
  // of its loop and the same speed.
  const build = () => {
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    const next = (track.scrollWidth + gap) / 2;
    if (!next || Math.abs(next - period) < 0.5) return;
    const at = anim ? ((anim.currentTime as number) % loop(period)) / loop(period) : 0;
    anim?.cancel();
    period = next;
    anim = track.animate([{ transform: "translateX(0)" }, { transform: `translateX(${-period}px)` }], {
      duration: loop(period),
      iterations: Infinity,
    });
    anim.currentTime = (LEAD + at) * loop(period);
    anim.playbackRate = speed / BASE;
    if (!onScreen || (paused && !raf)) anim.pause();
  };
  build();
  if ("ResizeObserver" in window) new ResizeObserver(build).observe(track);

  const frame = (now: number) => {
    // A frame's time can fall just before the click or scroll that asked for it.
    const dt = Math.max(0, Math.min(0.064, (now - last) / 1000));
    last = now;
    boost *= Math.pow(0.03, dt);
    if (Math.abs(boost) < 1) boost = 0;
    const target = paused ? 0 : BASE + boost;
    let v = speed + (target - speed) * (1 - Math.pow(1 - 0.08, dt * 60));
    // All but there, it lands on the drift or the stop and asks for no more frames.
    const settled = !boost && Math.abs(target - v) < 0.5;
    if (settled) v = target;
    setSpeed(v);
    if (settled && paused) anim?.pause();
    raf = settled ? 0 : requestAnimationFrame(frame);
  };
  const kick = () => {
    if (!anim || !onScreen || raf) return;
    if (!paused && anim.playState === "paused") anim.play();
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };

  addEventListener(
    "scroll",
    () => {
      // Only scroll seen while the reel is on screen and free counts, or a long scroll down the
      // page would store up and send the reel racing in.
      if (onScreen && !paused) {
        boost = Math.max(-1600, Math.min(1600, boost + (scrollY - lastY) * 1.2));
        kick();
      }
      lastY = scrollY;
    },
    { passive: true },
  );

  // The pause button's own listener, added first, has already flipped `paused`. Any boost goes,
  // so a stop eases straight down; off screen the reel only takes the new speed.
  motionButton?.addEventListener("click", () => {
    boost = 0;
    if (onScreen) kick();
    else setSpeed(paused ? 0 : BASE);
  });

  new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    if (!anim) return;
    if (onScreen) {
      if (!paused) anim.play();
      return;
    }
    // Off screen it holds, and comes back at its plain drift.
    cancelAnimationFrame(raf);
    raf = boost = 0;
    setSpeed(paused ? 0 : BASE);
    anim.pause();
  }).observe(reel);
}
