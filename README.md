# blog-2026

個人ブログです。[Fumapress](https://press.fumadocs.dev)(Fumadocs ベースのコンテンツフレームワーク)を Astro 上で動かして構築しています。ホスティングは Docs7(Upstash / Context7、Mintlify 互換)を想定しています。

## 公開ルール（人間の許可が必須）

公開は、`status: published` にしたうえで人間の許可を得てから行います。エージェントは下書きの作成とローカルプレビューまでです。

- `status: published` への変更、`main` への push、Docs7 の本番デプロイには、人間の明示的な許可が必要です。
- 公開前に次を実行し、すべて通ることを確認します。CI でも同じコマンドを実行します。

```sh
pnpm content:check
```

- `main` へは、`Content checks` が成功した PR を人間が承認してからマージします。ブランチ保護でこのチェックを必須にします。

- Scrap は、リポジトリオーナーが GitHub Issue に 🚀 リアクションを付けたものだけを同期します。
- `draft` は Fumapress のビルドに含まれず、Docs7 でも `content/.docs7ignore` によりアップロードされません。
  ignore が古いと Docs7 は draft を配信するため、生成漏れはテストと CI が検出します。

## 必要なもの

- Node.js 24以上（`.node-version` は動作確認した24.15.0）
- pnpm 12.15.0（`package.json` で固定）

## セットアップ

コマンドは SBX の Linux シェルで実行します。バインドマウント上のリンク制約に対応するため、`pnpm-workspace.yaml` で `hoisted` 配置と実行ファイルのリンク無効化を設定しています。OS ごとのネイティブ依存があるため、Windows で作成した `node_modules` を使い回さないでください。

```sh
pnpm install --frozen-lockfile
```

pnpm が PATH にない場合は、`corepack pnpm` を使います（例: `corepack pnpm install --frozen-lockfile`）。Windows 向け依存から切り替える場合は、Linux シェルで `corepack pnpm install --force --frozen-lockfile` を実行します。

依存を追加・更新するときは `pnpm add` / `pnpm update` を使い、`pnpm-lock.yaml` も更新します。scripts は `node_modules/.bin` に依存せず、CLI エントリを `node` で直接呼び出しています。依存のインストール時スクリプトは必要なものを確認して個別に許可します。

## 開発

```sh
pnpm run dev
```

## ビルド

```sh
pnpm run build
```

## ローカルのビジュアルエディタ

Fumadocs 公式の Studio 0.2.6 を開発依存として固定しています。`node_modules` が導入済みなら
追加のインストールは不要で、そのまま起動できます。

```sh
pnpm editor
```

`http://127.0.0.1:5180` で `content/` の MDX を編集できます。npx / pnpm dlx やグローバルインストールは不要です。

**コマンドは SBX（Docker Sandboxes の Linux サンドボックス）で実行します。** このリポジトリの
`node_modules` は SBX で導入した Linux 版なので、Windows ホストの `pnpm editor` は
ネイティブバインディング（rolldown / esbuild）を読み込めず起動しません。WSL でも動きますが、
正規の環境は SBX です。

```sh
# ホスト側のターミナルから
sbx exec opencode-blog-2026 -- bash -lc 'cd /c/Users/r02ta/projects/blog-2026 && pnpm editor'
# サンドボックス内のシェルから
cd /c/Users/r02ta/projects/blog-2026 && pnpm editor
```

SBX は Node.js 24 / pnpm 12.15.0 が入っており、`docs7:dev` もそのまま動きます
（初回だけ Docs7 レンダラーの取得にネットワーク承認が必要）。
`pnpm install` が必要なのは、初回 clone 時と `package.json` / `pnpm-lock.yaml` を変更したときだけです。

変更はファイルへ自動保存されます。`Ctrl+S` でも保存できます。MDX タブでソースを直接編集できます。
自己紹介の本文・見出しは Visual タブで直接入力できます。`studio/profile-components.tsx` が
HTML の編集領域を定義し、公開時と同じ CSS を読み込みます。アイコン表・リンク・属性は MDX タブで編集してください。

Studio の編集用表示は公開画面の完全なプレビューではありません。
公開UIを維持するための画像・寸法・比較手順は [見た目の基準](./docs/ui-baseline/README.md) に保存しています。
公開時の見た目は、別ターミナルの `pnpm docs7:dev`（ポート3333）で確認してください。
実験段階のエディタなので、保存後は `git diff -- content/` で変更を確認してください。

設定は `fumadocs-studio.config.ts`。待受先は `127.0.0.1` に限定し、画像アップロードは無効です。
Studio は別プロセスで起動し、サイトのコード・ビルド・Docs7 の公開対象へ組み込みません。
編集・保存ではデプロイされません。ただし、既存の GitHub 連携により `main` へ push すると本番更新されます。
デプロイせずに編集する間は push しないでください。

トップ (`/`) は名前と GitHub アイコンのみの入口、プロフィール (`/about`) に技術スタックと作品を置いています。
Blog (`/blog`)・Scrap (`/scraps`) はサイドバーから移動できます。
Blog は `content/blog/` の記事、Scrap は GitHub Issue の同期結果を一覧にします。Scrap は公開判定・入力検証・GitHub 取得・
同期ジョブ・生成 MDX の一覧と個別ページまで実装済みです。相対時刻の自動更新と検索はまだありません。

### 日本語と英語

`content/` 直下が日本語（既定言語）、`content/en/` が英語です。`/` が日本語、`/en` が英語で、
Fumapress は `i18n`（`parser: "dir"`, `hideLocale: "default-locale"`）で同じ構成を読みます。

**日本語が正**です。日本語のページを変更したら、同じ変更で `content/en/` の対応ファイルも更新してください。
ページの追加・並びは `content/docs.json` の `navigation.languages` に言語ごとに書きます。

導入方法・Node 要件は [公式 Studio ドキュメント](https://editor.fumadocs.dev/studio) を参照。

## 公開状態（frontmatter `status`）

各ページの frontmatter は `status: published` のときだけ公開されます。指定がない場合は `draft` です。

```md
---
title: 記事のタイトル
status: published
---
```

`draft` のページはローカルの Astro / Fumapress のビルドに含まれず（ルートもページツリーも作られません）、
Docs7 のアップロード対象からも外れます。`content/.docs7ignore` が Docs7 にアップロードしないページの
一覧で、`pnpm docs7:ignore` が `status` から生成します。状態を切り替えたらこのコマンドを実行し、
生成された `content/.docs7ignore` も同じ変更でコミットしてください。`draft` のページは
`content/docs.json` のナビゲーションに書かないでください（ビルドが失敗します）。

```sh
pnpm docs7:ignore
pnpm docs7:ignore --check   # 書き込みなし。差分があれば終了コード 1
```

## Blog 記事

記事は `content/blog/<slug>.mdx`、英語は `content/en/blog/<slug>.mdx` に置きます。
slug は英数字・`_`・`-` に限り、ファイル名がそのまま `/blog/<slug>` の URL になります。
サブディレクトリは使いません。

```md
---
title: 記事のタイトル
description: 記事ページの説明（meta description）
date: 2026-11-01
status: published
---
```

一覧 `content/blog/index.mdx` / `content/en/blog/index.mdx` は記事から生成します。追加・改名・削除のあとに実行してください。

```sh
pnpm blog:index
pnpm blog:index --check   # 書き込みなし。差分があれば終了コード 1
```

`tests/blog/index.test.ts` が、一覧の再生成忘れを検出します。

## リンク切れの検査

`press.config.tsx` で Fumapress 同梱の `linkValidationPlugin()` を有効にしています。
`pnpm build` の静的レンダリングで収集された Fumapress の `Link` のうち、内部リンクが404ならビルドが失敗します。
外部URL、ページ内アンカー、直接記述した HTML の `<a>` を網羅的に検査する設定ではありません。
Docs7 は Fumapress のビルドを実行しないため、この検査はローカルで `pnpm build` を実行して使います。
追加候補と適用範囲は [プラグイン一覧](./docs/fumapress-plugins.md) を参照してください。

## Docs7 との連携

`content/docs.json` と同じ MDX を、独自の Fumapress プラグインと Docs7 の両方で読みます。

```sh
pnpm docs7:dev
```

Docs7 のプレビューは `http://localhost:3333`。対応設定・MDX コンポーネント・認証と公開の手順は
[Docs7 連携](./docs/docs7-integration.md)を参照してください。
GitHub 連携時のドキュメントフォルダーは **`content`** です。

## 型チェック

```sh
pnpm run types:check
```

## 未使用コードの検査

Knip をローカル依存として導入しています。

```sh
pnpm knip
```

Fumapress が仮想モジュールから読む設定と CSS は `knip.jsonc` に入口として登録しています。
ツールは pnpm でインストールし、scripts 内で `node` から実行します。npx は使用しません。

## GitHub API の取得・テスト

GitHub の取得層は `@octokit/core` とページネーション用プラグインを使います。Scrap のスレッド取得は
GraphQL でコメントとリアクションをページ単位にまとめ、コメントごとの N+1 を避けます。
テストには Vercel Labs の `emulate` を使い、実 GitHub のトークンなしで実行できます。
GitHub の応答と Scrap の設定は Valibot で検証し、ID・時刻・ログイン・ハッシュはブランド型で区別します。

```sh
pnpm test
```

取得層の使い方、配布来歴の確認結果、エミュレーターの対応範囲は
[GitHub 取得層と API エミュレーター](./docs/github-client-and-testing.md)を参照してください。

### Scrap の同期

`.github/workflows/scrap-sync.yml` が毎日 18:00 JST に GitHub Issues を読み、公開承認された
スレッドを `content/scraps/` と `content/en/scraps/` に書き出します。手動で実行する場合は
Actions の **Run workflow**、または次のコマンドを使います。

```sh
GITHUB_REPOSITORY=owner/repo SCRAP_OWNER_ID=123 GITHUB_TOKEN=... pnpm scrap:sync
pnpm scrap:sync --dry-run
```

`SCRAP_OWNER_ID` はリポジトリの Variables に設定してください。同期結果は main へ push され、
Docs7 の既存の GitHub 連携でデプロイされます。個別スレッドは `content/docs.json` の
ナビゲーションには追加せず、`/scraps/<node_id>` のパスで配信します。

GitHub Actions の lint は jactionlint と sisakulint で行います。

```sh
mise install
pnpm lint:actions
```

## リポジトリ構成

```
├── content/          # 日本語の MDX（既定言語）
│   ├── docs.json     # ナビゲーション・テーマ・言語設定
│   ├── .docs7ignore  # Docs7 がアップロードしないページ（pnpm docs7:ignore の生成物）
│   ├── index.mdx     # トップページ
│   ├── about.mdx     # プロフィール(技術スタック・作品)
│   ├── blog/         # Blog 一覧(index.mdx)と記事(1 ファイル = 1 ページ)
│   ├── scraps/       # Scrap 一覧(index.mdx)と個別スレッド
│   └── en/           # 英語（同じファイル名で対応させる）
├── src/              # アプリケーションソース(src/app.css など)
├── press.config.tsx  # Fumapress の設定
├── astro.config.mjs  # Astro の設定（Fumapress インテグレーション）
├── src/content.config.ts # Astro のコンテンツコレクション
├── tsconfig.json     # TypeScript の設定
├── AGENTS.md         # AI エージェント向けの開発ドキュメント
└── README.md
```

## ロードマップ

- **Scrap 機能**: Zenn の「Scrap」のようなスレッド機能(GitHub Issue + コメントを時系列スレッドとして表示)。毎日 18:00 JST の同期と手動実行に対応。詳細は [AGENTS.md](./AGENTS.md) を参照。
- **Docs7 デプロイ**: https://merino-dev.docs7.io で本番公開。GitHub App を `blog-2026` に接続し、`main`・`content` からの自動デプロイを設定済み。
