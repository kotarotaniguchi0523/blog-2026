import { readContentPages } from '../content/docs7-ignore.ts';
import { parseBlogPost, renderBlogIndex, type BlogLanguage, type BlogPost } from './render.ts';

/**
 * Reads the blog folders under the content root and builds both index pages.
 * I/O lives here; rendering stays pure in `render.ts`.
 */

export interface BlogIndexPlan {
  /** Contents of `content/blog/index.mdx`. */
  readonly ja: string;
  /** Contents of `content/en/blog/index.mdx`. */
  readonly en: string;
  readonly posts: Readonly<Record<BlogLanguage, readonly BlogPost[]>>;
}

export async function planBlogIndexes(contentRoot: string): Promise<BlogIndexPlan> {
  const pages = await readContentPages(contentRoot);
  const ja = collect(pages, 'ja');
  const en = collect(pages, 'en');
  return {
    ja: renderBlogIndex(ja, 'ja'),
    en: renderBlogIndex(en, 'en'),
    posts: { ja, en },
  };
}

function collect(
  pages: readonly { path: string; data: unknown }[],
  language: BlogLanguage,
): BlogPost[] {
  const directory = language === 'en' ? 'en/blog/' : 'blog/';
  return pages
    .filter((page) => page.path.startsWith(directory))
    // `index.mdx` is the generated section page, not a post.
    .filter((page) => page.path !== `${directory}index.mdx`)
    .map((page) => parseBlogPost(page.path, page.data, language))
    .filter((post): post is BlogPost => post !== null);
}
