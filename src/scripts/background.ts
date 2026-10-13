/*
 * Hosts the dithered background (bg-renderer.ts). The canvas is handed to a worker via
 * OffscreenCanvas so WebGL setup and drawing never block the main thread; browsers
 * without it render on the main thread instead. Starts once the page has loaded.
 */

import { activity, onActivity } from "./activity";
import type { BgState } from "./bg-renderer";
import type { BgMessage } from "./bg-worker";

const CELL = 3;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const cells = () => ({
  w: Math.ceil(innerWidth / CELL),
  h: Math.ceil(Math.max(innerHeight, document.documentElement.clientHeight) / CELL),
});
const state = (): BgState => ({ scrolling: activity.scrolling, videos: activity.videos, hidden: document.hidden });

async function start(canvas: HTMLCanvasElement) {
  let size = cells();
  const fit = () => {
    canvas.style.width = `${size.w * CELL}px`;
    canvas.style.height = `${size.h * CELL}px`;
  };
  fit();
  const ready = () => canvas.classList.add("ready");

  let post: (m: BgMessage) => void;
  if ("transferControlToOffscreen" in canvas) {
    const worker = new Worker(new URL("./bg-worker.ts", import.meta.url), { type: "module" });
    const offscreen = canvas.transferControlToOffscreen();
    worker.onmessage = ready;
    worker.postMessage({ type: "init", canvas: offscreen, ...size, state: state(), reducedMotion } satisfies BgMessage, [
      offscreen,
    ]);
    post = (m) => worker.postMessage(m);
  } else {
    const { createRenderer } = await import("./bg-renderer");
    const renderer = createRenderer(canvas, size, state(), reducedMotion, ready);
    if (!renderer) return;
    post = (m) => {
      if (m.type === "size") renderer.resize(m.w, m.h);
      else if (m.type === "state") renderer.setState(m.state);
      else if (m.type === "pointer") renderer.setPointer(m.x, m.y, m.on);
    };
  }

  // A soft light in the dither follows the mouse (not touch), sent at most once a frame.
  if (!reducedMotion && matchMedia("(hover: hover) and (pointer: fine)").matches) {
    let pending: PointerEvent | null = null;
    addEventListener(
      "pointermove",
      (e) => {
        if (e.pointerType !== "mouse") return;
        if (!pending) requestAnimationFrame(() => {
          post({ type: "pointer", x: pending!.clientX / CELL, y: pending!.clientY / CELL, on: true });
          pending = null;
        });
        pending = e;
      },
      { passive: true },
    );
    document.documentElement.addEventListener("pointerleave", (e) => post({ type: "pointer", x: e.clientX / CELL, y: e.clientY / CELL, on: false }));
  }

  addEventListener("resize", () => {
    const next = cells();
    if (next.w === size.w && next.h === size.h) return;
    size = next;
    fit();
    post({ type: "size", ...size });
  });
  const sync = () => post({ type: "state", state: state() });
  onActivity(sync);
  document.addEventListener("visibilitychange", sync);
}

const canvas = document.querySelector<HTMLCanvasElement>("canvas.bg");
if (canvas) {
  const boot = () => ("requestIdleCallback" in window ? requestIdleCallback(() => start(canvas)) : start(canvas));
  if (document.readyState === "complete") boot();
  else addEventListener("load", boot, { once: true });
}
