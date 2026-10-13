// Writes data/previews.json: smaller encodes of every demo video, for the homepage strip.
// `node scripts/previews.mjs` after adding demos to data/demos.json.
//
// X serves each video at several sizes; demos.json keeps the largest. For each video this
// records the variant closest to 360p ("sd") and to 720p ("hd"), keyed by the media id in the
// video URL (".../amplify_video/<id>/..."). Variants come from the public FxTwitter API.
// A demo without an entry plays its full video.
import { readFile, writeFile } from "node:fs/promises";

const demos = JSON.parse(await readFile(new URL("../data/demos.json", import.meta.url), "utf8"));
const mediaId = (url) => url.match(/_video\/(\d+)\//)?.[1];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The mp4 variant whose height is nearest to `h`, preferring the smaller one on a tie. */
function nearest(variants, h) {
  return variants.reduce((best, v) => (Math.abs(v.h - h) < Math.abs(best.h - h) ? v : best));
}

const previews = {};
for (const d of demos) {
  const wanted = d.media.filter((m) => m.video).map((m) => mediaId(m.video)).filter(Boolean);
  if (!wanted.length) continue;
  const res = await fetch(`https://api.fxtwitter.com/LexnLin/status/${d.id}`);
  if (!res.ok) {
    console.warn(`${d.id}: ${res.status}, skipped`);
    continue;
  }
  const { tweet } = await res.json();
  for (const video of tweet?.media?.videos ?? []) {
    const id = mediaId(video.url);
    if (!wanted.includes(id)) continue;
    const mp4 = (video.variants ?? [])
      .filter((v) => v.content_type === "video/mp4")
      .map((v) => ({ url: v.url, h: Number(v.url.match(/\/(\d+)x(\d+)\//)?.[2] ?? 0) }))
      .filter((v) => v.h > 0);
    if (!mp4.length) continue;
    previews[id] = { sd: nearest(mp4, 360).url, hd: nearest(mp4, 720).url };
  }
  await sleep(250);
}

const sorted = Object.fromEntries(Object.entries(previews).sort(([a], [b]) => a.localeCompare(b)));
await writeFile(new URL("../data/previews.json", import.meta.url), JSON.stringify(sorted, null, 2) + "\n");
console.log(`${Object.keys(sorted).length} videos with previews`);
