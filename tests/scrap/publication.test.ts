import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildScrapSnapshot,
  parseCommentCandidate,
  parseCommentSource,
  parseIssueSource,
  parsePublicationPolicy,
  parseReactionSource,
  type ApprovalReaction,
  type CommentCandidate,
  type CommentId,
  type CommentSource,
  type ContentHash,
  type GitHubLogin,
  type GitHubUserId,
  type IsoTimestamp,
  type IssueSource,
  type PublicationPolicy,
  type ReactionSource,
  type ScrapId,
  type ScrapState,
  type ScrapCommentSnapshot,
  type ScrapSnapshot,
} from '../../src/scrap/publication.ts';

const OWNER_ID = 1;
const VISITOR_ID = 2;

function userIdFor(login: string): number {
  return login.toLowerCase() === 'owner' ? OWNER_ID : VISITOR_ID;
}

function issue(overrides: Record<string, unknown> = {}): IssueSource {
  return parseIssueSource({
    node_id: 'I_issue1',
    number: 1,
    title: 'First scrap',
    body: 'Issue body',
    user: { login: 'owner', id: OWNER_ID },
    state: 'open',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  });
}

function comment(id: number, overrides: Record<string, unknown> = {}): CommentSource {
  return parseCommentSource({
    id,
    node_id: `IC_comment${id}`,
    body: `Comment ${id}`,
    user: { login: `user-${id}`, id: 1000 + id },
    created_at: '2026-01-02T00:00:00Z',
    ...overrides,
  });
}

function reaction(login: string | null, content = 'rocket', id = login === null ? VISITOR_ID : userIdFor(login)): ReactionSource {
  return parseReactionSource({ content, user: login === null ? null : { login, id } });
}

function approved(source: CommentSource): CommentCandidate {
  return { comment: source, reactions: [reaction('owner')] };
}

const basePolicy: PublicationPolicy = parsePublicationPolicy({ ownerId: OWNER_ID });

const issueApproval = [reaction('owner')];

