import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  parseCommentCandidate,
  parseCommentSource,
  parseIssueSource,
  parsePublicationPolicy,
  parseReactionSource,
  type CommentId,
  type ContentHash,
  type GitHubLogin,
  type GitHubUserId,
  type IsoTimestamp,
  type ScrapId,
} from '../../src/scrap/schema.ts';

const issuePayload = {
  node_id: 'I_issue1',
  number: 1,
  title: 'First scrap',
  body: 'Issue body',
  user: { login: 'Owner', id: 1, site_admin: false },
  state: 'open',
  created_at: '2026-01-01T00:00:00Z',
  labels: [],
  html_url: 'https://github.com/owner/blog/issues/1',
};

const commentPayload = {
  id: 42,
  node_id: 'IC_comment42',
  body: 'Comment body',
  user: { login: 'user-42', id: 42, type: 'User' },
  created_at: '2026-01-02T00:00:00Z',
  issue_url: 'https://github.com/owner/blog/issues/1',
};

describe('source schemas accept Octokit shapes', () => {
  it('parses an issue, a comment, and a reaction while stripping unknown fields', () => {
    const issue = parseIssueSource(issuePayload);
    assert.equal(issue.node_id, 'I_issue1');
    assert.equal(issue.number, 1);
    assert.equal(issue.title, 'First scrap');
    assert.equal(issue.body, 'Issue body');
    assert.equal(issue.user?.id, 1);
    assert.equal(issue.user?.login, 'Owner');
    assert.equal(issue.state, 'open');
    assert.equal(issue.created_at, '2026-01-01T00:00:00Z');
    assert.deepEqual(Object.keys(issue).sort(), [
      'body', 'created_at', 'node_id', 'number', 'state', 'title', 'user',
    ]);

    const comment = parseCommentSource(commentPayload);
    assert.equal(comment.id, 42);
    assert.equal(comment.node_id, 'IC_comment42');
    assert.equal(comment.body, 'Comment body');
    assert.equal(comment.user?.id, 42);
    assert.equal(comment.user?.login, 'user-42');
    assert.equal(comment.created_at, '2026-01-02T00:00:00Z');
    assert.deepEqual(Object.keys(comment).sort(), ['body', 'created_at', 'id', 'node_id', 'user']);

    const reaction = parseReactionSource({
      id: 7, content: '+1', user: { login: 'owner', id: 1 }, created_at: '2026-01-03T00:00:00Z',
    });
    assert.equal(reaction.content, '+1');
    assert.equal(reaction.user?.id, 1);
    assert.equal(reaction.user?.login, 'owner');
    assert.deepEqual(Object.keys(reaction).sort(), ['content', 'user']);
  });

  it('does not require author IDs because authors are display data', () => {
    const issue = parseIssueSource({ ...issuePayload, user: { login: 'Owner' } });
    const comment = parseCommentSource({ ...commentPayload, user: { login: 'user-42' } });
    assert.equal(issue.user?.id, undefined);
    assert.equal(comment.user?.id, undefined);
  });

  it('defaults a missing issue body to null and keeps an explicit null', () => {
    const { body: _body, ...withoutBody } = issuePayload;
    assert.equal(parseIssueSource(withoutBody).body, null);
    assert.equal(parseIssueSource({ ...issuePayload, body: null }).body, null);
  });

  it('requires a comment body but accepts an empty one', () => {
    const { body: _body, ...withoutBody } = commentPayload;
    assert.throws(() => parseCommentSource(withoutBody), { name: 'ValiError' });
    assert.equal(parseCommentSource({ ...commentPayload, body: '' }).body, '');
  });
});

describe('source schemas reject malformed input', () => {
  it('rejects issue states outside open and closed', () => {
    assert.throws(() => parseIssueSource({ ...issuePayload, state: 'locked' }), { name: 'ValiError' });
  });

  it('rejects missing, empty, and whitespace-only node IDs', () => {
    const { node_id: _nodeId, ...withoutNodeId } = issuePayload;
    for (const nodeId of [undefined, '', '   ', 'I_issue 1']) {
      assert.throws(() => parseIssueSource({ ...withoutNodeId, node_id: nodeId }), { name: 'ValiError' });
    }
    assert.throws(
      () => parseCommentSource({ ...commentPayload, node_id: 'IC comment' }),
      { name: 'ValiError' },
    );
  });

  it('rejects malformed timestamps and accepts Z and offset forms', () => {
    for (const createdAt of ['2026-01-01', 'not a date', '2026-13-01T00:00:00Z']) {
      assert.throws(() => parseIssueSource({ ...issuePayload, created_at: createdAt }), { name: 'ValiError' });
    }
    assert.equal(parseIssueSource(issuePayload).created_at, '2026-01-01T00:00:00Z');
    assert.equal(
      parseIssueSource({ ...issuePayload, created_at: '2026-01-01T09:00:00+09:00' }).created_at,
      '2026-01-01T09:00:00+09:00',
    );
  });

  it('rejects zero, negative, fractional, NaN, and unsafe IDs but normalizes bigints', () => {
    const invalid = [0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1, 2n ** 53n];
    for (const value of invalid) {
      assert.throws(() => parseIssueSource({ ...issuePayload, number: value }), { name: 'ValiError' }, String(value));
      assert.throws(() => parseCommentSource({ ...commentPayload, id: value }), { name: 'ValiError' }, String(value));
      assert.throws(
        () => parseIssueSource({ ...issuePayload, user: { login: 'owner', id: value } }),
        { name: 'ValiError' },
        String(value),
      );
    }
    assert.equal(parseIssueSource({ ...issuePayload, number: 42n }).number, 42);
    assert.equal(parseCommentSource({ ...commentPayload, id: 42n }).id, 42);
    assert.equal(
      parseIssueSource({ ...issuePayload, user: { login: 'owner', id: 42n } }).user?.id,
      42,
    );
  });

  it('accepts any reaction name but never an empty one, and accepts bot and null users', () => {
    assert.throws(() => parseReactionSource({ content: '', user: null }), { name: 'ValiError' });
    assert.equal(
      parseReactionSource({ content: 'sparkles', user: { login: 'dependabot[bot]', id: 7 } }).user?.login,
      'dependabot[bot]',
    );
    assert.equal(parseReactionSource({ content: 'rocket', user: null }).user, null);
    assert.throws(
      () => parseReactionSource({ content: 'rocket', user: { login: 'owner' } }),
      { name: 'ValiError' },
    );
  });
});

