/*
 * Homepage: section entrances, the pause button, the Munich clocks, the copy button, live star
 * counts and the closing reel. The hero and about scene has its own script (intro.ts).
 */

import { compact } from "../lib/format";
import { column, glyphs } from "../lib/odometer";
import { setActivity } from "./activity";

// Arriving by a view transition, everything here waits until it has finished, so setting up
// does not steal frames from the morph. The head script in Base.astro leaves the transition's
// finished promise here.
const transition = (window as { __vt?: unknown }).__vt;
if (transition) await Promise.resolve(transition).catch(() => {});

// Hidden-until-revealed states only apply once this module runs, so a failed or blocked
// script never leaves the page blank.
document.documentElement.classList.add("reveal");

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
const root = document.documentElement;
let paused = false;

/* ------------------------------------------------------------------ pause */

// One button pauses everything that moves on its own: the background, the reel, the films and
// the waveform (WCAG 2.2.2). Its name stays "Pause …" and aria-pressed carries the state.
const motionButton = document.querySelector<HTMLButtonElement>(".motion");
if (motionButton && !reducedMotion) {
  motionButton.hidden = false;
  const icon = motionButton.querySelector("use")!;
  motionButton.addEventListener("click", () => {
    paused = !paused;
    root.classList.toggle("motion-paused", paused);
    setActivity({ paused });
    motionButton.setAttribute("aria-pressed", String(paused));
    icon.setAttribute("href", paused ? "#i-play" : "#i-pause");
  });
  // It appears once the hero has gone, where the moving parts are.
  const hero = document.querySelector("[data-intro]");
  if (hero && "IntersectionObserver" in window) {
    const marker = document.createElement("div");
    marker.style.cssText = "position:absolute;top:120svh;height:1px;width:1px;pointer-events:none";
    marker.setAttribute("aria-hidden", "true");
    document.body.append(marker);
    new IntersectionObserver(([e]) => root.classList.toggle("past-hero", !e.isIntersecting && e.boundingClientRect.top < 0)).observe(marker);
  }
  // At the end of the page it would sit on the email; it steps aside there.
  const close = document.querySelector(".close");
  if (close && "IntersectionObserver" in window) {
    new IntersectionObserver(([e]) => root.classList.toggle("at-close", e.isIntersecting), { rootMargin: "0px 0px -40% 0px" }).observe(close);
  }
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
for (const img of document.querySelectorAll<HTMLImageElement>(".reel img")) {
  const hide = () => (img.style.visibility = "hidden");
  if (img.complete && img.naturalWidth === 0 && img.currentSrc) hide();
  else img.addEventListener("error", hide, { once: true });
}
if (reel && track && !reducedMotion && "IntersectionObserver" in window) {
  reel.classList.add("is-js");
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
    const held = hovering || paused || root.classList.contains("motion-paused") || reel.matches(":focus-within");
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
