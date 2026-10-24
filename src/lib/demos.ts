import { readFileSync } from "node:fs";
import { join } from "node:path";
import raw from "../../data/demos.json";
import previews from "../../data/previews.json";

export type Category = "Games" | "Animations/Videos" | "Web/Interactive" | "Other";
export type Tool = "Claude" | "Codex" | "Kimi";
export type Logo = "claude" | "openai" | "kimi";

export interface Media {
  type: "photo" | "video" | "animated_gif";
  image: string;
  video?: string;
}

export interface Demo {
  id: string;
  category: Category;
  tools: Tool[];
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
  /** A local poster (public path) when the video's own first frame is black, blank or a loader. */
  poster?: string;
  /** Seconds into the video where playback starts, to match that poster. */
  posterTime?: number;
  /** "top" shows only the upper half of a video that stacks two clips. */
  crop?: "top";
}

export interface DemoLink {
  url: string;
  label: string;
  primary: boolean;
}

export interface ViewDemo extends Omit<Demo, "poster"> {
  shortTitle: string;
  cat: string;
  toolIds: string;
  links_: DemoLink[];
  poster: string | null;
  /** The poster's size in pixels, when it is known: a video's thumbnail, or a local file. */
  posterSize: [number, number] | null;
  /** The video's 720p cut, or the full-size file when X serves no cuts of it. */
  video: string | null;
  /** The 360p cut, for phones and narrow cards. */
  videoSm: string | null;
}

export const FILTERS: { id: string; label: string; category?: Category }[] = [
  { id: "all", label: "All" },
  { id: "games", label: "Games", category: "Games" },
  { id: "web", label: "Web", category: "Web/Interactive" },
  { id: "video", label: "Video", category: "Animations/Videos" },
  { id: "other", label: "Other", category: "Other" },
];

// No "All" among these: with no tool picked, every tool shows.
export const TOOL_FILTERS: { id: string; label: string; tool: Tool; logo: Logo }[] = [
  { id: "claude", label: "Claude", tool: "Claude", logo: "claude" },
  { id: "codex", label: "Codex", tool: "Codex", logo: "openai" },
  { id: "kimi", label: "Kimi", tool: "Kimi", logo: "kimi" },
];

const catId = (c: Category) => FILTERS.find((f) => f.category === c)?.id ?? "other";
export const toolFilter = (t: Tool) => TOOL_FILTERS.find((f) => f.tool === t)!;

/** Drops parenthetical notes such as "(GPT 6 Astra)" or "(screenshots)". */
export function shortTitle(title: string): string {
  return title.replace(/\s*\([^()]*\)/g, "").replace(/\s+([,:])/g, "$1").trim() || title;
}

/** Returns null for links that aren't shown (prompt files). */
export function describeLink(url: string, category: Category): DemoLink | null {
  const u = new URL(url);
  const host = u.hostname.replace(/^www\./, "");
  if (host === "github.com") {
    if (u.pathname.includes("/releases")) return { url, label: "Download", primary: false };
    if (u.pathname.includes("/blob/")) {
      const file = u.pathname.split("/").pop() ?? "";
      return /prompt/i.test(file) ? null : { url, label: "Source", primary: false };
    }
    return { url, label: "Repo", primary: false };
  }
  if (host === "codepen.io") return { url, label: "CodePen", primary: true };
  if (host === "claude.ai" && u.pathname.startsWith("/artifact")) return { url, label: "Artifact", primary: true };
  return { url, label: category === "Games" ? "Play" : "Live", primary: true };
}

export { compact } from "./format";

// pbs.twimg.com fits a picture within each of these boxes and never makes one larger than it is.
const BOUNDS = { small: 680, "900x900": 900, medium: 1200, large: 2048 } as const;
type Bound = keyof typeof BOUNDS;

/** Resized WebP from pbs.twimg.com, fitted within the named bound. */
export function sizedImage(url: string, size: Bound): string {
  return url.startsWith("https://pbs.twimg.com/") ? `${url.replace(/\?.*$/, "")}?format=webp&name=${size}` : url;
}

