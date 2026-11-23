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

### 確認済みの契約と所属を D1 に反映

`createClerkPaidProjector` は既存の決済再照合から、書き込み応答の確認を終えた組織IDと `resync_at` を受ける。
同じClerk組織をBackend APIで読み戻して時刻を突合し、全ページの現行組織所属を承認台帳と照合する。
承認台帳の読み込み元は呼び出し側が提供する。組織 ID と利用者 ID で照合し、メールや組織内の役割では承認しない。
[Clerk 組織所属の参照](https://clerk.com/docs/reference/backend/organization/get-organization-membership-list)

スナップショットと有償対応の追加・撤回を D1 の一つのバッチで反映する。古い観測結果は現在の行に影響しない。
承認または所属が消えた対応は撤回し、所属が戻っても同じ承認番号で復活しない。
個別無課金の `account_grants` は更新対象外。新リビジョンは `0003_paid_projection_revision.sql` を先に適用する。

開発試験では署名済みの試験通知、既存の `subscribe.sh resync`、合成Clerk応答、実workerdと使い捨てD1を使用する。
本番で使う承認台帳の接続、通知の運用入口と定期更新、実リソースへの接続は未設定。

通知と定期更新の開発試験では、ループバックの `POST /webhooks/stripe/billing` にStripe形式の署名済み試験通知を送る。
定期更新は同じ直列キューを通り、署名や通知本文を使わずに現時点の契約を再照合する。
試験のタイマーは期限切れの状態から定期更新で権限が戻ることまで確認する。開発用ランタイムはStripeのlive通知を拒否する。
