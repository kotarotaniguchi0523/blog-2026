import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { frontmatter } from 'fumadocs-core/content/md/frontmatter';
import { parseDocs7Config } from '../plugins/docs7/config.ts';
import {
  draftNavigationConflicts,
  draftPaths,
  pageStatusOf,
  parsePageStatus,
  renderDocs7Ignore,
  type ContentPageRef,
} from './publication.ts';

/**
 * Reads the content tree that Docs7 deploys and plans `content/.docs7ignore`.
 *
 * I/O lives here, not in `publication.ts`, so the publication rules stay pure
 * and both the CLI (`scripts/docs7-ignore.ts`) and its CI guard
 * (`tests/content/docs7-ignore.test.ts`) read the same tree the same way.
 */

export const DOCS7_IGNORE_FILE = '.docs7ignore';

/** Every MDX page under the content root, with its validated publication status. */
export async function readContentPages(root: string): Promise<ContentPageRef[]> {
  const pages: ContentPageRef[] = [];
  for (const path of await listMdx(root)) {
    const data = parseFrontmatter(await readFile(join(root, path), 'utf8'), path);
    try {
      parsePageStatus(pageStatusOf(data));
    } catch (error) {
      throw new Error(`Invalid status in content/${path}: ${reason(error)}`);
    }
    pages.push({ path, data });
  }
  return pages;
}

/**
 * Extensionless page paths from every docs.json navigation list, in file order.
 * The config is validated first so the generator never guesses at an
 * unsupported navigation shape.
 */
export async function readNavigationPages(root: string): Promise<string[]> {
  const source: unknown = JSON.parse(await readFile(join(root, 'docs.json'), 'utf8'));
  parseDocs7Config(source);
  return navigationPages(source);
}

/** Collects page paths from `navigation.{languages,groups,pages}`, including nested groups. */
export function navigationPages(config: unknown): string[] {
  const navigation = asRecord(asRecord(config)?.navigation);
  const pages: string[] = [];
  const collect = (value: unknown): void => {
    if (!Array.isArray(value)) return;
    for (const item of value) {
      if (typeof item === 'string') {
        pages.push(item);
        continue;
      }
      const entry = asRecord(item);
      collect(entry?.pages);
      collect(entry?.groups);
    }
  };
  collect(navigation?.languages);
  collect(navigation?.groups);
  collect(navigation?.pages);
  return [...new Set(pages)];
}

export interface Docs7IgnorePlan {
  /** Contents of `content/.docs7ignore`. */
  readonly ignore: string;
  /** Content-root-relative paths that Docs7 must not upload. */
  readonly drafts: readonly string[];
  /** Navigation entries that point at a draft page. */
  readonly conflicts: readonly string[];
}

/** Everything `pnpm docs7:ignore` writes or reports, from one content tree. */
export async function planDocs7Ignore(root: string): Promise<Docs7IgnorePlan> {
  const drafts = draftPaths(await readContentPages(root));
  const conflicts = draftNavigationConflicts(await readNavigationPages(root), drafts);
  return { ignore: renderDocs7Ignore(drafts), drafts, conflicts };
}

async function listMdx(root: string, prefix = ''): Promise<string[]> {
  const entries = await readdir(join(root, prefix), { withFileTypes: true });
  entries.sort(compareNames);
  const paths: string[] = [];
  for (const entry of entries) {
    const path = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) paths.push(...await listMdx(root, path));
    else if (entry.isFile() && entry.name.endsWith('.mdx')) paths.push(path);
  }
  return paths;
}

function compareNames(left: { name: string }, right: { name: string }): number {
  if (left.name === right.name) return 0;
  return left.name < right.name ? -1 : 1;
}

function parseFrontmatter(source: string, path: string): unknown {
  try {
    return frontmatter(source).data;
  } catch (error) {
    throw new Error(`Invalid frontmatter in content/${path}: ${reason(error)}`);
  }
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}
