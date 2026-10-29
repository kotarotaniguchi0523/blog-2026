import { defineConfig } from "fumapress";
import { linkValidationPlugin } from "fumapress/plugins/link-validation";
import { docs7Plugin } from "./src/plugins/docs7/plugin";
import { docs7Mdx } from "./src/plugins/docs7/adapter";
import { metaSchema, pageSchema } from "fumapress/adapters/mdx/schema";
import { defineDocs } from "fumadocs-mdx/macro";

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

export default defineConfig({
  content: docs.toFumadocsSource(),
  // Japanese is the source of truth; `content/en/` holds the translation.
  i18n: {
    languages: ["ja", "en"],
    defaultLanguage: "ja",
    parser: "dir",
    hideLocale: "default-locale",
  },
  site: {
    // The site name is read from content/docs.json by docs7Plugin().
    // Deployed URL, used by sitemap and RSS:
    baseUrl: "https://merino-dev.docs7.io",
  },
  meta: {
    root() {
      return (
        <>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
          <link
            href="https://fonts.googleapis.com/css2?family=Geist:ital,wght@0,100..900;1,100..900&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap"
            rel="stylesheet"
          />
        </>
      );
    },
  },
})
  .plugins(docs7Plugin(), linkValidationPlugin())
  .adapters(docs7Mdx());
