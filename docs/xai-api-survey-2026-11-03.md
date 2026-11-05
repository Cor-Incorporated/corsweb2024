# xAI API 仕様調査（2026-11-03）

**調査日**: 2026-11-03  
**参照URL**: https://docs.x.ai/

## モデル

- **grok-4.7**: 最新のフラッグシップモデル
  - Context: 500k tokens
  - 入力: $2.00 / 1M tokens
  - 出力: $6.00 / 1M tokens
  - 機能: function calling, structured outputs, reasoning

## Web・X 検索の指定方法

xAI の Grok API は、**server-side tool calls** として Web 検索と X 検索を提供する。

- `web_search_call`: Web 検索
- `x_search_call`: X（旧Twitter）検索
- パラメータ: `web_search_options` でオプション指定可能

これらは tool calls として ChatCompletion API のレスポンスに含まれ、モデルが必要に応じて自動で呼び出す。

## API エンドポイント

- Base URL: `https://api.x.ai/v1`
- Chat Completions: `/v1/chat/completions`
- モデル一覧: `/v1/embedding-models`

## 認証

- Header: `Authorization: Bearer $XAI_API_KEY`

## 参考

- OpenAPI spec: https://docs.x.ai/openapi.json
- API Reference: https://docs.x.ai/developers/rest-api-reference
- Models: https://docs.x.ai/developers/models/grok-4.7
