# leons-demos

Every demo I've shared on X, ranked by likes.

A showcase of the AI-built demos by Leon Lin ([@LexnLin](https://x.com/LexnLin) · [GitHub](https://github.com/Leonxlnx)):
3D games, three.js worlds, shaders, animations, launch videos and web experiments. Each card links to the original X post
and to the live demo / repo, previews its video on hover, and opens a detail view with the full post, media and stats.
You can filter by category, search, and sort by most liked or newest (filters are kept in the URL, and `?demo=<id>`
deep-links to a demo).

Built with [Astro](https://astro.build) as a fully static site. All 108 cards are prerendered to HTML, with a small
script for filtering, video and the lightbox, plus a WebGL shader in the hero.

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
  "title": "Verdant forest: …",
  "created_at": "2026-09-05T15:43:51.000Z",
  "likes": 3969, "reposts": 277, "views": 1081412,
  "post_url": "https://x.com/LexnLin/status/…",
  "text": "…",                           // raw post text; trailing t.co links are stripped for display
  "links": ["https://…"],                // live demo / repo links shown as Play · Live · Repo buttons
  "related_posts": ["https://x.com/i/status/…"],
  "media": [{ "type": "video", "image": "https://pbs.twimg.com/…", "video": "https://video.twimg.com/….mp4" }]
}
```

To add a demo or refresh stats, edit or replace that file and push to `main`. The site sorts by likes at build
time, so the order in the file doesn't matter. Link labels come from the URL: `github.com` becomes **Repo**,
other links become **Play** for games and **Live** for everything else. Totals and category counts are
computed automatically.

Media is hotlinked from Twitter's CDN. The page sets `referrer: no-referrer`, because `video.twimg.com` rejects
requests that carry a third-party referrer.
