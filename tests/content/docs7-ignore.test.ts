import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  navigationPages,
  planDocs7Ignore,
  readContentPages,
  readNavigationPages,
} from '../../src/content/docs7-ignore.ts';
import { draftNavigationConflicts, draftPaths, renderDocs7Ignore } from '../../src/content/publication.ts';

const CONTENT_DIR = fileURLToPath(new URL('../../content', import.meta.url));

// This file is the CI guard for the Docs7 upload: a page that flips to draft
// without regenerating `content/.docs7ignore` would still be uploaded.
describe('content/.docs7ignore', () => {
  it('matches the drafts in the committed content', async () => {
    const committed = await readFile(join(CONTENT_DIR, '.docs7ignore'), 'utf8');
    const pages = await readContentPages(CONTENT_DIR);

    assert.equal(committed, renderDocs7Ignore(draftPaths(pages)));
    assert.equal(committed, (await planDocs7Ignore(CONTENT_DIR)).ignore);
  });

  it('lists no draft page that docs.json navigation references', async () => {
    assert.deepEqual((await planDocs7Ignore(CONTENT_DIR)).conflicts, []);
  });

  it('reads the pages of both languages relative to the content root', async () => {
    const paths = (await readContentPages(CONTENT_DIR)).map((page) => page.path);
    assert.ok(paths.includes('index.mdx'));
    assert.ok(paths.includes('en/index.mdx'));
    assert.ok(paths.every((path) => path.endsWith('.mdx') && !path.startsWith('content/')));
  });

  it('reports a draft that docs.json lists in either language', async () => {
    const navPages = await readNavigationPages(CONTENT_DIR);
    assert.ok(navPages.includes('about'));
    assert.ok(navPages.includes('en/about'));

    assert.deepEqual(draftNavigationConflicts(navPages, ['about.mdx']), ['about']);
    assert.deepEqual(draftNavigationConflicts(navPages, ['en/about.mdx']), ['en/about']);
    assert.deepEqual(draftNavigationConflicts(navPages, ['blog/post.mdx']), []);
  });
});

describe('navigationPages', () => {
  it('collects page paths from languages and nested groups without duplicates', () => {
    assert.deepEqual(
      navigationPages({
        navigation: {
          languages: [
            {
              language: 'ja',
              default: true,
              pages: ['index', { group: 'Guides', pages: ['guides/setup', 'guides/setup'] }],
            },
            { language: 'en', pages: ['en/index'] },
          ],
        },
      }),
      ['index', 'guides/setup', 'en/index'],
    );
    assert.deepEqual(navigationPages({ navigation: { pages: ['about', 'blog'] } }), ['about', 'blog']);
    assert.deepEqual(navigationPages({}), []);
  });
});
