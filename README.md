# leons-demos

Every demo I've shared on X, ranked by likes.

Leon Lin's AI-built demos ([@LexnLin](https://x.com/LexnLin) · [GitHub](https://github.com/Leonxlnx)) as one
minimal grid, most liked first. Each card shows the video or thumbnail, the title, likes, and links to the X post and
any live demo or repo. Videos autoplay muted while on screen and are paused and unloaded when they scroll away.

Built with [Astro](https://astro.build) as a fully static page. The only client JS is the category filter, the video
observer and the background.

The background is a WebGL2 port of two effects from
[shader-effects-inc/shaders](https://github.com/shader-effects-inc/shaders) (MIT): `SimplexNoise` feeding `Dither`
(Bayer 4×4), in black and grey. The library itself needs WebGPU and adds ~700 KB gzipped, so the two effects are
inlined in `src/scripts/background.ts`. It renders at one pixel per dither cell, is capped at 30 fps, stops when the tab
is hidden, and shows a still frame for `prefers-reduced-motion`.

## Develop

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static output in dist/
npm run preview  # serve the production build
```

Requires Node 22.12+. Vercel detects Astro automatically and needs no config (build `npm run build`, output `dist`).

## Updating the data

All content comes from [`data/demos.json`](data/demos.json), an array of demos:

```jsonc
{
  "id": "2096263046918197609",          // X post id (unique)
  "category": "Web/Interactive",         // Games | Animations/Videos | Web/Interactive | Other
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
for games and **Live** for everything else. The card uses the first video in `media` (or the first image if there is
no video).

Media is hotlinked from Twitter's CDN. The page sets `referrer: no-referrer`, because `video.twimg.com` rejects
requests that carry a third-party referrer.
