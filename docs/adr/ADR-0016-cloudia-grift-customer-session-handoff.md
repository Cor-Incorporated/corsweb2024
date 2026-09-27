# ADR-0016 Cloudia から Grift 公開相談セッションへの引継ぎ

## ステータス: Accepted (2026-07-14)

## 背景

- `contract-dev` と Grift LP の既存 3 intent（`grift-team-beta`、`grift-paid-trial`、`estimate-audit`）は受託開発・見積支援の相談であり、Cloudia の初期ヒアリング後も相談者自身が Grift で追加ヒアリングと概算確認を続ける必要がある。
- Grift を社内リード保存先としてだけ使うと、相談者が Grift の公開ポータルを利用せず、Grift が解決する要件整理・見積・変更管理の価値を提供できない。
- Cloudia のブラウザから Grift の内部 API、テナント ID、サービス認証情報へ直接アクセスさせてはならない。
- `workers/contact-chat` の既存メール通知と本人向け受付メールは、Grift 障害時の取りこぼし防止と運用監査のため維持する。

## 決定

### 責務

| コンポーネント      | 責務                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------ |
| Cloudia             | 初期相談、非 PII の構造化、転送内容の確認、明示同意、Grift への画面遷移              |
| contact-chat Worker | PII の最終検証、サーバー側セッション情報の復元、メール受付、Grift へのサービス間中継 |
| Grift Control API   | Cor. テナントに intake submission / case / 顧客ポータルセッションを冪等作成          |
| Grift 顧客ポータル  | 追加ヒアリング、非拘束の概算提示、相談者の了承                                       |
| Grift 管理画面      | Cor. 担当者による内容確認、初回詳細見積の作成・公開、有償変更の承認                  |

### フロー

```text
Cloudia 初期相談
  -> 転送内容と利用目的を表示
  -> 相談者が明示同意
  -> POST /api/contact/submit
  -> contact-chat Worker がメール受付を保存
  -> POST /v1/internal/cloudia/intake-sessions
  -> Grift が Cor. テナントの case と短命・一回限りの交換 URL を発行
  -> Worker は交換 URL と交換期限だけを Cloudia に返す
  -> Cloudia が相談者を Grift へ遷移
  -> Grift 顧客ポータルが URL fragment を即時消去
  -> 同一 origin の交換 API が case 限定 session cookie を発行
```

- valid・active・期限内の D1 contact session に保存された `summary`、`intent`、`classification`、`structuredLead` をサーバー正本とする。この `summary` は Cloudia 画面で相談者に表示され、相談者が確認した正規化済み要約である。browser submit の `summaryText.text` は信頼入力ではなく、D1 正本との完全一致だけを確認する相関値とし、D1 正本を browser 文面へ置換しない。
- 自動引継ぎは D1 正本の session intent が `contract-dev`、`grift-team-beta`、`grift-paid-trial`、`estimate-audit` のいずれかで、送信 payload の正規化済み intent と一致し、D1 classification が `genuine`、`handoffConsent.accepted=true`、`summaryConfirmed=true` の場合だけ実行する。保存、両メール通知、Grift request は同じ D1 正本の summary / intent / classification / structuredLead を使う。
- submission 保存は、最初に復元した active D1 session の全可変列（`summary` / `intent` / `classification` / `structuredLead` / `updatedAt` / 暗号化済み conversation excerpt を含む）を `INSERT ... SELECT` 条件として、submission・outbox・audit と同じ D1 batch transaction 内で compare-and-swap する。D1 session が missing / expired、取得 row の session ID が不一致、read error、または保存直前の再確認 race で snapshot が1項目でも変化した場合は trusted submission を一切作らず、browser summary、consent、session ID、conversation excerpt をすべて破棄する。正規化済み intent / classification / structuredLead だけから deterministic fallback を生成して D1 に保存し、社内通知と本人向け受付メールを継続するが、Grift は呼ばない。
- Grift LP は既存 3 intent を URL 上で維持する。Worker は Grift 内部契約へ渡す際にだけ `intent=contract-dev`、`source=corsweb-contact-chat` へ固定し、ブラウザ値をそのまま Grift の権限境界へ渡さない。
- 上記以外の intent、未知 intent、session と payload の intent 不一致、同意なしは従来のメール受付を維持し、Grift を呼ばない。active D1 session を復元できたが browser summary が D1 summary と一致しない場合は相関失敗として副作用前に拒否し、どちらかの文面で他方を置換しない。
- Grift 引継ぎの成功・失敗にかかわらず、既存の社内通知メールと本人向け受付メールを維持する。
- Grift が失敗した場合は問い合わせ自体を失敗扱いにせず、メール受付済みと fallback 状態を返す。

