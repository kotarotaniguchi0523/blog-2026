import type { AppShape, HeadTag, Plugin, ProviderProps } from 'fumapress';
import { flattenTree, type Root } from 'fumadocs-core/page-tree';
import { createDocs7PageTree, docs7Languages, docs7NavbarLinks, docs7ThemeCss, type Docs7Config } from './config.ts';

/** Replaces a generated page tree with the docs.json navigation of its language. */
function docs7PageTree(config: Docs7Config, root: Root, locale: string | undefined): Root {
  const pages = flattenTree(root.children).flatMap((node) => node.$ref ? [{
    path: node.$ref,
    url: node.url,
    data: { title: typeof node.name === 'string' ? node.name : undefined },
  }] : []);
  return createDocs7PageTree(config, pages, locale);
}

/**
 * Maps the documented common docs.json subset to Fumapress 2 plugin hooks. The site name
 * is not a plugin concern in v2 (`siteConfig` is read-only): press.config passes `config.name`
 * to `site.name`, and Fumapress uses it as the nav title.
 */
export function docs7Plugin<C extends AppShape = AppShape>(config: Docs7Config): Plugin<C> {
  const head: HeadTag[] = [{ tag: 'style', attrs: { 'data-docs7-theme': '' }, children: docs7ThemeCss(config) }];
  const appearance = config.appearance;
  const providerProps: Partial<ProviderProps> | undefined = appearance && {
    theme: {
      defaultTheme: appearance.default,
      forcedTheme: appearance.strict ? appearance.default : undefined,
    },
  };
  return {
    name: 'blog-2026:docs7',
    configureLoader() {
      return {
        // docs.json is the whole sidebar; a fallback tree of unlisted pages would never be shown.
        pageTree: { generateFallback: false },
        plugins: [{
          name: 'blog-2026:docs7-navigation',
          transformPageTree: {
            root(root) {
              return docs7PageTree(config, root, this.locale);
            },
          },
        }],
      };
    },
    async configure() {
      // Validate every language, not just the one a page happens to request.
      const source = await this.getLoader();
      const locales = docs7Languages(config);
      for (const locale of locales.length ? locales : [undefined]) source.getPageTree(locale);
    },
    head: () => head,
    providerProps: () => providerProps,
    layoutProps({ lang }) {
      const links = docs7NavbarLinks(config, lang).map((link) => ({
        text: link.label,
        url: link.href,
        external: !link.href.startsWith('/'),
      }));
      return {
        ...(links.length ? { links } : {}),
        ...(config.appearance?.strict ? { themeSwitch: { enabled: false } } : {}),
      };
    },
  };
}
