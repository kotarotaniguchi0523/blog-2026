import { defineConfig } from "fumapress";
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
  site: {
    // The site name is read from content/docs.json by docs7Plugin().
    // the URL where your site is deployed, needed for SEO features like sitemap:
    // baseUrl: "https://example.com",
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
  .plugins(docs7Plugin())
  .adapters(docs7Mdx());
