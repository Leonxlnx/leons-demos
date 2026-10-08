interface ClientLink {
  url: string;
  label: string;
  host: string;
  kind: "play" | "live" | "repo" | "other";
}
interface ClientMedia {
  type: string;
  image: string;
  video?: string;
}
interface ClientDemo {
  id: string;
  rank: number;
  title: string;
  cat: string;
  catLabel: string;
  date: string;
  iso: string;
  likes: number;
  reposts: number;
  views: number;
  post: string;
  html: string;
  links: ClientLink[];
  related: string[];
  media: ClientMedia[];
}

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  root.querySelector<T & Element>(sel) as T;
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<T & Element>(sel)) as T[];

const DATA: ClientDemo[] = JSON.parse($("#demo-data").textContent || "[]");
const BY_ID = new Map(DATA.map((d) => [d.id, d]));
const SEARCH = new Map(
  DATA.map((d) => [
    d.id,
    [d.title, d.html.replace(/<[^>]+>/g, " "), d.catLabel, ...d.links.map((l) => l.url)].join(" ").toLowerCase(),
  ]),
);
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;

const compact = (n: number) =>
  n >= 1e6
    ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, "")}M`
    : n >= 1e3
      ? `${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, "")}K`
      : String(n);
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const sized = (url: string, size: string) => (url.includes("/media/") ? `${url}?name=${size}` : url);

const ICON = {
  heart:
    '<svg class="icon" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.4-9.1C1.3 8.2 3.2 4.5 6.8 4.5c2.1 0 3.6 1.2 5.2 3.1 1.6-1.9 3.1-3.1 5.2-3.1 3.6 0 5.5 3.7 4.2 6.9-1.9 4.5-9.4 9.1-9.4 9.1z" fill="currentColor"/></svg>',
  eye: '<svg class="icon" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>',
  repost:
    '<svg class="icon" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V7.5A2.5 2.5 0 0 1 6.5 5H18l-3-3M20 15v1.5a2.5 2.5 0 0 1-2.5 2.5H6l3 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  arrow:
    '<svg class="icon" width="11" height="11" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  github:
    '<svg class="icon" width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z"/></svg>',
  x: '<svg class="icon" width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.36 5.77L17.75 3zm-1.08 16.18h1.7L7.4 4.73H5.58l11.09 14.45z"/></svg>',
  play: '<svg class="icon" width="10" height="10" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" fill="currentColor"/></svg>',
};

/* ------------------------------------------------------------------ filters */

const grid = $("#grid");
const cards = $$<HTMLElement>(".card", grid);
const input = $<HTMLInputElement>("#q");
const countEl = $("#count");
const emptyEl = $("#empty");
const chips = $$<HTMLButtonElement>(".chip");
const sortBtns = $$<HTMLButtonElement>("[data-sort]");

const params = new URLSearchParams(location.search);
const state = {
  cat: params.get("cat") || "all",
  q: params.get("q") || "",
  sort: params.get("sort") === "new" ? "new" : "likes",
};
if (!chips.some((c) => c.dataset.cat === state.cat)) state.cat = "all";
input.value = state.q;

function syncUrl() {
  const p = new URLSearchParams(location.search);
  const set = (k: string, v: string, def: string) => (v && v !== def ? p.set(k, v) : p.delete(k));
  set("cat", state.cat, "all");
  set("q", state.q.trim(), "");
  set("sort", state.sort, "likes");
  const qs = p.toString();
  history.replaceState(null, "", `${location.pathname}${qs ? `?${qs}` : ""}${location.hash}`);
}

let visibleOrder: string[] = [];

function apply(animate = true) {
  const terms = state.q.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const matches = cards.filter((c) => {
    if (state.cat !== "all" && c.dataset.cat !== state.cat) return false;
    const hay = SEARCH.get(c.dataset.id!) || "";
    return terms.every((t) => hay.includes(t));
  });
  const sorted = matches.slice().sort((a, b) =>
    state.sort === "new"
      ? (b.dataset.date || "").localeCompare(a.dataset.date || "")
      : Number(b.dataset.likes) - Number(a.dataset.likes),
  );
  const show = new Set(sorted);
  for (const c of cards) c.hidden = !show.has(c);
  const frag = document.createDocumentFragment();
  for (const c of sorted) frag.appendChild(c);
  for (const c of cards) if (!show.has(c)) frag.appendChild(c);
  grid.appendChild(frag);

  visibleOrder = sorted.map((c) => c.dataset.id!);
  countEl.textContent = String(sorted.length);
  emptyEl.hidden = sorted.length > 0;
  chips.forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.cat === state.cat)));
  sortBtns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.sort === state.sort)));

  if (animate && !reduceMotion) {
    sorted.slice(0, 16).forEach((c, i) => {
      c.classList.remove("in", "pop");
      void c.offsetWidth;
      c.style.setProperty("--stagger", `${i * 28}ms`);
      c.classList.add("pop", "in");
    });
  }
  syncUrl();
}

chips.forEach((chip) =>
  chip.addEventListener("click", () => {
    state.cat = chip.dataset.cat || "all";
    apply();
  }),
);
sortBtns.forEach((b) =>
  b.addEventListener("click", () => {
    if (state.sort === b.dataset.sort) return;
    state.sort = b.dataset.sort === "new" ? "new" : "likes";
    apply();
  }),
);
let qTimer = 0;
input.addEventListener("input", () => {
  clearTimeout(qTimer);
  qTimer = window.setTimeout(() => {
    state.q = input.value;
    apply();
  }, 120);
});
$("#reset").addEventListener("click", () => {
  state.cat = "all";
  state.q = "";
  input.value = "";
  apply();
});
document.addEventListener("keydown", (e) => {
  const t = e.target as HTMLElement;
  if (e.key === "/" && !/INPUT|TEXTAREA/.test(t.tagName) && !lightbox.open) {
    e.preventDefault();
    input.focus();
  } else if (e.key === "Escape" && t === input && input.value) {
    input.value = "";
    state.q = "";
    apply();
  }
});

apply(false);

/* ------------------------------------------------------------------ reveal */

if (!reduceMotion && "IntersectionObserver" in window) {
  document.documentElement.classList.add("js-reveal");
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        (e.target as HTMLElement).classList.add("in");
        io.unobserve(e.target);
      }
    },
    { rootMargin: "0px 0px -6% 0px" },
  );
  $$(".card, .feat, .section-head").forEach((el) => io.observe(el));
}

/* ------------------------------------------------------------------ video */

function makeVideo(src: string, poster?: string) {
  const v = document.createElement("video");
  v.muted = true;
  v.loop = true;
  v.playsInline = true;
  v.preload = "auto";
  v.setAttribute("muted", "");
  v.setAttribute("playsinline", "");
  if (poster) v.poster = poster;
  v.src = src;
  return v;
}

if (finePointer && !reduceMotion) {
  for (const card of cards) {
    const media = $(".card-media", card);
    const src = media?.dataset.video;
    if (!src) continue;
    let timer = 0;
    let video: HTMLVideoElement | null = null;
    card.addEventListener("mouseenter", () => {
      timer = window.setTimeout(() => {
        video = makeVideo(src);
        video.className = "hover-video";
        video.addEventListener("playing", () => media.classList.add("playing"), { once: true });
        video.addEventListener("error", () => video?.remove());
        media.appendChild(video);
        video.play().catch(() => {});
      }, 140);
    });
    card.addEventListener("mouseleave", () => {
      clearTimeout(timer);
      media.classList.remove("playing");
      if (video) {
        const v = video;
        video = null;
        v.pause();
        setTimeout(() => {
          v.removeAttribute("src");
          v.load();
          v.remove();
        }, 250);
      }
    });
  }
}

const featVideos = $$(".feat-media[data-autoplay]");
if (featVideos.length && !reduceMotion && "IntersectionObserver" in window) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const box = e.target as HTMLElement;
        let v = box.querySelector("video");
        if (e.isIntersecting) {
          if (!v) {
            v = makeVideo(box.dataset.autoplay!);
            v.addEventListener("playing", () => box.classList.add("playing"), { once: true });
            v.addEventListener("error", () => v?.remove());
            box.appendChild(v);
          }
          v.play().catch(() => {});
        } else if (v) {
          v.pause();
        }
      }
    },
    { threshold: 0.35 },
  );
  featVideos.forEach((b) => io.observe(b));
}

/* ------------------------------------------------------------------ lightbox */

const lightbox = $<HTMLDialogElement>("#lightbox");
const lb = {
  media: $("#lb-media"),
  meta: $("#lb-meta"),
  rank: $("#lb-rank"),
  title: $("#lb-title"),
  stats: $("#lb-stats"),
  links: $("#lb-links"),
  text: $("#lb-text"),
  related: $("#lb-related"),
  pos: $("#lb-pos"),
};
let current: ClientDemo | null = null;
let mediaIndex = 0;

function navList() {
  return current && visibleOrder.includes(current.id) ? visibleOrder : DATA.map((d) => d.id);
}

function renderMedia() {
  if (!current) return;
  const items = current.media;
  lb.media.querySelector("video")?.pause();
  if (!items.length) {
    lb.media.innerHTML = `<div class="lb-placeholder"><span>${esc(current.title)}</span><a class="btn" href="${esc(current.post)}" target="_blank" rel="noopener">${ICON.x} View the post</a></div>`;
    return;
  }
  const m = items[mediaIndex];
  let main: string;
  if (m.video) {
    main = `<video class="lb-video" src="${esc(m.video)}" poster="${esc(m.image)}" controls playsinline loop preload="auto"></video>`;
  } else {
    main = `<img class="lb-img" src="${esc(sized(m.image, "large"))}" alt="${esc(current.title)} — image ${mediaIndex + 1}" decoding="async" />`;
  }
  const thumbs =
    items.length > 1
      ? `<div class="lb-thumbs" role="group" aria-label="Media">${items
          .map(
            (t, i) =>
              `<button type="button" data-mi="${i}" aria-label="Media ${i + 1}"${i === mediaIndex ? ' aria-current="true"' : ""}><img src="${esc(sized(t.image, "small"))}" alt="" loading="lazy" />${t.video ? `<span class="lb-thumb-play">${ICON.play}</span>` : ""}</button>`,
          )
          .join("")}</div>`
      : "";
  lb.media.innerHTML = `<div class="lb-stage">${main}</div>${thumbs}`;
  const video = lb.media.querySelector<HTMLVideoElement>("video");
  if (video) {
    video.addEventListener("error", () => {
      const stage = lb.media.querySelector(".lb-stage");
      if (stage)
        stage.innerHTML = `<img class="lb-img" src="${esc(m.image)}" alt="" /><a class="btn lb-fallback" href="${esc(current!.post)}" target="_blank" rel="noopener">${ICON.x} Watch on X</a>`;
    });
    video.play().catch(() => {
      video.muted = true;
      video.play().catch(() => {});
    });
  }
}

function openDemo(id: string, push = true) {
  const d = BY_ID.get(id);
  if (!d) return;
  current = d;
  mediaIndex = 0;
  lb.meta.innerHTML = `<span class="cat cat--${d.cat}">${esc(d.catLabel)}</span><time datetime="${d.iso}">${d.date}</time>`;
  lb.rank.textContent = `#${String(d.rank).padStart(2, "0")} most liked`;
  lb.title.textContent = d.title;
  lb.stats.innerHTML = `
    <span class="stat stat--likes" title="Likes">${ICON.heart}${d.likes.toLocaleString("en-US")}</span>
    <span class="stat" title="Reposts">${ICON.repost}${d.reposts.toLocaleString("en-US")}</span>
    <span class="stat" title="Views">${ICON.eye}${compact(d.views)}</span>`;
  lb.links.innerHTML =
    d.links
      .map(
        (l) =>
          `<a class="lb-link lb-link--${l.kind}" href="${esc(l.url)}" target="_blank" rel="noopener"><span class="lb-link-label">${l.kind === "repo" ? ICON.github : l.kind === "play" ? ICON.play : ""}${esc(l.label)}</span><span class="lb-link-host">${esc(l.host)}${ICON.arrow}</span></a>`,
      )
      .join("") +
    `<a class="lb-link lb-link--x" href="${esc(d.post)}" target="_blank" rel="noopener"><span class="lb-link-label">${ICON.x}View post</span><span class="lb-link-host">x.com${ICON.arrow}</span></a>`;
  lb.text.innerHTML = d.html ? `<p>${d.html}</p>` : "";
  lb.related.innerHTML = d.related.length
    ? `<p class="lb-related-h">Related posts</p>${d.related
        .map(
          (u, i) =>
            `<a href="${esc(u)}" target="_blank" rel="noopener">${ICON.x} Thread post ${i + 1} ${ICON.arrow}</a>`,
        )
        .join("")}`
    : "";
  const list = navList();
  lb.pos.textContent = `${list.indexOf(d.id) + 1} / ${list.length}`;
  renderMedia();
  if (!lightbox.open) {
    lightbox.showModal();
    document.documentElement.classList.add("lb-open");
  }
  lb.text.parentElement?.scrollTo({ top: 0 });
  if (push) {
    const p = new URLSearchParams(location.search);
    p.set("demo", d.id);
    history.replaceState(null, "", `${location.pathname}?${p}`);
  }
}

