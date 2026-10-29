# Fumapress / Docs7 連携

確認日: 2026-10-28。Windows ホスト、Node 26.12.1、pnpm 12.15.0。

## 構成

`src/plugins/docs7/` はこのリポジトリ独自のローカルプラグイン。
`@fumapress/mintlify` の設定読み込み、`PressPlugin.init`、レイアウト変換の設計を参考にした。
同パッケージは依存として追加していない。

原本は一つだけ持つ:

- `content/docs.json`: サイト名、色、ナビゲーションなど
- `content/*.mdx`: 記事
- `content/style.css`: 自己紹介の HTML と表・アイコン・作品カードの共通スタイル
- 公開ページは自己紹介、Blog一覧 (`blog.mdx`)、Scrap一覧 (`scraps.mdx`)。
  Blog / Scrap は空の状態を表示。記事や GitHub 同期機能は未実装。確認用ページは削除済み。

Fumapress は `press.config.tsx` の `docs7Plugin()` と `docs7Mdx()` を通して読む。
Docs7 は `content/` をプロジェクトルートとして、そのまま読む。
生成ファイルのコピーやシンボリックリンクは使わない。
Docs7 レンダラー 0.1.61 がコンテンツ内の CSS を収集し、`style.css` を優先して
読み込むことを配布ソースと開発サーバーで確認した。
Fumapress は `src/app.css` から同じファイルを import する。
Docs7 上で Fumapress の React サーバーや GitHub 同期コードを動かす構成ではない。

## 起動

```sh
pnpm install --frozen-lockfile
pnpm dev
```

別のターミナルで Docs7 を起動する:

```sh
pnpm docs7:dev
```

Docs7 は `http://localhost:3333`、自己紹介ページは `/`。
CLI はローカル依存 `@upstash/docs7@0.1.12` を `node` から直接呼ぶ。
`docs7.env` の `DOCS7_RENDERER_VERSION=0.1.61` でプレビューのレンダラーを固定した。
初回は CLI が公式の署名付きレンダラーをダウンロードするため、ネットワーク接続が必要。
既存の環境変数は Node の `--env-file` より優先するので、意図的なバージョン上書きは可能。
Fumapress の開発サーバーは `content/docs.json` の変更で再起動する。

## 対応する設定

