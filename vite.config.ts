import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import press from "fumapress/vite";
import { fumadocsMdx } from "fumadocs-mdx/vite";
import { docs7ConfigWatch } from "./src/plugins/docs7/vite";

export default defineConfig({
  plugins: [press({ components: "./src/plugins/docs7/mdx.ts" }), fumadocsMdx(), tailwindcss(), docs7ConfigWatch()],
});
