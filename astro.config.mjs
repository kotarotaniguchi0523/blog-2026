// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import press from "@fumapress/astro";
import { docs7ConfigWatch } from "./src/plugins/docs7/astro.ts";

export default defineConfig({
  // Deployed URL, used by the sitemap, RSS and canonical links.
  site: "https://merino-dev.docs7.io",
  integrations: [
    press({
      collections: { docs: { dir: "content" } },
      components: "./src/plugins/docs7/mdx.ts",
      lastModified: true,
      includeProcessedMarkdown: true,
    }),
    docs7ConfigWatch(),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