### Worker の公開契約

既存 `POST /api/contact/submit` に次の任意フィールドだけを追加する。

```json
{
  "handoffConsent": {
    "accepted": true,
    "summaryConfirmed": true,
    "version": "cloudia-grift-v1",
    "acceptedAt": "2026-07-14T00:00:00.000Z"
  }
}
```

- `acceptedAt` はブラウザ側の監査参考値とする。Worker が受信した時刻を同意時刻の正本として D1 と Grift に記録する。
- 要約を編集した場合は `summaryConfirmed` と Grift 引継ぎ同意を解除し、相談者に再確認を求める。
- Grift へ送る `inquiry.summary`、D1 submission、社内通知、本人向け受付メールは、active D1 contact session の同じ正本要約を使用する。browser の要約は一致確認以外に使用せず、D1 正本と browser 文面を相互に置換しない。session を信頼できない場合だけ、前項の deterministic fallback を共通保存・通知文面とする。
- submission には PII 本文を複製しない payload HMAC を保存する。同一冪等キー・同一 payload だけを replay とし、session、連絡先、要約、同意のいずれかが異なる場合は `409` として Grift を呼ばない。

Grift セッションを発行できた場合、既存応答に次を追加する。

```json
{
  "ok": true,
  "receiptId": "opaque-id",
  "handoff": {
    "status": "ready",
    "url": "https://app.griftai.org/chat/portal#exchange_code=43-character-base64url-code",
    "expiresAt": "2026-07-14T00:05:00.000Z"
  }
}
```

Grift 障害時は `handoff.status=fallback` とし、内部エラー、テナント ID、Grift case ID、認証情報をブラウザへ返さない。

### Grift の内部契約

```http
POST /v1/internal/cloudia/intake-sessions
Authorization: Bearer <Cloudia route scoped service secret>
Idempotency-Key: <contact submission id or client idempotency key>
Content-Type: application/json
```

```json
{
  "schema_version": "cloudia-grift-handoff.v1",
  "intent": "contract-dev",
  "source": "corsweb-contact-chat",
  "locale": "ja",
  "contact": {
    "name": "相談者名",
    "email": "client@example.com",
    "company": "Example Inc."
  },
  "inquiry": {
    "message": "相談者が送信前に確認した補足",
    "summary": "相談者が画面で確認した正規化済み要約",
    "structured_lead": {
      "purpose": "...",
      "industry_role": "...",
      "data_sensitivity": "...",
      "stage": "...",
      "timing_budget": "..."
    }
  },
  "consent": {
    "version": "cloudia-grift-v1",
    "accepted_at": "2026-07-14T00:00:00.000Z"
  }
}
```

- リクエストに `tenant_id` を含めない。Grift は `CLOUDIA_HANDOFF_TENANT_ID` で Cor. テナントへ固定する。
- Worker と Grift の双方で `CLOUDIA_HANDOFF_AUTH_TOKEN` を Cloudia route 専用 secret とし、他の internal API を操作できる共通 token を再利用しない。secret は Cloudflare Worker secret と Google Secret Manager で保持し、設定ファイル・ログ・レスポンスへ出さない。
- 生の会話全文は送らない。contact-chat が保持する信頼済み要約、構造化項目、相談者が確認した補足だけを送る。
- 同じ `Idempotency-Key` と同じ canonical payload は同じ submission / case / case-bound share link を再利用し、ケースを重複作成しない。同じキーで payload が異なる場合は `409` とする。短命 exchange code の再発行だけは下記のgeneration契約に従う。
- Grift は既存 IntakeService、RLS transaction、case-bound share link を再利用する。ただし share link bearer を URL へ露出せず、短命の portal exchange code を別途発行する。
- case / case-bound share link 自体の有効期間は24時間を維持する。これはbrowserへ返す一回限りexchange codeの最大5分とは別の寿命であり、share-link expiryを`handoff.expiresAt`へ返さない。
- 成功応答は `submission_id`, `case_id`, `chat_url`, `expires_at`, `duplicate` を Worker に返す。Worker は `chat_url` と有効期限以外をブラウザへ公開しない。
- `structured_lead` の各項目は未取得の場合に省略可能とし、未知フィールドは拒否する。
- browser へ返す credential は暗号学的に不透明な32-byte valueのbase64url表現（43文字）で、発行から最大5分の一回限りexchange codeとする。Cloudia冪等再送ではtenant・source・idempotency key・generation・key versionからHMAC導出し、通常発行ではCSPRNGを使う。DBにはraw codeを保存せずSHA-256 hash、generation、HMAC key versionだけを保存する。
- browser へ返せる URL は許可済み HTTPS origin の正確な `/chat/portal#exchange_code=<43-character-base64url-code>` に限定する。userinfo、任意 port、query、別 path、未知 fragment key、追加 fragment parameter、percent-encoded credential を Worker、Cloudia、埋め込み親の各層で拒否する。
- Grift 顧客ポータルは React、LIFF 初期化、共有 UI、履歴記録より先に fragment credential を module memory へ取り込み、`history.replaceState` で URL から消去する。交換後のURL、ログ、OTel span、Nginx / Cloud Run request path、LINE login URL、共有・clipboard に credential を含めない。
- 交換は同一 origin の `POST /v1/portal/session/exchange` だけで行う。成功時に case 限定の8時間 sessionを `__Host-`、`Secure`、`HttpOnly`、`SameSite=Strict` cookieとして発行し、unsafe methodは別の `__Host-` CSRF cookieと `X-Portal-CSRF` headerの一致を要求する。全応答を `no-store` とする。
- 同じ `Idempotency-Key` と payload の再送は case / share link を増やさない。未消費codeは同じcodeと期限を返し、消費済み・失効済みなら同じcase/share linkへ新しいgenerationの短命codeを発行する。並行再送と交換は同じshare-link row lockで直列化し、先に返した未消費codeを競合で無効化しない。
- session交換・portal APIは同一origin配信を必須とする。LIFF frontendとControl APIを別originのまま直接接続してcookieを緩和せず、公開originのreverse proxyで `/v1/portal/session/*` を同一origin化する。

