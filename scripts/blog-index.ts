import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { planBlogIndexes } from '../src/blog/generate.ts';

/**
 * Regenerates the Blog index pages from the posts under `content/blog/` and
 * `content/en/blog/`.
 *
 * `--check` writes nothing and exits non-zero when a committed index differs,
 * so a post that was added without regenerating the index is caught in review.
 */

const CONTENT_DIR = fileURLToPath(new URL('../content', import.meta.url));
const CHECK_ONLY = process.argv.includes('--check');

const TARGETS = [
  { language: 'ja' as const, path: join(CONTENT_DIR, 'blog', 'index.mdx'), label: 'content/blog/index.mdx' },
  {
    language: 'en' as const,
    path: join(CONTENT_DIR, 'en', 'blog', 'index.mdx'),
    label: 'content/en/blog/index.mdx',
  },
];

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}

async function main(): Promise<void> {
  const plan = await planBlogIndexes(CONTENT_DIR);
  let changed = 0;

  for (const target of TARGETS) {
    const expected = plan[target.language];
    const current = await readIfExists(target.path);
    if (current === expected) continue;
    changed += 1;

    if (CHECK_ONLY) {
      console.error(`${target.label} is out of date. Run \`pnpm blog:index\`.`);
      continue;
    }
    await writeFile(target.path, expected, 'utf8');
    console.log(`updated ${target.label}`);
  }

  if (CHECK_ONLY) {
    if (changed > 0) {
      process.exitCode = 1;
    } else {
      console.log('Blog index: up to date.');
    }
    return;
  }
  if (changed === 0) {
    console.log('Blog index: no changes.');
    return;
  }
  console.log(`Blog index: ${plan.posts.ja.length} Japanese and ${plan.posts.en.length} English post(s).`);
}

async function readIfExists(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') return null;
    throw error;
  }
}
