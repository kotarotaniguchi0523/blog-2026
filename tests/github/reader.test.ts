import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { createEmulator, defineEmulator, type Emulator } from 'emulate';
import { createGitHubReader } from '../../src/github/reader.ts';
import { createReactionsEmulator, reaction } from './reactions-emulator.ts';

describe('GitHub reads against emulate built-in GitHub', () => {
  let github: Emulator;
  let reader: ReturnType<typeof createGitHubReader>;

  before(async () => {
    github = await createEmulator({
      service: 'github',
      port: 0,
      seed: {
        github: {
          users: [{ login: 'admin' }],
          repos: [{ owner: 'admin', name: 'blog', private: true }],
        },
      },
    });
    reader = createGitHubReader({
      owner: 'admin', repo: 'blog', token: 'test_token_admin', baseUrl: github.url,
    });
  });
  after(async () => { await github?.close(); });
  beforeEach(() => github.reset());

  // Mutations exist only in the test arrangement, never in the source reader.
  async function api(path: string, method = 'GET', body?: unknown) {
    const response = await fetch(`${github.url}${path}`, {
      method,
      headers: { authorization: 'token test_token_admin', 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    assert.ok(response.ok, `${method} ${path}: ${response.status} ${await response.clone().text()}`);
    return response;
  }

  async function createIssue(title = 'Draft scrap') {
    const response = await api('/repos/admin/blog/issues', 'POST', { title, body: 'Source text' });
    return await response.json() as { number: number; node_id: string };
  }

  it('reads unlabelled issues and follows Link pagination past 100 items', async () => {
    const expected = [];
    for (let index = 0; index < 101; index++) expected.push(await createIssue(`Scrap ${index}`));
    const issues = await reader.listIssues();
    assert.equal(issues.length, 101);
    assert.deepEqual(new Set(issues.map((issue) => issue.node_id)), new Set(expected.map((issue) => issue.node_id)));
    assert.ok(issues.every((issue) => issue.labels.length === 0));
  });

  it('retains a closed issue, then observes reopen and body edits with stable node_id', async () => {
    const issue = await createIssue();
    await api(`/repos/admin/blog/issues/${issue.number}`, 'PATCH', { state: 'closed', body: 'Edited' });
    const closed = await reader.listIssues();
    assert.equal(closed[0]?.state, 'closed');
    assert.equal(closed[0]?.body, 'Edited');
    assert.equal(closed[0]?.node_id, issue.node_id);
    await api(`/repos/admin/blog/issues/${issue.number}`, 'PATCH', { state: 'open' });
    assert.equal((await reader.getIssue(issue.number)).state, 'open');
  });

  it('reads all comments across pages and observes edits and deletion', async () => {
    const issue = await createIssue();
    const expected: number[] = [];
    for (let index = 0; index < 101; index++) {
      const response = await api(`/repos/admin/blog/issues/${issue.number}/comments`, 'POST', { body: `Comment ${index}` });
      const comment = await response.json() as { id: number };
      expected.push(comment.id);
    }
    const comments = await reader.listComments(issue.number);
    assert.deepEqual(comments.map((comment) => comment.id), expected);
    const firstId = expected[0]!;
    await api(`/repos/admin/blog/issues/comments/${firstId}`, 'PATCH', { body: 'Corrected' });
    assert.equal((await reader.listComments(issue.number))[0]?.body, 'Corrected');
    await api(`/repos/admin/blog/issues/comments/${firstId}`, 'DELETE');
    assert.deepEqual((await reader.listComments(issue.number)).map((comment) => comment.id), expected.slice(1));
  });

  it('preserves a 404 error instead of returning an empty successful result', async () => {
    await assert.rejects(reader.getIssue(9999), { status: 404 });
  });

  it('records the built-in emulator limitation: no Reactions API in 0.12.3', async () => {
    const issue = await createIssue();
    await assert.rejects(reader.listIssueReactions(issue.number), { status: 404 });
  });
});

describe('GitHub reactions against a test-owned emulate custom API', () => {
  it('reads all actors/types across pages without deciding who may publish', async () => {
    const rows = Array.from({ length: 101 }, (_, index) => reaction(index + 1, `visitor-${index}`));
    rows.push(reaction(102, 'owner'), reaction(103, 'owner', 'eyes'));
    const github = await createReactionsEmulator({ issues: { '1': rows } });
    try {
      const reader = createGitHubReader({ owner: 'owner', repo: 'blog', token: 'local-test-token', baseUrl: github.url });
      const actual = await reader.listIssueReactions(1);
      assert.equal(actual.length, 103);
      assert.equal(actual[101]?.user?.login, 'owner');
      assert.equal(actual[102]?.content, 'eyes');
      assert.deepEqual(actual.map((item) => item.id), rows.map((item) => item.id));
    } finally { await github.close(); }
  });

  it('keeps issue/comment approval data separate and observes reaction removal', async () => {
    const github = await createReactionsEmulator({
      issues: { '1': [reaction(1, 'visitor')] },
      comments: { '42': [reaction(2, 'owner')] },
    });
    try {
      const reader = createGitHubReader({ owner: 'owner', repo: 'blog', token: 'local-test-token', baseUrl: github.url });
      assert.equal((await reader.listIssueReactions(1))[0]?.user?.login, 'visitor');
      assert.equal((await reader.listCommentReactions(42))[0]?.user?.login, 'owner');
      const snapshot = github.snapshot();
      snapshot.state.comments['42'] = [];
      await github.restore(snapshot);
      assert.deepEqual(await reader.listCommentReactions(42), []);
      assert.equal((await reader.listIssueReactions(1)).length, 1);
    } finally { await github.close(); }
  });

  it('rejects the entire paginated read on a later rate-limit failure', async () => {
    const github = await createReactionsEmulator({
      issues: { '1': Array.from({ length: 101 }, (_, index) => reaction(index + 1, 'owner')) },
      failPage: 2,
    });
    try {
      const reader = createGitHubReader({ owner: 'owner', repo: 'blog', token: 'local-test-token', baseUrl: github.url });
      await assert.rejects(reader.listIssueReactions(1), { status: 403 });
    } finally { await github.close(); }
  });
});

it('excludes PRs from GitHub-shaped issue responses (custom contract fixture)', async () => {
  // Built-in emulate omits PRs from its list response, unlike GitHub's contract.
  const github = await createEmulator({
    service: defineEmulator({
      name: 'github-issue-pr-contract',
      state: () => ({}),
      setup({ app }) {
        const issue = { number: 1, node_id: 'issue-1' };
        const pr = { number: 2, node_id: 'pr-2', pull_request: { url: 'https://example.invalid/pr/2' } };
        app.get('/repos/owner/blog/issues', (c) => c.json([issue, pr]));
        app.get('/repos/owner/blog/issues/2', (c) => c.json(pr));
      },
    }),
    port: 0,
  });
  try {
    const reader = createGitHubReader({ owner: 'owner', repo: 'blog', baseUrl: github.url });
    assert.deepEqual((await reader.listIssues()).map((issue) => issue.node_id), ['issue-1']);
    await assert.rejects(reader.getIssue(2), /Pull requests are not Scrap sources/);
  } finally { await github.close(); }
});
