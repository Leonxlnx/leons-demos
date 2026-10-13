import { createRenderer, type BgRenderer, type BgState } from "./bg-renderer";

export type BgMessage =
  | { type: "init"; canvas: OffscreenCanvas; w: number; h: number; state: BgState; reducedMotion: boolean }
  | { type: "size"; w: number; h: number }
  | { type: "state"; state: BgState }
  | { type: "pointer"; x: number; y: number; on: boolean };

let renderer: BgRenderer | null = null;

self.onmessage = (e: MessageEvent<BgMessage>) => {
  const m = e.data;
  if (m.type === "init") {
    renderer = createRenderer(m.canvas, m, m.state, m.reducedMotion, () => self.postMessage("ready"));
  } else if (m.type === "size") renderer?.resize(m.w, m.h);
  else if (m.type === "pointer") renderer?.setPointer(m.x, m.y, m.on);
  else renderer?.setState(m.state);
};
