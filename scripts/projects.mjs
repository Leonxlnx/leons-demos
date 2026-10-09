// Refreshes data/projects.json from the GitHub API: `node scripts/projects.mjs`
// (set GITHUB_TOKEN to avoid the unauthenticated rate limit). Edit REPOS to change the list.
import { writeFile } from "node:fs/promises";

const OWNER = "Leonxlnx";
const REPOS = [
  "taste-skill",
  "unlazy",
  "lumenshaders",
  "tastecode",
  "claude-launchvideo",
  "cinetic",
  "verdant-forest",
  "kimi-code-desktop",
  "claude-of-duty",
  "motion-recreation",
  "sakura-realm",
  "SharpShot",
  "merge-conflict",
  "monolithwilds",
];

const headers = { Accept: "application/vnd.github+json" };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

const projects = [];
for (const name of REPOS) {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${name}`, { headers });
  if (!res.ok) throw new Error(`${name}: ${res.status} ${res.statusText}`);
  const r = await res.json();
  projects.push({ name: r.name, description: r.description ?? "", stars: r.stargazers_count, url: r.html_url });
}
projects.sort((a, b) => b.stars - a.stars);

await writeFile(new URL("../data/projects.json", import.meta.url), JSON.stringify(projects, null, 2) + "\n");
console.log(projects.map((p) => `${p.stars}\t${p.name}`).join("\n"));
