# ADR-0028 Cor. のサービスに共通のアカウントと課金の基盤（Clerk の組織と自前の Stripe）

## ステータス: Proposed (2026-11-09)（骨子。「決めること」は寺田の回答を待つ）

## 背景

- 寺田の決定（2026-11-09、原文）:「clerk と stripe は最優先。その下にアプリを今作っておかないと、後々サービスを増やす時に大きな工数がかかります。」
- 2026-11-06 に、business-dossier（以下 bd）と XESM のアカウントを Clerk で管理すると決めた。Stripe と紐づけて、Cor. のサービスに共通の基盤にする（`docs/billing/README.md` の 0 章と 1A 章）。
- ところが bd はローカル認証（パスワードと Cookie のセッション）で、独自の利用者を作るところまで進んでいた。XESM も Keycloak（OIDC）で、実利用者を作る直前だった。
- 2026-11-09 に両方を止めた。bd の c01 は空にした。XESM は Access の許可と実利用者を保留している。
- 課金は「作り方 B」で実装した。毎月末に顧客ごとの請求書を 1 枚作り、翌月末に払ってもらう（#505・#506）。Stripe の Subscription は使わない。
- 契約の正本は Stripe の Customer の metadata（`contract_<サービス>_*`）。
- 2026-11-09 に、bd-deploy と xesm-deploy の 2 つのレーンが、それぞれの認証の今と Clerk に載せる案を調べた（非公開の報告）。この ADR はその結果を入れている。
- この ADR では、共通の基盤の形を決める。身元・顧客・契約・権利をどこに持ち、どう結ぶかと、各サービスが守る約束（サービス側の実装規約）の 2 つ。サービスを足すたびに作り直さずに済むようにするため。
- 横断の ADR なので、正本はこのリポジトリに置く（ADR-0015）。bd と XESM のリポジトリには参照の ADR を 1 枚ずつ置く。

## 決定（骨子）

**Clerk はアカウントと Organization の正本、決済事業者（Stripe）は契約（サブスク）の正本にする。サービスは、契約から作った権利（entitlement）を参照して機能を開け閉めする。**

### 1. 何をどこに持つか

| もの | 正本 | 中身 |
|---|---|---|
| 利用者 | Clerk の user（`user_…`） | メールアドレス、名前、ログインの方法、2 要素 |
| 顧客（テナント） | Clerk の Organization（`org_…`） | 会社 1 社につき組織を 1 つ作る。bd の workspace、XESM の Tenant にあたる |
| 組織での立場 | Clerk の Organization の role | `org:admin`（組織の管理者）と `org:member` の 2 つだけを使う。最初の管理者を決めるときにだけ使い、サービスの認可には使わない（4 節） |
| 所属とサービスでの役割 | 各サービスの DB | bd は `memberships`（`admin`・`editor`・`viewer`）、XESM は `Membership` と `ROLE_CAPS`（7 つの役割）。どちらも今の作りのまま |
| 契約と請求 | Stripe の Customer（当社のアカウント 1 つ）と毎月の請求書 | `contract_<サービス>_*`、`payment`、`clerk_org_id`（README 4 章） |
| 権利（使えるサービス） | 契約から作り、Clerk の組織の public metadata に写す（2 節） | サービスごとの開始日、終了日、止めているか |
| 2 要素の水準とセッションの生死 | ログインを受け持つ IdP | bd は Clerk。XESM は案 (a) のあいだ Keycloak（5 節） |

- Clerk のアプリケーションは 1 つにする。本番のインスタンスのドメインは `cor-jp.com` にする。
- サービスは `cor-jp.com` の下のホストに置く。今の bd と XESM も、どちらも `cor-jp.com` のサブドメインにある。
- Clerk の文書では、本番のセッションはサブドメインの間で共有される [3]。1 回のログインで、組織が契約しているサービスを全部使える。
- Clerk Billing は使わない。請求の通貨が USD だけで、消費税に対応していない [7]（README 1A 章の表）。
- サービスには Stripe の鍵も Clerk の秘密鍵も置かない（R9）。

### 2. 権利の流れ（契約 → 組織の metadata → サービス）

```text
Stripe の Customer の metadata（契約の正本）
  │  subscribe.sh contract / cancel / hold（寺田が実行。Clerk の秘密鍵は表示しない入力で受ける）
  ▼
Clerk の組織の public_metadata.services（写し）
  ├─ 道 A: セッショントークンの独自 claim `cor_svc`（60 秒ごとに更新）
  │        → Clerk のトークンを直接検証するサービス（bd）が読む。通信しない
  └─ 道 B: Clerk の webhook（組織の作成と更新）
           → Keycloak を挟むサービス（XESM の案 (a)）が自分の表に書く
```

組織の `public_metadata` の例を下に示す（値は架空）。

