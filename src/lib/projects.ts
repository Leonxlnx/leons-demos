import raw from "../../data/projects.json";

export interface Project {
  name: string;
  description: string;
  stars: number;
  url: string;
}

export interface ViewProject extends Project {
  /** One line for the homepage list. */
  note: string;
  /** "owner/name", which the homepage uses to refresh the stars in the browser. */
  repo: string;
}

/** Hand-written lines for repos whose GitHub description doesn't read well as one line. */
const NOTES: Record<string, string> = {
  tastecode: "Desktop workspace for coding agents, with a built-in design agent",
  "level-devil": "Level Devil fan recreation in plain HTML, CSS and JS",
  "prompt-library": "Desktop app to organize your AI prompts",
  "kimi-code-desktop": "Unofficial Windows desktop app for Kimi Code CLI",
  "motion-recreation": "Motion-design recreation in JS, Canvas and WebGL, by GPT 6 Astra",
  earshot: "Ears for coding agents: let AI hear, review and make sound",
  athenaion: "An ancient Greek world built entirely in code with three.js",
  "open-water": "A real-time ocean in pure WebGL2, with weather and sound",
  shanshui: "Ten ink-wash landscapes painted and animated in code",
  "procedural-alpine-lake": "A one-minute alpine lake film rendered entirely from code",
  "golden-temple": "A golden-hour temple in three.js, rendered into a 70 second film",
  "imagegen-skills": "Image-generation skills for coding agents",
  "agentic-ai-prompt-research": "Research into how agentic coding assistants work",
  "claude-of-duty": "A tactical FPS in the browser, every texture and sound generated",
  "sakura-realm": "A procedural cherry blossom landscape in the browser",
  lumenshaders: "LUMEN, a generative shader studio with nine WebGL2 modes",
};

const OWNER = "Leonxlnx";

/** The first sentence of a GitHub description, without a trailing full stop. */
function firstSentence(text: string): string {
  const first = text.split(/(?<=[.!?])\s|\s[—–-]\s/)[0] ?? text;
  return first.replace(/[.!?]+$/, "").trim();
}

/**
 * Star counts read from the GitHub API at build time, so every deploy starts current (the
 * homepage refreshes them again in the browser). The list itself stays data/projects.json;
 * offline or rate limited, its counts are used. Set GITHUB_TOKEN on the build to lift the
 * unauthenticated limit of 60 requests an hour.
 */
async function liveStars(): Promise<Map<string, number>> {
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const stars = new Map<string, number>();
  try {
    for (let page = 1; ; page++) {
      const res = await fetch(`https://api.github.com/users/${OWNER}/repos?type=owner&per_page=100&page=${page}`, {
        headers,
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const batch = (await res.json()) as { name: string; stargazers_count: number }[];
      for (const r of batch) stars.set(r.name, r.stargazers_count);
      if (batch.length < 100) break;
    }
  } catch (err) {
    console.warn(`GitHub stars: ${(err as Error).message}, using data/projects.json`);
    stars.clear();
  }
  return stars;
}

const live = await liveStars();

export const PROJECTS: ViewProject[] = (raw as Project[])
  .map((p) => {
    const description = p.description.trim();
    return {
      ...p,
      description,
      stars: live.get(p.name) ?? p.stars,
      note: NOTES[p.name] ?? firstSentence(description),
      repo: new URL(p.url).pathname.slice(1),
    };
  })
  .sort((a, b) => b.stars - a.stars);