describe('parsePublicationPolicy', () => {
  it('defaults the approval reaction to rocket', () => {
    const policy = parsePublicationPolicy({ ownerId: OWNER_ID });
    assert.equal(policy.reaction, 'rocket');
  });

  it('keeps the immutable owner ID and normalizes the reaction', () => {
    const policy = parsePublicationPolicy({
      ownerId: 42,
      reaction: ' rocket ',
    });
    assert.equal(policy.ownerId, 42);
    assert.equal(policy.reaction, 'rocket');
  });

  it('rejects a missing or non-positive owner ID', () => {
    assert.throws(() => parsePublicationPolicy({}), { name: 'ValiError' });
    for (const ownerId of [0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
      assert.throws(() => parsePublicationPolicy({ ownerId }), { name: 'ValiError' }, String(ownerId));
    }
    assert.throws(() => parsePublicationPolicy({ ownerId: null as unknown as number }), {
      name: 'ValiError',
      message: /Expected \(number \| bigint\) but received null/,
    });
  });

  it('rejects a blank reaction', () => {
    for (const reactionValue of ['', '   ']) {
      assert.throws(() => parsePublicationPolicy({ ownerId: OWNER_ID, reaction: reactionValue }), {
        name: 'ValiError',
        message: /but received ""/,
      });
    }
  });
});

describe('buildScrapSnapshot publication decisions', () => {
  it('publishes an approved issue and only approved comments, with fields and order intact', () => {
    const snapshot: ScrapSnapshot | null = buildScrapSnapshot(
      {
        issue: issue(),
        issueReactions: [reaction('visitor'), reaction('owner')],
        comments: [
          approved(comment(30)),
          { comment: comment(20), reactions: [reaction('visitor'), reaction('owner', 'heart'), reaction(null)] },
          approved(comment(10, { user: null })),
        ],
      },
      basePolicy,
    );

    assert.ok(snapshot);
    assert.equal(snapshot.id, 'I_issue1');
    assert.equal(snapshot.issueNumber, 1);
    assert.equal(snapshot.title, 'First scrap');
    assert.equal(snapshot.body, 'Issue body');
    assert.equal(snapshot.author, 'owner');
    assert.equal(snapshot.createdAt, '2026-01-01T00:00:00Z');
    assert.equal(snapshot.state, 'open');
    const published: ScrapCommentSnapshot[] = snapshot.comments;
    assert.deepEqual(published, [
      { id: 'IC_comment10', body: 'Comment 10', author: null, createdAt: '2026-01-02T00:00:00Z' },
      { id: 'IC_comment30', body: 'Comment 30', author: 'user-30', createdAt: '2026-01-02T00:00:00Z' },
    ]);
  });

  it('returns null when the issue is unapproved even if comments are approved', () => {
    const snapshot = buildScrapSnapshot(
      {
        issue: issue(),
        issueReactions: [reaction('visitor')],
        comments: [approved(comment(10)), approved(comment(11))],
      },
      basePolicy,
    );
    assert.equal(snapshot, null);
  });

  it('ignores users other than the owner, the wrong reaction, and reactions without a user', () => {
    const disallowed = [reaction('visitor'), reaction('owner', 'heart'), reaction(null)];
    for (const candidate of disallowed) {
      assert.equal(
        buildScrapSnapshot({ issue: issue(), issueReactions: [candidate], comments: [] }, basePolicy),
        null,
      );
    }

    const snapshot = buildScrapSnapshot(
      {
        issue: issue(),
        issueReactions: issueApproval,
        comments: disallowed.map((candidate, index) => ({ comment: comment(index + 1), reactions: [candidate] })),
      },
      basePolicy,
    );
    assert.ok(snapshot);
    assert.deepEqual(snapshot.comments, []);
  });

  it('does not treat the issue or comment author as an approver', () => {
    const snapshot = buildScrapSnapshot(
      {
        issue: issue({ user: { login: 'visitor', id: VISITOR_ID } }),
        issueReactions: [reaction('owner')],
        comments: [
          { comment: comment(1, { user: { login: 'owner', id: OWNER_ID } }), reactions: [reaction('visitor')] },
          { comment: comment(2, { user: { login: 'visitor', id: VISITOR_ID } }), reactions: [reaction('owner')] },
        ],
      },
      basePolicy,
    );
    assert.ok(snapshot);
    assert.equal(snapshot.author, 'visitor');
    assert.deepEqual(snapshot.comments.map((publishedComment) => publishedComment.id), ['IC_comment2']);
  });

  it('authorizes by immutable owner ID, not by login', () => {
    const policy = parsePublicationPolicy({ ownerId: OWNER_ID });
    const snapshot = buildScrapSnapshot(
      {
        issue: issue(),
        issueReactions: [reaction('renamed-owner', 'rocket', OWNER_ID)],
        comments: [{ comment: comment(1), reactions: [reaction('owner', 'rocket', VISITOR_ID)] }],
      },
      policy,
    );
    assert.ok(snapshot);
    assert.deepEqual(snapshot.comments, []);
  });

  it('keeps approval after editing the issue or an approved comment', () => {
    const first = buildScrapSnapshot(
      {
        issue: issue(),
        issueReactions: issueApproval,
        comments: [approved(comment(10))],
      },
      basePolicy,
    );
    assert.ok(first);

    const edited = buildScrapSnapshot(
      {
        issue: issue({ title: 'Edited title', body: 'Edited body' }),
        issueReactions: issueApproval,
        comments: [approved(comment(10, { body: 'Edited comment' }))],
      },
      basePolicy,
    );
    assert.ok(edited);
    assert.equal(edited.title, 'Edited title');
    assert.equal(edited.body, 'Edited body');
    assert.equal(edited.comments[0]?.body, 'Edited comment');
  });

  it('keeps a closed issue published with state closed', () => {
    const snapshot = buildScrapSnapshot(
      {
        issue: issue({ state: 'closed' }),
        issueReactions: issueApproval,
        comments: [approved(comment(1))],
      },
      basePolicy,
    );
    assert.ok(snapshot);
    assert.equal(snapshot.state, 'closed');
    assert.equal(snapshot.comments.length, 1);
  });

  it('reflects current reactions: removing a comment approval drops it, removing the issue approval returns null', () => {
    const source = {
      issue: issue(),
      issueReactions: issueApproval,
      comments: [approved(comment(10)), approved(comment(11))],
    };

    const first = buildScrapSnapshot(source, basePolicy);
    assert.ok(first);
    assert.deepEqual(first.comments.map((publishedComment) => publishedComment.id), ['IC_comment10', 'IC_comment11']);

    const second = buildScrapSnapshot({
      ...source,
      comments: [
        { comment: comment(10), reactions: [] },
        approved(comment(11)),
      ],
    }, basePolicy);
    assert.ok(second);
    assert.deepEqual(second.comments.map((publishedComment) => publishedComment.id), ['IC_comment11']);

    const third = buildScrapSnapshot({ ...source, issueReactions: [] }, basePolicy);
    assert.equal(third, null);
  });

  it('does not duplicate output for duplicate approval reactions from the owner', () => {
    const snapshot = buildScrapSnapshot(
      {
        issue: issue(),
        issueReactions: [reaction('owner'), reaction('owner'), reaction('owner')],
        comments: [{ comment: comment(1), reactions: [reaction('owner'), reaction('owner')] }],
      },
      basePolicy,
    );
    assert.ok(snapshot);
    assert.equal(snapshot.comments.length, 1);
  });

  it('turns a null issue body into an empty string and keeps null authors null', () => {
    const snapshot = buildScrapSnapshot(
      {
        issue: issue({ body: null, user: null }),
        issueReactions: issueApproval,
        comments: [approved(comment(1, { user: null }))],
      },
      basePolicy,
    );
    assert.ok(snapshot);
    assert.equal(snapshot.body, '');
    assert.equal(snapshot.author, null);
    assert.equal(snapshot.comments[0]?.author, null);
  });
});

describe('buildScrapSnapshot content hash', () => {
  const source = {
    issue: issue(),
    issueReactions: issueApproval,
    comments: [approved(comment(10)), approved(comment(20))],
  };

  function hashOf(candidate = source): string {
    const snapshot = buildScrapSnapshot(candidate, basePolicy);
    assert.ok(snapshot);
    return snapshot.contentHash;
  }

  it('is stable across identical calls', () => {
    assert.equal(hashOf(), hashOf());
    assert.deepEqual(buildScrapSnapshot(source, basePolicy), buildScrapSnapshot(source, basePolicy));
  });

  it('changes after edits to the title, body, state, or a comment body', () => {
    const base = hashOf();
    const editedIssue = [
      issue({ title: 'Renamed scrap' }),
      issue({ body: 'Edited body' }),
      issue({ state: 'closed' }),
    ];
    for (const edited of editedIssue) {
      assert.notEqual(hashOf({ ...source, issue: edited }), base);
    }

    const editedComment = buildScrapSnapshot({
      ...source,
      comments: [approved(comment(10, { body: 'Corrected' })), approved(comment(20))],
    }, basePolicy);
    assert.ok(editedComment);
    assert.notEqual(editedComment.contentHash, base);
  });

  it('ignores unapproved comments and non-approving reactions', () => {
    const base = hashOf();
    const withNoise = hashOf({
      ...source,
      issueReactions: [reaction('owner'), reaction('visitor'), reaction('owner', 'heart'), reaction(null)],
      comments: [
        approved(comment(10)),
        approved(comment(20)),
        { comment: comment(30), reactions: [reaction('visitor'), reaction(null)] },
      ],
    });
    assert.equal(withNoise, base);
  });
});

describe('publication entry point', () => {
  it('exposes the schema parsers and the branded snapshot fields', () => {
    const policy: PublicationPolicy = parsePublicationPolicy({ ownerId: OWNER_ID });
    const ownerId: GitHubUserId = policy.ownerId;
    const approvalReaction: ApprovalReaction = policy.reaction;
    const issue: IssueSource = parseIssueSource({
      node_id: 'I_issue1',
      number: 1,
      title: 'Entry point',
      body: null,
      user: { login: 'owner', id: OWNER_ID },
      state: 'open',
      created_at: '2026-01-01T00:00:00Z',
    });
    const approval: ReactionSource = parseReactionSource({
      content: 'rocket',
      user: { login: 'Owner', id: OWNER_ID },
    });
    const commentSource: CommentSource = parseCommentSource({
      id: 1,
      node_id: 'IC_comment1',
      body: 'Hi',
      user: null,
      created_at: '2026-01-02T00:00:00Z',
    });
    const candidate: CommentCandidate = parseCommentCandidate({
      comment: commentSource,
      reactions: [approval],
    });

    const snapshot = buildScrapSnapshot(
      { issue, issueReactions: [approval], comments: [candidate] },
      policy,
    );
    assert.ok(snapshot);

    const id: ScrapId = snapshot.id;
    const commentId: CommentId = snapshot.comments[0]!.id;
    const author: GitHubLogin | null = snapshot.author;
    const createdAt: IsoTimestamp = snapshot.createdAt;
    const state: ScrapState = snapshot.state;
    const contentHash: ContentHash = snapshot.contentHash;

    assert.equal(id, 'I_issue1');
    assert.equal(commentId, 'IC_comment1');
    assert.equal(author, 'owner');
    assert.equal(createdAt, '2026-01-01T00:00:00Z');
    assert.equal(state, 'open');
    assert.match(contentHash, /^[\da-f]{64}$/);
    assert.equal(ownerId, OWNER_ID);
    assert.equal(approvalReaction, 'rocket');
  });
});
