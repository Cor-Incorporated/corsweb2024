# Cloudia Vertex Gateway

Cloud Run のサービスアカウントで認証し、`cor-jp-web` の `global` にある `gemini-3.5-flash` と `gemini-4-hydrogen` を呼び出します。
Cloudflare Workerからのリクエストは `VERTEX_GATEWAY_SECRET` によるHMAC-SHA256、
30秒のtimestamp、nonceで検証する。サービスアカウントJSON鍵は使用しない。

Cloud Runは `service.yaml` の専用サービスアカウントで実行し、Secret Managerの
`cloudia-gateway-hmac` だけを参照させる。Worker側にはGateway URLと同じsecretを
`wrangler secret put` で設定する。

## Deploy

以下は新規構築用です。稼働中のモデルを更新する場合は「モデルの切替と戻し方」に従い、Gateway と Worker の配備を分けます。

```bash
gcloud config set project cor-jp-web
gcloud builds submit services/vertex-gateway \
  --tag asia-northeast1-docker.pkg.dev/cor-jp-web/cloudia/vertex-gateway:latest
gcloud secrets add-iam-policy-binding cloudia-gateway-hmac \
  --member='serviceAccount:cloudia-vertex-gateway@cor-jp-web.iam.gserviceaccount.com' \
  --role='roles/secretmanager.secretAccessor'
gcloud run services replace services/vertex-gateway/service.yaml --region asia-northeast1
gcloud run services add-iam-policy-binding cloudia-vertex-gateway \
  --region asia-northeast1 --member='allUsers' --role='roles/run.invoker'
GATEWAY_URL="$(gcloud run services describe cloudia-vertex-gateway \
  --region asia-northeast1 --format='value(status.url)')/generateContent"
cd workers/contact-chat
printf '%s' "$GATEWAY_URL" | npx wrangler secret put VERTEX_GATEWAY_URL
npx wrangler secret put VERTEX_GATEWAY_SECRET
npx wrangler deploy
```

GatewayとWorkerの `VERTEX_GATEWAY_SECRET` はSecret Manager
`cloudia-gateway-hmac` の同じ値にする。nonce cacheはCloud Runプロセス内のため、
`maxScale=1` と30秒の署名有効期限でリプレイ窓を制限する。再起動をまたぐ永続nonceではない。

## モデルの切替と戻し方

Gateway は、許可リストにあるモデル（gemini-3.5-flash、gemini-4-hydrogen）だけを、署名付きで受け付けます。許可以外のモデルは、署名が正しくても HTTP 400 で止め、Vertex への通信を行いません。

Worker の既定値、本番設定、プレビュー設定は、すべて `gemini-3.5-flash` です。互換 Gateway を使う隔離検証で `VERTEX_MODEL=gemini-4-hydrogen` を明示すると、新モデルの要求を試せます。本番設定を変える場合は、実モデル検証の後に変更と配備を分けて行います。

本番で切り替える場合は、次の順で行います。

1. 合成の検証をします。署名付きローカルリクエストで、両モデルの Vertex 行き URL と、未許可モデルの外向通信ゼロを試験で確かめます。
2. 実接続の承認を取ります。実モデルでの試験は、別の承認が必要です。
3. 互換Gatewayを先に配備します。このGatewayは、旧モデルと新モデルの両方を受け付けます。
4. 旧モデルのままで運用を監視します。
5. Worker の `VERTEX_MODEL` を gemini-4-hydrogen に変えて配備します。
6. 問題があったときは、先に Worker を gemini-3.5-flash に戻します。Gateway は、両方を受け付けるままにします。

gemini-4-hydrogen は temperature の指定値を無視します。Worker は temperature を送らず、`generationConfig.thinkingConfig.thinkingLevel` に LOW を送ります。

`thinkingBudget` と `thinkingLevel: MINIMAL` は HTTP 400 になります。切替前に、実モデルで構造化応答と継続する会話を確認します。

## Rollback

Workerを先に `LLM_PROVIDER = "anthropic"` へ戻し、`ANTHROPIC_API_KEY` を設定して
`npx wrangler deploy` する。Gatewayは後から停止する。前リビジョンへ戻す場合は
`gcloud run services update-traffic cloudia-vertex-gateway --region asia-northeast1 --to-revisions REVISION=100`
を使う。
