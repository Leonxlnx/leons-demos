import raw from "../../data/demos.json";

export type Category = "Games" | "Animations/Videos" | "Web/Interactive" | "Other";

export interface Media {
  type: "photo" | "video" | "animated_gif";
  image: string;
  video?: string;
}

export interface Demo {
  id: string;
  category: Category;
  title: string;
  created_at: string;
  likes: number;
  reposts: number;
  views: number;
  post_url: string;
  text: string;
  links: string[];
  related_posts: string[];
  media: Media[];
}

export interface DemoLink {
  url: string;
  label: string;
  host: string;
  kind: "play" | "live" | "repo" | "other";
}

export interface ViewDemo extends Demo {
  rank: number;
  slug: string;
  textHtml: string;
  dateLabel: string;
  links_: DemoLink[];
  thumb: string | null;
  video: string | null;
}

export const CATEGORIES: { id: Category; label: string; short: string }[] = [
  { id: "Games", label: "Games", short: "games" },
  { id: "Web/Interactive", label: "Web & Interactive", short: "web" },
  { id: "Animations/Videos", label: "Animations & Videos", short: "motion" },
  { id: "Other", label: "Other", short: "other" },
];

export const categoryShort = (c: Category) =>
  CATEGORIES.find((x) => x.id === c)?.short ?? "other";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const TRAILING_TCO = /(?:\s*https?:\/\/t\.co\/\w+)+\s*$/;

export function cleanText(text: string): string {
  return text.replace(TRAILING_TCO, "").trim();
}

/** Escaped HTML for the post body: inline t.co links and @mentions become anchors. */
export function textToHtml(text: string): string {
  const cleaned = escapeHtml(cleanText(text));
  return cleaned
    .replace(
      /https?:\/\/t\.co\/\w+/g,
      (u) => `<a href="${u}" target="_blank" rel="noopener noreferrer" class="inline-link">link&nbsp;↗</a>`,
    )
    .replace(
      /(^|[^\w])@(\w{1,15})/g,
      (_, pre, h) =>
        `${pre}<a href="https://x.com/${h}" target="_blank" rel="noopener noreferrer" class="mention">@${h}</a>`,
    )
    .replace(/\n{3,}/g, "\n\n");
}

export function describeLink(url: string, category: Category): DemoLink {
  const u = new URL(url);
  const host = u.hostname.replace(/^www\./, "");
  const path = u.pathname;
  if (host === "github.com") {
    if (path.includes("/releases")) return { url, label: "Download", host, kind: "repo" };
    if (path.includes("/blob/")) {
      const file = path.split("/").pop() ?? "";
      return { url, label: /prompt/i.test(file) ? "Prompt" : file, host, kind: "repo" };
    }
    return { url, label: "Repo", host, kind: "repo" };
  }
  if (host === "codepen.io") return { url, label: "CodePen", host, kind: "live" };
  if (host === "claude.ai") return { url, label: "Artifact", host, kind: "live" };
  if (category === "Games") return { url, label: "Play", host, kind: "play" };
  return { url, label: "Live", host, kind: "live" };
}

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 100_000 ? 0 : 1).replace(/\.0$/, "")}K`;
  return String(n);
}

/** Smaller pbs.twimg.com variant for grid thumbnails (video thumbs ignore the param). */
export function sizedImage(url: string, size: "small" | "medium" | "large"): string {
  return url.includes("/media/") ? `${url}?name=${size}` : url;
}

const demos = (raw as Demo[])
  .slice()
  .sort((a, b) => b.likes - a.likes || b.created_at.localeCompare(a.created_at));

export const DEMOS: ViewDemo[] = demos.map((d, i) => {
  const firstVideo = d.media.find((m) => m.video);
  return {
    ...d,
    rank: i + 1,
    slug: d.id,
    textHtml: textToHtml(d.text),
    dateLabel: dateFmt.format(new Date(d.created_at)),
    links_: d.links.map((l) => describeLink(l, d.category)),
    thumb: d.media[0]?.image ?? null,
    video: firstVideo?.video ?? null,
  };
});

export const TOTALS = {
  demos: DEMOS.length,
  likes: DEMOS.reduce((s, d) => s + d.likes, 0),
  views: DEMOS.reduce((s, d) => s + d.views, 0),
  reposts: DEMOS.reduce((s, d) => s + d.reposts, 0),
  playable: DEMOS.filter((d) => d.links.length > 0).length,
  byCategory: Object.fromEntries(
    CATEGORIES.map((c) => [c.id, DEMOS.filter((d) => d.category === c.id).length]),
  ) as Record<Category, number>,
};
