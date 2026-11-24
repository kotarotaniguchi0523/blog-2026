import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  BLOG_GENERATED_MARKER,
  parseBlogPost,
  renderBlogIndex,
  type BlogPost,
} from '../../src/blog/render.ts';

describe('parseBlogPost', () => {
  it('reads a published post and keeps the optional fields', () => {
    assert.deepEqual(
      parseBlogPost('blog/hello-world.mdx', {
        title: 'Hello',
        description: 'First post',
        date: '2026-01-02',
        status: 'published',
      }, 'ja'),
      { slug: 'hello-world', title: 'Hello', date: '2026-01-02' },
    );
  });

  it('drops a draft even though its frontmatter is valid', () => {
    assert.equal(
      parseBlogPost('blog/hello.mdx', { title: 'Hello', status: 'draft' }, 'ja'),
      null,
    );
    assert.equal(parseBlogPost('blog/hello.mdx', { title: 'Hello' }, 'ja'), null);
  });

  it('rejects a post without a title', () => {
    assert.throws(
      () => parseBlogPost('blog/hello.mdx', { status: 'published' }, 'ja'),
      /invalid title/,
    );
  });

  it('rejects a date that is not YYYY-MM-DD', () => {
    assert.throws(
      () => parseBlogPost('blog/hello.mdx', { title: 'Hello', date: '2026/01/02', status: 'published' }, 'ja'),
      /invalid date/,
    );
  });

  it('rejects nested files so one post maps to one URL', () => {
    assert.throws(
      () => parseBlogPost('blog/2026/hello.mdx', { title: 'Hello', status: 'published' }, 'ja'),
      /direct \.mdx file/,
    );
  });

  it('rejects file names that are not URL-safe', () => {
    assert.throws(
      () => parseBlogPost('blog/hello world.mdx', { title: 'Hello', status: 'published' }, 'ja'),
      /not URL-safe/,
    );
  });

  it('rejects a post from the other language folder', () => {
    assert.throws(
      () => parseBlogPost('en/blog/hello.mdx', { title: 'Hello', status: 'published' }, 'ja'),
      /not under content\/blog\//,
    );
  });
});

describe('renderBlogIndex', () => {
  it('writes an empty Japanese index with the generated marker', () => {
    const page = renderBlogIndex([], 'ja');
    assert.ok(page.includes(BLOG_GENERATED_MARKER));
    assert.ok(page.includes('まだ記事はありません。'));
    assert.ok(page.includes('status: published'));
    assert.ok(page.endsWith('\n'));
  });

  it('sorts by date descending, then by slug, and links each post', () => {
    const posts: BlogPost[] = [
      { slug: 'old', title: 'Old', date: '2025-12-01' },
      { slug: 'b', title: 'B' },
      { slug: 'a', title: 'A' },
      { slug: 'new', title: 'New', date: '2026-02-03' },
    ];
    const page = renderBlogIndex(posts, 'en');
    const links = page.split('\n').filter((line) => line.startsWith('- '));
    assert.deepEqual(links, [
      '- [New](/en/blog/new) — 2026-02-03',
      '- [Old](/en/blog/old) — 2025-12-01',
      '- [A](/en/blog/a)',
      '- [B](/en/blog/b)',
    ]);
  });

  it('links Japanese posts under /blog', () => {
    assert.ok(renderBlogIndex([{ slug: 'post', title: 'Post' }], 'ja').includes('(/blog/post)'));
  });

  it('escapes brackets in a title', () => {
    assert.ok(
      renderBlogIndex([{ slug: 'post', title: 'A [note]' }], 'ja').includes('[A \\[note\\]](/blog/post)'),
    );
  });
});
