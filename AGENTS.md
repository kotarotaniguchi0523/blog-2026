# blog-2026

## このリポジトリについて

個人ブログ用の公開 GitHub リポジトリ(`blog-2026`)です。

- **フレームワーク**: [Fumapress](https://press.fumadocs.dev)(Fumadocs ベースのコンテンツフレームワーク)を `@fumapress/astro` で Astro 上に載せています。React + TypeScript。
- **コンテンツ**: リポジトリ内の MDX ファイルを基本とし、将来的には GitHub Issues もコンテンツの入力として取り込む予定です。
- **ホスティング**: Docs7(Upstash / Context7)を想定しています。Docs7 は Mintlify 互換で、`content/docs.json` と MDX を読み取り、`pnpm docs7:dev` でポート 3333 上に起動します。デプロイは `main` ブランチから行い、各プルリクエストにはプレビューが作成されます。

## 公開ルール（必須）

このリポジトリでは、公開操作に必ず人間の明示的な許可を必要とする。

- エージェントは `status: draft` のページ作成、ローカルプレビュー、変更の提案までを行う。
- `status: published` への変更、`main` への push、Docs7 の本番デプロイは、人間の許可を得てから行う。
  許可を求めるときは、対象ページ、`git diff`、プレビューで確認した URL を示す。
- 公開前チェックとして `pnpm content:check` を必ず実行する。Docs7 の ignore、Blog 一覧、
  テスト、型検査、ビルドをまとめて検証する。CI でも同じコマンドを実行する。
- `main` への変更は、`Content checks` が成功した PR を人間が承認してからマージする。
  GitHub のブランチ保護でこのチェックを必須にする（設定はリポジトリ管理者が行う）。
- Scrap の公開は、リポジトリオーナーが GitHub Issue に公開リアクション（既定 `rocket`）を
  付けた場合だけ行われる。エージェントはリアクションを追加せず、`SCRAP_OWNER_ID` も変更しない。
  承認リアクションに基づく Scrap 同期の自動 push は、この許可の例外とする。
- `draft` は Fumapress のビルドに含まれず、Docs7 でも `content/.docs7ignore` により
  アップロードされない。ただし ignore が古いまま push すると Docs7 は draft を配信する（確認済み）。
  そのため `.docs7ignore` の再生成漏れはテストと CI で落とす。

### Mintlify / Docs7 連携について

`@fumapress/mintlify` は実装の参考資料として扱い、**Docs7 向けの連携を独自に実装します**。同パッケージの採用を前提にしません。Docs7 と Fumapress の公開仕様、型定義、ソースを確認し、対応できる設定と MDX コンポーネントを明示してください。API や設定キーは推測しないでください。

## サイト構成（現状）

公開ページは日本語と英語の 2 言語、各 4 ページです。

| 日本語 | 英語 | 内容 |
| --- | --- | --- |
| `/` | `/en` | 名前・所属・GitHub アイコンだけの入口 |
| `/about` | `/en/about` | 技術スタック（アイコンのみのグリッド）とポートフォリオ／発表物 |
| `/blog` | `/en/blog` | 記事一覧（`content/blog/*.mdx` から生成） |
| `/scraps` | `/en/scraps` | スレッド一覧（GitHub Issue の同期で生成） |

- 見た目は `content/style.css` の `.merino-home`（トップ）と `.merino-profile`（プロフィール）で完結させる。
  CSS は Docs7 が `content/style.css` を優先して読み、Fumapress は `src/app.css` から同じファイルを import する。
- CSS は Baseline で広く使える機能だけを使い、プリプロセッサを挟まない（CSS ネスティング、`:is()`、
  `color-mix()`、論理プロパティ、`margin-block` など）。Docs7 は生の CSS を配信するため、
  ビルド済みブラウザで解釈できる構文に限る。
- プロフィールの作品は「ポートフォリオ」と「発表物」に分ける。外部リンクは文章中の埋め込みではなくボタンに置く。
- 技術スタックは表を使わず、`ul.stack-items` の `li`（アイコン + 名前）を領域ごとに並べる。リンクは埋め込まない。
- サイト名・言語・ナビゲーション・アイコンは `content/docs.json` に集約する。

## Docs7 連携の実装

`src/plugins/docs7/` が docs.json を Fumapress に読み替える。`content/docs.json` を唯一の原本とし、
Docs7 とローカルプレビューで同じ設定を共有する。

- `config.ts`: docs.json の Zod スキーマ（意図的に「対応サブセットのみ」を許可）、ページツリー生成、テーマ CSS。
- `plugin.ts`: テーマ色（`head`）・外観（`providerProps`）・ナビバー（`layoutProps`）・サイドバー
  （`configureLoader` で追加するローダープラグインの `transformPageTree.root`）の Fumapress 2 フックへの変換。
  サイト名は Fumapress 2 ではプラグインから書き換えられないため、`press.config.tsx` が docs.json を一度だけ読み、`site.name` と `docs7Plugin(config)` に渡す。
- `mdx.ts` / `components.ts`: Docs7 の MDX コンポーネントを Fumadocs UI に変換。`mdx.ts` は
  `astro.config.mjs` の `press({ components })` に渡すモジュール（相対リンクは Fumapress が解決する）。
  本文は React の island としてブラウザでも描画されるため、props はシリアライズ可能に保ち、サーバー専用コードを import しない。
- `astro.ts`: docs.json の変更で開発サーバーを再起動する Astro インテグレーション（`addWatchFile`）。

対応する設定: `name` / `theme` / `colors` / `appearance` / `icons.library` / `seo.indexing` /
`contextual.options` / `navbar.links` / `navigation.{groups,pages,languages}`。
未対応キーは起動時に例外にする。

Docs7 の挙動として確認済みの制約:

- `contextual.options`（`copy` / `view` / `chatgpt` / `claude` / `perplexity` など）は Docs7 のスキーマにあり
  docs.json で受理されるが、レンダラー 0.1.61 は `copy` 以外を描画しない。確認手順:
  本番ビルドに設定を入れてデプロイ完了を確認（ページ内マーカーで検証）→ hydration 後の DOM に
  `[role=menu]` / `[aria-haspopup]` / ChatGPT・Claude へのリンクが 0 件。レンダラーのバンドルにも
  "Open in ChatGPT" 等の文言と `chatgpt.com` / `claude.ai` の URL が存在しない。
  Mintlify 側の仕様（`contextual.options` で ChatGPT / Claude 等を追加）とはここが一致していない。
  Docs7 が対応したときのために設定は docs.json に残している（現状は効果なし）。


- 言語ごとの `navbar.links` は切り替わらない（グローバル設定のみ反映）。そのため Blog / Scrap は
  ヘッダーではなく言語別のサイドバーに置く。
- `navigation.languages` の `en` 側ページは `en/index` のように言語ディレクトリ込みで列挙する。
- `/en` でも `<html lang="ja">` が出力される（Docs7 レンダラー側の挙動。こちらでは制御できない）。
- ヘッダーの言語切り替えは、Docs7 が持つドロップダウン（`#localization-select-trigger`）を隠し、
  同じ要素内のリンク一覧（`#localization-select-content`）を `content/style.css` で常時表示して
  `EN | JA` に見せている。Docs7 のマークアップに依存するため、レンダラー更新で崩れたらこのブロックを見直す。
- その言語切り替えは Docs7 の仕様で**相手言語のトップページ**（`/` ↔ `/en`）へ移動する。同じページの対訳へは飛ばない。
  移動後のサイドバーは自動でその言語のリンク（`/en/about` など）に切り替わる。

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

## 公開状態（frontmatter `status`）

- 各ページの frontmatter は `status: published` のときだけ公開する。指定がなければ `draft`
  （`src/content/publication.ts` の `pageStatusSchema` が既定値）。`published` 以外の値は検証エラー。
- Astro / Fumapress は `src/content.config.ts` の `publishedOnly(pageLoader())` が `draft` を
  コレクションから落とすため、`draft` のページはルートにもページツリーにも現れない。
- Docs7 のアップロード対象は `content/.docs7ignore` で決まる。`pnpm docs7:ignore` が
  `status` を見てこのファイルを生成する。`status` を切り替えたら実行し、生成物も同じ変更で
  コミットする。`pnpm docs7:ignore --check` は書き込みなしで差分だけを検査する。
- Docs7 はアップロードされた MDX を frontmatter の `status` では判定しない。ignore が古いまま
  push すると、`draft` でも配信される（Docs7 レンダラー 0.1.61 のローカルプレビューで確認済み）。
  再生成漏れは `pnpm content:check` と CI で落とす。
- `draft` のページを `content/docs.json` のナビゲーションに書かない。Docs7 のナビゲーションは
  公開判定ではなく、`draft` はアップロードされないため 404 になる（Fumapress のビルドも
  `Navigation page not found` で失敗する）。`tests/content/docs7-ignore.test.ts` が
  ignore ファイルのずれとナビゲーション参照を検出する。

## Blog 記事（`content/blog/`）

- 記事は `content/blog/<slug>.mdx`、英語は `content/en/blog/<slug>.mdx` に置く。 slug は
  `[A-Za-z0-9_-]+` に限り、ファイル名がそのまま `/blog/<slug>` の URL になる。
  サブディレクトリは使わない（1 ファイル = 1 ページ）。
- frontmatter は `title`（必須）、`description`、`date`（`YYYY-MM-DD`）、`status`。
  `status: published` の記事だけが一覧に載る。
- 一覧 `content/blog/index.mdx` / `content/en/blog/index.mdx` は `pnpm blog:index` の生成物。記事を追加・改名・
  削除したら実行する。`pnpm blog:index --check` は書き込みなしで再生成漏れを検査する。
- `tests/blog/index.test.ts` が、コミット済みの一覧と `content/blog/` の内容のずれを検出する。

## カスタム機能: Zenn「Scrap」風スレッド

Zenn の Scrap のようなスレッド機能を実装しています。公開判定・入力検証（`src/scrap/publication.ts` / `src/scrap/schema.ts`）、GitHub 取得、同期ジョブ、生成 MDX の一覧・個別ページまで実装済みです。相対時刻の自動更新や検索はまだありません。
`/scraps` と `/en/scraps` は同期結果を表示する一覧ページで、`/scraps/<node_id>` に個別スレッドを生成します。

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
- 公開操作はリポジトリオーナーの GitHub ユーザー ID と一致するリアクションのみに限定し、それ以外の利用者（Issue 作成者を含む）のリアクションでは公開しない。
- Issue 本文とコメントのどこに付けたリアクションをどの範囲へ適用するかは、下記の実装案を出発点にする。確定済み要件と混同しない。
- 自動ラベル付けの案: Scrap 専用 Issue テンプレートで `labels: [scrap]` を指定する。ラベルはリポジトリに事前作成が必要。通常の Issue は一括で Scrap にしない。
- テンプレート外の既存 Issue も、リポジトリオーナーの公開用リアクションを検出した際に `scrap` ラベルを付けて取り込める設計とする。

### 公開判定（実装済み）

- `src/scrap/schema.ts` の `parsePublicationPolicy` が設定を検証し、`src/scrap/publication.ts` の `buildScrapSnapshot` が検証済みの Issue・コメント・リアクションから公開スナップショットを作る。I/O・時計・環境変数には触れない。
- GitHub の応答は `src/scrap/schema.ts` で Valibot により検証する。Octokit の型で緩い `body` の省略（Issue は `null`、コメントは必須）、`state` の任意文字列、コメント ID の `number | bigint` を境界で正規化し、未知のフィールドは落とす。検証失敗は `ValiError` にして、未承認の素材を公開しない。
- `ScrapId` / `CommentId` / `GitHubLogin` / `GitHubUserId` / `IsoTimestamp` は実行時の `unique symbol` を使ったブランド型。`ContentHash` も出力専用のブランド型で、ID・ログイン・時刻・ハッシュの取り違えをコンパイル時に防ぐ。
- `state` は `open` / `closed` に限定し、数値 ID は安全な整数へ正規化する。`parsePublicationPolicy` はオーナーを不変の GitHub ユーザー ID (`ownerId`) として検証する。設定オブジェクトの未知キーは例外にし、`reaction` の typo や古い `owner` / `approvers` 設定で権限を広げられないようにする。公開リアクションの設定は GitHub の8種類に限定する。リアクション応答の `content` は将来の追加に備えて任意の非空文字列を許し、承認判定に一致しなければ無視する。
- 既定の公開リアクションは `rocket`。オーナーは `parsePublicationPolicy` に渡す `ownerId` で決め、比較は不変のユーザー ID で行う。ログインは変更・再利用され得るため認可には使わない。`ownerId` はリポジトリ所有者の GitHub ユーザー ID と一致させる。
- Issue の承認リアクションがスレッド全体の前提。コメントは個別の承認リアクションが必要で、未承認コメントはスナップショットに含めない。
- Close は非公開にしない。`state: 'closed'` のまま公開を続ける。
- 現在のリアクション状態をそのまま反映する。承認リアクションを外すと次回のスナップショットから消える（現時点の既定）。Issue タイトル・本文、承認済みコメント本文の編集は次回同期でそのまま反映し、再承認は要求しない（確定）。
- `contentHash` は公開内容（Issue の id・title・body・state・author と、公開コメントの id・body・author）だけから計算する。タイムスタンプや、公開対象を変えないリアクション、`issueNumber` は含めない。
- 公開 URL の識別子には `issue.node_id` を使う。Docs7 はファイルパスをそのまま URL にするため、`^[A-Za-z0-9_-]+$` を検証したうえで `encodeURIComponent` した値を URL とファイル名の両方に使う。検証に失敗する ID は同期を失敗させる。`issueNumber` は API 用にスナップショットへ残すが、URL には使わない。

### 非同期公開（実装済み）

- Issue 本文の 🚀 をスレッドと本文の公開操作、各コメントの 🚀 をそのコメントの公開操作とする。未承認コメントはブログに含めない。親スレッド未公開時はコメントも公開しない。
- `src/scrap/sync.ts` が `listIssues` → `getScrapThread` → `buildScrapSnapshot` の順に処理し、公開されたスレッドだけを MDX に書き出す。出力は `content/scraps/index.mdx` / `content/en/scraps/index.mdx` と各 `content/scraps/<node_id>.mdx` / `content/en/scraps/<node_id>.mdx`。
- 出力は決定的に生成し、変更のあるファイルだけを書き換える。`contentHash` はスナップショットに含まれるが、保存状態は git の差分で管理する。生成マーカーのある古いページは削除する。失敗時は書き込まず、前回の公開データを保持して次回再試行する。
- `src/github/reader.ts` の `getScrapThread` が GraphQL で Issue・コメント・リアクションをページ単位にまとめる。コメントごとの REST リアクション取得は通常経路で行わない。
- リアクションには Webhook イベントがないため、承認検出は定期同期を必須とする。コメント投稿・編集の Webhook / GitHub Actions イベントは本文の即時反映には使えるが、承認検出の代替にはならない。
- `.github/workflows/scrap-sync.yml` が毎日 18:00 JST（09:00 UTC）に実行する。Actions の `Run workflow`（`workflow_dispatch`）から手動でも実行できる。実行遅延があり、公開までの時間は保証しない。
- Issue の closed / reopened、本文・コメントの編集と削除も同期対象。編集は次回同期で自動反映し、再承認は要求しない（確定）。リアクション削除による取り下げは現時点の既定。
- 同期結果は main へ push し、Docs7 の既存の GitHub 連携でデプロイする。Docs7 は任意の React サーバーを実行しない。個別ページは `content/docs.json` のナビゲーションに追加しない。Docs7 がナビゲーション外の MDX もパスで配信することはローカルプレビューで確認済み。

### 未解決の質問

- 公開リアクション（既定 `rocket`）とオーナーの `ownerId` は `parsePublicationPolicy` の設定として実装済み。公開単位は Issue 本文とコメント単位に固定し、コメントは個別承認を要求する。編集は承認継続で確定。リアクション削除で次回非公開、は現時点の既定。
- 日次 18:00 JST の反映遅延で足りるか（より短い間隔や手動実行の運用が必要か）
- GitHub API のレート制限・認証(トークン)の扱い。同期失敗時の再試行とバックオフ
- Organization 所有リポジトリで、公開を許可する管理者1名の GitHub ユーザー ID を `ownerId` にするか（Organization 自身はリアクションできないため、管理者ユーザーを明示する必要がある）
- 相対時刻の更新戦略(SSR での初回表示とクライアントでの更新)

## 開発ルール

### 作業環境

- **コマンドは Docker Sandboxes の `opencode-blog-2026` で実行する**。ホスト（Windows）からは
  `sbx exec opencode-blog-2026 -- bash -lc 'cd /c/Users/r02ta/projects/blog-2026 && …'`、
  サンドボックス内のシェルからは `/c/Users/r02ta/projects/blog-2026` で直接実行する。
- **WSL の `bash.exe` は使わない。** サンドボックスと WSL は別環境で、正規の環境はサンドボックス。
- Windows ホストの Node / pnpm でリポジトリのコマンドを実行しない。`node_modules` はサンドボックスの
  Linux 版（`@esbuild/linux-x64` など）なので、ホストではネイティブバインディングが読み込めない。
- `sbx policy approval` はホスト側で実行する。Docs7 プレビューの初回は
  `b3a38d39ac3c.blob.upstash.io`（レンダラー配布）への通信許可が必要。

### コマンド

| 目的 | コマンド |
| --- | --- |
| Fumapress 開発サーバー（Astro、4321） | `pnpm dev`（Astro 7 はエージェント環境ではバックグラウンドで起動する。`node node_modules/astro/bin/astro.mjs dev logs` / `dev stop`） |
| Docs7 プレビュー（公開と同じ見た目、3333） | `pnpm docs7:dev` |
| Studio（編集、5180） | `pnpm editor` |
| 静的ビルド（`dist/`） | `pnpm build` |
| ビルド結果の確認 | `pnpm preview` |
| テスト | `pnpm test` |
| 公開前チェック（ignore・Blog 一覧・テスト・型・ビルド） | `pnpm content:check` |
| 型検査 | `pnpm types:check` |
| Docs7 の ignore ファイル生成（`--check` で差分のみ） | `pnpm docs7:ignore` |
| 未使用検出 | `pnpm knip` |
| GitHub Actions の lint | `pnpm lint:actions` |
| Blog 一覧の生成（`--check` で差分のみ） | `pnpm blog:index` |
| Scrap の手動同期（`--dry-run` で書き込みなし） | `pnpm scrap:sync` |

### Scrap の定期同期

- `.github/workflows/scrap-sync.yml` が毎日 18:00 JST（09:00 UTC）に実行する。Actions の
  `Run workflow`（`workflow_dispatch`）から手動でも実行できる。
- `SCRAP_OWNER_ID` はリポジトリの **Variables** に置く。値は公開を許可する GitHub ユーザーの
  不変 ID（このリポジトリなら `kotarotaniguchi0523` の `119092698`）。
- 生成物は `content/scraps/index.mdx` / `content/en/scraps/index.mdx` と、公開された各スレッドの
  `content/scraps/<node_id>.mdx` / `content/en/scraps/<node_id>.mdx`。個別ページは
  `content/docs.json` のナビゲーションに追加しない。Docs7 はナビゲーション外の MDX も
  パスで配信することをローカルプレビューで確認済み。
- 権限は job 単位で付与する。ワークフロー直下の `permissions: {}` は default-deny のためだけに
  置き、`contents: write` / `issues: read` などの実権限は job に置く。
- GitHub Actions の lint は `mise install` で入る jactionlint / sisakulint / shellcheck を使う。
  `pnpm lint:actions` は jactionlint の pedantic + strict-exit と sisakulint を実行し、
  オンライン検査は `LINT_ACTIONS_ONLINE=1` で有効になる。CI は
  `.github/workflows/actions-lint.yml`。

### Windows バインドマウント(SBX)制約

このディレクトリは Windows のバインドマウント上にあり、**シンボリックリンクを作成できません**。そのため:

- シンボリックリンクを前提とする依存配置を使用しないこと。パッケージマネージャーは以下の指定に従う。
- npm scripts は `node_modules/.bin` に依存しないこと。CLI は `node` でエントリファイルを直接呼び出す(例: `node node_modules/astro/bin/astro.mjs dev`)。

### パッケージマネージャー

- 利用者の決定により pnpm 12.15.0 を使用する。`package.json` の `packageManager` で固定する。npm / upm で依存を導入しない。
- コマンドは SBX の Linux シェルで実行する。Windows ホストの Node・pnpm・Git に切り替えない。OS ごとのネイティブ依存があるため、Windows で作成した `node_modules` を使い回さない。
- リンク制約への対応として `pnpm-workspace.yaml` に `nodeLinker: hoisted` と `preferSymlinkedExecutables: false` を指定する。pnpm が PATH にない場合は `corepack pnpm` で固定版を実行する。
- 正式なロックファイルは `pnpm-lock.yaml`。開発環境・CI の再現インストールは `pnpm install --frozen-lockfile` を使用する。
- 移行前の `upm.lock` と `package-lock.json` は削除済み。再作成しない。
- CLI はプロジェクトの依存としてインストールする。npx による実行は禁止し、pnpm scripts から `node` で直接呼び出す。
- 依存のビルドスクリプトは内容を確認して `allowBuilds` で個別に許可・拒否する。
- **依存のバージョンを下げない（ダウングレード禁止）。** 互換性の問題は、新しい版の組み合わせ、上流の修正、
  または理由を書いた `peerDependencyRules` の例外で解決する。古い版への固定で回避しない。
- `pnpm-workspace.yaml` の `trustPolicy: no-downgrade` で、公開時の信頼性（Trusted Publisher / provenance）が
  過去の版より下がったパッケージのインストールを拒否する。例外は `trustPolicyExclude` に理由付きで個別に書く。

### その他

- `git init`、GitHub リポジトリ作成、コミットは親エージェントの担当(このセッションでは行わない)。
- 未確認のパッケージ・API・設定キーを推測しない。不明なら `node_modules` や公開メタデータを確認する。
- 不要ファイル・依存・エクスポートは `pnpm knip` で確認する。Fumapress の仮想モジュール経由の入口は `knip.jsonc` に明示し、検出を避けるためにソース全体を entry / ignore にしない。
