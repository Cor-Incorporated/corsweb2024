# Cor Account の個別利用権の問い合わせ

この候補は、Cor’s Projects の組織機能に依存せず、確認済みのスタッフと既存利用者に製品別の利用権を付与する。中央D1の `account_grants` を認可の問い合わせで参照する。実アプリの設定、実利用者の取込み、DB作成、配備はこの候補の検証に含まない。

## 製品サーバーとの契約

`POST /v1/entitlements/check` に `Content-Type: application/json` と製品専用の `Authorization: Bearer …` を付ける。BD・XESM・Harborの製品サーバーは、それぞれ独立した機械間の値を使う。値は256ビット以上のbase64urlで、最大128文字。設定が空または他製品と重複する製品には503を返す。異なる値を持つ製品は引き続き照会できる。

```json
{
  "service": "business-dossier",
  "issuer": "https://clerk.example.invalid",
  "subject": "user_Example",
  "tenantId": "existing-workspace-id"
}
```

- BDの `service` は `business-dossier`、XESMは `xesm`、Harborは `harbor`。製品サーバーが署名を検証したClerkの `issuer`・`subject` と既存テナントIDを渡す。別のIdPを介す場合は、本人確認済みの対応を製品サーバーで解決する。Harborの共有利用では `tenantId` は既存のworkspace ID。中央の `HARBOR_ENTITLEMENT_QUERY_TOKEN` はHarborのサーバーが使う製品専用資格に対応する。テナントIDやClerk主体をブラウザ入力から直接採用しない。
- `200 {"allowed":true}` は指定した4項目に一致する期限内の付与あり。製品の役割・所属・案件や資料の個別認可は引き続き製品側で行う。独立付与で既存ロールの範囲を広げない。
- `200 {"allowed":false}` は一致する期限内の付与なし。認証・構成・通信・データベースの異常も中央付与は認めない。独立に有効な既存の有償契約の判断は製品側に残す。中央方式へ移行した対象を古いローカル台帳へ戻して再許可しない。
- 応答は保存せず、保護操作ごとに問合せる。中央はD1のprimaryを参照する。撤回がコミットされた後、次の問合せに反映される。

## 付与の正規化

認証済みの管理経路で、確認済みClerk主体と既存テナントの対応を照合し、承認参照がある行だけを登録する。スタッフの既定付与も対象製品・テナントごとの `staff` 行として明示する。既存利用者への無課金付与は `legacy` 行とする。期間は日本時間の日付で両端を含む。撤回日時と撤回承認の参照を同じ更新で記録する。再付与は新しい承認と行を使う。実メールの文字列や同一ドメインだけから付与を作らない。

付与はStripe由来の組織の有償権利と独立している。現在の請求CLIはこれまでどおり `services` に同期する。個別付与だけで顧客登録や請求を行わず、有償解約だけで有効な個別付与を失効させない。

## ローカルでの確認

Node.js 22以上でこのディレクトリの依存を解決し、`npm test` を実行する。テストはMiniflareのローカルWorkerとD1に実際のSQL移行を適用し、発行元、製品、テナント、期限、明示的な撤回、DB異常を通常のHTTP入口から確認する。配備時のDB bindingは `ACCOUNT_GRANTS`、固定された正規Clerk issuerは `CLERK_ISSUER`。信頼できる実発行元、製品サーバーの接続、管理経路と監査記録は配備候補を検収する時点で確認する。

## 有償契約の製品照会（隔離候補）

`POST /v2/entitlements/check` は v1 の4項目に `organizationId` と
`operation`（`view`、`edit`、`export`）を加える。組織なしは
`organizationId: null`。製品ごとのサーバー資格情報は v1 と共通。
署名・セッションを検証した主体と、製品の正規権限で解決したテナント・組織を渡す。
中央照会の許可後も製品自身の役割・案件・文書の境界が適用される。

| 応答の `access` | 閲覧 | 編集 | 書き出し |
|---|---|---|---|
| `open` | 可 | 可 | 可 |
| `view_only` | 可 | 拒否 | 拒否 |
| `read_export_only` | 可 | 拒否 | 可 |
| `closed` | 拒否 | 拒否 | 拒否 |

