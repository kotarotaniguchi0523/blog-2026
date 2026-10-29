import { createElement, Fragment } from 'react';
import type { AppShape, PressPlugin } from 'fumapress';
import { createDocs7PageTree, docs7ThemeCss, readDocs7Config } from './config.ts';

export interface Docs7PluginOptions {
  configPath?: string;
}

/** Maps the documented common docs.json subset to Fumapress 1.6.2 hooks. */
export function docs7Plugin<C extends AppShape = AppShape>(options: Docs7PluginOptions = {}): PressPlugin<C> {
  return {
    name: 'blog-2026:docs7',
    init() {
      const config = readDocs7Config(options.configPath);
      this.siteConfig.name = config.name;
      this.interceptRootMeta(({ next }) => createElement(Fragment, null,
        next(), createElement('style', { 'data-docs7-theme': true }, docs7ThemeCss(config)),
      ));
      const previous = this.defaultLayoutProps;
      const navbarLinks = (config.navbar?.links ?? []).map((link) => ({
        text: link.label,
        url: link.href,
        external: !link.href.startsWith('/'),
      }));
      this.defaultLayoutProps = async (env) => {
        const inherited = await previous(env);
        const links = inherited.links ?? [];
        const linkedUrls = new Set(links.flatMap((item) => ('url' in item && typeof item.url === 'string' ? [item.url] : [])));
        return {
          ...inherited,
          nav: { ...inherited.nav, title: config.name },
          ...(navbarLinks.length ? {
            links: [...links, ...navbarLinks.filter((link) => !linkedUrls.has(link.url))],
          } : {}),
          ...(config.appearance?.strict ? { themeSwitch: { enabled: false } } : {}),
        };
      };
      if (config.appearance) {
        const appearance = config.appearance;
        const provider = (this.data['core:provider'] ??= {});
        (provider.transformers ??= []).push((props) => ({
          ...props,
          theme: {
            ...props.theme,
            defaultTheme: appearance.default,
            forcedTheme: appearance.strict ? appearance.default : undefined,
          },
        }));
      }
      const context = this;
      for (const key of ['core:docs-layout', 'core:notebook-layout', 'core:spacious-layout'] as const) {
        const layout = (this.data[key] ??= {});
        (layout.transformers ??= []).push(async ({ data, page }) => {
          const source = await context.getLoader();
          data.layoutProps.tree = createDocs7PageTree(config, source.getPages(page.locale));
          return data;
        });
      }
    },
    async configure() {
      // Validate references even before a page happens to request its sidebar.
      const source = await this.getLoader();
      createDocs7PageTree(readDocs7Config(options.configPath), source.getPages());
    },
  };
}