このプラグインは Docs7 の全 JSON Schema を再実装していない。
公式 [Docs7 Schema](https://context7.com/schema/docs7.json) にある設定のうち、下記の共通部分に限定する。
未対応キーは Zod の strict schema でエラーにし、読み捨てない。

| キー | Fumapress への対応 |
| --- | --- |
| `$schema` | Docs7 のスキーマ URL を受け付ける |
| `name` | サイト名・ナビゲーションタイトル |
| `theme` | `mint` のみ受け付ける。Fumapress の見た目が Mintlify と同一になる意味ではない |
| `colors.primary`, `colors.light`, `colors.dark` | Fumadocs のプライマリー色。6桁の hex 色のみ |
| `appearance.default` | `light` / `dark` / `system` |
| `appearance.strict` | テーマ固定と切替ボタン非表示。strict の場合は light / dark を指定 |
| `navigation.groups` | 設定順のサイドバー。入れ子の `{ group, pages }` に対応 |

ページは `content/` 相対の拡張子なしパスで指定する。例: `index`, `posts/hello`。
存在しないページ、重複参照、ルート外のパスはエラーになる。
ナビゲーションは表示順の設定であり、アクセス制御ではない。
ナビゲーション外の MDX が非公開になるとは扱わない。

タブ・言語・バージョン・productGroups を持つナビゲーション、外部リンクのナビゲーション、
navbar / footer / logo / SEO / redirects / integrations / filterSidebar 等の設定、
JSON `$ref` 分割は未対応。必要になったら Docs7 の実仕様を確認して追加する。

## 対応する MDX

標準 Markdown と通常のコードブロックに加え、以下を `docs7Mdx()` が Fumadocs / HTML に変換する。
表の props と `children` のみ対応する。未対応 props はエラーにする。

| コンポーネント | 対応する props / 挙動 |
| --- | --- |
| `Note`, `Info`, `Tip`, `Warning`, `Check`, `Success`, `Danger` | children のみ。それぞれ info / idea / warn / success / error の Callout |
| `Callout` | children のみ。標準の info 表示 |
| `Tabs` / `Tab` | `Tab.title`。空や重複のないタイトルを指定。Fumadocs のタブに変換 |
| `AccordionGroup` / `Accordion` | `title`, `description`, `defaultOpen`。ネイティブ details / summary |
| `Steps` / `Step` | `Step.title`。Fumadocs Steps と見出しに変換 |
| `Card` | `title`, `href`。本文を保持したリンクカード |
| `Columns` / `CardGroup` | `cols` (1〜4、既定2)。狭い画面では1列。CardGroup は Docs7 のレガシー別名 |
| `Column` | children のみ |

アイコン指定、Callout の色・emoji・type、Tab の icon、Card の画像・CTA、Step の
stepNumber / titleSize 等は未対応。`CodeGroup`, API フィールド、Mermaid、数式、独自 React import、
snippets 等も、このプラグインが保証する共通コンテンツには含めない。
Fumapress だけのコンポーネントを記事に使うと、Docs7 で表示できるとは限らない。
同じ内容を読めることを目標とし、見た目や機能の完全一致は保証しない。

## GitHub と Docs7 の公開設定

2026-10-29 に Linux の Docs7 CLI から Personal teamspace にログインし、本番公開を完了した。

- 公開 URL: https://merino-dev.docs7.io （初回公開後に slug を `merino-dev` へ変更）
- 公開対象: `content/` の設定、MDX、スタイルシート。
  自己紹介に加え Blog / Scrap の一覧を配置し、main への push で反映する。
- `whoami` がログイン済み、CLI が `Your site is live`、管理画面が `Succeeded` になったことを確認。
- 初回公開時は `/` と `/compatibility` を確認。その後、利用者の指定で自己紹介1ページに変更。

同日、Context7 GitHub App を対象リポジトリ1件に限定してインストールし、既存サイトに接続した。
自動デプロイの設定値:

- Repository: `kotarotaniguchi0523/blog-2026`
- Production branch: `main`
- Documentation directory: **`content`**（リポジトリのルートではない）

Docs7 の GitHub 連携が push 時の production build と PR preview を担当する。
接続時に GitHub の `main` のコミット `a516cbd` を取得した初回ビルドが成功し、
管理画面が `Live`、ログが `Your site is live at https://blog-2026.docs7.io` になったことを確認した。
その後 `42b742a` の push による自動デプロイも `Live` になることを確認。PR プレビューは未検証。
この連携のために Fumapress のビルドや任意の React サーバーを Docs7 に登録しない。
ソースの push と、Docs7 の GitHub App 登録・サイト連携は別の操作となる。

Context7 への掲載も Docs7 管理画面から登録済み。公開ライブラリの URL は
https://context7.com/kotarotaniguchi0523/blog-2026 。初回解析は非同期で行われ、
以降は本番ビルドの完了に合わせて更新される。

CLI でプレビューを公開する場合は、利用者が認証してから実行する:

```sh
pnpm docs7:login
pnpm docs7:whoami
pnpm docs7:preview
```

GitHub 接続後の本番更新は `main` へ push して行う。CLI アップロードは拒否されることを確認した:

```sh
This site now deploys from GitHub. Push to the connected repository to deploy it.
```

初回の CLI 公開では `--slug blog-2026` を指定し、GitHub 接続後に管理画面で `merino-dev` へ変更した。
認証情報は Linux ホームの `~/.config/docs7/credentials.json` に保存され、リポジトリには含めない。

`docs7:preview` は外部にサイトを作る操作。ローカルの動作確認では実行しない。
`.docs7/project.json` は CLI がサイトを作成・リンクしたときの記録であり、
GitHub 連携の設定を代替しない。必要なローカル記録を CLI が作るため、手書きしない。

## 検証と制約

- 設定の変換、不正・未対応設定、存在しないページ、PR取得層を含むテストを `pnpm test` で実行。
- `pnpm run types:check` と `pnpm build` を実行。
- 実際の Docs7 0.1.61 と Fumapress 1.6.2 を起動し、`/` と `/compatibility` の HTTP 応答を確認。
  共通コンテンツと両方のタブ名が HTML にあることを確認。ブラウザー操作・見た目の一致は未検証。
- Fumapress ビルドには既存の `::highlight` CSS 警告と `site.baseUrl` 未設定警告がある。
  Docs7 の公開 URL は上記のとおり。Fumapress の `site.baseUrl` は別途未設定。
- 自己紹介の改修では Docs7 開発サーバーをブラウザーで確認。
  デスクトップ・幅390px・明暗テーマで表示を確認し、8個のアイコンが32×32px、
  枠が48×48pxで中央に配置され、表の全セルが中央揃えであることを計測した。
- 2026-10-29 に開発環境を Linux SBX (Node 22.23.3) へ切り替えた。
  `corepack pnpm install --force --frozen-lockfile` で Linux 用依存を再配置し、
  退避された旧 Windows 依存を削除。Linux で16テスト・型チェック・Knip・ビルドが成功。
  その後 CLI によるリモート本番デプロイと公開2ページの本文を確認。
- Docs7 の source repository (`upstash/docs7`) は確認時の公開 API で404だった。
  公開ドキュメント・スキーマ・npm 配布済み CLI・実行したレンダラーで確認した。

`@upstash/docs7@0.1.12` の npm メタデータには Trusted Publisher の記録があるが、
provenance の記録はない。CLI のソースはダウンロード時の SHA-256 と Ed25519 署名検証を実装している。
これを npm パッケージの provenance があることと混同しない。

## 参照

- [参考にした Mintlify プラグイン](https://github.com/fuma-nama/fumapress/blob/main/packages/mintlify/src/index.tsx)
- [Mintlify 設定読み込み](https://github.com/fuma-nama/fumapress/blob/main/packages/mintlify/src/read-config.ts)
- [Docs7 Quickstart](https://context7.com/docs/docs7/quickstart)
- [Docs7 CLI](https://context7.com/docs/docs7/cli)
- [Docs7 configuration](https://context7.com/docs/docs7/configuration)
- [Docs7 component documentation source](https://github.com/upstash/context7/tree/master/docs/docs7/components)
- [採用した Docs7 CLI の公開記録](https://registry.npmjs.org/@upstash/docs7/0.1.12)
