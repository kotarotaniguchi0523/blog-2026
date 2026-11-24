import { Octokit } from '@octokit/core';
import { paginateRest } from '@octokit/plugin-paginate-rest';

const PaginatedOctokit = Octokit.plugin(paginateRest);

/** A single GitHub path segment; rejects empty names and `.` / `..`. */
const GITHUB_NAME_PATTERN = /^(?!\.{1,2}$)[A-Za-z0-9_.-]+$/;

const SCRAP_THREAD_QUERY = `
  query ScrapThread(
    $owner: String!
    $repo: String!
    $number: Int!
    $commentsAfter: String
  ) {
    repository(owner: $owner, name: $repo) {
      issue(number: $number) {
        id
        number
        title
        body
        state
        createdAt
        author { login }
        reactions(first: 100) {
          nodes { content user { databaseId login } }
          pageInfo { hasNextPage endCursor }
        }
        comments(first: 100, after: $commentsAfter) {
          nodes {
            id
            databaseId
            body
            createdAt
            author { login }
            reactions(first: 100) {
              nodes { content user { databaseId login } }
              pageInfo { hasNextPage endCursor }
            }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    }
  }
`;

const REACTION_PAGE_QUERY = `
  query ScrapReactionPage($id: ID!, $after: String) {
    node(id: $id) {
      ... on Reactable {
        reactions(first: 100, after: $after) {
          nodes { content user { databaseId login } }
          pageInfo { hasNextPage endCursor }
        }
      }
    }
  }
`;

interface GitHubScrapReactionSource {
  content: string;
  user: { id: number; login: string } | null;
}

interface GitHubScrapCommentSource {
  comment: {
    id: number;
    node_id: string;
    body: string;
    user: { login: string } | null;
    created_at: string;
  };
  reactions: GitHubScrapReactionSource[];
}

export interface GitHubScrapThreadSource {
  issue: {
    node_id: string;
    number: number;
    title: string;
    body: string | null;
    user: { login: string } | null;
    state: 'open' | 'closed';
    created_at: string;
  };
  issueReactions: GitHubScrapReactionSource[];
  comments: GitHubScrapCommentSource[];
}

type GraphQLReactionContent =
  | 'CONFUSED'
  | 'EYES'
  | 'HEART'
  | 'HOORAY'
  | 'LAUGH'
  | 'ROCKET'
  | 'THUMBS_DOWN'
  | 'THUMBS_UP';

const REACTION_CONTENT_BY_GRAPHQL: Record<GraphQLReactionContent, string> = {
  CONFUSED: 'confused',
  EYES: 'eyes',
  HEART: 'heart',
  HOORAY: 'hooray',
  LAUGH: 'laugh',
  ROCKET: 'rocket',
  THUMBS_DOWN: '-1',
  THUMBS_UP: '+1',
};

interface GraphQLReaction {
  content: GraphQLReactionContent;
  user: { databaseId: number | null; login: string } | null;
}