`allowed` は要求された操作に対する真偽値。v1 の `{allowed}` は既存の個別付与専用。
v2 でも有効な従来・スタッフの個別付与があれば `open` となる。個別付与の失効と、
有償契約の期間・保留は独立している。

有償判定の前提は、承認済みの `paid_contract_members` に対象の
issuer・主体・サービス・製品テナント・組織の全てが一致し、同じ組織に有効期限内の
`paid_contract_snapshots` があること。対応の欠落、撤回、不一致、スナップショットの
期限切れは権利を付けない。日付は日本時間で判定する。期間・保留の規則は ADR-0028
および既存のサービス選択の判定と同じ。サービスIDは既存 `docs/billing/plans.json` の
`business-dossier` と `xesm`。

ローカル試験では署名検証後に既存 `subscribe.sh resync` を合成CLIで実行する。
CLIが照合した組織の `public_metadata.services` と同じ内容を合成アダプターが
D1に記録する。イベント本文の契約情報は書き込まない。実運用の配備前には、決済側顧客と
Clerk組織の対応、両製品の実テナントと承認済み主体、組織メンバー撤回の反映、成功した
照合だけを順序保証付きで反映し期限内に更新する同期経路が要る。現時点の移行SQLには
実データを含めていない。BD・XESMの実呼び出しは v1 が対象のまま。
## #539 サービス選択画面

静的 Astro の `/account/services/` から同じオリジンの `GET /api/account/services` を読む。Worker の入口は `account.js`。製品サーバー用の `index.js` とは別の Worker として構成し、製品用照会キーをこの入口へ付与しない。

- `ACCOUNT_SITE_ORIGIN` にサイトの HTTPS origin、`CLERK_ISSUER` に正規 Clerk issuer の origin、`CLERK_JWT_KEY` に同じインスタンスの署名検証用公開鍵、`CLERK_SIGN_IN_URL` に正規のログイン URL を設定する。Astro 側の `PUBLIC_CLERK_PUBLISHABLE_KEY` は公開可能なキーだけを使う。ClerkJS の組織切替から個人へ戻るには Clerk の Personal Accounts を有効にする。
- 選択中の組織は署名済み v2 セッションの `o.id` で確定する。組織モードの `cor_svc` は選択組織の `org.public_metadata.services` をセッションテンプレートから供給する。token は署名・期限・発行元・認可済みオリジン・本人を検証し、保留中のセッションを拒否。組織の権利は最大60秒の新しい claim を使い、欠落・期限超過時は表示しない。停止や閲覧期間の表示は共有ベクトルに従う。
- 個人モードは `ACCOUNT_GRANTS` の primary にあり、撤回されていない期限内の明示的な staff/legacy 付与から製品を選ぶ。組織の有償権利の停止で個別付与の行は変更しない。選択組織の停止を別テナントの個別付与で上書きすることもない。個人モードで表示されるリンク先でも、製品が既存の対象テナント・所属・操作権限を再検証する。
- Worker の `BD_SERVICE_URL` と `XESM_SERVICE_URL` に、対象環境とテナントに対応する HTTPS の製品入口を設定する。必要な設定を欠くとサービス一覧のAPIは503を返す。入口の値は環境別の配備設定で管理し、静的配信側に秘密値や製品用機械キーを入れない。

配備前に、独立 Worker を `cor-jp.com/api/account/services` だけへルーティングし、他の公開経路や製品のサーバー間APIは既存設定を確認する。現在はローカル候補。実ルート、Clerk Production のログイン・組織選択・個人選択、実ユーザーの有償 claim と D1、上記入口への実ログインと製品側の拒否は未検証。公開前に同一ユーザーで組織の hold と個人の適用テナントを確認する。

ローカルでは Worker ディレクトリの `npm test` で既存の製品照会と #539 のAPIを確認する。Astroをビルド後、`ACCOUNT_PICKER_BROWSER_OUTPUT` を設定すると同じテストでChromium表示も検査する。ブラウザ証跡は合成セッションと隔離D1に限定し、実Clerk・実製品への通信を行わない。既定のリンクは試験用の値。配備設定との照合が必要な場合は、同じ試験の環境変数 `BD_SERVICE_URL` と `XESM_SERVICE_URL` で検証対象の値を渡す。ブラウザ試験はリンクの値を検査し、リンク先への通信は遮断する。
