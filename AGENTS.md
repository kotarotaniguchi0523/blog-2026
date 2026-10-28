# blog-2026

## このリポジトリについて

個人ブログ用の公開 GitHub リポジトリ(`blog-2026`)です。

- **フレームワーク**: [Fumapress](https://press.fumadocs.dev)(Fumadocs ベースのコンテンツフレームワーク)。Vite + React + TypeScript で動作します。
- **コンテンツ**: リポジトリ内の MDX ファイルを基本とし、将来的には GitHub Issues もコンテンツの入力として取り込む予定です。
- **ホスティング**: Docs7(Upstash / Context7)を想定しています。Docs7 は Mintlify 互換で、`docs.json` と MDX を読み取り、`npx @upstash/docs7 dev` でポート 3333 上に起動します。デプロイは `main` ブランチから行い、各プルリクエストにはプレビューが作成されます。

### Mintlify / Docs7 連携について

`@fumapress/mintlify` は Fumapress の Mintlify 自動移行パッケージです。Docs7(Mintlify 互換)の `docs.json` + MDX コンテンツを Fumapress に組み込む際はこちらを使います。ただし **API を推測せず、使用前に必ず公開されている型定義やソースを読んで確認してください**(例: `node_modules/@fumapress/mintlify/`、または npm の公開メタデータ)。

## コンテンツ入力

1. **リポジトリ内の MDX ファイル**(現状。`content/` 以下に配置)
2. **GitHub Issues**(任意・将来対応)

## 計画中のカスタム機能: Zenn「Scrap」風スレッド

Zenn の Scrap のようなスレッド機能を検討しています。**まだ実装していません。**

### スケッチ

- **Scrap = GitHub Issue 1 件**(title, body, author, createdAt)+ **順序付きコメント**(body, author, createdAt)
- データモデル(正規化後・イメージ):
  ```ts
  interface Scrap {
    number: number; // GitHub Issue 番号(URL にも使用)
    title: string;
    body: string;
    author: string; // GitHub ユーザー名
    createdAt: string; // ISO 8601
    comments: ScrapComment[];
  }

  interface ScrapComment {
    body: string;
    author: string;
    createdAt: string;
  }
  ```
- ルート:
  - `/scraps` — Scrap 一覧
  - `/scraps/[number]` — 個別スレッド
- UI 要件: 時系列スレッドとして読める表示、オーナー(リポジトリ所有者)とコメント投稿者の区別、相対時刻の表示、GitHub へのリンク。

### 未解決の質問

- Scrap として扱う Issue の絞り込み方法(ラベル?特定の Issue 一覧?)
- 取得タイミング(ビルド時 / リクエスト時)とキャッシュ方針
- GitHub API のレート制限・認証(トークン)の扱い
- オーナー判定をどう定義するか(リポジトリ所有者?コメント毎の区分は?)
- 相対時刻の更新戦略(SSR での初回表示とクライアントでの更新)

## 開発ルール

### Windows バインドマウント(SBX)制約

このディレクトリは Windows のバインドマウント上にあり、**シンボリックリンクを作成できません**。そのため:

- このディレクトリで素の `npm install` を実行しないこと。必ず `npm_config_bin_links=false npm install` を使う。
- npm scripts は `node_modules/.bin` に依存しないこと。CLI は `node` でエントリファイルを直接呼び出す(例: `node node_modules/fumapress/cli.js dev`)。

### その他

- `git init`、GitHub リポジトリ作成、コミットは親エージェントの担当(このセッションでは行わない)。
- 未確認のパッケージ・API・設定キーを推測しない。不明なら `node_modules` や公開メタデータを確認する。