function closeDemo() {
  lb.media.querySelector("video")?.pause();
  lb.media.innerHTML = "";
  if (lightbox.open) lightbox.close();
}
lightbox.addEventListener("close", () => {
  lb.media.querySelector("video")?.pause();
  lb.media.innerHTML = "";
  document.documentElement.classList.remove("lb-open");
  current = null;
  const p = new URLSearchParams(location.search);
  p.delete("demo");
  const qs = p.toString();
  history.replaceState(null, "", `${location.pathname}${qs ? `?${qs}` : ""}`);
});

function step(dir: 1 | -1) {
  if (!current) return;
  const list = navList();
  const i = list.indexOf(current.id);
  openDemo(list[(i + dir + list.length) % list.length]);
}

document.addEventListener("click", (e) => {
  const opener = (e.target as HTMLElement).closest<HTMLElement>("[data-open]");
  if (opener) {
    e.preventDefault();
    openDemo(opener.dataset.open!);
  }
});
$("#lb-close").addEventListener("click", closeDemo);
$("#lb-prev").addEventListener("click", () => step(-1));
$("#lb-next").addEventListener("click", () => step(1));
lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox) closeDemo();
  const t = (e.target as HTMLElement).closest<HTMLElement>("[data-mi]");
  if (t) {
    mediaIndex = Number(t.dataset.mi);
    renderMedia();
  }
});
lightbox.addEventListener("keydown", (e) => {
  if ((e.target as HTMLElement).tagName === "VIDEO") return;
  if (e.key === "ArrowRight") step(1);
  else if (e.key === "ArrowLeft") step(-1);
});

const deep = params.get("demo");
if (deep && BY_ID.has(deep)) openDemo(deep, false);
