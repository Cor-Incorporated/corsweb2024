# ADR-0028 Cor. のサービスに共通のアカウントと課金の基盤（Clerk の組織と自前の Stripe）

## ステータス: Proposed (2026-11-09)（骨子。「決めること」は寺田の回答を待つ）

## 背景

- 寺田の決定（2026-11-09、原文）:「clerk と stripe は最優先。その下にアプリを今作っておかないと、後々サービスを増やす時に大きな工数がかかります。」
- 2026-11-06 に、business-dossier（以下 bd）と XESM のアカウントを Clerk で管理すると決めた。Stripe と紐づけて、Cor. のサービスに共通の基盤にする（`docs/billing/README.md` の 0 章と 1A 章）。
- ところが bd はローカル認証（パスワードと Cookie のセッション）で、独自の利用者を作るところまで進んでいた。XESM も Keycloak（OIDC）で、実利用者を作る直前だった。
- 2026-11-09 に両方を止めた。bd の c01 は空にした。XESM は Access の許可と実利用者を保留している。
- 課金は「作り方 B」で実装した。毎月末に顧客ごとの請求書を 1 枚作り、翌月末に払ってもらう（#505・#506）。Stripe の Subscription は使わない。
- 契約の正本は Stripe の Customer の metadata（`contract_<サービス>_*`）。
- この ADR では、共通の基盤の形を決める。身元・顧客・権利・課金をどこに持ち、どう結ぶかと、各サービスが守る約束（サービス側の実装規約）の 2 つ。サービスを足すたびに作り直さずに済むようにするため。
- 横断の ADR なので、正本はこのリポジトリに置く（ADR-0015）。bd と XESM のリポジトリには参照の ADR を 1 枚ずつ置く。

## 決定（骨子）

### 1. 何をどこに持つか

| もの | 正本 | 中身 |
|---|---|---|
| 利用者 | Clerk の user（`user_…`） | メールアドレス、名前、ログインの方法、2 要素 |
| 顧客（テナント） | Clerk の Organization（`org_…`） | 会社 1 社につき組織を 1 つ作る。bd の workspace、XESM の Tenant にあたる |
| 組織での立場 | Clerk の Organization の role | `org:admin`（組織の管理者）と `org:member` の 2 つだけを使う（4 節） |
| サービスでの役割 | 組織のメンバーの public metadata（4 節） | bd は `admin`・`editor`・`viewer`、XESM は 7 つの役割 |
| 契約と請求 | Stripe の Customer（当社のアカウント 1 つ）と毎月の請求書 | `contract_<サービス>_*`、`payment`、`clerk_org_id`（README 4 章） |
| 使えるサービス（権利） | 契約から作り、Clerk の組織の public metadata に写す（2 節） | サービスごとの開始日、終了日、止めているか |

- Clerk のアプリケーションは 1 つにする。本番のインスタンスのドメインは `cor-jp.com` にする。
- サービスは `cor-jp.com` の下のホストに置く。今の bd と XESM も、どちらも `cor-jp.com` のサブドメインにある。
- Clerk の文書では、本番のセッションはサブドメインの間で共有される [3]。1 回のログインで、組織が契約しているサービスを全部使える。
- Clerk Billing は使わない。請求の通貨が USD だけで、消費税に対応していない [7]（README 1A 章の表）。
- サービスには Stripe の鍵も Clerk の秘密鍵も置かない。置くのは公開してよい値（Clerk の公開鍵と publishable key）だけにする。

### 2. 権利の流れ（契約 → 組織の metadata → トークン → サービス）