describe('parsePublicationPolicy', () => {
  it('defaults to rocket and keeps the immutable owner ID', () => {
    const policy = parsePublicationPolicy({ ownerId: 1 });
    assert.equal(policy.reaction, 'rocket');
    assert.equal(policy.ownerId, 1);
  });

  it('normalizes the approval reaction name', () => {
    assert.equal(parsePublicationPolicy({ ownerId: 1, reaction: 'Rocket' }).reaction, 'rocket');
    assert.equal(parsePublicationPolicy({ ownerId: 1, reaction: ' rocket ' }).reaction, 'rocket');
    assert.equal(parsePublicationPolicy({ ownerId: 1, reaction: '+1' }).reaction, '+1');
  });

  it('requires a positive safe owner ID', () => {
    assert.throws(() => parsePublicationPolicy({}), { name: 'ValiError' });
    for (const ownerId of [undefined, 0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1, 2n ** 53n]) {
      assert.throws(() => parsePublicationPolicy({ ownerId }), { name: 'ValiError' }, String(ownerId));
    }
    assert.throws(
      () => parsePublicationPolicy({ ownerId: null as unknown as number }),
      { name: 'ValiError' },
    );
    assert.equal(parsePublicationPolicy({ ownerId: 1n }).ownerId, 1);
  });

  it('rejects reactions outside the GitHub reaction set', () => {
    assert.throws(() => parsePublicationPolicy({ ownerId: 1, reaction: '🚀' }), { name: 'ValiError' });
  });

  it('rejects unknown policy keys instead of silently using defaults', () => {
    assert.throws(
      () => parsePublicationPolicy({ ownerId: 1, reactionn: 'heart' }),
      { name: 'ValiError' },
    );
    assert.throws(
      () => parsePublicationPolicy({ ownerId: 1, approvers: ['owner', 'visitor'] }),
      { name: 'ValiError' },
    );
    assert.throws(
      () => parsePublicationPolicy({ owner: 'owner' }),
      { name: 'ValiError' },
    );
  });
});

describe('parseCommentCandidate', () => {
  it('parses the comment and every reaction attached to it', () => {
    const candidate = parseCommentCandidate({
      comment: commentPayload,
      reactions: [
        { content: 'rocket', user: { login: 'owner', id: 1 } },
        { content: 'eyes', user: { login: 'dependabot[bot]', id: 7 } },
      ],
      unexpected: 'stripped',
    });
    assert.equal(candidate.comment.node_id, 'IC_comment42');
    assert.deepEqual(candidate.reactions.map((item) => item.content), ['rocket', 'eyes']);
    assert.deepEqual(candidate.reactions.map((item) => item.user?.id), [1, 7]);
    assert.deepEqual(candidate.reactions.map((item) => item.user?.login), ['owner', 'dependabot[bot]']);
    assert.deepEqual(Object.keys(candidate).sort(), ['comment', 'reactions']);
  });

  it('rejects a bad reaction inside the candidate', () => {
    assert.throws(
      () => parseCommentCandidate({ comment: commentPayload, reactions: [{ content: '', user: null }] }),
      { name: 'ValiError' },
    );
  });
});

describe('brands are not interchangeable (compiled by pnpm types:check)', () => {
  it('rejects raw values and other brands at compile time', () => {
    const raw = 'I_issue1';
    const rawNumber = 1;
    // @ts-expect-error a raw string is not a ScrapId
    const scrapId: ScrapId = raw;
    const commentId: CommentId = parseCommentSource(commentPayload).node_id;
    // @ts-expect-error a CommentId cannot stand in for a ScrapId
    const crossedId: ScrapId = commentId;
    // @ts-expect-error a raw string is not an IsoTimestamp
    const timestamp: IsoTimestamp = raw;
    // @ts-expect-error a raw string is not a GitHubLogin
    const login: GitHubLogin = raw;
    // @ts-expect-error a raw number is not a GitHubUserId
    const userId: GitHubUserId = rawNumber;
    // @ts-expect-error a raw string is not a ContentHash
    const contentHash: ContentHash = raw;
    assert.equal(scrapId, raw);
    assert.equal(crossedId, commentId);
    assert.equal(timestamp, raw);
    assert.equal(login, raw);
    assert.equal(userId, rawNumber);
    assert.equal(contentHash, raw);
  });
});
