import { getCollection } from "astro:content";
import { toFumadocsSource } from "@fumadocs/astro/source";
import { createPress } from "@fumapress/astro/config";
import { linkValidationPlugin } from "@fumapress/astro/plugins/link-validation";
import { docs7Plugin } from "./src/plugins/docs7/plugin";
import { readDocs7Config } from "./src/plugins/docs7/config";

// content/docs.json is the single source for the site name, theme and navigation.
const docs7 = readDocs7Config();

// The meta loader reads every JSON file in content/, including docs.json (the Docs7
// config); only `meta.json` files are Fumadocs sidebar metadata.
const meta = await getCollection("meta", (entry) => /(^|\/)meta\.json$/.test(entry.id));

export const app = createPress(toFumadocsSource(await getCollection("docs"), meta), {
  // Japanese is the source of truth; `content/en/` holds the translation.
  i18n: {
    languages: ["ja", "en"],
    defaultLanguage: "ja",
    parser: "dir",
    hideLocale: "default-locale",
  },
}).plugins(docs7Plugin(docs7), linkValidationPlugin());

export default app.config({
  site: {
    name: docs7.name,
  },
  head: [
    { tag: "link", attrs: { rel: "preconnect", href: "https://fonts.googleapis.com" } },
    { tag: "link", attrs: { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" } },
    {
      tag: "link",
      attrs: {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Geist:ital,wght@0,100..900;1,100..900&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap",
      },
    },
  ],
});
