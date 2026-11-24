# GitHub 取得層と API エミュレーター

確認日: 2026-10-28。実行環境: Windows ホスト、Node 26.12.1、pnpm 12.15.0。

## 採用した構成

- API 通信: `@octokit/core@7.0.8`（`graphql` も同じクライアントから利用）
- REST の全ページ取得: `@octokit/plugin-paginate-rest@16.0.0`
- Scrap スレッドの一括取得: GraphQL `getScrapThread`
- 入力検証: `valibot@1.5.0`
- テスト: Vercel Labs の `emulate@0.12.3` と Node 標準テストランナー

全 API クライアントを自作せず、Octokit の型付きリクエストと `Link` によるページネーションを使う。
ブログ固有の処理は `src/github/reader.ts` に集め、公開条件の判定から切り離す。
GitHub の応答と Scrap の設定は `src/scrap/schema.ts` で Valibot により検証し、未知のフィールドを
落としてブランド型へ変換する。
`@octokit/rest` の一括クライアントは今回は追加しない。

自前の `fetch` でも今回の数エンドポイントは実装できるが、ページネーション、エラー表現、
GitHub の型との整合性を継続して保守する必要がある。型を生成する OpenAPI クライアントも選択肢だが、
今回の GitHub 専用の処理には Octokit の小さな構成を選んだ。

この構成に自動再試行・レート制限待機のプラグインは含まれない。取得失敗は呼び出し元にそのまま伝える。
同期ジョブを追加する際は、エラーヘッダーに従った再試行と前回の公開データ保持を実装する。

## 使い方

サーバー／同期ジョブ側で使う。トークンをクライアントバンドルに含めない。

```ts
import { createGitHubReader } from '../src/github/reader.ts';

const github = createGitHubReader({
  owner: 'YOUR_OWNER',
  repo: 'blog-2026',
  token: process.env.GITHUB_TOKEN,
});

const issues = await github.listIssues();
// 承認対象の Issue を選んだら、Issue・コメント・全リアクションをまとめて取得する。
const thread = await github.getScrapThread(issue.number);
```

`listIssues()` は Open / Closed を両方取得し、PR を除く。
ラベルなしの既存 Issue への公開リアクションも将来発見できるよう、ラベルで制限しない。
公開 URL 用の `node_id`、API 用の `number`、操作したユーザー ID などは GitHub の応答のまま保持する。
未承認の本文・コメントを含む取得結果を、そのまま公開ファイルに書き出してはいけない。

### `listCommentReactions` の意味

`listCommentReactions(commentId)` はコメント本文を返す API ではない。**1つのコメントに付いた
全リアクション**（ユーザー × 絵文字）を返す。コメント本文は `comment.body` に1つだけだが、
リアクションは複数ユーザーが複数種類を付けられる。たとえば同じコメントに、オーナーの 🚀、
別ユーザーの ❤️、別ユーザーの 👀 が同時に付き得る。承認判定はその一覧から
「オーナーの GitHub ユーザー ID」と「設定した絵文字」の組を探す。

REST の `listIssueReactions` / `listCommentReactions` はこの一覧取得には使えるが、
コメントごとに呼ぶと N+1 になる。Scrap の同期では `getScrapThread` を使う。

取得に必要な権限は Issues の読み取り。公開リソースは未認証でも読めるが、
同期ジョブでは認証付きアクセスを使い、実際の rate-limit ヘッダーを監視する。

## 公開判定（Scrap）

公開条件の判定は `src/scrap/publication.ts` の純粋関数に分ける。GitHub から取得しただけの
データは未承認の素材であり、`src/scrap/schema.ts` の Valibot スキーマを通したスナップショットだけを
公開候補にする。

