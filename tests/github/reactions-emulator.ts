import { createEmulator, defineEmulator } from 'emulate';

export interface TestReaction {
  id: number;
  node_id: string;
  content: string;
  user: { id: number; login: string } | null;
  created_at: string;
}

interface ReactionState {
  issues: Record<string, TestReaction[]>;
  comments: Record<string, TestReaction[]>;
  failPage: number | null;
}

/**
 * Test-owned subset of the GitHub REST contract, NOT emulate's built-in GitHub.
 * emulate 0.12.3 has no Reactions API routes. Its official custom API runs these
 * fixtures; passing here does not establish parity with GitHub's implementation.
 */
const reactions = defineEmulator({
  name: 'github-reactions-test',
  state: (): ReactionState => ({ issues: {}, comments: {}, failPage: null }),
  setup({ app, state }) {
    app.get('/repos/owner/blog/issues/:number/reactions', (c) =>
      page(c.req.raw, state.issues[c.req.param('number')], state.failPage),
    );
    app.get('/repos/owner/blog/issues/comments/:id/reactions', (c) =>
      page(c.req.raw, state.comments[c.req.param('id')], state.failPage),
    );
  },
});

function page(request: Request, rows: TestReaction[] | undefined, failPage: number | null) {
  if (request.headers.get('authorization') !== 'token local-test-token') {
    return Response.json({ message: 'Bad credentials' }, { status: 401 });
  }
  if (!rows) return Response.json({ message: 'Not Found' }, { status: 404 });
  const url = new URL(request.url);
  const current = Number(url.searchParams.get('page') ?? 1);
  const size = Number(url.searchParams.get('per_page') ?? 30);
  if (current === failPage) {
    return Response.json({ message: 'API rate limit exceeded' }, {
      status: 403,
      headers: { 'x-ratelimit-remaining': '0', 'retry-after': '60' },
    });
  }
  const headers = new Headers();
  if (current * size < rows.length) {
    url.searchParams.set('page', String(current + 1));
    headers.set('link', `<${url}>; rel="next"`);
  }
  return Response.json(rows.slice((current - 1) * size, current * size), { headers });
}

export function createReactionsEmulator(seed: Partial<ReactionState> = {}) {
  return createEmulator({
    service: reactions,
    port: 0,
    seed: { issues: {}, comments: {}, failPage: null, ...seed },
  });
}

export function reaction(id: number, login: string, content = 'rocket'): TestReaction {
  return {
    id,
    node_id: `reaction-${id}`,
    content,
    user: { id, login },
    created_at: '2026-10-28T00:00:00Z',
  };
}