interface GraphQLReactionConnection {
  nodes: GraphQLReaction[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
}

interface GraphQLIssueComment {
  id: string;
  databaseId: number | null;
  body: string;
  createdAt: string;
  author: { login: string } | null;
  reactions: GraphQLReactionConnection;
}

interface GraphQLIssue {
  id: string;
  number: number;
  title: string;
  body: string | null;
  state: 'OPEN' | 'CLOSED';
  createdAt: string;
  author: { login: string } | null;
  reactions: GraphQLReactionConnection;
  comments: {
    nodes: GraphQLIssueComment[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
}

interface ScrapThreadQueryData {
  repository: { issue: GraphQLIssue | null } | null;
}

interface ReactionPageQueryData {
  node: { reactions: GraphQLReactionConnection } | null;
}

export interface GitHubReaderOptions {
  owner: string;
  repo: string;
  token?: string;
  /** Override only for GitHub Enterprise or a local emulator. */
  baseUrl?: string;
}

/** Server/job-side reads only. Returned data is unapproved source material. */
export function createGitHubReader(options: GitHubReaderOptions) {
  const { owner, repo } = options;
  assertGitHubName(owner, 'owner');
  assertGitHubName(repo, 'repo');
  const client = new PaginatedOctokit({
    auth: options.token,
    baseUrl: options.baseUrl,
    userAgent: 'blog-2026-github-reader',
  });
  const repository = { owner, repo, per_page: 100 };

  async function readReactions(
    reactableId: string,
    connection: GraphQLReactionConnection,
  ): Promise<GitHubScrapReactionSource[]> {
    const reactions = connection.nodes.map(mapReaction);
    let pageInfo = connection.pageInfo;

    while (pageInfo.hasNextPage) {
      if (!pageInfo.endCursor) {
        throw new TypeError(`GitHub did not return a reaction cursor for ${reactableId}.`);
      }
      const data = await client.graphql<ReactionPageQueryData>(REACTION_PAGE_QUERY, {
        id: reactableId,
        after: pageInfo.endCursor,
      });
      const next = data.node?.reactions;
      if (!next) throw new TypeError(`GitHub reactions were not found for ${reactableId}.`);
      reactions.push(...next.nodes.map(mapReaction));
      pageInfo = next.pageInfo;
    }

    return reactions;
  }

  return {
    async listIssues() {
      // Include closed issues and issues without labels. Close is not unpublish.
      // GitHub's Issues endpoint also returns PRs; those are not Scrap sources.
      const issues = await client.paginate('GET /repos/{owner}/{repo}/issues', {
        ...repository,
        state: 'all',
        sort: 'created',
        direction: 'asc',
      });
      return issues.filter((issue) => !issue.pull_request);
    },

    async getIssue(issueNumber: number) {
      assertId(issueNumber);
      const { data } = await client.request('GET /repos/{owner}/{repo}/issues/{issue_number}', {
        owner,
        repo,
        issue_number: issueNumber,
      });
      if (data.pull_request) throw new TypeError('Pull requests are not Scrap sources.');
      return data;
    },

    async listComments(issueNumber: number) {
      assertId(issueNumber);
      // This endpoint returns comments in ascending ID order (GitHub's contract).
      return client.paginate('GET /repos/{owner}/{repo}/issues/{issue_number}/comments', {
        ...repository,
        issue_number: issueNumber,
      });
    },

    async listIssueReactions(issueNumber: number) {
      assertId(issueNumber);
      return client.paginate('GET /repos/{owner}/{repo}/issues/{issue_number}/reactions', {
        ...repository,
        issue_number: issueNumber,
      });
    },

    /** Lists every reaction on one comment; the comment body itself is not returned here. */
    async listCommentReactions(commentId: number) {
      assertId(commentId);
      return client.paginate('GET /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions', {
        ...repository,
        comment_id: commentId,
      });
    },

    /**
     * Fetches one Scrap thread with GraphQL so comments and their reactions are
     * batched by page instead of one REST reaction request per comment.
     */
    async getScrapThread(issueNumber: number): Promise<GitHubScrapThreadSource> {
      assertId(issueNumber);
      const comments: GitHubScrapCommentSource[] = [];
      let issue: GraphQLIssue | null = null;
      let issueReactions: GitHubScrapReactionSource[] = [];
      let commentsAfter: string | null = null;

      do {
        const data: ScrapThreadQueryData = await client.graphql<ScrapThreadQueryData>(SCRAP_THREAD_QUERY, {
          owner,
          repo,
          number: issueNumber,
          commentsAfter,
        });
        const current: GraphQLIssue | null = data.repository?.issue ?? null;
        if (!current) throw new TypeError(`Scrap issue #${issueNumber} was not found.`);

        if (!issue) {
          issue = current;
          issueReactions = await readReactions(current.id, current.reactions);
        }

        for (const comment of current.comments.nodes) {
          comments.push({
            comment: {
              id: requireDatabaseId(comment.databaseId, comment.id),
              node_id: comment.id,
              body: comment.body,
              user: mapAuthor(comment.author),
              created_at: comment.createdAt,
            },
            reactions: await readReactions(comment.id, comment.reactions),
          });
        }

        if (current.comments.pageInfo.hasNextPage && !current.comments.pageInfo.endCursor) {
          throw new TypeError(`GitHub did not return a comment cursor for issue #${issueNumber}.`);
        }
        commentsAfter = current.comments.pageInfo.hasNextPage
          ? current.comments.pageInfo.endCursor
          : null;
      } while (commentsAfter);

      if (!issue) throw new TypeError(`Scrap issue #${issueNumber} was not found.`);

      return {
        issue: {
          node_id: issue.id,
          number: issue.number,
          title: issue.title,
          body: issue.body,
          user: mapAuthor(issue.author),
          state: issue.state === 'OPEN' ? 'open' : 'closed',
          created_at: issue.createdAt,
        },
        issueReactions,
        comments,
      };
    },
  };
}

function mapReaction(reaction: GraphQLReaction): GitHubScrapReactionSource {
  const content = REACTION_CONTENT_BY_GRAPHQL[reaction.content];
  if (!content) {
    throw new TypeError(`GitHub returned an unknown reaction: ${String(reaction.content)}`);
  }
  if (!reaction.user || reaction.user.databaseId === null) {
    return { content, user: null };
  }
  return {
    content,
    user: { id: reaction.user.databaseId, login: reaction.user.login },
  };
}

function mapAuthor(author: { login: string } | null): { login: string } | null {
  return author === null ? null : { login: author.login };
}

function requireDatabaseId(value: number | null, nodeId: string): number {
  if (value === null) {
    throw new TypeError(`GitHub did not return a database ID for comment ${nodeId}.`);
  }
  return value;
}

function assertGitHubName(value: string, label: string): void {
  if (typeof value !== 'string' || !GITHUB_NAME_PATTERN.test(value)) {
    throw new TypeError(
      `GitHub ${label} must be a single path segment containing only letters, numbers, dots, hyphens, and underscores.`,
    );
  }
}

function assertId(id: number): void {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new TypeError('GitHub issue numbers and comment IDs must be positive safe integers.');
  }
}
