import type { AppShape, Plugin } from 'fumapress';
import type { Node, Root } from 'fumadocs-core/page-tree';
import { createDocs7PageTree, docs7DefaultLanguage, docs7Languages, docs7NavbarLinks, docs7ThemeCss, readDocs7Config, type Docs7Config } from './config.ts';

export interface Docs7PluginOptions {
  configPath?: string;
}

/** Page nodes of a generated tree, in the shape `createDocs7PageTree()` resolves navigation entries against. */
function treePages(root: Root) {
  const pages: { path: string; url: string; data: { title?: string } }[] = [];
  const visit = (nodes: Node[]) => {
    for (const node of nodes) {
      if (node.type === 'page' && node.$ref) {
        pages.push({ path: node.$ref, url: node.url, data: { title: typeof node.name === 'string' ? node.name : undefined } });
      } else if (node.type === 'folder') {
        if (node.index?.$ref) {
          const index = node.index;
          pages.push({ path: index.$ref!, url: index.url, data: { title: typeof index.name === 'string' ? index.name : undefined } });
        }
        visit(node.children);
      }
    }
  };
  visit(root.children);
  return pages;
}

/** Replaces the generated sidebar with the docs.json navigation of the tree's language. */
export function docs7PageTree(config: Docs7Config, root: Root, locale: string | undefined): Root {
  return createDocs7PageTree(config, treePages(root), locale);
}

/** Maps the documented common docs.json subset to Fumapress 2 plugin hooks. */
export function docs7Plugin<C extends AppShape = AppShape>(options: Docs7PluginOptions = {}): Plugin<C> {
  const config = readDocs7Config(options.configPath);
  return {
    name: 'blog-2026:docs7',
    configureLoader() {
      return {
        plugins: [{
          name: 'blog-2026:docs7-navigation',
          transformPageTree: {
            root(root) {
              // Fumadocs also builds a fallback tree of pages missing from the main tree, with
              // `generateFallback: false`. docs.json describes the main sidebar only.
              if (this.options.generateFallback === false) return root;
              return docs7PageTree(config, root, this.locale);
            },
          },
        }],
      };
    },
    async configure() {
      // Validate every language, not just the one a page happens to request.
      const source = await this.getLoader();
      for (const locale of docs7Languages(config)) source.getPageTree(locale);
      source.getPageTree(docs7DefaultLanguage(config));
    },
    head() {
      return [{ tag: 'style', attrs: { 'data-docs7-theme': '' }, children: docs7ThemeCss(config) }];
    },
    layoutProps({ lang }) {
      const links = docs7NavbarLinks(config, lang).map((link) => ({
        text: link.label,
        url: link.href,
        external: !link.href.startsWith('/'),
      }));
      return {
        nav: { title: config.name },
        ...(links.length ? { links } : {}),
        ...(config.appearance?.strict ? { themeSwitch: { enabled: false } } : {}),
      };
    },
    providerProps() {
      const appearance = config.appearance;
      if (!appearance) return undefined;
      return {
        theme: {
          defaultTheme: appearance.default,
          forcedTheme: appearance.strict ? appearance.default : undefined,
        },
      };
    },
  };
}
