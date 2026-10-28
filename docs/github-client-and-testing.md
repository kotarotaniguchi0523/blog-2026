# GitHub 取得層と API エミュレーター

確認日: 2026-10-28。実行環境: Windows ホスト、Node 26.12.1、pnpm 12.15.0。

## 採用した構成

- API 通信: `@octokit/core@7.0.8`
- REST の全ページ取得: `@octokit/plugin-paginate-rest@16.0.0`
- テスト: Vercel Labs の `emulate@0.12.3` と Node 標準テストランナー

全 API クライアントを自作せず、Octokit の型付きリクエストと `Link` によるページネーションを使う。
ブログ固有の処理は `src/github/reader.ts` に集め、公開条件の判定から切り離す。
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
// 取得対象を選んだ後、issue.number / comment.id で各 API を呼ぶ。
// getIssue(issueNumber)
// listComments(issueNumber)
// listIssueReactions(issueNumber)
// listCommentReactions(commentId)
```

`listIssues()` は Open / Closed を両方取得し、PR を除く。
ラベルなしの既存 Issue への公開リアクションも将来発見できるよう、ラベルで制限しない。
公開 URL 用の `node_id`、API 用の `number`、操作したユーザー ID などは GitHub の応答のまま保持する。
全リアクションを返すので、許可アカウントと絵文字の照合は後段で行う。
未承認の本文・コメントを含む取得結果を、そのまま公開ファイルに書き出してはいけない。

取得に必要な権限は Issues の読み取り。公開リソースは未認証でも読めるが、
同期ジョブでは認証付きアクセスを使い、実際の rate-limit ヘッダーを監視する。

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
2026-10-29 に Linux SBX (Node 22.23.3、Corepack 経由の pnpm 12.15.0) で依存を入れ直し、
Docs7 のテストを含む全16テスト・型チェック・Knip・production build の成功を確認した。

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
| Issue 一覧への PR 混入 | 同じ公式カスタム API | 一覧で PR を除外し、個別取得で PR を拒否 |

重要な差:

- **内蔵 GitHub に Reactions API のルートはない。** Issue / コメントの応答にある
  `reactions` 集計フィールドは、リアクション一覧エンドポイントの実装を意味しない。
  内蔵 API が404を返すこともテストで明示している。
- **内蔵 GitHub の Issue 一覧は PR を除外するが、実 GitHub の Issues API は PR も返す。**
  内蔵 API だけでは PR 除外処理の検証にならないので、別の契約フィクスチャで検証する。
- カスタム API はプロジェクトが書いた応答であり、実 GitHub との完全互換の証明ではない。
  `tests/github/reactions-emulator.ts` は読み取りエンドポイントと `Link` の必要部分だけを定義する。
  書き込み、GitHub の厳密なレート制限、ETag、Webhook 発火は再現していない。
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

emulate の証明は `vercel-labs/emulate` の `.github/workflows/release.yml`、コミット
`361410f1e2e3872cf58c49277e5ce3174e040701` を指す。
依存バージョンを固定し、`pnpm-lock.yaml` を再現インストールの入力にする。
追加3パッケージにインストール時のビルドスクリプトはなく、既存 `allowBuilds` の変更は不要だった。

## 今後決めること

公開絵文字、許可アカウント、本文とコメントの公開単位、編集の再承認、取り下げ方針はまだ未確定。
今回の変更は取得とテストの土台であり、公開ジョブ、ラベル付与、Docs7 への書き出し、Scrap UI は追加しない。

## 参照した仕様

- [Octokit Core](https://github.com/octokit/core.js)
- [Octokit pagination plugin](https://github.com/octokit/plugin-paginate-rest.js)
- [emulate programmatic API / custom emulators](https://github.com/vercel-labs/emulate#programmatic-api)
- [GitHub Issues](https://docs.github.com/en/rest/issues/issues#list-repository-issues)
- [GitHub issue comments](https://docs.github.com/en/rest/issues/comments#list-issue-comments)
- [GitHub Reactions API](https://docs.github.com/en/rest/reactions/reactions)
