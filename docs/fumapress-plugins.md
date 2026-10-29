# Fumapress のプラグイン候補

確認日: 2026-10-29。公式カタログと、導入済み Fumapress 1.6.2 の配布ソース・型定義で確認。

## 導入済み

- **Link Validation**: `fumapress/plugins/link-validation` の `linkValidationPlugin()`。
  静的ビルドでレンダリングした Fumapress `Link` の内部404を検出し、ビルドを失敗させる。
  外部リンク検査は別途 `externalLink` コールバックが必要。直接記述した HTML の `<a>` は収集対象ではない。
  `#` アンカーと `mailto:` はスキップされる。Docs7 のビルドで自動実行されるものではない。

## 追加候補（未導入）

| 候補 | 便利な点 | このサイトでの判断 |
| --- | --- | --- |
| Sitemap | サイトマップを生成 | Fumapress で公開する場合に有用。Docs7 への追加効果はないため、公開基盤側の出力を先に確認する |
| llms.txt | AI向けの本文・Markdownエンドポイントを提供 | Fumapress 公開時の候補。現在は Docs7 / Context7 側の機能と役割が重なる |
| FlexSearch | 静的インデックスと検索API | 記事が増え、Fumapress のローカル表示で検索したくなったら候補。現在の自己紹介1ページでは優先度が低い |
| Takumi | 各ページのOG画像を生成 | SNS共有を整える段階で候補。Fumapress 側で生成する画像を Docs7 が自動利用するわけではない |
| Image Optimization | 配信先に応じた画像最適化 | 写真が増えた場合に候補。Docs7 用ではなく Fumapress の配信環境を前提とする |
| Blog / RSS | 記事一覧・ブログ表示・フィード | ブログ記事の公開を始める段階で検討。現在の Blog / Scrap は利用者指定の空の一覧ページで、プラグインによる記事集約は未実装 |
| OpenAPI / AsyncAPI | API仕様から参照ページを生成 | FastAPI・Hono など自作APIの仕様公開をする場合に候補 |

AIチャット・MCP Server・Feedback も公式カタログにあるが、現状の自己紹介ページには必須ではない。
追加依存やサーバー機能が必要になる場合があるため、必要になってから各仕様を確認する。

本番は `content/` を Docs7 が読み取る。Fumapress のプラグイン追加が Docs7 の機能追加になるわけではない。
今回追加した Studio も開発専用の別アプリであり、公開ページには含めない。

## 参考

- [公式プラグインカタログ](https://press.fumadocs.dev/)
- [Fumapress ソース](https://github.com/fuma-nama/fumapress)
- [Fumadocs Studio](https://editor.fumadocs.dev/studio)

Studio 0.2.6 の npm 公開メタデータでは GitHub Actions の Trusted Publisher と SLSA provenance の記録を確認した。
導入は pnpm の開発依存で行い、CLI の実体を `node` から呼び出す。
