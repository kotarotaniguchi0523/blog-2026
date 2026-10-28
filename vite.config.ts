import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import press from "fumapress/vite";
import { fumadocsMdx } from "fumadocs-mdx/vite";
import { docs7ConfigWatch } from "./src/plugins/docs7/vite";

export default defineConfig({
  plugins: [press(), fumadocsMdx(), tailwindcss(), docs7ConfigWatch()],
});
