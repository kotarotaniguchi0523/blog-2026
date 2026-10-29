import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import type { Node, Root } from 'fumadocs-core/page-tree';

interface Docs7Group {
  group: string;
  icon?: string;
  pages: (string | Docs7Group)[];
}

const pagePath = z.string().min(1).refine((value) =>
  !value.startsWith('/') && !value.endsWith('/') &&
  !/[\\?#:]/.test(value) && !/\.(md|mdx)$/i.test(value) &&
  value.split('/').every((part) => part !== '.' && part !== '..' && part !== ''),
  'Use an extensionless, content-relative page path such as index or posts/hello.',
);
const group: z.ZodType<Docs7Group> = z.strictObject({
  group: z.string().min(1),
  // Icon names are resolved by Docs7 at build time; Fumapress keeps its own sidebar icons.
  icon: z.string().min(1).optional(),
  pages: z.array(z.union([pagePath, z.lazy(() => group)])).min(1),
});
const color = z.string().regex(/^#[\da-fA-F]{6}$/, 'Use a six-digit hex color.');
const linkHref = z.string().min(1).refine((value) => {
  if (value.startsWith('/')) return !value.startsWith('//');
  if (!URL.canParse(value)) return false;
  const { protocol } = new URL(value);
  return protocol === 'https:' || protocol === 'http:';
}, 'Use a site path such as /blog or an http(s) URL.');
const navbarLink = z.strictObject({
  label: z.string().min(1),
  href: linkHref,
  type: z.enum(['github', 'discord']).optional(),
});

const pageList = z.array(z.union([pagePath, z.lazy(() => group)])).min(1);

const navbar = z.strictObject({ links: z.array(navbarLink) });
const languageEntry = z.union([
  z.strictObject({
    language: z.string().min(1),
    default: z.boolean().optional(),
    navbar: navbar.optional(),
    groups: z.array(group).min(1),
  }),
  z.strictObject({
    language: z.string().min(1),
    default: z.boolean().optional(),
    navbar: navbar.optional(),
    pages: pageList,
  }),
]);

// Intentionally a strict supported subset, not a replacement for Docs7's full schema.
const configSchema = z.strictObject({
  $schema: z.literal('https://context7.com/schema/docs7.json').optional(),
  name: z.string().min(1),
  theme: z.literal('mint').optional(),
  colors: z.strictObject({ primary: color, light: color.optional(), dark: color.optional() }),
  appearance: z.strictObject({
    default: z.enum(['light', 'dark', 'system']),
    strict: z.boolean().optional(),
  }).optional(),
  // Docs7-only icon library setting; Fumapress ships its own icon set.
  icons: z.strictObject({ library: z.enum(['fontawesome', 'lucide', 'tabler']) }).optional(),
  // Docs7-only page actions; Fumapress has no equivalent UI.
  contextual: z.strictObject({
    options: z.array(z.enum([
      'copy', 'view', 'assistant', 'download-pdf', 'download-spec',
      'chatgpt', 'claude', 'perplexity', 'grok', 'aistudio',
      'devin', 'windsurf', 'mcp', 'add-mcp', 'cursor', 'vscode', 'devin-mcp',
    ])).min(1),
    display: z.enum(['header', 'toc']).optional(),
  }).optional(),
  // Docs7-only indexing scope; Fumapress builds its sitemap from the source pages.
  seo: z.strictObject({ indexing: z.enum(['navigable', 'all']) }).optional(),
  navbar: navbar.optional(),
  // `pages` is a flat sidebar, `groups` adds section labels, `languages` repeats
  // the navigation per locale (default language first, English in `en/`).
  navigation: z.union([
    z.strictObject({ groups: z.array(group).min(1) }),
    z.strictObject({ pages: pageList }),
    z.strictObject({ languages: z.array(languageEntry).min(1) }),
  ]),
});

export type Docs7Config = z.infer<typeof configSchema>;

export function parseDocs7Config(value: unknown): Docs7Config {
  const result = configSchema.safeParse(value);
  if (!result.success) {
    throw new Error(`[Docs7 plugin] Invalid or unsupported docs.json setting: ${result.error.message}`);
  }
  if (result.data.appearance?.strict && result.data.appearance.default === 'system') {
    throw new Error('[Docs7 plugin] strict appearance requires light or dark.');
  }
  if ('languages' in result.data.navigation) {
    const defaults = result.data.navigation.languages.filter((language) => language.default);
    if (defaults.length !== 1) {
      throw new Error('[Docs7 plugin] navigation.languages requires exactly one default language.');
    }
  }
  return result.data;
}

export function readDocs7Config(configPath = 'content/docs.json'): Docs7Config {
  return parseDocs7Config(JSON.parse(readFileSync(resolve(configPath), 'utf8')));
}

/** Locales listed in docs.json, empty when the site is single-language. */
export function docs7Languages(config: Docs7Config): string[] {
  return 'languages' in config.navigation
    ? config.navigation.languages.map((language) => language.language)
    : [];
}

/** Language treated as the source of truth, `undefined` for single-language sites. */
export function docs7DefaultLanguage(config: Docs7Config): string | undefined {
  if (!('languages' in config.navigation)) return undefined;
  return config.navigation.languages.find((language) => language.default)?.language;
}

function languageEntryFor(config: Docs7Config, locale: string | undefined) {
  if (!('languages' in config.navigation)) return undefined;
  const languages = config.navigation.languages;
  return languages.find((language) => language.language === locale)
    ?? languages.find((language) => language.default)
    ?? languages[0];
}

function navigationItems(config: Docs7Config, locale?: string): (string | Docs7Group)[] {
  const language = languageEntryFor(config, locale);
  if (language) return 'groups' in language ? language.groups : language.pages;
  if ('groups' in config.navigation) return config.navigation.groups;
  if ('pages' in config.navigation) return config.navigation.pages;
  return [];
}

/** Navbar links for one locale, falling back to the site-wide links. */
export function docs7NavbarLinks(config: Docs7Config, locale?: string): { label: string; href: string }[] {
  const language = languageEntryFor(config, locale);
  return language?.navbar?.links ?? config.navbar?.links ?? [];
}

interface SourcePage {
  path: string;
  url: string;
  data: { title?: string; description?: string };
}

export function createDocs7PageTree(config: Docs7Config, pages: SourcePage[], locale?: string): Root {
  // Docs7 lists translated pages with their language folder (`en/about`), while
  // `source.getPages(locale)` keeps the same prefix. Accept both forms.
  const index = new Map<string, SourcePage>();
  for (const page of pages) {
    const key = page.path.replaceAll('\\', '/').replace(/\.(md|mdx)$/, '');
    index.set(key, page);
    const slash = key.indexOf('/');
    if (slash > 0) index.set(key.slice(slash + 1), page);
  }
  const seen = new Set<string>();
  function entry(value: string | Docs7Group, position: string): Node {
    if (typeof value !== 'string') {
      return {
        type: 'folder', $id: `docs7:${position}`, name: value.group, defaultOpen: true,
        children: value.pages.map((child, i) => entry(child, `${position}.${i}`)),
      };
    }
    if (seen.has(value)) throw new Error(`[Docs7 plugin] Duplicate navigation page: ${value}`);
    seen.add(value);
    const page = index.get(value);
    if (!page) throw new Error(`[Docs7 plugin] Navigation page not found: ${value}`);
    return { type: 'page', $id: `docs7:${value}`, $ref: page.path, name: page.data.title ?? value, url: page.url };
  }
  return { name: config.name, children: navigationItems(config, locale).map((item, i) => entry(item, String(i))) };
}

export function docs7ThemeCss(config: Docs7Config): string {
  return `:root{--color-fd-primary:${config.colors.light ?? config.colors.primary}}.dark{--color-fd-primary:${config.colors.dark ?? config.colors.primary}}`;
}