```json
{
  "services": {
    "business-dossier": { "from": "2026-12-01", "until": null, "hold": false },
    "xesm": { "from": "2026-12-01", "until": "2027-11-30", "hold": false }
  }
}
```

- `from` は契約の開始日、`until` は終了日（解約していなければ `null`）、`hold` は止めているかどうか。
- サービスの名前は `plans.json` の `services[].service` と同じにする。
- 開けるか閉じるかは日付で決まる。終了日を過ぎても、誰かが書き換える必要はない。サービスが日本時間の今日の日付で判定する（3 節の判定表）。
- 書くのは `subscribe.sh` の `contract`・`cancel` と、新しく作る `hold`・`unhold` の後。
- Clerk の更新は deep merge で、値を `null` にするとその項目が消える [5]。
- 道 A: トークンは 60 秒ごとに作り直されるので、反映は最大で 1 分遅れる [2]。独自 claim は 1.2KB まで [2]。`services` には上の 3 つの項目だけを入れる。
- 道 B: Clerk の webhook は Svix で送られ、少なくとも 1 回届くが、順番は保証されない。同じイベントの再送は同じ `svix-id` を持つ [10]。だから受け手は、届いた `services` の全体で自分の表を上書きし、`svix-id` で重複を捨てる。組織の作成と更新のイベントの名前は、文書の概要のページに無い（未確認）。
- 道 B を Stripe の webhook にする案もある（xesm-deploy の調査の案）。この ADR は Clerk の webhook を推奨する。権利の形が道 A と同じになり、サービスが Stripe の形を知らずに済むため（「決めること」8）。

### 3. サービス側の実装規約

すべてのサービスが次の R1〜R9 を守る。権利の判定が守れているかは、共通の試験ベクトル（`docs/billing/contract/entitlement-vectors.json`。これから作る）で確かめる。各サービスの試験がこのファイルを読み、全件で同じ結果になること。

| # | 約束 | 中身 |
|---|---|---|
| R1 | ログインを確かめる | Clerk に直接つなぐサービスは、セッショントークンを RS256 で検証する。公開鍵は Dashboard の API keys の画面にある JWKS Public Key を設定に置き、通信しない [4]。`iss` は本番の Frontend API の URL（値は本番のインスタンスを作った後に決まる）。`exp`・`nbf` を確かめ、`azp` を自分のホストの許可リストと照らす [4]。`v` が `2` であること、`sts` が `pending` なら拒否すること。Keycloak を挟むサービスは、今の OIDC の検証を変えない（Keycloak が Clerk にログインを任せる） |
| R2 | テナントを組織に結ぶ | 自分のテナントに Clerk の組織の id を持つ（bd は起動の設定の `CLERK_ORG_ID` と workspace、XESM は Tenant）。Clerk に直接つなぐサービスは、トークンの `o.id` [1] がそれと違えば拒否する。`o` の無いトークン（組織を選んでいない）も拒否する |
| R3 | 利用者を結び付ける | (`iss`, `sub`) で自分の利用者に結ぶ。メールアドレスでは結ばない。Keycloak を挟むあいだは、Keycloak の `iss` と `sub` のまま |
| R4 | 所属と役割は自分の DB に持つ | 認可は今の作り（bd の `Principal`、XESM の `Membership`・`ROLE_CAPS`）で行う。Clerk の role（`o.rol` [1]）は、最初の管理者を決めるときにだけ使う |
| R5 | 権利を受け取る | 道 A（独自 claim `cor_svc`）か道 B（署名を確かめた webhook を自分の表に書く。重複を捨て、順番が入れ替わっても最後の状態になる）のどちらか |
| R6 | 権利を判定の一点に掛ける | 権限を判定する一点（bd は `current_principal` と `require`、XESM は `caps()` と `require_cap`）に権利を掛ける。止めた組織は、書く能力だけを落とせる形にする。お客様が書き換えられる欄（XESM の `Tenant.active`）を課金に使わない |
| R7 | テナントを作る受け口を持つ | 契約で組織ができたら、サービスのテナントと最初の管理者を作る。同じ通知が何度届いても 1 つしか作らない。今は bd も XESM も人手のスクリプトだけ |
| R8 | 記録を残す | 監査の記録に、Clerk の組織の id と利用者を残す |
| R9 | 鍵を持たない | Clerk の秘密鍵と Stripe の鍵をサービスに置かない。道 B のサービスは webhook の署名を確かめる鍵だけを持つ（確かめるだけで、API は呼べない） |

判定表は次のとおり。d は日本時間の今日の日付。

