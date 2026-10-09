# leonlin.de

Leon Lin's personal site ([@LexnLin](https://x.com/LexnLin) · [GitHub](https://github.com/Leonxlnx)).

- `/` lists his open-source projects from [`data/projects.json`](data/projects.json), sorted by stars.
- `/demos` shows every demo he has shared on X as one minimal grid, most liked first. Each card shows the video or
  thumbnail, the title, likes, and links to the X post and any live demo or repo, plus a small Claude / OpenAI / Kimi
  logo for each tool it was made with. The grid can be filtered by category and by tool (Claude, Codex, Kimi; a demo
  made with two tools shows under both); the filter state lives in the URL (`/demos?cat=games&tool=claude`).

The site URL (canonical links, Open Graph) is set once as `site` in `astro.config.mjs`.

Videos autoplay muted, but at most four at a time (two on narrow screens): the most visible ones, started one after
another once the page has loaded and scrolling has settled. Every other video is unloaded back to its poster. Posters
are requested as resized WebP from `pbs.twimg.com`.

Built with [Astro](https://astro.build) as a fully static site. The only client JS is the background and, on
`/demos`, the filters and the video scheduler.

The background is a WebGL2 port of two effects from
[shader-effects-inc/shaders](https://github.com/shader-effects-inc/shaders) (MIT): `SimplexNoise` feeding `Dither`
(Bayer 4×4), in black and grey. The library itself needs WebGPU and adds ~700 KB gzipped, so the two effects are
inlined in `src/scripts/bg-renderer.ts`. It runs in a worker through `OffscreenCanvas` (main thread as a fallback),
renders at one pixel per dither cell at 20 fps (10 while videos play), holds still while scrolling, stops when the tab
is hidden, and shows a still frame for `prefers-reduced-motion`.

## Develop

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static output in dist/
npm run preview  # serve the production build
```

Requires Node 22.12+. Vercel detects Astro automatically and needs no config (build `npm run build`, output `dist`).

## Updating the projects

`data/projects.json` holds each repo's name, GitHub description, stars and URL. To refresh it (or change which repos
are listed, see `REPOS` in the script), run `node scripts/projects.mjs` and commit the result. Set `GITHUB_TOKEN` to
avoid GitHub's unauthenticated rate limit.

## Updating the demos

All content comes from [`data/demos.json`](data/demos.json), an array of demos:

```jsonc
{
  "id": "2096263046918197609",          // X post id (unique)
  "category": "Web/Interactive",         // Games | Animations/Videos | Web/Interactive | Other
  "tools": ["Claude", "Codex"],          // any of Claude | Codex | Kimi
  "title": "Verdant forest: …",          // trailing "(…)" is dropped on the card
  "created_at": "2026-09-05T15:43:51.000Z",
  "likes": 3969, "reposts": 277, "views": 1081412,
  "post_url": "https://x.com/LexnLin/status/…",
  "text": "…",
  "links": ["https://…"],                // shown as Play / Live / Repo buttons
  "related_posts": ["https://x.com/i/status/…"],
  "media": [{ "type": "video", "image": "https://pbs.twimg.com/…", "video": "https://video.twimg.com/….mp4" }]
}
```

To add a demo or refresh stats, edit that file and push to `main`. The page sorts by likes at build time, so the order
in the file doesn't matter. Link labels come from the URL: `github.com` becomes **Repo**, other links become **Play**
for games and **Live** for everything else; links to prompt files are not shown. The card uses the first video in `media` (or the first image if there is
no video).

Media is hotlinked from Twitter's CDN. The page sets `referrer: no-referrer`, because `video.twimg.com` rejects
requests that carry a third-party referrer.
