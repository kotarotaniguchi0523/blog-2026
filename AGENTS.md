# blog-2026

## このリポジトリについて

個人ブログ用の公開 GitHub リポジトリ(`blog-2026`)です。

- **フレームワーク**: [Fumapress](https://press.fumadocs.dev)(Fumadocs ベースのコンテンツフレームワーク)。Vite + React + TypeScript で動作します。
- **コンテンツ**: リポジトリ内の MDX ファイルを基本とし、将来的には GitHub Issues もコンテンツの入力として取り込む予定です。
- **ホスティング**: Docs7(Upstash / Context7)を想定しています。Docs7 は Mintlify 互換で、`content/docs.json` と MDX を読み取り、`pnpm docs7:dev` でポート 3333 上に起動します。デプロイは `main` ブランチから行い、各プルリクエストにはプレビューが作成されます。

### Mintlify / Docs7 連携について

`@fumapress/mintlify` は実装の参考資料として扱い、**Docs7 向けの連携を独自に実装します**。同パッケージの採用を前提にしません。Docs7 と Fumapress の公開仕様、型定義、ソースを確認し、対応できる設定と MDX コンポーネントを明示してください。API や設定キーは推測しないでください。

## サイト構成（現状）

公開ページは日本語と英語の 2 言語、各 4 ページです。

| 日本語 | 英語 | 内容 |
| --- | --- | --- |
| `/` | `/en` | 名前・所属・GitHub アイコンだけの入口 |
| `/about` | `/en/about` | 技術スタック（アイコンのみのグリッド）とポートフォリオ／発表物 |
| `/blog` | `/en/blog` | 空の一覧 |
| `/scraps` | `/en/scraps` | 空の一覧（GitHub 同期は未実装） |

- 見た目は `content/style.css` の `.merino-home`（トップ）と `.merino-profile`（プロフィール）で完結させる。
  CSS は Docs7 が `content/style.css` を優先して読み、Fumapress は `src/app.css` から同じファイルを import する。
- プロフィールの作品は「ポートフォリオ」と「発表物」に分ける。外部リンクは文章中の埋め込みではなくボタンに置く。
- 技術スタックは表を使わず、`ul.stack-items` の `li`（アイコン + 名前）を領域ごとに並べる。リンクは埋め込まない。
- サイト名・言語・ナビゲーション・アイコンは `content/docs.json` に集約する。

## Docs7 連携の実装

`src/plugins/docs7/` が docs.json を Fumapress に読み替える。`content/docs.json` を唯一の原本とし、
Docs7 とローカルプレビューで同じ設定を共有する。

- `config.ts`: docs.json の Zod スキーマ（意図的に「対応サブセットのみ」を許可）、ページツリー生成、テーマ CSS。
- `plugin.ts`: サイト名・テーマ色・外観・サイドバー・ナビバーの Fumapress フックへの変換。
- `adapter.ts` / `components.ts`: Docs7 の MDX コンポーネントを Fumadocs UI に変換。
- `vite.ts`: docs.json の変更で開発サーバーを再起動する。

対応する設定: `name` / `theme` / `colors` / `appearance` / `icons.library` / `seo.indexing` /
`navbar.links` / `navigation.{groups,pages,languages}`。未対応キーは起動時に例外にする。

Docs7 の挙動として確認済みの制約:

- ページ上部のアクションは「Copy as Markdown」だけで固定。`contextual.options`（`chatgpt` / `claude` /
  `perplexity` など）はスキーマにはあるが、レンダラー 0.1.61 では `display: header` / `toc` のどちらでも
  追加のアクションが描画されない（ローカル 0.1.61 と本番の両方で確認）。有効化できないため docs.json には書かない。
  ヘッダーの「Ask AI」は別機能として使える。

- 言語ごとの `navbar.links` は切り替わらない（グローバル設定のみ反映）。そのため Blog / Scrap は
  ヘッダーではなく言語別のサイドバーに置く。
- `navigation.languages` の `en` 側ページは `en/index` のように言語ディレクトリ込みで列挙する。
- `/en` でも `<html lang="ja">` が出力される（Docs7 レンダラー側の挙動。こちらでは制御できない）。

## 編集（Fumadocs Studio）

`pnpm editor`（`127.0.0.1:5180`）で `content/` の MDX を編集する。英語ページも `content/en/` 配下として同じ手順で編集できる。

- `fumadocs-studio.config.ts` が `root: "content"`、`components`、`styles` を指定する。
- `studio/profile-components.tsx` が Visual タブで入力できる要素を定義する。
  `div` / `section` / `nav` / `ul` / `li` は本文領域、`p` / `h2` / `h3` はテキスト領域、
  `img` は props（`src` / `alt` / `width` / `height`）で編集する。`ul` は `li` のリストとして扱う。
- `studio/style.css` は Studio の領域ラッパーを `display: contents` にする編集専用の調整。
- Studio の表示は公開画面の完全なプレビューではない。公開時の見た目は `pnpm docs7:dev` で確認する。

## コンテンツ入力

1. **リポジトリ内の MDX ファイル**(現状。`content/` 以下に配置)
2. **GitHub Issues**(任意・将来対応)

## 多言語（日本語が正）

- `content/` 直下の MDX が日本語で、既定言語。英語は `content/en/` に同じファイル名で置く。
- **日本語が正**。日本語を変更したら、同じ変更の中で `content/en/` の対応ファイルも更新する。
  英語の更新を後回しにする場合でも、日本語だけを push しない。
- ページの追加・削除・並びは `content/docs.json` の `navigation.languages` に言語ごとに書く。
  `en` のページは `en/index` のように言語ディレクトリを含めたパスで列挙する。
- Docs7 は言語ごとの navbar を切り替えられない（確認済み）。そのためグローバルな
  `navbar.links` は使わず、Blog / Scrap を含む全ページをサイドバーの `pages` に列挙する。

## 計画中のカスタム機能: Zenn「Scrap」風スレッド

Zenn の Scrap のようなスレッド機能を検討しています。**まだ実装していません。**
`/scraps` と `/en/scraps` は空の一覧ページとして公開済みで、同期処理・UI は未着手です。

### スケッチ

- **Scrap = GitHub Issue 1 件**(title, body, author, createdAt)+ **順序付きコメント**(body, author, createdAt)
- データモデル(正規化後・イメージ):
  ```ts
  interface Scrap {
    id: string; // GitHub Issue の node_id を使用する方針。公開 URL の識別子
    issueNumber: number; // GitHub API の取得・更新用。公開 URL には使用しない
    title: string;
    body: string;
    author: string; // GitHub ユーザー名
    createdAt: string; // ISO 8601
    state: "open" | "closed"; // GitHub Issue の状態と同期
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
  - `/scraps/[id]` — 個別スレッド
- UI 要件: 時系列スレッドとして読める表示、オーナー(リポジトリ所有者)とコメント投稿者の区別、相対時刻の表示、GitHub へのリンク。
- GitHub Issue が Open なら Scrap も Open、Closed なら Closed。再オープンも同期する。開閉状態と公開状態は別に管理し、Close を非公開の意味にしない。

### 公開操作と自動ラベル付け

- 利用者の要件: GitHub 上で公開用リアクションを付けると、非同期でブログへ反映する。
- GitHub のリアクションに独自の `Post` は追加できないため、既存の 🚀 (`rocket`) を公開操作に割り当てる案とする。
- GitHub にリアクション追加の Webhook / Actions トリガーはない。リアクションは API で定期取得して検出する。Issue / コメントの編集イベントだけでリアクション変更を検出できるとは扱わない。
- 公開操作を認めるアカウントを明示的に設定し、それ以外の利用者のリアクションでは公開しない。
- Issue 本文とコメントのどこに付けたリアクションをどの範囲へ適用するかは、下記の実装案を出発点にする。確定済み要件と混同しない。
- 自動ラベル付けの案: Scrap 専用 Issue テンプレートで `labels: [scrap]` を指定する。ラベルはリポジトリに事前作成が必要。通常の Issue は一括で Scrap にしない。
- テンプレート外の既存 Issue も、許可アカウントの公開用リアクションを検出した際に `scrap` ラベルを付けて取り込める設計とする。

### 非同期公開の実装案（未実装）

- Issue 本文の 🚀 をスレッドと本文の公開操作、各コメントの 🚀 をそのコメントの公開操作とする。未承認コメントはブログに含めない。親スレッド未公開時はコメントも公開しない。
- 定期同期で対象 Issue とリアクションをページネーション付きで取得し、許可アカウントを確認して、公開スナップショットを生成する。
- 再実行しても重複しないよう Issue / コメントの ID と内容ハッシュを管理する。失敗時は前回の公開データを保持し、次回再試行する。
- 初期案は GitHub Actions の定期実行（例: 5 分間隔）と手動実行。実行遅延があり、公開までの時間は保証しない。より短い遅延が必要なら別の定期ジョブ基盤を検討する。
- Issue の closed / reopened、本文・コメントの編集と削除も同期対象。公開後の編集を自動反映するか、再承認を要求するか、リアクション削除で公開を取り下げるかは実装前に決める。
- 同期結果から Docs7 向けのファイルを生成する方法と、公開環境への更新方法は Docs7 の実際の仕様を確認して決める。Docs7 が任意の React サーバーを実行できるとは仮定しない。

### 未解決の質問

- 公開リアクションの確定、許可アカウント、本文とコメントの公開単位、編集の再承認・公開取り下げの方針
- 非同期ジョブの実行基盤、許容遅延、公開データの保存場所と Docs7 の更新方法
- GitHub API のレート制限・認証(トークン)の扱い
- オーナー判定をどう定義するか(リポジトリ所有者?コメント毎の区分は?)
- 相対時刻の更新戦略(SSR での初回表示とクライアントでの更新)

## 開発ルール

### コマンド

| 目的 | コマンド |
| --- | --- |
| Fumapress 開発サーバー | `pnpm dev` |
| Docs7 プレビュー（公開と同じ見た目、3333） | `pnpm docs7:dev` |
| Studio（編集、5180） | `pnpm editor` |
| 静的ビルド | `pnpm build` |
| テスト | `pnpm test` |
| 型検査 | `pnpm types:check` |
| 未使用検出 | `pnpm knip` |

### Windows バインドマウント(SBX)制約

このディレクトリは Windows のバインドマウント上にあり、**シンボリックリンクを作成できません**。そのため:

- シンボリックリンクを前提とする依存配置を使用しないこと。パッケージマネージャーは以下の指定に従う。
- npm scripts は `node_modules/.bin` に依存しないこと。CLI は `node` でエントリファイルを直接呼び出す(例: `node node_modules/fumapress/cli.js dev`)。

### パッケージマネージャー

- 利用者の決定により pnpm 12.15.0 を使用する。`package.json` の `packageManager` で固定する。npm / upm で依存を導入しない。
- コマンドは SBX の Linux シェルで実行する。Windows ホストの Node・pnpm・Git に切り替えない。OS ごとのネイティブ依存があるため、Windows で作成した `node_modules` を使い回さない。
- リンク制約への対応として `pnpm-workspace.yaml` に `nodeLinker: hoisted` と `preferSymlinkedExecutables: false` を指定する。pnpm が PATH にない場合は `corepack pnpm` で固定版を実行する。
- 正式なロックファイルは `pnpm-lock.yaml`。開発環境・CI の再現インストールは `pnpm install --frozen-lockfile` を使用する。
- 移行前の `upm.lock` と `package-lock.json` は削除済み。再作成しない。
- CLI はプロジェクトの依存としてインストールする。npx による実行は禁止し、pnpm scripts から `node` で直接呼び出す。
- 依存のビルドスクリプトは内容を確認して `allowBuilds` で個別に許可・拒否する。

### その他

- `git init`、GitHub リポジトリ作成、コミットは親エージェントの担当(このセッションでは行わない)。
- 未確認のパッケージ・API・設定キーを推測しない。不明なら `node_modules` や公開メタデータを確認する。
- 不要ファイル・依存・エクスポートは `pnpm knip` で確認する。Fumapress の仮想モジュール経由の入口は `knip.jsonc` に明示し、検出を避けるためにソース全体を entry / ignore にしない。
