import raw from "../../data/demos.json";

export type Category = "Games" | "Animations/Videos" | "Web/Interactive" | "Other";
export type Tool = "Claude" | "Codex" | "Other";

export interface Media {
  type: "photo" | "video" | "animated_gif";
  image: string;
  video?: string;
}

export interface Demo {
  id: string;
  category: Category;
  tool: Tool;
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
  primary: boolean;
}

export interface ViewDemo extends Demo {
  shortTitle: string;
  cat: string;
  toolId: string;
  links_: DemoLink[];
  poster: string | null;
  video: string | null;
}

export const FILTERS: { id: string; label: string; category?: Category }[] = [
  { id: "all", label: "All" },
  { id: "games", label: "Games", category: "Games" },
  { id: "web", label: "Web", category: "Web/Interactive" },
  { id: "video", label: "Video", category: "Animations/Videos" },
  { id: "other", label: "Other", category: "Other" },
];

export const TOOL_FILTERS: { id: string; label: string; tool?: Tool }[] = [
  { id: "all", label: "All" },
  { id: "claude", label: "Claude", tool: "Claude" },
  { id: "codex", label: "Codex", tool: "Codex" },
  { id: "other", label: "Other", tool: "Other" },
];

const catId = (c: Category) => FILTERS.find((f) => f.category === c)?.id ?? "other";
const toolId = (t: Tool) => TOOL_FILTERS.find((f) => f.tool === t)?.id ?? "other";

/** Drops parenthetical notes such as "(GPT 6 Astra)" or "(screenshots)". */
export function shortTitle(title: string): string {
  return title.replace(/\s*\([^()]*\)/g, "").replace(/\s+([,:])/g, "$1").trim() || title;
}

export function describeLink(url: string, category: Category): DemoLink {
  const u = new URL(url);
  const host = u.hostname.replace(/^www\./, "");
  if (host === "github.com") {
    if (u.pathname.includes("/releases")) return { url, label: "Download", primary: false };
    if (u.pathname.includes("/blob/")) {
      const file = u.pathname.split("/").pop() ?? "";
      return { url, label: /prompt/i.test(file) ? "Prompt" : "Source", primary: false };
    }
    return { url, label: "Repo", primary: false };
  }
  if (host === "codepen.io") return { url, label: "CodePen", primary: true };
  if (host === "claude.ai" && u.pathname.startsWith("/artifact")) return { url, label: "Artifact", primary: true };
  return { url, label: category === "Games" ? "Play" : "Live", primary: true };
}

export function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, "")}K`;
  return String(n);
}

/** Smaller pbs.twimg.com variant for thumbnails (video thumbs ignore the param). */
export function sizedImage(url: string, size: "small" | "medium"): string {
  return url.includes("/media/") ? `${url}?name=${size}` : url;
}

export const DEMOS: ViewDemo[] = (raw as Demo[])
  .slice()
  .sort((a, b) => b.likes - a.likes || b.created_at.localeCompare(a.created_at))
  .map((d) => {
    const primary = d.media.find((m) => m.video) ?? d.media[0];
    const seen = new Set<string>();
    const links_ = d.links
      .map((l) => describeLink(l, d.category))
      .filter((l) => {
        const key = l.url.replace(/\/$/, "");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    const groups = Map.groupBy(links_, (l) => l.label);
    for (const [label, group] of groups) {
      if (group.length > 1) group.forEach((l, i) => (l.label = `${label} ${i + 1}`));
    }
    return {
      ...d,
      shortTitle: shortTitle(d.title),
      cat: catId(d.category),
      toolId: toolId(d.tool),
      links_,
      poster: primary?.image ?? null,
      video: primary?.video ?? null,
    };
  });

/** Filters with at least one demo; "All" is always first. */
export const VISIBLE_FILTERS = FILTERS.filter((f) => !f.category || DEMOS.some((d) => d.category === f.category));
export const VISIBLE_TOOL_FILTERS = TOOL_FILTERS.filter((f) => !f.tool || DEMOS.some((d) => d.tool === f.tool));
