import { defineCollection } from 'astro:content';
import { metaLoader, pageLoader } from '@fumadocs/astro/loaders';
import { pageFrontmatterSchema, publishedOnly } from './content/publication.ts';

// The `docs` collection is content/ (see `collections` in astro.config.mjs).
export const collections = {
  // Draft pages are dropped before the store, so no route or page tree entry sees them.
  docs: defineCollection({
    loader: publishedOnly(pageLoader()),
    schema: pageFrontmatterSchema,
  }),
  meta: defineCollection({ loader: metaLoader() }),
};
