import { createPress } from "fumapress";
import { linkValidationPlugin } from "fumapress/plugins/link-validation";
import { metaSchema, pageSchema } from "fumapress/schema";
import { defineDocs } from "fumadocs-mdx/macro";
import { docs7Plugin } from "./src/plugins/docs7/plugin";
import { readDocs7Config } from "./src/plugins/docs7/config";

const docs = defineDocs({
  dir: "content",
  docs: {
    async: true,
    schema: pageSchema,
    lastModified: true,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});

export const app = createPress(docs.toFumadocsSource(), {
  // Japanese is the source of truth; `content/en/` holds the translation.
  i18n: {
    languages: ["ja", "en"],
    defaultLanguage: "ja",
    parser: "dir",
    hideLocale: "default-locale",
  },
}).plugins(docs7Plugin(), linkValidationPlugin());

export default app.config({
  site: {
    // content/docs.json is the single source for the site name.
    name: readDocs7Config().name,
    // Deployed URL, used by the sitemap, RSS and canonical links.
    baseUrl: "https://merino-dev.docs7.io",
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
