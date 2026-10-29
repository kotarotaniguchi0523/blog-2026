# blog-2026

個人ブログです。[Fumapress](https://press.fumadocs.dev)(Fumadocs ベースのコンテンツフレームワーク、Vite + React)で構築しています。ホスティングは Docs7(Upstash / Context7、Mintlify 互換)を想定しています。

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

**この環境（`node_modules` は WSL の Linux 版）では Windows 側の `pnpm editor` は起動しません。**
Windows の Node には Linux 版のネイティブバインディング（rolldown / esbuild など）が読み込めないためです。
WSL で CLI を直接起動し、Windows のブラウザから開きます（WSL の 127.0.0.1 は Windows の localhost に転送されます）。

```sh
wsl
cd /mnt/c/Users/r02ta/projects/blog-2026
node node_modules/@fumadocs-editor/studio/dist/cli.js --config fumadocs-studio.config.ts
```

`pnpm install` が必要なのは、初回 clone 時・`package.json` / `pnpm-lock.yaml` を変更したとき・
OS（WSL と Windows）を切り替えたときだけです。`node_modules` は OS ごとに作り直してください。

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
どちらも現在は記事・スレッドのない一覧ページです。Scrap の GitHub 同期は未実装です。

### 日本語と英語

`content/` 直下が日本語（既定言語）、`content/en/` が英語です。`/` が日本語、`/en` が英語で、
Fumapress は `i18n`（`parser: "dir"`, `hideLocale: "default-locale"`）で同じ構成を読みます。

**日本語が正**です。日本語のページを変更したら、同じ変更で `content/en/` の対応ファイルも更新してください。
ページの追加・並びは `content/docs.json` の `navigation.languages` に言語ごとに書きます。

導入方法・Node 要件は [公式 Studio ドキュメント](https://editor.fumadocs.dev/studio) を参照。

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

GitHub の取得層は `@octokit/core` とページネーション用プラグインを使います。
テストには Vercel Labs の `emulate` を使い、実 GitHub のトークンなしで実行できます。

```sh
pnpm test
```

取得層の使い方、配布来歴の確認結果、エミュレーターの対応範囲は
[GitHub 取得層と API エミュレーター](./docs/github-client-and-testing.md)を参照してください。
Scrap の公開処理・UI はまだ未実装です。

## リポジトリ構成

```
├── content/          # 日本語の MDX（既定言語）
│   ├── docs.json     # ナビゲーション・テーマ・言語設定
│   ├── index.mdx     # トップページ
│   ├── about.mdx     # プロフィール(技術スタック・作品)
│   ├── blog.mdx      # Blog 一覧
│   ├── scraps.mdx    # Scrap 一覧
│   └── en/           # 英語（同じファイル名で対応させる）
├── src/              # アプリケーションソース(src/app.css など)
├── press.config.tsx  # Fumapress の設定
├── vite.config.ts    # Vite の設定
├── tsconfig.json     # TypeScript の設定
├── AGENTS.md         # AI エージェント向けの開発ドキュメント
└── README.md
```

## ロードマップ

- **Scrap 機能**: Zenn の「Scrap」のようなスレッド機能(GitHub Issue + コメントを時系列スレッドとして表示)。詳細は [AGENTS.md](./AGENTS.md) を参照。**未実装**。
- **Docs7 デプロイ**: https://merino-dev.docs7.io で本番公開。GitHub App を `blog-2026` に接続し、`main`・`content` からの自動デプロイを設定済み。
