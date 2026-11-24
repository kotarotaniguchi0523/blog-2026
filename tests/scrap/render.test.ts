import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildScrapSnapshot,
  parseCommentCandidate,
  parseIssueSource,
  parsePublicationPolicy,
  parseReactionSource,
  type ScrapSnapshot,
} from '../../src/scrap/publication.ts';
import {
  GENERATED_MARKER,
  renderScrapIndex,
  renderScrapPage,
  scrapSlug,
} from '../../src/scrap/render.ts';

const policy = parsePublicationPolicy({ ownerId: 1 });
const approval = parseReactionSource({
  content: 'rocket',
  user: { login: 'owner', id: 1 },
});

function snapshot(overrides: {
  id?: string;
  number?: number;
  title?: string;
  body?: string | null;
  createdAt?: string;
  state?: 'open' | 'closed';
  comments?: Array<{ id: number; body: string; login: string; createdAt: string }>;
} = {}): ScrapSnapshot {
  const result = buildScrapSnapshot(
    {
      issue: parseIssueSource({
        node_id: overrides.id ?? 'I_scrap1',
        number: overrides.number ?? 7,
        title: overrides.title ?? 'First scrap',
        body: overrides.body === undefined ? 'The issue body.' : overrides.body,
        user: { login: 'owner', id: 1 },
        state: overrides.state ?? 'open',
        created_at: overrides.createdAt ?? '2026-01-01T00:00:00Z',
      }),
      issueReactions: [approval],
      comments: (overrides.comments ?? []).map((comment) =>
        parseCommentCandidate({
          comment: {
            id: comment.id,
            node_id: `IC_comment${comment.id}`,
            body: comment.body,
            user: { login: comment.login },
            created_at: comment.createdAt,
          },
          reactions: [approval],
        })),
    },
    policy,
  );
  assert.ok(result);
  return result;
}

describe('scrapSlug', () => {
  it('keeps GitHub node IDs and rejects unsafe path segments', () => {
    assert.equal(scrapSlug('I_abc-123'), 'I_abc-123');
    for (const value of ['', '../escape', 'a/b', 'I scrap', 'I_scrap?x=1']) {
      assert.throws(() => scrapSlug(value), { name: 'TypeError' }, value);
    }
  });
});

describe('renderScrapIndex', () => {
  it('renders the empty state with the generated marker', () => {
    const output = renderScrapIndex([], { owner: 'owner', repo: 'blog', language: 'ja' });
    assert.match(output, /title: "Scrap"/);
    assert.match(output, /^---$/m);
    assert.ok(output.includes('status: published'));
    assert.ok(output.includes(GENERATED_MARKER));
    assert.ok(output.includes('まだ Scrap はありません。'));
  });

  it('sorts newest first and escapes link text', () => {
    const older = snapshot({
      id: 'I_older',
      number: 1,
      title: 'Older',
      createdAt: '2026-01-01T00:00:00Z',
    });
    const newer = snapshot({
      id: 'I_newer',
      number: 2,
      title: 'Newer [draft]',
      createdAt: '2026-02-01T00:00:00Z',
      comments: [
        { id: 1, body: 'One', login: 'user-1', createdAt: '2026-02-02T00:00:00Z' },
        { id: 2, body: 'Two', login: 'user-2', createdAt: '2026-02-03T00:00:00Z' },
      ],
    });

    const output = renderScrapIndex([older, newer], {
      owner: 'owner',
      repo: 'blog',
      language: 'en',
    });

    assert.ok(output.indexOf('Newer \\[draft\\]') < output.indexOf('Older'));
    assert.ok(output.includes('- [Newer \\[draft\\]](/en/scraps/I_newer) — [@owner](https://github.com/owner) · 2026-02-01 · Open · 2 comments'));
    assert.ok(output.includes('- [Older](/en/scraps/I_older) — [@owner](https://github.com/owner) · 2026-01-01 · Open · 0 comments'));
  });
});

describe('renderScrapPage', () => {
  it('renders the issue, approved comments, and GitHub links', () => {
    const output = renderScrapPage(
      snapshot({
        title: 'A title',
        body: 'Issue body.',
        comments: [
          { id: 10, body: 'First comment.', login: 'user-10', createdAt: '2026-01-02T00:00:00Z' },
          { id: 20, body: 'Second comment.', login: 'user-20', createdAt: '2026-01-03T00:00:00Z' },
        ],
      }),
      { owner: 'owner', repo: 'blog', language: 'en' },
    );

    assert.match(output, /title: "A title"/);
    assert.ok(output.includes('status: published'));
    assert.ok(output.includes(GENERATED_MARKER));
    assert.ok(output.includes('[View on GitHub](https://github.com/owner/blog/issues/7)'));
    assert.ok(output.includes('[@owner](https://github.com/owner)'));
    assert.ok(output.includes('Issue body.'));
    assert.ok(output.includes('## Comments'));
    assert.ok(output.includes('### [@user-10](https://github.com/user-10) · 2026-01-02'));
    assert.ok(output.includes('First comment.'));
    assert.ok(output.indexOf('First comment.') < output.indexOf('Second comment.'));
  });

  it('renders Japanese labels and empty states', () => {
    const output = renderScrapPage(
      snapshot({ body: null, comments: [] }),
      { owner: 'owner', repo: 'blog', language: 'ja' },
    );

    assert.ok(output.includes('## コメント'));
    assert.ok(output.includes('本文はありません。'));
    assert.ok(output.includes('コメントはまだありません。'));
    assert.ok(output.includes('状態: オープン'));
  });

  it('renders a closed thread without treating it as unpublished', () => {
    const output = renderScrapPage(
      snapshot({ state: 'closed' }),
      { owner: 'owner', repo: 'blog', language: 'en' },
    );
    assert.ok(output.includes('State: Closed'));
  });
});