/**
 * A srcset for a poster from pbs.twimg.com. Posters are cropped to fill a 16:10 frame (twice as
 * tall for a stacked video), so each size is described by the width of frame it fills sharply,
 * not by its own width: a portrait poster is narrower than its bound, a very wide one loses its
 * sides. A photo's size is not recorded, so it counts as a 16:10 picture as large as the largest
 * bound. A local poster is already a 16:10 frame; one wider than 720px has a 720px copy beside
 * it (<id>-720.webp).
 */
export function posterSrcset(demo: ViewDemo): string | undefined {
  if (demo.poster?.startsWith("/")) {
    const w = demo.posterSize?.[0] ?? 0;
    return w > 720 ? `${demo.poster.replace(/\.webp$/, "-720.webp")} 720w, ${demo.poster} ${w}w` : undefined;
  }
  if (!demo.poster?.startsWith("https://pbs.twimg.com/")) return undefined;
  const [w, h] = demo.posterSize ?? [2048, 1280];
  const frame = demo.crop === "top" ? 1.6 / 2.04 : 1.6;
  const out: string[] = [];
  for (const [name, bound] of Object.entries(BOUNDS) as [Bound, number][]) {
    const scale = Math.min(1, bound / Math.max(w, h));
    out.push(`${sizedImage(demo.poster, name)} ${Math.round(Math.min(w, h * frame) * scale)}w`);
    // Past the picture's own size every name returns the same file.
    if (scale === 1) break;
  }
  return out.join(", ");
}

/** A video's thumbnail is its first frame at full size, and the video's URL spells that size out. */
function videoSize(video: string | undefined): [number, number] | null {
  const m = video?.match(/\/(\d+)x(\d+)\//);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

/** A local WebP's size, from its header (lossy, lossless or extended). */
function webpSize(path: string): [number, number] {
  const b = readFileSync(join(process.cwd(), "public", path));
  const chunk = b.toString("ascii", 12, 16);
  if (chunk === "VP8X") return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (chunk === "VP8L") {
    const bits = b.readUInt32LE(21);
    return [1 + (bits & 0x3fff), 1 + ((bits >> 14) & 0x3fff)];
  }
  return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
}

// The 720p and 360p cuts X serves beside each full-size video, by the video's media id. They
// share its timeline, so a start time carries over.
const CUTS: Record<string, { hd: string; sd: string } | undefined> = previews;
const cutsOf = (video: string) => CUTS[video.match(/_video\/(\d+)\//)?.[1] ?? ""];

export const DEMOS: ViewDemo[] = (raw as Demo[])
  .slice()
  .sort((a, b) => b.likes - a.likes || b.created_at.localeCompare(a.created_at))
  .map((d) => {
    const primary = d.media.find((m) => m.video) ?? d.media[0];
    const seen = new Set<string>();
    const links_ = d.links
      .map((l) => describeLink(l, d.category))
      .filter((l): l is DemoLink => {
        if (!l) return false;
        const key = l.url.replace(/\/$/, "");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    const groups = Map.groupBy(links_, (l) => l.label);
    for (const [label, group] of groups) {
      if (group.length > 1) group.forEach((l, i) => (l.label = `${label} ${i + 1}`));
    }
    const start = d.posterTime ? `#t=${d.posterTime}` : "";
    const cuts = primary?.video ? cutsOf(primary.video) : undefined;
    return {
      ...d,
      shortTitle: shortTitle(d.title),
      cat: catId(d.category),
      toolIds: d.tools.map((t) => toolFilter(t).id).join(" "),
      links_,
      poster: d.poster ?? primary?.image ?? null,
      posterSize: d.poster ? webpSize(d.poster) : videoSize(primary?.video),
      video: primary?.video ? (cuts?.hd ?? primary.video) + start : null,
      videoSm: cuts ? cuts.sd + start : null,
    };
  });

/** Filters with at least one demo; the type filters start with "All". */
export const VISIBLE_FILTERS = FILTERS.filter((f) => !f.category || DEMOS.some((d) => d.category === f.category));
export const VISIBLE_TOOL_FILTERS = TOOL_FILTERS.filter((f) => DEMOS.some((d) => d.tools.includes(f.tool)));