| 条件 | 結果 |
|---|---|
| 自分のサービスの行が無い | 閉じる |
| d が `from` より前 | 閉じる |
| `until` があり、d が `until` より後 | 閉じる（終了日の当日までは開ける）。読むだけ・書き出すだけを残す期間を置くかは「決めること」1 |
| `hold` が `true` | 「決めること」1（全部止めるか、見るだけにするか） |
| それ以外 | 開ける |

### 4. 役割の持ち方

- 所属と役割は各サービスの DB に持つ（R4）。bd も XESM も今そうなっている。IdP を替えても、認可の作りは変わらない。
- XESM の調査によると、Clerk の role を認可に使うと、XESM の保証が Clerk 側の設定に左右される。今の保証は「承認は承認者の役割だけ」「見えないものは 404」。
- Clerk の独自の役割（例: `org:viewer`）は使わない。本番では有料の追加機能（Enhanced、月 $100）が要るうえ [6][9]、組織の中で 1 人に 1 つしか付けられず、サービスごとに違う役割を表せない。
- 独自の役割の数の上限は、文書では 1 つのインスタンスで 10 個まで [6]。料金のページには無制限と書かれていて、食い違う（未確認）。

### 5. bd と XESM の載せ方

- bd（Python の API と web）は Clerk に直接つなぐ（道 A）。`DOSSIER_AUTH_MODE=local|clerk` で切り替え、`Principal` の形は変えない。作業は bd-deploy のレーンの一覧（B1〜T1、9〜12 日の見込み）。
- XESM は、案 (a) を第一の候補にする。Keycloak を残し、Clerk を Keycloak の上流の IdP にする（道 B）。
  - XESM のアプリのコードは変えずに足せる。戻すときは Keycloak で Clerk の IdP を無効にするだけ。
  - 代わりに 2 要素の確認が 2 か所になる。XESM の承認・共有・納品・組織管理は `acr=mfa` を要り、Keycloak の TOTP で満たす。Clerk で済ませた 2 要素は Keycloak に伝わらない見込み。
  - Keycloak の運用も残る。
- Clerk を OIDC の IdP として XESM に直接つなぐ案（b1）は採らない。理由は Clerk の文書に次の記載が無いこと [8]。
  - ID トークンの `acr`・`amr`
  - ログアウト（end_session）
  - `/.well-known/openid-configuration`
- さらに、XESM が今求めるスコープには `offline_access` が無い。このまま直結すると、2 要素で守る操作が通らず、60 秒ごとの確認でセッションが切れる（xesm-deploy の調査）。
- Clerk の SDK に作り替える案（b2）は最終の形の候補だが、作業は一番大きい。
- (a) から (b2) へ移るかは、Clerk の実際のインスタンスでの実測 U1〜U7 で決める（「決めること」9）。U1〜U7 は、寺田が Clerk の画面でアプリケーションを作った直後に行う。特に効くのは次の 2 つ。
  - U1: `acr`・`amr` を載せられるか
  - U3: サインアウトや利用者の停止が伝わるか
- XESM の権利は、`caps()` と `require_cap` に組織の権利を掛ける形にする（R6）。テナントを作る受け口（R7）は新しく要る。今の XESM の Tenant は、人手のスクリプトでしか作れない。

### 6. 入口と画面

- サービスを選ぶ画面（freee や MF のような、使えるサービスの一覧）を誰がいつ作るかは「決めること」4。
- Cloudflare Access の許可は、サービスが Clerk で認証できるようになるまで、寺田だけのまま変えない。
- その後に Access を外すか、Access の IdP を Clerk にするかは「決めること」5。

## 移行の順番と Yes の関門

| 段階 | 中身 | 誰が | Yes の関門 |
|---|---|---|---|
| 0 | この ADR の「決めること」に答え、Accepted にする | 寺田 | この ADR の PR の merge |
| 1 | 基盤: Clerk のアプリケーションと開発のインスタンス（寺田の画面の作業）。その直後に U1〜U7 の実測。`subscribe.sh` から Clerk への書き込み（`clerk-sync`・`hold`）、試験ベクトル、検証の見本。最後に本番のインスタンス | 寺田（画面と鍵）、xesm-deploy（U1〜U7）、contract-billing | PR ごとの merge、画面の作業ごとの確認 |
| 2 | bd を Clerk に載せ（道 A）、release して c01 に配置する。bd の 8 章（はじめの設定）は行わず、Clerk の組織への招待に置き換える。c01 にローカルのデータは無い（2026-11-09 に消去済み） | bd-deploy | PR ごとの merge、配置、Access の変更（寺田） |
| 3 | XESM を案 (a) で Clerk に載せる（道 B）。Keycloak の IdP の設定、権利の表と webhook の受け口、テナントを作る受け口 | xesm-deploy | 同上 |
| 4 | 結合の試験（下の完了の条件） | contract-billing | — |
| 5 | 請求書で課金中の既存の顧客 1 社を、カードの引き落としに移す。組織を作り、カードを保存してもらい、支払い方法を `card` に変える。発行済みの請求書は振込のまま | 寺田（顧客への案内も寺田） | 顧客の同意と寺田の Yes |