```ts
import {
  buildScrapSnapshot,
  parseCommentCandidate,
  parseIssueSource,
  parsePublicationPolicy,
  parseReactionSource,
} from '../src/scrap/publication.ts';

// リポジトリ所有者の不変な GitHub ユーザー ID。ログインではない。
// Organization の場合は、公開を許可する管理者1名のユーザー ID を設定する。
const ownerId = Number(process.env.SCRAP_OWNER_ID);
const policy = parsePublicationPolicy({ ownerId });

// createGitHubReader(...) で作成した reader
const thread = await github.getScrapThread(issueNumber);
const snapshot = buildScrapSnapshot({
  issue: parseIssueSource(thread.issue),
  issueReactions: thread.issueReactions.map(parseReactionSource),
  comments: thread.comments.map(({ comment, reactions }) => parseCommentCandidate({
    comment,
    reactions: reactions.map(parseReactionSource),
  })),
}, policy);

if (snapshot) {
  // snapshot.contentHash を前回の公開分と比べ、変わったときだけ書き出す。
}
```

- 入力は `parseIssueSource` / `parseCommentSource` / `parseReactionSource` / `parseCommentCandidate`
  で検証する。Octokit の型で緩い `body` の省略（Issue は `null`、コメントは必須）、`state` の
  任意文字列、コメント ID の `number | bigint` をここで正規化し、未知のフィールドは落とす。
  検証失敗は `ValiError` になる。
- `ScrapId` / `CommentId` / `GitHubLogin` / `GitHubUserId` / `IsoTimestamp` は実行時の
  `unique symbol` を使ったブランド型。`ContentHash` も出力専用のブランド型で、ID・ログイン・時刻・
  ハッシュの取り違えをコンパイル時に防ぐ。
- `state` は `open` / `closed` に限定する。数値 ID は安全な整数へ正規化し、`bigint` も受け付ける。
- 公開リアクションの設定は GitHub の8種類（`+1` / `-1` / `laugh` / `hooray` / `confused` /
  `heart` / `rocket` / `eyes`）に限定する。リアクション応答の `content` は将来の追加に備えて
  任意の非空文字列を許し、承認判定に一致しなければ無視する。
- `parsePublicationPolicy` は `ownerId` を安全な正の整数として検証する。`ownerId` の欠落・
  0・負数・小数・安全でない整数は設定ミスとして例外にする。未知キーも例外にし、`reaction` の
  typo や古い `owner` / `approvers` 設定で権限を広げられないようにする。
- 個人リポジトリでは `ownerId` を `GET /users/{username}` またはリポジトリ応答の `owner.id` から
  一度取得して設定する。Organization の `owner.id` は Organization 自身なので、実際にリアクションする
  管理者ユーザーの ID を使う。いずれもログイン変更後は同じ値を使える。
- 個人リポジトリでは、同期ジョブの起動時にリポジトリ応答の `owner.id` と `ownerId` を照合し、
  不一致なら公開処理を停止する。Organization では管理者 ID を明示するため、この照合は使えない。
- 承認リアクションを付けたユーザーの不変な GitHub ユーザー ID が `ownerId` と一致する場合だけ
  公開する。ログインは変更・再利用され得るため認可に使わない。Issue 作成者や他のコラボレーターの
  リアクションでは公開しない。
- 既定の公開リアクションは `rocket`。`reaction` で変更できる。
- Issue の承認がスレッド全体の前提。未承認の Issue は `null` になり、承認済みコメントも出さない。
- コメントは個別承認。未承認コメントは含めない。並びは `comment.id` の昇順。
- `state` はそのまま公開し、Close を非公開にしない。
- 現在のリアクションを反映するため、承認リアクションを外すと次回から消える（現時点の既定）。編集だけでは再承認を要求しない（確定）。
- `contentHash` は公開内容だけから計算する。タイムスタンプや、公開対象を変えないリアクションの変更では変わらない。
- `ScrapId` を URL に使うときは `encodeURIComponent` する。Docs7 の静的ルーティングでは
  ファイルパスが URL になるため、`^[A-Za-z0-9_-]+$` を検証した値だけを URL とファイル名の
  両方に使う。検証に失敗する ID は同期を失敗させる。
- この関数は I/O を持たない。同期ジョブが取得・比較・書き出しを担当する。

### 設計判断