### 見積と有償変更の境界

- Grift チャット内の概算は非拘束の参考値とする。
- 相談者が概算を了承した後、Cor. 管理画面で担当者が確認した初回詳細見積を 1 回無料で公開する。
- 初回詳細見積の公開後に発生する仕様変更、追加調査、代替案比較、再見積は有償とする。
- 2 回目以降は既存 change request に `required -> requested -> approved` の有償確認状態を持たせる。
- 未承認の再見積は `PAID_REESTIMATE_REQUIRED` で停止する。Stripe は今回の境界に含めず、Cor. の契約確認後に管理画面から 1 回分を解放する。

### Rollout

- Worker の `GRIFT_HANDOFF_ENABLED` と Grift の `CLOUDIA_HANDOFF_ENABLED` は既定 `false` とする。
- Preview で 4つの引継ぎ対象 intent、exchange codeの一回消費・再発行、cookie/CSRF、contract / tenant isolation / browser E2E を通した後に両方を有効化する。
- 一方だけ有効、secret 不足、タイムアウト、Grift 4xx/5xx はメール fallback とし、転送成功と表示しない。

## 理由

- 相談者を Grift に移動させることで、Grift を単なる社内 CRM ではなく、ヒアリング・概算・変更管理の顧客体験として利用できる。
- browser -> Worker -> Grift の順に trust boundary を置くことで、内部 API と固定テナント設定を公開しない。
- 既存 IntakeService とメール受付を再利用し、新しいリードモデルや別の通知基盤を増やさない。

## 影響

- corsweb: #259。Worker の送信・fallback と本 ADR の正本を担当する。
- cloudia: Cor-Incorporated/cloudia#25。明示同意と Grift 遷移を担当する。
- griftai: #55〜#58 は横断 Epic / 契約 / E2E の追跡として残し、Grift 本体のコード変更は `Cor-Incorporated/Grift` の実装 Issue で追跡する。
- Grift LP は `contract-dev` を CTA として使用せず、既存の製品 intent を維持する。

## 受入基準

- 4つの対象 intent は引継ぎでき、同意なし、対象外・未知 intent、信頼済み session と payload の intent 不一致では Grift が呼ばれない。
- 同一冪等キーの再送で Grift case が増えない。
- Cor. 以外のテナントへ作成できず、他テナントから読み取れない。
- browser応答は `handoff.status`、交換 URL、交換期限だけを公開し、内部 submission / case / tenant ID、share-link bearer、session cookieを含めない。交換後URL、履歴、ログ、メールにも service secret、内部 tenant ID、share-link bearer、session credentialが出ない。browserに見えるexchange codeはfragmentだけに存在し、初期化前に消去される。
- Grift 障害時もメール受付が完了し、Cloudia は fallback 状態を表示する。
- 成功時は相談者が Grift 公開ポータルへ遷移し、追加ヒアリングと概算確認を継続できる。
- 初回詳細見積は無料で公開でき、2 回目以降は有償確認前に停止する。

## 参照

- ADR-0012 / ADR-0013 / ADR-0014 / ADR-0015
- Grift ADR-0022 / ADR-0023 / ADR-0024 / ADR-0025
