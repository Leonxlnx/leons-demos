// Refreshes data/projects.json from the GitHub API: `node scripts/projects.mjs`
// (set GITHUB_TOKEN to avoid the unauthenticated rate limit).
// Lists every public repo of OWNER that is not a fork or archived, has a description and at
// least MIN_STARS stars, minus SKIP. Edit those to change the list.
import { writeFile } from "node:fs/promises";

const OWNER = "Leonxlnx";
const MIN_STARS = 20;
const SKIP = new Set([OWNER, "leons-demos"]);

const headers = { Accept: "application/vnd.github+json" };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

const repos = [];
for (let page = 1; ; page++) {
  const res = await fetch(`https://api.github.com/users/${OWNER}/repos?type=owner&per_page=100&page=${page}`, { headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const batch = await res.json();
  repos.push(...batch);
  if (batch.length < 100) break;
}

const projects = repos
  .filter((r) => !r.fork && !r.archived && !r.private && r.description?.trim() && r.stargazers_count >= MIN_STARS)
  .filter((r) => !SKIP.has(r.name))
  .map((r) => ({ name: r.name, description: r.description.trim(), stars: r.stargazers_count, url: r.html_url }))
  .sort((a, b) => b.stars - a.stars);

await writeFile(new URL("../data/projects.json", import.meta.url), JSON.stringify(projects, null, 2) + "\n");
console.log(projects.map((p) => `${p.stars}\t${p.name}`).join("\n"));