- **承認者**: 採用は「単一の不変 GitHub ユーザー ID (`ownerId`)」。個人リポジトリなら
  リポジトリ所有者、Organization なら公開を許可する管理者1名の ID を設定する。
  Organization 自身はリアクションできないため、`owner.id` をそのまま使うことはできない。
  代替案は、(a) 複数管理者を許可する（「オーナーのみ」を満たさない）、(b) リポジトリの
  admin 権限を持つ全員を許可する（追加の権限 API が必要で、複数管理者になる）、
  (c) ログイン名で許可する（変更・再利用でなりすませる）。採用案は (a)(b)(c) を避ける。
  例: `ownerId = 123` のとき、ユーザー 123 の 🚀 は公開し、ユーザー 456 の 🚀 は無視する。
  Organization リポジトリで `ownerId` に alice の 123 を設定した場合、bob の 456 は
  管理者であっても承認者にはならない。
- **編集**: 編集だけでは再承認を要求しない。Issue タイトル・本文、コメント本文の変更は
  次回同期でそのまま公開内容に反映する。承認は「この情報を公開してよい」という意味であり、
  内容の凍結ではないため。代替案の「編集のたびに再承認」は、編集のたびにリアクションを
  外して付け直す運用になり、取り下げとの区別も曖昧になる。
  例: 承認済みコメントを「A」から「B」に編集しても、🚀 を付け直さずに次回同期で「B」が出る。
- **承認リアクションの削除**: 現時点の既定は、次回同期で非公開にする（現在の GitHub 状態を
  そのまま投影する）。代替案は、一度承認したら削除後も公開を維持する「承認履歴」方式だが、
  誤操作・いたずら・アカウント侵害時の取り下げが効かず、永続ストレージも必要になる。
- **コメント**: Issue の承認を前提に、コメントごとに個別承認を要求する。代替案の
  「Issue 承認で全コメントを公開」は実装は簡単だが、コメント単位の取り下げができない。
- **Close**: Close は非公開にせず、`state: 'closed'` のまま公開する。Close は議論の終了であり、
  公開意思の取り下げとは別だから。代替案は Close で非公開だが、Close の意味を公開判定に
  混ぜることになる。
- **ラベル**: ラベルは公開判定に使わない。ラベルなしの既存 Issue への承認リアクションも
  検出するため。`scrap` ラベルは発見・整理用の補助に留める。
- **同期方式**: GitHub GraphQL のバッチ取得を主経路にし、リアクションは定期同期で検出する。
  Webhook はコメント本文の即時反映には使えるが、リアクションにはイベントがないため、
  承認検出の代替にはならない。
- **配信**: Docs7 へ静的投影する。各リクエストで Waku RSC から GitHub API を叩く方式は、
  レート制限・遅延・トークン管理の面で不利で、Docs7 はそもそも Waku を実行しない。

### 同期時のリクエスト

Scrap の同期は `getScrapThread` を使う。Issue 本文、Issue のリアクション、コメント、
コメントのリアクションを GraphQL のページ単位の1クエリにまとめる。コメントは100件、
各リアクションは100件ずつ取得し、ページが続く場合だけ追加クエリを発行する。コメントごとの REST
`listCommentReactions` は通常経路では呼ばない。

- `listIssues()` の各要素は本文・作成者・状態・`node_id` を含むため、同じ Issue に対して
  `getIssue()` を追加で呼ばない。`getIssue()` は単一 Issue の再取得や詳細確認に使う。
- Waku/React Server Components の `cache` や `Promise.all` は、同一レンダー内の重複排除や
  並列化には使えるが、GitHub への HTTP リクエスト数自体は減らない。さらに Docs7 配信は
  ビルド済みレンダラーと `content/` を読むため、RSC は本番の Scrap 同期経路にいない。
  RSC をバッチ機構として当てにせず、同期側で GraphQL バッチにする。
- `listIssues()` は PR 除外のため全 Issue を取得する。ラベルで絞ると、ラベルなしの既存 Issue に
  付いたオーナーのリアクションを検出できないため、公開判定にラベルを使わない方針と整合させる。
