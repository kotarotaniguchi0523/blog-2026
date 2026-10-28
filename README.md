# blog-2026

個人ブログです。[Fumapress](https://press.fumadocs.dev)(Fumadocs ベースのコンテンツフレームワーク、Vite + React)で構築しています。ホスティングは Docs7(Upstash / Context7、Mintlify 互換)を想定しています。

## 必要なもの

- Node.js 24
- pnpm 12.15.0（`package.json` で固定）

## セットアップ

SBX の Linux 環境と Windows ホストで利用します。バインドマウント上のリンク制約に対応するため、`pnpm-workspace.yaml` で `hoisted` 配置と実行ファイルのリンク無効化を設定しています。

```sh
pnpm install --frozen-lockfile
```

依存を追加・更新するときは `pnpm add` / `pnpm update` を使い、`pnpm-lock.yaml` も更新します。scripts は `node_modules/.bin` に依存せず、CLI エントリを `node` で直接呼び出しています。依存のインストール時スクリプトは必要なものを確認して個別に許可します。

## 開発

```sh
pnpm run dev
```

## ビルド

```sh
pnpm run build
```

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
├── content/          # MDX コンテンツ(ブログ記事)
│   └── index.mdx     # トップページ
├── src/              # アプリケーションソース(src/app.css など)
├── press.config.tsx  # Fumapress の設定
├── vite.config.ts    # Vite の設定
├── tsconfig.json     # TypeScript の設定
├── AGENTS.md         # AI エージェント向けの開発ドキュメント
└── README.md
```

## ロードマップ

- **Scrap 機能**: Zenn の「Scrap」のようなスレッド機能(GitHub Issue + コメントを時系列スレッドとして表示)。詳細は [AGENTS.md](./AGENTS.md) を参照。**未実装**。
- **Docs7 デプロイ**: 独自プラグインとローカルプレビューを設定済み。Docs7 のサイト作成・GitHub 接続・公開は未実施。
