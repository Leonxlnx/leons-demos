import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://leonlin.de",
  output: "static",
  build: { inlineStylesheets: "always" },
  vite: {
    build: {
      // Lightning CSS (Vite's default) folds `animation-timeline` into the `animation`
      // shorthand ("animation: linear both lens --frame"), which browsers reject, so every
      // scroll-driven animation on the homepage would silently not run in production.
      cssMinify: "esbuild",
    },
  },
});