```text
Stripe の Customer の metadata（契約の正本）
  │  subscribe.sh contract / cancel / hold（寺田が実行。Clerk の秘密鍵は表示しない入力で受ける）
  ▼
Clerk の組織の public_metadata.services（写し）
  │  セッショントークンの独自 claim `cor_svc`（60 秒ごとに更新）
  ▼
各サービスが、トークンだけで開けるか閉じるかを決める（通信しない）
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
- トークンは 60 秒ごとに作り直されるので、反映は最大で 1 分遅れる [2]。
- 独自 claim は 1.2KB まで [2]。`services` には上の 3 つの項目だけを入れる。

### 3. サービス側の実装規約

すべてのサービスが次の R1〜R8 を守る。守れているかは、共通の試験ベクトル（`docs/billing/contract/entitlement-vectors.json`。これから作る）で確かめる。各サービスの試験がこのファイルを読み、全件で同じ結果になること。

| # | 約束 | 中身 |
|---|---|---|
| R1 | トークンを検証する | RS256 で、Clerk の公開鍵を設定に置き、通信せずに検証する。公開鍵は Dashboard の API keys の画面にある JWKS Public Key [4]。`iss` は本番の Frontend API の URL（値は本番のインスタンスを作った後に決まる）。`exp`・`nbf` を確かめる。`azp` は自分のホストの許可リストと照らす [4]。`v` が `2` であること。`sts` が `pending` なら拒否する |
| R2 | 組織を取り出す | `o.id` を使う [1]。`o` の無いトークン（組織を選んでいない）は拒否する。1 つの起動が 1 社だけを受け入れるサービス（bd のお客様ごとの起動）は、設定に書いた組織と違えば拒否する |
| R3 | 利用者を結び付ける | (`iss`, `sub`) で自分の利用者に結ぶ。初めて来たときに作る。メールアドレスでは結ばない |
| R4 | 組織での立場を読む | `o.rol`（`admin` か `member`。`org:` は付かない [1]） |
| R5 | 権利を判定する | 独自 claim `cor_svc` から自分のサービスの行を読み、下の判定表で決める |
| R6 | サービスでの役割を読む | 独自 claim `cor_roles` の自分のサービスの値を使う。無ければ既定の役割にする（`admin` の人はサービスの管理者。`member` の人の既定は「決めること」3） |
| R7 | 記録を残す | 監査の記録に、Clerk の `sub` と `o.id` を残す |
| R8 | 鍵を持たない | Clerk の秘密鍵と Stripe の鍵をサービスに置かない |

判定表は次のとおり。d は日本時間の今日の日付。

| 条件 | 結果 |
|---|---|
| 自分のサービスの行が無い | 閉じる |
| d が `from` より前 | 閉じる |
| `until` があり、d が `until` より後 | 閉じる（終了日の当日までは開ける） |
| `hold` が `true` | 「決めること」1（全部止めるか、見るだけにするか） |
| それ以外 | 開ける |

### 4. 役割の持ち方

- Clerk の独自の役割（例: `org:viewer`）は、本番では有料の追加機能（Enhanced、月 $100）が要る [6][9]。
- 独自の役割の数の上限は、文書では 1 つのインスタンスで 10 個まで [6]。料金のページには無制限と書かれていて、食い違う（未確認）。
- しかも役割は、組織の中で 1 人に 1 つしか付けられない。サービスごとに違う役割は表せない。
- そこで Clerk の役割は `org:admin` と `org:member` の 2 つだけを使う。
- サービスでの役割は、組織のメンバーの public metadata に `roles.<サービス>` として書く案を推奨する。この値は独自 claim に入れられる（`{{org_membership.public_metadata}}` [2]）。
- public metadata を書けるのはバックエンドだけ [5]。当面は寺田の CLI で書き、後でアカウントの画面から書けるようにする。

### 5. bd と XESM の載せ方

- bd（Python の API と web）は Clerk に直接つなぐ。`DOSSIER_AUTH_MODE=local|clerk` で切り替え、`Principal` の形は変えない。作業は bd-deploy のレーンの一覧（B1〜T1、9〜12 日の見込み）。
- XESM（Keycloak がある）は 2 つの案を比べる。(a) Clerk を Keycloak の上流の IdP にする。(b) Clerk に直接つなぐ。比較は xesm-deploy のレーンが出す。
- 比べるときに外せない事実は次の 3 つ（どれも Clerk の文書から）。
  - OAuth / OIDC の ID トークンに入る組織の情報は `org_id` だけ。スコープ `user:org:read` を求め、同意の画面で利用者が組織を 1 つ選ぶ。組織での role と組織の metadata は入らない [8]。(a) では R4〜R6 を別の道で満たす必要がある。
  - ID トークンに `acr` と `amr` があるとは書かれていない [8]。XESM の段階認証（`acr` が `mfa`）は、Clerk の ID トークンだけでは満たせない見込み（未確認）。セッショントークンには `fva`（要素ごとに、最後の確認からの経過分）がある [1]。
  - Clerk の 2 要素認証は Pro（月 $25）で使える [9]。
- どちらの案でも、R5 の判定は同じ試験ベクトルを通す。

### 6. 入口と画面

- サービスを選ぶ画面（freee や MF のような、使えるサービスの一覧）を誰がいつ作るかは「決めること」4。
- Cloudflare Access の許可は、サービスが Clerk で認証できるようになるまで、寺田だけのまま変えない。
- その後に Access を外すか、Access の IdP を Clerk にするかは「決めること」5。

## 移行の順番と Yes の関門

| 段階 | 中身 | 誰が | Yes の関門 |
|---|---|---|---|
| 0 | この ADR の「決めること」に答え、Accepted にする | 寺田 | この ADR の PR の merge |
| 1 | 基盤: Clerk の本番のインスタンス、`subscribe.sh` から Clerk への書き込み（`clerk-sync`・`hold`）、試験ベクトル、検証の見本 | 寺田（画面と鍵）、contract-billing | PR ごとの merge、画面の作業ごとの確認 |
| 2 | bd を Clerk に載せ、release して c01 に配置する。bd の 8 章（はじめの設定）は行わず、Clerk の組織への招待に置き換える。c01 にローカルのデータは無い（2026-11-09 に消去済み） | bd-deploy | PR ごとの merge、配置、Access の変更（寺田） |
| 3 | XESM を Clerk に載せる（5 節の a か b） | xesm-deploy | 同上 |
| 4 | 結合の試験（下の完了の条件） | contract-billing | — |
| 5 | 請求書で課金中の既存の顧客 1 社を、カードの引き落としに移す。組織を作り、カードを保存してもらい、支払い方法を `card` に変える。発行済みの請求書は振込のまま | 寺田（顧客への案内も寺田） | 顧客の同意と寺田の Yes |

段階 5 のために、`subscribe.sh` に支払い方法を変えるサブコマンドを足す（今の `subscribe.sh` は既存の顧客を書き換えない）。

## 完了の条件（反証できる形）

- 試験用の鍵で、同じ組織の id と同じ `services` の値からトークンを作る。bd と XESM の両方の試験が、共通の試験ベクトルの全件で同じ結果（開ける・閉じる・止める）を出す。どちらか一方の判定だけを変えると落ちる。
- 結合の試験では、試験用の鍵 1 つで作った同じトークンを 2 つのサービスの開発環境に送る。開ける・閉じるが 2 つで一致する。

## 決めること（寺田）

1. `hold` の組織をどう扱うか（全部止めるか、見るだけにするか）。いつ `hold` にするか（支払いの期限を過ぎてから何日か）。bd-deploy の B6 と同じ問い
2. 組織に入っていない利用者（個人のアカウント）を許すか。推奨は許さない
3. サービスでの役割をどこに持つか。推奨は組織のメンバーの public metadata（追加の費用なし）。代わりの案は Clerk の独自の役割（月 $100、組織の中で 1 人 1 つ）。`member` の人の既定の役割も決める
4. サービスを選ぶ画面を、誰がいつ作るか
5. サービスが Clerk で認証するようになった後、Cloudflare Access を外すか、Access の IdP を Clerk にするか
6. Clerk の 2 要素認証（Pro、月 $25）を使うか。XESM の承認者の段階認証をどこで満たすか
7. bd の要件 SEC-01 の書き換え（ローカル認証は開発用に残す）

## 代替案

- Clerk Billing: USD だけで消費税に未対応のため採らない（README 1A 章）。
- サービスごとに独自のアカウント（今の bd と XESM）: サービスを足すたびに、利用者の管理と課金の結び付けを作り直すことになる。寺田の決定に反するため採らない。
- サービスが Clerk や Stripe の API に毎回問い合わせて権利を確かめる: サービスごとに秘密鍵が要り、Clerk の秘密鍵は権限を絞れない。トークンの claim で足りるため採らない。

## 参考資料

1. Clerk: Session tokens（v2 の claim。`o.id`・`o.rol`・`fva`・`azp`・`sts`）: https://clerk.com/docs/guides/sessions/session-tokens
2. Clerk: Customize session tokens（`{{org.public_metadata}}`、`{{org_membership.public_metadata}}`、1.2KB、60 秒）: https://clerk.com/docs/guides/sessions/customize-session-tokens
3. Clerk: Deploy to production（サブドメインの間でセッションを共有）: https://clerk.com/docs/guides/development/deployment/production
4. Clerk: Manual JWT verification（JWKS Public Key、`azp` の照合）: https://clerk.com/docs/guides/sessions/manual-jwt-verification
5. Clerk: Organization metadata と更新の API（public / private、deep merge）: https://clerk.com/docs/guides/organizations/metadata 、https://clerk.com/docs/reference/backend/organization/update-organization-metadata
6. Clerk: Roles and permissions（既定の役割、独自の役割は 10 個まで、本番は追加機能が要る）: https://clerk.com/docs/guides/organizations/control-access/roles-and-permissions
7. Clerk: Billing overview（USD だけ）: https://clerk.com/docs/guides/billing/overview
8. Clerk: How Clerk implements OAuth（ID トークンの claim、`user:org:read` と `org_id`）: https://clerk.com/docs/guides/configure/auth-strategies/oauth/how-clerk-implements-oauth
9. Clerk: Pricing（組織は全プランで使える、Enhanced の追加機能、Pro）: https://clerk.com/pricing

いずれも 2026-11-09 に読んだ。料金と機能は変わるので、決めるときに読み直す。この ADR を直すのは contract-billing のレーンで、bd と XESM の参照の ADR はそれぞれのレーンが直す。
