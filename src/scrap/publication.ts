import { createHash } from 'node:crypto';

import {
  type CommentCandidate,
  type CommentId,
  type ContentHash,
  type GitHubLogin,
  type IsoTimestamp,
  type IssueSource,
  type PublicationPolicy,
  type ReactionSource,
  type ScrapId,
  type ScrapState,
} from './schema.ts';

export {
  parseCommentCandidate,
  parseCommentSource,
  parseIssueSource,
  parsePublicationPolicy,
  parseReactionSource,
} from './schema.ts';

export type {
  ApprovalReaction,
  CommentCandidate,
  CommentId,
  CommentSource,
  ContentHash,
  GitHubLogin,
  GitHubUserId,
  IsoTimestamp,
  IssueSource,
  PublicationPolicy,
  ReactionSource,
  ScrapId,
  ScrapState,
} from './schema.ts';

/**
 * Turns unapproved GitHub source material into the public Scrap snapshot.
 *
 * Publication is decided only by reactions from the configured repository
 * owner; issue state and labels never gate publication, so a closed issue
 * stays published (with `state: 'closed'`) and a missing `scrap` label changes nothing.
 *
 * The snapshot reflects the reactions present on each run. Removing an
 * approval reaction removes that content on the next run, while editing a
 * title, body, or comment does not require re-approval.
 *
 * Sources must already be parsed by `./schema.ts`; this module trusts only that
 * validated, branded data and never re-reads raw GitHub responses.
 *
 * This module is pure: no I/O, no clock, no environment reads.
 */

export interface ScrapCommentSnapshot {
  id: CommentId;
  body: string;
  author: GitHubLogin | null;
  createdAt: IsoTimestamp;
}

export interface ScrapSnapshot {
  id: ScrapId;
  issueNumber: number;
  title: string;
  body: string;
  author: GitHubLogin | null;
  createdAt: IsoTimestamp;
  state: ScrapState;
  comments: ScrapCommentSnapshot[];
  contentHash: ContentHash;
}

export function buildScrapSnapshot(
  input: {
    issue: IssueSource;
    issueReactions: readonly ReactionSource[];
    comments: readonly CommentCandidate[];
  },
  policy: PublicationPolicy,
): ScrapSnapshot | null {
  const { issue } = input;
  if (!hasApproval(input.issueReactions, policy)) return null;

  const body = issue.body ?? '';
  const author = issue.user?.login ?? null;

  const comments = input.comments
    .filter((candidate) => hasApproval(candidate.reactions, policy))
    .sort((left, right) => left.comment.id - right.comment.id)
    .map(({ comment }): ScrapCommentSnapshot => ({
      id: comment.node_id,
      body: comment.body,
      author: comment.user?.login ?? null,
      createdAt: comment.created_at,
    }));

  return {
    id: issue.node_id,
    issueNumber: issue.number,
    title: issue.title,
    body,
    author,
    createdAt: issue.created_at,
    state: issue.state,
    comments,
    contentHash: hashContent({
      id: issue.node_id,
      title: issue.title,
      body,
      state: issue.state,
      author,
      comments,
    }),
  };
}

function hasApproval(reactions: readonly ReactionSource[], policy: PublicationPolicy): boolean {
  return reactions.some(
    (reaction) =>
      reaction.content === policy.reaction
      && reaction.user !== null
      && policy.ownerId === reaction.user.id,
  );
}

function hashContent(content: {
  id: ScrapId;
  title: string;
  body: string;
  state: ScrapState;
  author: GitHubLogin | null;
  comments: readonly ScrapCommentSnapshot[];
}): ContentHash {
  const payload = [
    content.id,
    content.title,
    content.body,
    content.state,
    content.author,
    content.comments.map((comment) => [comment.id, comment.body, comment.author]),
  ];
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex') as ContentHash;
}
