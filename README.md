# blog-2026

個人ブログです。[Fumapress](https://press.fumadocs.dev)(Fumadocs ベースのコンテンツフレームワーク、Vite + React)で構築しています。ホスティングは Docs7(Upstash / Context7、Mintlify 互換)を想定しています。

## 必要なもの

- Node.js 24

## セットアップ

> **注意**: このリポジトリは Windows のバインドマウント上で作業することがあり、シンボリックリンクが使えません。そのためインストールは必ず `bin-links` を無効にして行います。

```sh
npm_config_bin_links=false npm install
```

npm scripts も `node_modules/.bin` に依存せず、CLI エントリを `node` で直接呼び出しています。

## 開発

```sh
npm run dev
```

## ビルド

```sh
npm run build
```

## 型チェック

```sh
npm run types:check
```

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
- **Docs7 デプロイ**: `docs.json` + MDX 構成で Docs7(Mintlify 互換)へデプロイ(`main` ブランチからデプロイ、PR ごとにプレビュー)。
