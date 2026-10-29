import { createElement, Fragment } from 'react';
import type { AppShape, PressPlugin } from 'fumapress';
import { createDocs7PageTree, docs7DefaultLanguage, docs7Languages, docs7NavbarLinks, docs7ThemeCss, readDocs7Config } from './config.ts';

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
      this.defaultLayoutProps = async (env) => {
        const inherited = await previous(env);
        const links = inherited.links ?? [];
        const linkedUrls = new Set(links.flatMap((item) => ('url' in item && typeof item.url === 'string' ? [item.url] : [])));
        const navbarLinks = docs7NavbarLinks(config, env.lang).map((link) => ({
          text: link.label,
          url: link.href,
          external: !link.href.startsWith('/'),
        }));
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
          data.layoutProps.tree = createDocs7PageTree(config, source.getPages(page.locale), page.locale);
          return data;
        });
      }
    },
    async configure() {
      // Validate every language, not just the one a page happens to request.
      const config = readDocs7Config(options.configPath);
      const source = await this.getLoader();
      for (const locale of docs7Languages(config)) {
        createDocs7PageTree(config, source.getPages(locale), locale);
      }
      createDocs7PageTree(config, source.getPages(docs7DefaultLanguage(config)), docs7DefaultLanguage(config));
    },
  };
}