- `since` だけの差分同期は、リアクション変更が Issue の `updated_at` に反映される保証がないため、
  承認検出の唯一の根拠にしない。
- コメントの投稿・編集には GitHub Actions の `issue_comment` / `issues` イベントを使えるが、
  リアクション追加・削除には Webhook イベントがない。Webhook を足しても承認検出の定期取得は
  不要にならない。即時性が必要ならコメント本文の更新通知として併用する。現状は未実装。
- GraphQL の1クエリはコメント100件 × リアクション100件までを含み得る。非常に大きいスレッドでは
  クエリコストとノード上限を確認し、`first` を下げるか、コメントページとリアクションページを
  分ける。100件を超えたリアクションは追加クエリで取得する。
- 認証付きアクセスを使い、`x-ratelimit-remaining` と `retry-after` を監視する。ETag / 304 は
  取得量を減らせるが、新規承認の検出を省かない範囲で使う。失敗時は前回公開データを保持する。

## テストの実行

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm run types:check
```

`pnpm test` がエミュレーターを起動して終了時に閉じる。手動起動・実 GitHub トークンは不要。
ランダムな空きポート (`port: 0`) とループバックを使う。GitHub への実通信は行わない。
テストランナーは `node --test` なので `node_modules/.bin` に依存しない。
TypeScript は Node のネイティブ型除去で実行する。Node 24 を使う場合は型除去対応版が必要。
2026-10-29 に Linux SBX (Node 26.21.0、pnpm 12.15.0) で依存を入れ直し、
Docs7・GitHub 取得層・Scrap の公開判定と入力検証を含む全58テスト、型チェック、Knip、
production build の成功を確認した。

この Windows ホストで、9テスト、型チェック、サイトの production build、
`pnpm install --frozen-lockfile` が成功した。
サイトのビルドには `::highlight` の CSS 警告と `site.baseUrl` 未設定の警告が出る。

## 検証範囲とエミュレーターの限界

Vercel Labs の [emulate](https://github.com/vercel-labs/emulate) は実験段階の API エミュレーター。
`latest` の README だけでなく、インストールした 0.12.3 の型定義と実装を確認した。

| 範囲 | 使った実装 | 検証すること |
| --- | --- | --- |
| Issue とコメント | emulate 内蔵 GitHub | 101件の全ページ取得、ラベルなし、Close と再オープン、本文編集、コメント編集と削除、404 |
| Issue / コメントのリアクション | emulate の公式 `defineEmulator` によるテスト用 API | 複数ページ、ユーザーと絵文字の保持、本文とコメントの区別、削除後の再取得、2ページ目で403になった場合の全体失敗 |
| Scrap スレッドの GraphQL バッチ | 同じ公式カスタム API の `POST /graphql` | コメントページ、リアクションの追加ページ、コメントごとの REST 呼び出しがないこと |
| Issue 一覧への PR 混入 | 同じ公式カスタム API | 一覧で PR を除外し、個別取得で PR を拒否 |
| Scrap の入力境界 | Valibot の単体テストと内蔵 GitHub の実応答 | Octokit の緩い型、未知フィールドの除去、`state`・ID・時刻の正規化、ブランド型 |

重要な差:

- **内蔵 GitHub に Reactions API のルートはない。** Issue / コメントの応答にある
  `reactions` 集計フィールドは、リアクション一覧エンドポイントの実装を意味しない。
  内蔵 API が404を返すこともテストで明示している。
- **内蔵 GitHub の Issue 一覧は PR を除外するが、実 GitHub の Issues API は PR も返す。**
  内蔵 API だけでは PR 除外処理の検証にならないので、別の契約フィクスチャで検証する。
- カスタム API はプロジェクトが書いた応答であり、実 GitHub との完全互換の証明ではない。
  `tests/github/reactions-emulator.ts` は読み取りエンドポイントと `Link` の必要部分だけを定義する。
  書き込み、GitHub の厳密なレート制限、ETag、Webhook 発火は再現していない。
- GraphQL のクエリと変換は公式スキーマに合わせて実装したが、実 GitHub に対する契約テストはまだない。
  `tests/github/graphql-emulator.ts` はページングと変換の検証用で、GraphQL スキーマの互換性を保証しない。
- 実 GitHub を使う契約テスト、認証権限の完全な再現、本番レート制限の検証はまだない。

リアクション用の実在しない Webhook を追加したり、エミュレーターの挙動から GitHub の仕様を決めたりはしない。

## 配布の来歴

各採用版の npm メタデータに GitHub の `trustedPublisher` 記録と SLSA provenance がある。
provenance の配布物 SHA-512 と npm の integrity の一致を確認した。
署名チェーンの暗号学的検証、推移依存全体の provenance 確認は今回の確認に含まれない。

| 採用版 | npm の公開メタデータ | provenance |
| --- | --- | --- |
| `@octokit/core@7.0.8` | [metadata](https://registry.npmjs.org/@octokit/core/7.0.8) | [attestation](https://registry.npmjs.org/-/npm/v1/attestations/@octokit%2fcore@7.0.8) |
| `@octokit/plugin-paginate-rest@16.0.0` | [metadata](https://registry.npmjs.org/@octokit/plugin-paginate-rest/16.0.0) | [attestation](https://registry.npmjs.org/-/npm/v1/attestations/@octokit%2fplugin-paginate-rest@16.0.0) |
| `emulate@0.12.3` | [metadata](https://registry.npmjs.org/emulate/0.12.3) | [attestation](https://registry.npmjs.org/-/npm/v1/attestations/emulate@0.12.3) |
| `valibot@1.5.0` | [metadata](https://registry.npmjs.org/valibot/1.5.0) | [attestation](https://registry.npmjs.org/-/npm/v1/attestations/valibot@1.5.0) |

emulate の証明は `vercel-labs/emulate` の `.github/workflows/release.yml`、コミット
`361410f1e2e3872cf58c49277e5ce3174e040701` を指す。
依存バージョンを固定し、`pnpm-lock.yaml` を再現インストールの入力にする。
追加4パッケージにインストール時のビルドスクリプトはなく、既存 `allowBuilds` の変更は不要だった。

## 今後決めること

公開判定と入力検証は `src/scrap/publication.ts` / `src/scrap/schema.ts` に実装済み。同期ジョブは
`src/scrap/sync.ts`、定期実行は `.github/workflows/scrap-sync.yml`（毎日 18:00 JST と手動実行）に
実装済み。Docs7 へは生成 MDX を main に push して反映する。ラベル付与はまだ追加していない。
残っている判断は次のとおり。

- 日次 18:00 JST の反映遅延で足りるか。より短い間隔が必要か。
- GraphQL クエリの実 GitHub に対する契約テスト（スキーマ互換性の確認）。
- GitHub API のレート制限と認証トークンの扱い。失敗時の再試行と前回公開データの保持。
- リアクション削除による取り下げを既定のまま確定するか。
- Organization 所有リポジトリで、公開を許可する管理者1名の GitHub ユーザー ID を `ownerId` に
  するか（Organization 自身はリアクションできないため、管理者ユーザーを明示する必要がある）。
- 相対時刻の更新方法。

## 参照した仕様

- [Octokit Core](https://github.com/octokit/core.js)
- [Octokit pagination plugin](https://github.com/octokit/plugin-paginate-rest.js)
- [Valibot](https://valibot.dev/)
- [emulate programmatic API / custom emulators](https://github.com/vercel-labs/emulate#programmatic-api)
- [GitHub Issues](https://docs.github.com/en/rest/issues/issues#list-repository-issues)
- [GitHub issue comments](https://docs.github.com/en/rest/issues/comments#list-issue-comments)
- [GitHub Reactions API](https://docs.github.com/en/rest/reactions/reactions)
- [GitHub GraphQL API](https://docs.github.com/en/graphql)
