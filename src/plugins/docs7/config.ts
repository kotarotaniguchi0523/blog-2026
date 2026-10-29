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
  navbar: z.strictObject({ links: z.array(navbarLink) }).optional(),
  navigation: z.strictObject({ groups: z.array(group).min(1) }),
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
  return result.data;
}

export function readDocs7Config(configPath = 'content/docs.json'): Docs7Config {
  return parseDocs7Config(JSON.parse(readFileSync(resolve(configPath), 'utf8')));
}

interface SourcePage {
  path: string;
  url: string;
  data: { title?: string; description?: string };
}

export function createDocs7PageTree(config: Docs7Config, pages: SourcePage[]): Root {
  const index = new Map(pages.map((page) => [page.path.replaceAll('\\', '/').replace(/\.(md|mdx)$/, ''), page]));
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
  return { name: config.name, children: config.navigation.groups.map((item, i) => entry(item, String(i))) };
}

export function docs7ThemeCss(config: Docs7Config): string {
  return `:root{--color-fd-primary:${config.colors.light ?? config.colors.primary}}.dark{--color-fd-primary:${config.colors.dark ?? config.colors.primary}}`;
}