段階 5 のために、`subscribe.sh` に支払い方法を変えるサブコマンドを足す（今の `subscribe.sh` は既存の顧客を書き換えない）。

## 完了の条件（反証できる形）

- 同じ組織の id と同じ `services` の値を、bd には道 A（試験用の鍵で署名したトークン）で、XESM には道 B（試験用の鍵で署名した webhook）で渡す。両方の試験が、共通の試験ベクトルの全件で同じ結果（開ける・閉じる・止める）を出す。どちらか一方の判定だけを変えると落ちる。
- 結合の試験では、試験用の組織の `services` を 1 回書き換え、bd のトークンと XESM の webhook の両方に流す。開ける・閉じるが 2 つで一致する。

## 決めること（寺田）

1. `hold` の組織をどう扱うか（全部止めるか、見るだけにするか）。いつ `hold` にするか（支払いの期限を過ぎてから何日か）。終了日の後に、読むだけ・書き出すだけを残す期間を置くか。bd-deploy の B6 と同じ問い
2. 組織に入っていない利用者（個人のアカウント）を許すか。推奨は許さない
3. サービスでの役割をどこに持つか。推奨は各サービスの DB（今の形。追加の費用なし）。代わりの案は Clerk の独自の役割（月 $100、組織の中で 1 人 1 つ）
4. サービスを選ぶ画面を、誰がいつ作るか
5. サービスが Clerk で認証するようになった後、Cloudflare Access を外すか、Access の IdP を Clerk にするか
6. Clerk の 2 要素認証（Pro、月 $25）を使うか。XESM の案 (a) で 2 要素の確認が 2 か所になることを受け入れるか
7. bd の要件 SEC-01 の書き換え（ローカル認証は開発用に残す）
8. 道 B の通知の元を Clerk の webhook にするか（推奨）、Stripe の webhook にするか
9. XESM を案 (a) のままにするか、U1〜U7 の結果を見て b2 へ移るか。移る時期も決める
10. 組織のメンバーの追加を、どこで行うか（Clerk の組織への招待にそろえるか、各サービスの画面に残すか）

## 代替案

- Clerk Billing: USD だけで消費税に未対応のため採らない（README 1A 章）。
- サービスごとに独自のアカウント（今の bd と XESM）: サービスを足すたびに、利用者の管理と課金の結び付けを作り直すことになる。寺田の決定に反するため採らない。
- サービスが Clerk や Stripe の API に毎回問い合わせて権利を確かめる: サービスごとに秘密鍵が要り、Clerk の秘密鍵は権限を絞れない。トークンの claim と webhook で足りるため採らない。
- XESM を Clerk の OIDC に直接つなぐ（b1）: 5 節の理由で採らない。

## 参考資料

1. Clerk: Session tokens（v2 の claim。`o.id`・`o.rol`・`fva`・`azp`・`sts`）: https://clerk.com/docs/guides/sessions/session-tokens
2. Clerk: Customize session tokens（`{{org.public_metadata}}`、1.2KB、60 秒）: https://clerk.com/docs/guides/sessions/customize-session-tokens
3. Clerk: Deploy to production（サブドメインの間でセッションを共有）: https://clerk.com/docs/guides/development/deployment/production
4. Clerk: Manual JWT verification（JWKS Public Key、`azp` の照合）: https://clerk.com/docs/guides/sessions/manual-jwt-verification
5. Clerk: Organization metadata と更新の API（public / private、deep merge）: https://clerk.com/docs/guides/organizations/metadata 、https://clerk.com/docs/reference/backend/organization/update-organization-metadata
6. Clerk: Roles and permissions（既定の役割、独自の役割は 10 個まで、本番は追加機能が要る）: https://clerk.com/docs/guides/organizations/control-access/roles-and-permissions
7. Clerk: Billing overview（USD だけ）: https://clerk.com/docs/guides/billing/overview
8. Clerk: How Clerk implements OAuth（ID トークンの claim、`user:org:read` と `org_id`）: https://clerk.com/docs/guides/configure/auth-strategies/oauth/how-clerk-implements-oauth
9. Clerk: Pricing（組織は全プランで使える、Enhanced の追加機能、Pro）: https://clerk.com/pricing
10. Clerk: Webhooks overview（Svix、少なくとも 1 回、順番は保証しない、`svix-id`）: https://clerk.com/docs/guides/development/webhooks/overview

いずれも 2026-11-09 に読んだ。料金と機能は変わるので、決めるときに読み直す。この ADR を直すのは contract-billing のレーンで、bd と XESM の参照の ADR はそれぞれのレーンが直す。
