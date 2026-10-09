import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://leonlin.de",
  output: "static",
  build: { inlineStylesheets: "always" },
});
