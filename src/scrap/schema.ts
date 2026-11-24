import * as v from 'valibot';

/**
 * Boundary schemas for Scrap source material.
 *
 * Octokit's response types describe GitHub's wire format loosely (`body` may be
 * absent, `state` is any string, comment IDs are `number | bigint`). These
 * schemas validate that shape once, strip unknown fields, and brand the
 * identifiers so IDs, logins, timestamps, and hashes cannot be swapped.
 *
 * This module is pure: no I/O, no clock, no environment reads.
 */

const scrapIdBrand = Symbol('ScrapId');
const commentIdBrand = Symbol('CommentId');
const githubLoginBrand = Symbol('GitHubLogin');
const githubUserIdBrand = Symbol('GitHubUserId');
const isoTimestampBrand = Symbol('IsoTimestamp');
const contentHashBrand = Symbol('ContentHash');

const APPROVAL_REACTIONS = [
  '+1',
  '-1',
  'laugh',
  'hooray',
  'confused',
  'heart',
  'rocket',
  'eyes',
] as const;

const ScrapIdSchema = v.pipe(
  v.string(),
  v.nonEmpty(),
  v.regex(/^\S+$/),
  v.brand(scrapIdBrand),
);
export type ScrapId = v.InferOutput<typeof ScrapIdSchema>;

const CommentIdSchema = v.pipe(
  v.string(),
  v.nonEmpty(),
  v.regex(/^\S+$/),
  v.brand(commentIdBrand),
);
export type CommentId = v.InferOutput<typeof CommentIdSchema>;

// Actor logins are display data; authorization uses the immutable numeric user ID.
const GitHubLoginSchema = v.pipe(
  v.string(),
  v.nonEmpty(),
  v.regex(/^\S+$/),
  v.brand(githubLoginBrand),
);
export type GitHubLogin = v.InferOutput<typeof GitHubLoginSchema>;

const IsoTimestampSchema = v.pipe(
  v.string(),
  v.isoTimestamp(),
  v.brand(isoTimestampBrand),
);
export type IsoTimestamp = v.InferOutput<typeof IsoTimestampSchema>;

const ScrapStateSchema = v.picklist(['open', 'closed']);
export type ScrapState = v.InferOutput<typeof ScrapStateSchema>;

const ApprovalReactionSchema = v.pipe(
  v.string(),
  v.trim(),
  v.toLowerCase(),
  v.picklist(APPROVAL_REACTIONS),
);
export type ApprovalReaction = v.InferOutput<typeof ApprovalReactionSchema>;

/** Output-only brand: a SHA-256 digest is produced by this module, never parsed. */
export type ContentHash = string & { readonly [contentHashBrand]: true };

const PositiveIntegerSchema = v.pipe(
  v.union([v.number(), v.bigint()]),
  v.check(
    (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0,
    'Must be a positive safe integer.',
  ),
  v.transform(Number),
);

const GitHubUserIdSchema = v.pipe(
  PositiveIntegerSchema,
  v.brand(githubUserIdBrand),
);
export type GitHubUserId = v.InferOutput<typeof GitHubUserIdSchema>;

// Authors are display data only; their numeric IDs are not used for authorization.
const AuthorSchema = v.nullable(v.object({
  id: v.optional(GitHubUserIdSchema),
  login: GitHubLoginSchema,
}));

// Reactions are authorization data; the owner must be identified by an immutable ID.
const ReactionUserSchema = v.nullable(v.object({
  id: GitHubUserIdSchema,
  login: GitHubLoginSchema,
}));

const IssueSourceSchema = v.object({
  node_id: ScrapIdSchema,
  number: PositiveIntegerSchema,
  title: v.pipe(v.string(), v.nonEmpty()),
  body: v.optional(v.nullable(v.string()), null),
  user: AuthorSchema,
  state: ScrapStateSchema,
  created_at: IsoTimestampSchema,
});
export type IssueSource = v.InferOutput<typeof IssueSourceSchema>;

const CommentSourceSchema = v.object({
  id: PositiveIntegerSchema,
  node_id: CommentIdSchema,
  body: v.string(),
  user: AuthorSchema,
  created_at: IsoTimestampSchema,
});
export type CommentSource = v.InferOutput<typeof CommentSourceSchema>;

const ReactionSourceSchema = v.object({
  content: v.pipe(v.string(), v.nonEmpty()),
  user: ReactionUserSchema,
});
export type ReactionSource = v.InferOutput<typeof ReactionSourceSchema>;

const CommentCandidateSchema = v.object({
  comment: CommentSourceSchema,
  reactions: v.array(ReactionSourceSchema),
});
export type CommentCandidate = v.InferOutput<typeof CommentCandidateSchema>;

const PublicationPolicyInputSchema = v.strictObject({
  ownerId: GitHubUserIdSchema,
  reaction: v.optional(ApprovalReactionSchema, 'rocket'),
});

export interface PublicationPolicy {
  /** Immutable user ID of the single owner or designated org admin who may publish. */
  readonly ownerId: GitHubUserId;
  readonly reaction: ApprovalReaction;
}

export function parseIssueSource(input: unknown): IssueSource {
  return v.parse(IssueSourceSchema, input);
}

export function parseCommentSource(input: unknown): CommentSource {
  return v.parse(CommentSourceSchema, input);
}

export function parseReactionSource(input: unknown): ReactionSource {
  return v.parse(ReactionSourceSchema, input);
}

export function parseCommentCandidate(input: unknown): CommentCandidate {
  return v.parse(CommentCandidateSchema, input);
}

/** Validates configuration at the boundary and normalizes it for comparison. */
export function parsePublicationPolicy(input: unknown): PublicationPolicy {
  const parsed = v.parse(PublicationPolicyInputSchema, input);
  return { ownerId: parsed.ownerId, reaction: parsed.reaction };
}
