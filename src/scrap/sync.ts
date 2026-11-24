import type { Dirent } from 'node:fs';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createGitHubReader } from '../github/reader.ts';
import {
  buildScrapSnapshot,
  parseCommentCandidate,
  parseIssueSource,
  parsePublicationPolicy,
  parseReactionSource,
  type ScrapSnapshot,
} from './publication.ts';
import {
  GENERATED_MARKER,
  renderScrapIndex,
  renderScrapPage,
  scrapSlug,
  type ScrapRenderContext,
} from './render.ts';

const CONTENT_DIR = fileURLToPath(new URL('../../content', import.meta.url));
const DRY_RUN = process.argv.includes('--dry-run');

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}

async function main(): Promise<void> {
  const { owner, repo } = readRepository();
  const policy = parsePublicationPolicy({ ownerId: readOwnerId() });
  const reader = createGitHubReader({
    owner,
    repo,
    token: process.env.GITHUB_TOKEN,
  });

  const issues = await reader.listIssues();
  const published: ScrapSnapshot[] = [];
  for (const issue of issues) {
    const thread = await reader.getScrapThread(issue.number);
    const snapshot = buildScrapSnapshot(
      {
        issue: parseIssueSource(thread.issue),
        issueReactions: thread.issueReactions.map(parseReactionSource),
        comments: thread.comments.map(({ comment, reactions }) =>
          parseCommentCandidate({
            comment,
            reactions: reactions.map(parseReactionSource),
          })),
      },
      policy,
    );
    if (snapshot !== null) published.push(snapshot);
  }

  const changes: string[] = [];
  const expected = new Set<string>();
  const contextFor = (language: 'ja' | 'en'): ScrapRenderContext => ({
    owner,
    repo,
    language,
  });

  for (const [language, subdirectory, indexPath] of [
    ['ja', 'scraps', join(CONTENT_DIR, 'scraps', 'index.mdx')],
    ['en', join('en', 'scraps'), join(CONTENT_DIR, 'en', 'scraps', 'index.mdx')],
  ] as const) {
    const context = contextFor(language);
    for (const snapshot of published) {
      const path = join(CONTENT_DIR, subdirectory, `${scrapSlug(snapshot.id)}.mdx`);
      expected.add(path);
      await writeIfChanged(path, renderScrapPage(snapshot, context), changes);
    }
    expected.add(indexPath);
    await writeIfChanged(indexPath, renderScrapIndex(published, context), changes);
  }

  for (const subdirectory of ['scraps', join('en', 'scraps')]) {
    await removeStale(join(CONTENT_DIR, subdirectory), expected, changes);
  }

  if (changes.length === 0) {
    console.log('Scrap sync: no changes.');
    return;
  }

  console.log(
    `Scrap sync: ${published.length} published scrap(s), ${changes.length} file change(s)${DRY_RUN ? ' (dry run)' : ''}.`,
  );
  for (const change of changes) console.log(`  ${change}`);
}

function readRepository(): { owner: string; repo: string } {
  const value = process.env.GITHUB_REPOSITORY;
  if (!value) {
    throw new Error('GITHUB_REPOSITORY must be set to "owner/repo".');
  }
  const [owner, repo, ...rest] = value.split('/');
  if (!owner || !repo || rest.length > 0) {
    throw new Error(`GITHUB_REPOSITORY must be "owner/repo", got "${value}".`);
  }
  return { owner, repo };
}

function readOwnerId(): number {
  const value = process.env.SCRAP_OWNER_ID;
  if (!value) {
    throw new Error('SCRAP_OWNER_ID must be the immutable GitHub user ID of the only approver.');
  }
  return Number(value);
}

async function writeIfChanged(
  path: string,
  content: string,
  changes: string[],
): Promise<void> {
  let current: string | null = null;
  try {
    current = await readFile(path, 'utf8');
  } catch (error) {
    if (!isMissingFile(error)) throw error;
  }
  if (current === content) return;

  changes.push(`${current === null ? 'create' : 'update'} ${relative(path)}`);
  if (DRY_RUN) return;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf8');
}

async function removeStale(
  directory: string,
  expected: Set<string>,
  changes: string[],
): Promise<void> {
  let entries: Dirent[];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (isMissingFile(error)) return;
    throw error;
  }

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.mdx')) continue;
    const path = join(directory, entry.name);
    if (expected.has(path)) continue;

    let current: string;
    try {
      current = await readFile(path, 'utf8');
    } catch (error) {
      if (isMissingFile(error)) continue;
      throw error;
    }
    if (!current.includes(GENERATED_MARKER)) continue;

    changes.push(`delete ${relative(path)}`);
    if (!DRY_RUN) await rm(path);
  }
}

function isMissingFile(error: unknown): boolean {
  return (error as { code?: string }).code === 'ENOENT';
}

function relative(path: string): string {
  return path.startsWith(CONTENT_DIR)
    ? join('content', path.slice(CONTENT_DIR.length + 1))
    : path;
}
