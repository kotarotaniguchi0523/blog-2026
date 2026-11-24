import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { planBlogIndexes } from '../../src/blog/generate.ts';

const CONTENT_DIR = fileURLToPath(new URL('../../content', import.meta.url));

// Adding a post edits `content/blog/`, but the index is a committed file: this
// guard fails when the index was not regenerated with `pnpm blog:index`.
describe('generated Blog indexes', () => {
  it('match the posts in the blog folders', async () => {
    const plan = await planBlogIndexes(CONTENT_DIR);

    assert.equal(await readFile(join(CONTENT_DIR, 'blog', 'index.mdx'), 'utf8'), plan.ja);
    assert.equal(await readFile(join(CONTENT_DIR, 'en', 'blog', 'index.mdx'), 'utf8'), plan.en);
  });
});
