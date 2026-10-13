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
}

/** Hand-written lines for repos whose GitHub description doesn't read well as one line. */
const NOTES: Record<string, string> = {
  tastecode: "Desktop workspace for coding agents, with a built-in design agent",
  "level-devil": "Level Devil fan recreation in plain HTML, CSS and JS",
};

/** The first sentence of a GitHub description, without a trailing full stop. */
function firstSentence(text: string): string {
  const first = text.split(/(?<=[.!?])\s|\s[—–-]\s/)[0] ?? text;
  return first.replace(/[.!?]+$/, "").trim();
}

export const PROJECTS: ViewProject[] = (raw as Project[])
  .map((p) => {
    const description = p.description.trim();
    return { ...p, description, note: NOTES[p.name] ?? firstSentence(description) };
  })
  .sort((a, b) => b.stars - a.stars);
