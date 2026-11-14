import type { AppShape, HeadTag, Plugin, ProviderProps } from 'fumapress';
import { flattenTree, type Root } from 'fumadocs-core/page-tree';
import { createDocs7PageTree, docs7Languages, docs7NavbarLinks, docs7ThemeCss, type Docs7Config } from './config.ts';

/**
 * Replaces a generated page tree with the docs.json navigation of its language. Pages
 * that docs.json leaves out stay in `fallback`, where Fumadocs UI still finds their
 * sidebar scope and position.
 */
function docs7PageTree(config: Docs7Config, root: Root, locale: string | undefined): Root {
  const nodes = flattenTree(root.children).filter((node) => node.$ref);
  const tree = createDocs7PageTree(config, nodes.map((node) => ({
    path: node.$ref!,
    url: node.url,
    data: { title: typeof node.name === 'string' ? node.name : undefined },
  })), locale);
  const listed = new Set(flattenTree(tree.children).map((node) => node.$ref));
  const unlisted = nodes.filter((node) => !listed.has(node.$ref));
  return unlisted.length ? { ...tree, fallback: { name: tree.name, children: unlisted } } : tree;
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
        // Fumadocs assigns its own fallback (pages the generated tree left out) after the
        // transformers, replacing the one `docs7PageTree()` sets. Core skips this option when
        // `createPress()` sets `pageTree` itself; the guard below then keeps that tree as built.
        pageTree: { generateFallback: false },
        plugins: [{
          name: 'blog-2026:docs7-navigation',
          transformPageTree: {
            root(root) {
              // Fumadocs builds its own fallback tree, of pages the generated tree left out,
              // with the same transformers; it has no docs.json navigation to apply.
              if (this.options.generateFallback === false && this.options.idPrefix?.startsWith('fallback')) return root;
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
