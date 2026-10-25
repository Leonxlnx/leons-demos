# leonlin.de

Leon Lin's personal site ([@LexnLin](https://x.com/LexnLin) · [GitHub](https://github.com/Leonxlnx)).

- `/` is the portfolio, one section component each in `src/components/home`:
  - **Intro**: the hero, on paper. His name, and a collage that rises piece by piece from below the screen: Leon seen
    from behind as a black silhouette, the three models he builds with as glass tiles round his head, his laptop with
    TasteCode open, the Frauenkirche, a tablet of photographs, his guitar and a football (all in `public/home/v2`).
    Nothing on the site reacts to hover. With motion allowed and a hero that fits the screen, `src/scripts/intro.ts`
    pins the hero and the about section as one stage: scrolling, the photographs leave and the tiles come up beside
    the about text as one cluster, with two photographs behind it. On phones and short screens the about section
    simply follows. Wheel scrolling glides (Lenis, `src/scripts/smooth.ts`) on mouse and trackpad; touch keeps the
    browser's own scrolling.
  - **Taste Skill**: what it is, live stars and installs as odometers, the install command, and a band of pages
    agents built with it that slides with the scroll.
  - **TasteCode**, **earshot**, **cinetic**: one short section each on the dark ground. The TasteCode window stands up
    as it scrolls in; earshot shows a listening timeline you can scrub, and Listen plays six seconds of sound made
    in code with Web Audio; cinetic plays its films (`public/work/cinetic`, 1080p H.264 with 720p cuts for phones), the lead one
    opening to the full width and developing its colour in the middle of the screen.
  - **More on GitHub** (the index of hand-picked repos from [`data/projects.json`](data/projects.json)),
    **Recognition**, **Demos** (a reel of demo stills, picked in `REEL` in `src/components/home/Close.astro`) and the
    contact footer.

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

Built with [Astro](https://astro.build) as a fully static site. Client JS is the homepage scene and sections, and on
`/demos` the filters and the video scheduler.

## Develop

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static output in dist/
npm run preview  # serve the production build
```

Requires Node 22.12+. Vercel detects Astro automatically and needs no config (build `npm run build`, output `dist`).

Page views are counted with [Vercel Web Analytics](https://vercel.com/docs/analytics) (`@vercel/analytics`, the
`<Analytics />` component at the end of `src/layouts/Base.astro`; no cookies). It reports only once Web Analytics is
enabled in the Vercel project's Analytics tab.

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

The Taste Skill install count (`TASTE_INSTALLS` in `src/pages/index.astro`, from skills.sh) and the recognition entries
(`src/components/home/Recognition.astro`) are written by hand.

## Pictures

The homepage reel shows the demos' own posters in grey, at sizes that stay sharp on retina screens (local posters
in `public/demos/posters` have a 720 px copy next to them). On `/demos` the cards play X's 720p or 360p cuts of
each video from `data/previews.json` (written by `node scripts/previews.mjs`), not the full-size files.

The hero and about pictures in `public/home/v2` are cut from CC0 photographs (Wikimedia Commons, Unsplash's CC0
years, rawpixel and the WordPress photo directory) and need no credit: the silhouette (Tim Marshall), the laptop
(Pineapple Supply Co., with TasteCode composited into its screen), the tablet (彭家杰, with three photographs on it), the
Gehrenspitze in Tyrol (Wilfredor) and the Frauenkirche (Christoph Braun). All are grey with one shared tone curve. Each
has smaller copies beside it for phones (`-sm`, and `-md` for the two about photographs); replace a picture together
with its copies, same names and sizes. A pause button in the corner stops everything that moves on its own: the reel,
the films and the waveform; on `/demos` its own button stops the playing cards.

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

Three optional fields fix a card whose video starts badly: `"poster": "/demos/posters/<id>.webp"` replaces a black,
blank or loading first frame with a frame from the middle (16:10 WebP in `public/demos/posters`, e.g.
`ffmpeg -ss 20 -i <video> -frames:v 1 frame.png`), `"posterTime": 24` starts playback at that moment, and
`"crop": "top"` shows only the upper clip of a video that stacks two.

Media is hotlinked from Twitter's CDN. The page sets `referrer: no-referrer`, because `video.twimg.com` rejects
requests that carry a third-party referrer.
