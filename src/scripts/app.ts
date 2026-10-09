import { activity, setActivity } from "./activity";

type Group = "cat" | "tool";

const cards = Array.from(document.querySelectorAll<HTMLElement>(".card"));
const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-group]"));
const state: Record<Group, string> = { cat: "all", tool: "all" };

const matches = (card: HTMLElement, group: Group, value: string) => value === "all" || card.dataset[group] === value;
const other = (group: Group): Group => (group === "cat" ? "tool" : "cat");

function apply() {
  for (const c of cards) c.hidden = !(matches(c, "cat", state.cat) && matches(c, "tool", state.tool));
  for (const b of buttons) {
    const group = b.dataset.group as Group;
    const value = b.dataset.value!;
    b.setAttribute("aria-pressed", String(state[group] === value));
    // An option that would empty the grid given the other filter is disabled rather than hidden.
    b.disabled = !cards.some((c) => matches(c, group, value) && matches(c, other(group), state[other(group)]));
  }
  const url = new URL(location.href);
  for (const group of ["cat", "tool"] as Group[]) {
    if (state[group] === "all") url.searchParams.delete(group);
    else url.searchParams.set(group, state[group]);
  }
  history.replaceState(null, "", url);
}

for (const b of buttons) {
  b.addEventListener("click", () => {
    state[b.dataset.group as Group] = b.dataset.value!;
    apply();
  });
}

const params = new URLSearchParams(location.search);
for (const group of ["cat", "tool"] as Group[]) {
  const value = params.get(group);
  if (value && buttons.some((b) => b.dataset.group === group && b.dataset.value === value)) state[group] = value;
}
if (!cards.some((c) => matches(c, "cat", state.cat) && matches(c, "tool", state.tool))) state.tool = "all";
if (state.cat !== "all" || state.tool !== "all") apply();

/*
 * Videos: at most a few play at once, picked by how much of each is on screen (ties go
 * to the higher-ranked card, then to whatever is already playing). Every other video is
 * released back to its poster, so the page never holds more decoders than that. Stopping
 * is immediate; starting waits for the page to load and for scrolling to settle, so fast
 * scrolls don't kick off downloads. Reduced-motion users keep the static thumbnails.
 */
const autoplay = !matchMedia("(prefers-reduced-motion: reduce)").matches;
const videos = Array.from(document.querySelectorAll<HTMLVideoElement>(".media video"));
const order = new Map(videos.map((v, i) => [v, i]));
const ratio = new Map<HTMLVideoElement, number>();
const broken = new WeakSet<HTMLVideoElement>();
const MIN_RATIO = 0.5;
const maxPlaying = () => (innerWidth >= 700 ? 4 : 2);
const loaded = (v: HTMLVideoElement) => v.hasAttribute("src");

// Spinning up several decoders at once stalls the main thread, so new videos start one
// at a time: the next waits for the previous one's first frame (or a timeout).
let starting: HTMLVideoElement | null = null;

function play(v: HTMLVideoElement) {
  if (!loaded(v)) {
    if (starting) return;
    starting = v;
    v.src = v.dataset.src!;
    const next = () => {
      clearTimeout(fallback);
      if (starting !== v) return;
      starting = null;
      update();
    };
    const fallback = setTimeout(next, 1500);
    const reveal = () => {
      if (loaded(v)) v.parentElement?.classList.add("playing");
      next();
    };
    if (typeof v.requestVideoFrameCallback === "function") v.requestVideoFrameCallback(reveal);
    else (v as HTMLVideoElement).addEventListener("playing", reveal, { once: true });
  }
  v.play().catch(() => {});
}

function release(v: HTMLVideoElement) {
  if (starting === v) starting = null;
  if (!loaded(v)) return;
  v.pause();
  v.parentElement?.classList.remove("playing");
  v.removeAttribute("src");
  v.load();
}

let ready = false;
let timer = 0;

function update() {
  if (!ready) return;
  if (activity.scrolling) return schedule();
  if (document.hidden) {
    for (const v of videos) if (loaded(v)) v.pause();
    return;
  }
  const wanted = new Set(
    videos
      .filter((v) => (ratio.get(v) ?? 0) >= MIN_RATIO && !broken.has(v))
      .sort(
        (a, b) =>
          ratio.get(b)! - ratio.get(a)! ||
          Number(loaded(b)) - Number(loaded(a)) ||
          order.get(a)! - order.get(b)!,
      )
      .slice(0, maxPlaying()),
  );
  for (const v of videos) if (!wanted.has(v)) release(v);
  for (const v of wanted) play(v);
  setActivity({ videos: wanted.size });
}

function schedule() {
  clearTimeout(timer);
  timer = window.setTimeout(update, 200);
}

if (autoplay && "IntersectionObserver" in window) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const v = e.target as HTMLVideoElement;
        const r = e.isIntersecting ? e.intersectionRatio : 0;
        ratio.set(v, r);
        if (r < MIN_RATIO) release(v);
      }
      setActivity({ videos: videos.filter(loaded).length });
      schedule();
    },
    { threshold: [0, 0.25, 0.5, 0.75, 1] },
  );
  for (const v of videos) {
    v.addEventListener("error", () => {
      broken.add(v);
      release(v);
      schedule();
    });
    io.observe(v);
  }

  const start = () => {
    ready = true;
    update();
  };
  const idle = () => ("requestIdleCallback" in window ? requestIdleCallback(start, { timeout: 1500 }) : setTimeout(start, 300));
  if (document.readyState === "complete") idle();
  else addEventListener("load", idle, { once: true });

  document.addEventListener("visibilitychange", update);
  addEventListener("resize", schedule);
}
