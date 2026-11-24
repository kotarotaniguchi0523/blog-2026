import { createEmulator, defineEmulator } from 'emulate';

const ISSUE_ID = 'I_graphql_issue1';

const issueReactions = {
  nodes: [
    { content: 'ROCKET', user: { databaseId: 1, login: 'owner' } },
    { content: 'HEART', user: { databaseId: 2, login: 'visitor' } },
  ],
  pageInfo: { hasNextPage: true, endCursor: 'issue-reactions-1' },
};

const firstComment = {
  id: 'IC_graphql_comment10',
  databaseId: 10,
  body: 'Approved comment',
  createdAt: '2026-01-02T00:00:00Z',
  author: { login: 'user-10' },
  reactions: {
    nodes: [{ content: 'ROCKET', user: { databaseId: 1, login: 'owner' } }],
    pageInfo: { hasNextPage: false, endCursor: null },
  },
};

const secondComment = {
  id: 'IC_graphql_comment20',
  databaseId: 20,
  body: 'Unapproved comment',
  createdAt: '2026-01-03T00:00:00Z',
  author: { login: 'user-20' },
  reactions: {
    nodes: [{ content: 'HEART', user: { databaseId: 2, login: 'visitor' } }],
    pageInfo: { hasNextPage: false, endCursor: null },
  },
};

const thirdComment = {
  id: 'IC_graphql_comment30',
  databaseId: 30,
  body: 'Approved on page two',
  createdAt: '2026-01-04T00:00:00Z',
  author: { login: 'user-30' },
  reactions: {
    nodes: [{ content: 'ROCKET', user: { databaseId: 1, login: 'owner' } }],
    pageInfo: { hasNextPage: false, endCursor: null },
  },
};

function threadPage(comments: unknown[], pageInfo: { hasNextPage: boolean; endCursor: string | null }) {
  return {
    repository: {
      issue: {
        id: ISSUE_ID,
        number: 1,
        title: 'GraphQL scrap',
        body: 'Issue body',
        state: 'OPEN',
        createdAt: '2026-01-01T00:00:00Z',
        author: { login: 'owner' },
        reactions: issueReactions,
        comments: { nodes: comments, pageInfo },
      },
    },
  };
}

const graphql = defineEmulator({
  name: 'github-graphql-test',
  state: () => ({ requests: 0 }),
  setup({ app, state }) {
    app.post('/graphql', async (c) => {
      state.requests += 1;
      if (c.req.raw.headers.get('authorization') !== 'token local-test-token') {
        return Response.json({ message: 'Bad credentials' }, { status: 401 });
      }

      const body = await c.req.json() as {
        query: string;
        variables?: { commentsAfter?: string | null };
      };

      if (body.query.includes('ScrapReactionPage')) {
        return Response.json({
          data: {
            node: {
              reactions: {
                nodes: [{ content: 'EYES', user: { databaseId: 3, login: 'third' } }],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        });
      }

      if (!body.query.includes('ScrapThread')) {
        return Response.json({ errors: [{ message: 'Unknown query' }] }, { status: 400 });
      }

      if (body.variables?.commentsAfter === 'comments-1') {
        return Response.json({
          data: threadPage([thirdComment], { hasNextPage: false, endCursor: null }),
        });
      }

      return Response.json({
        data: threadPage(
          [firstComment, secondComment],
          { hasNextPage: true, endCursor: 'comments-1' },
        ),
      });
    });
  },
});

export function createGraphqlEmulator() {
  return createEmulator({ service: graphql, port: 0 });
}
