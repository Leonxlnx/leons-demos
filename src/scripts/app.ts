const cards = Array.from(document.querySelectorAll<HTMLElement>(".card"));
const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-filter]"));

function setFilter(id: string) {
  if (!buttons.some((b) => b.dataset.filter === id)) id = "all";
  for (const b of buttons) b.setAttribute("aria-pressed", String(b.dataset.filter === id));
  for (const c of cards) c.hidden = id !== "all" && c.dataset.cat !== id;
  const url = new URL(location.href);
  if (id === "all") url.searchParams.delete("cat");
  else url.searchParams.set("cat", id);
  history.replaceState(null, "", url);
}

for (const b of buttons) b.addEventListener("click", () => setFilter(b.dataset.filter!));
const initial = new URLSearchParams(location.search).get("cat");
if (initial) setFilter(initial);

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
    if ("requestVideoFrameCallback" in v) v.requestVideoFrameCallback(reveal);
    else v.addEventListener("playing", reveal, { once: true });
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
