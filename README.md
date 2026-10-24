# leonlin.de

Leon Lin's personal site ([@LexnLin](https://x.com/LexnLin) · [GitHub](https://github.com/Leonxlnx)).

- `/` is the portfolio, one section component each in `src/components/home`:
  - **Intro**: the hero, on paper. His name, and a collage that rises piece by piece from below the screen: Leon seen
    from behind (a drawn silhouette, `public/home/me.png`), the three models he builds with as tiles behind his
    head, and his guitar, Munich and his sports as grey photographs (`public/home`). The words on the left and the
    pieces point at each other on hover; under a mouse the collage leans with the pointer. With motion allowed and a
    hero that fits the screen, `src/scripts/intro.ts` pins the hero and the about section as one stage: scrolling,
    the photographs leave, the tiles drop behind his shoulders and come up beside the about text as solid tilted
    tiles. On phones and short screens the about section simply follows, and the pieces part as the hero scrolls away.
  - **Taste Skill**: what it is, live stars and installs as odometers, the install command, and a band of pages
    agents built with it that slides with the scroll.
  - **TasteCode**, **earshot**, **cinetic**: one short section each on the dark ground. The TasteCode window stands up
    as it scrolls in; earshot shows a listening timeline you can scrub, and Listen plays six seconds of sound made
    in code with Web Audio; cinetic plays its films (`public/work/cinetic`, small H.264 encodes), the lead one
    opening to the full width and developing its colour in the middle of the screen.
  - **More on GitHub** (the index of hand-picked repos from [`data/projects.json`](data/projects.json)),
    **Recognition**, **Demos** (the reel of dithered prints) and the contact footer.

  Section entrances, the pause button, the Munich clocks, live stars and the reel are in `src/scripts/home.ts`;
  shared primitives (frame, buttons, reveals) in `src/styles/home.css`.
- `/demos` shows every demo he has shared on X as one minimal grid, most liked first. Each card shows the video or
  thumbnail, the title, likes, and links to the X post and any live demo or repo, plus a small Claude / OpenAI / Kimi
  logo for each tool it was made with. The grid can be filtered by category and by tool (Claude, Codex, Kimi; a demo
  made with two tools shows under both); the filter state lives in the URL (`/demos?cat=games&tool=claude`).

The site URL (canonical links, Open Graph) is set once as `site` in `astro.config.mjs`.

Videos autoplay muted, but at most four at a time (two on narrow screens): the most visible ones, started one after
another once the page has loaded and scrolling has settled. Every other video is unloaded back to its poster. Posters
are requested as resized WebP from `pbs.twimg.com`.

Built with [Astro](https://astro.build) as a fully static site. Client JS is the background, the homepage scene and
sections, and on `/demos` the filters and the video scheduler.

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

`data/projects.json` holds each repo's name, GitHub description, stars and URL. To refresh it, run
`node scripts/projects.mjs` and commit the result. It lists every public repo of Leonxlnx that is not a fork or
archived, has a description and at least 20 stars (change `MIN_STARS` or `SKIP` in the script). Set `GITHUB_TOKEN` to
avoid GitHub's unauthenticated rate limit. The homepage shows taste-skill in its own section and an index of the repos named in `SHOWN` in
`src/pages/index.astro`, in that order (taste-skill, tastecode, earshot and cinetic have sections of their own); each line is the first sentence of the GitHub description unless `NOTES` in
`src/lib/projects.ts` overrides it.

Star counts are live: the build reads them from the GitHub API (falling back to the JSON offline or when rate
limited; set `GITHUB_TOKEN` in the Vercel project to lift the limit), and the homepage refreshes them in the browser
from GitHub's search API, at most once every ten minutes per visitor.

The Taste Skill install count (`TASTE_INSTALLS` in `src/pages/index.astro`, from skills.sh) and the recognition table
are written by hand in that file.

## Pictures

The posters in the homepage reel are shown as prints in four greys, dithered with the background's 4×4 Bayer matrix
(`public/dither/{id}-paper.png`; `{id}.png` is the darker variant). After adding demos or when a poster changes, run
`node scripts/dither.mjs` (it fetches every poster from `pbs.twimg.com`, rewrites all prints in about 40 seconds and
uses `sharp`, which comes with Astro; it imports `src/lib/bayer.ts`, so it needs Node 22.18+ or
`--experimental-strip-types`) and commit `public/dither`. `node scripts/previews.mjs` still writes
`data/previews.json` (smaller encodes per clip) for future use; no page plays them right now.

The hero silhouette is drawn by `node scripts/silhouette.mjs` (deterministic; `SEED`, `HEAD`, `LEN` and `BLUR` tune
it). The four hero photographs are CC0 (rawpixel and the WordPress photo directory) and need no credit; replace them
with your own any time, same file names, in grey. A pause button in the corner stops everything that moves on its
own: the background, the reel, the films, the waveform and the floating collage.

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
