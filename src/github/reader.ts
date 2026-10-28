import { Octokit } from '@octokit/core';
import { paginateRest } from '@octokit/plugin-paginate-rest';

const PaginatedOctokit = Octokit.plugin(paginateRest);

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
  if (!owner.trim() || !repo.trim()) {
    throw new TypeError('GitHub owner and repo must not be empty.');
  }
  const client = new PaginatedOctokit({
    auth: options.token,
    baseUrl: options.baseUrl,
    userAgent: 'blog-2026-github-reader',
  });
  const repository = { owner, repo, per_page: 100 };

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

    async listCommentReactions(commentId: number) {
      assertId(commentId);
      return client.paginate('GET /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions', {
        ...repository,
        comment_id: commentId,
      });
    },
  };
}

function assertId(id: number): void {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new TypeError('GitHub issue numbers and comment IDs must be positive safe integers.');
  }
}
