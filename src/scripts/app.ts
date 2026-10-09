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
 * Videos: only the ones on screen are loaded and playing. A video that leaves the
 * viewport is paused and its source released, so the browser never holds more than
 * a handful of decoders. Reduced-motion users keep the static thumbnails.
 */
const autoplay = !matchMedia("(prefers-reduced-motion: reduce)").matches;
const inView = new Set<HTMLVideoElement>();

function play(v: HTMLVideoElement) {
  if (!v.getAttribute("src")) {
    v.src = v.dataset.src!;
    const reveal = () => v.parentElement?.classList.add("playing");
    if (typeof v.requestVideoFrameCallback === "function") v.requestVideoFrameCallback(reveal);
    else (v as HTMLVideoElement).addEventListener("playing", reveal, { once: true });
  }
  v.play().catch(() => {});
}

function release(v: HTMLVideoElement) {
  v.pause();
  if (v.getAttribute("src")) {
    v.parentElement?.classList.remove("playing");
    v.removeAttribute("src");
    v.load();
  }
}

if (autoplay && "IntersectionObserver" in window) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const v = e.target as HTMLVideoElement;
        if (e.intersectionRatio >= 0.4) {
          inView.add(v);
          if (!document.hidden) play(v);
        } else if (!e.isIntersecting) {
          inView.delete(v);
          release(v);
        } else {
          inView.delete(v);
          v.pause();
        }
      }
    },
    { threshold: [0, 0.4] },
  );
  document.querySelectorAll<HTMLVideoElement>(".media video").forEach((v) => {
    v.addEventListener("error", () => release(v));
    io.observe(v);
  });

  document.addEventListener("visibilitychange", () => {
    for (const v of inView) document.hidden ? v.pause() : play(v);
  });
}
