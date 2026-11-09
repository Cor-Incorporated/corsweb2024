# ADR-0028 Cor. のサービスに共通のアカウントと課金の基盤（Clerk の組織と自前の Stripe）

## ステータス: Proposed (2026-11-09)（決めること 1〜10 は寺田が回答済み。11 は回答待ち。この PR の merge で Accepted にする）

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
| 2 要素の水準とセッションの生死 | ログインを受け持つ IdP | bd は Clerk。XESM は (a) なら Keycloak、(b2) なら Clerk（5 節） |

- Clerk のアプリケーションは 1 つにする。本番のインスタンスのドメインは `cor-jp.com` にする。
- サービスは `cor-jp.com` の下のホストに置く。今の bd と XESM も、どちらも `cor-jp.com` のサブドメインにある。
- Clerk の文書では、本番のセッションはサブドメインの間で共有される [3]。1 回のログインで、組織が契約しているサービスを全部使える。
- 2026-11-09 に寺田が Clerk の画面で確かめたところ、本番のアプリケーションは既に 2 つある。Grift 用（`app.griftai.org`）と、Cor. 用（`app.cor-jp.com`、最後の更新は約 2 年前）。プランは Hobby。
- 既存の Cor. 用を使うか、新しく作るかは「決めること」11。
- 既存の Cor. 用のドメインが本番のドメインとして `app.cor-jp.com` なら、セッションを共有するのは `app.cor-jp.com` の下だけになる見込み（未確認）。今の bd と XESM のホストは `cor-jp.com` の直下なので、そのままでは共有できない。
- 共有するには 3 つの道がある。本番のドメインを `cor-jp.com` にする。サービスを `app.cor-jp.com` の下に置く。satellite のドメイン（月 $10 ずつ [9]）を使う。
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
  └─ 道 B: 署名つきの通知（Clerk の webhook か、clerk-sync からの push）
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
- 書くのは `subscribe.sh` の `contract`・`cancel` と、新しく作る `hold`（とそれを外すサブコマンド）の後。
- Clerk の更新は deep merge で、値を `null` にするとその項目が消える [5]。
- 道 A: トークンは 60 秒ごとに作り直されるので、反映は最大で 1 分遅れる [2]。独自 claim は 1.2KB まで [2]。`services` には上の 3 つの項目だけを入れる。
- 道 B の通知の送り手は、下の 3 つの案から B1（Clerk の webhook）に決めた（決定 8）。受け手は届いた `services` の全体で自分の表を上書きし、重複を捨てる。
- 道 B の前提: XESM の API には外への出口が無い（xesm-deploy の調査）。だから XESM から読みに行く形（pull）は作れず、道 B は届けてもらう形（push）だけになる。

| 案 | 送り手 | 長所 | 短所 |
|---|---|---|---|
| B1 Clerk の webhook（採る） | Clerk（組織の作成と更新のイベント） | 書き込みが 1 本で済む（サービスの表は Clerk の metadata の写しで、元は Clerk の 1 つ）。届かなければ Svix が送り直す。寺田の手元に鍵が増えない。権利の形が道 A と同じ | 少なくとも 1 回届くが、順番は保証されない（同じイベントは同じ `svix-id`）[10]。受け口は Access の外に出し、署名だけで守る（守る面が広い）。全件を強制的に送り直す道が Clerk に無い（下の補い）。イベントの名前と中身は未確認（U13） |
| B2 clerk-sync からの push | `subscribe.sh` の `clerk-sync`（寺田が実行） | 書いた直後に届く。全件の強制の送り直しが自然に作れる。受け口は Access のサービストークンと署名の 2 重で守れる（守る面が狭い） | Clerk とサービスに別々に書くので、片方だけ失敗するとずれる。署名の鍵が寺田の手元と XESM の 2 か所に要る。届かなければ寺田が送り直す |
| B3 Stripe の webhook | Stripe（Customer の更新） | 契約の正本から直接届く | サービスが Stripe の metadata の形を知り、契約の規則（`from`・`until`・`hold` の決め方）をサービス側にも持つことになる（二重になる）。権利の形が道 A と変わる |

- 道 B のサービスは、権利を自分の DB にも持つので、元が 2 つになる。どの案でも定期の照合を行う。
- 照合は「サービスの表を読んで比べる」ではなく、「全件を強制的に送り直して上書きする」形にする。XESM の表を読むには、Access を越える道がもう 1 本要るため（読む受け口を足すなら別の判断）。
- B1 で全件を送り直すには、`subscribe.sh` が組織の metadata に送り直しの印（例: `resync_at` に時刻）を書き、Clerk に更新のイベントを起こさせる。これで足りるかは U13 で確かめる。足りなければ、送り直しだけ B2 の push を使う。
- B1 で組織の作成のイベントからテナントと最初の管理者まで作れれば、R5 と R7 の受け口は 1 本で済む。最初の管理者を通知の中身から特定できるかも U13 で確かめる。

### 3. サービス側の実装規約

すべてのサービスが次の R1〜R9 を守る。権利の判定が守れているかは、共通の試験ベクトル（`docs/billing` の下に置く JSON のファイル。これから作る）で確かめる。各サービスの試験がこのファイルを読み、全件で同じ結果になること。

R1〜R3 は、Clerk のトークンを直接検証するサービスの約束。Keycloak を挟むサービス（XESM の案 (a)）は、今のログインの検証のまま、表の中の読み替えに従う。だから共通の試験ベクトルは、トークンの検証には当てず、R5 の判定（`services` の値と日付を入れて、開けるか閉じるかを返す）にだけ当てる。

| # | 約束 | 中身 |
|---|---|---|
| R1 | ログインを確かめる | Clerk に直接つなぐサービスは、セッショントークンを RS256 で検証する。公開鍵は Dashboard の API keys の画面にある JWKS Public Key を設定に置き、通信しない [4]。`iss` は本番の Frontend API の URL（値は本番のインスタンスを作った後に決まる）。`exp`・`nbf` を確かめ、`azp` を自分のホストの許可リストと照らす [4]。`v` が `2` であること、`sts` が `pending` なら拒否すること。Keycloak を挟むサービスは、今の OIDC の検証を変えない（Keycloak が Clerk にログインを任せる） |
| R2 | テナントを組織に結ぶ | 自分のテナントに Clerk の組織の id を持つ（bd は起動の設定の `CLERK_ORG_ID` と workspace、XESM は Tenant）。Clerk に直接つなぐサービスは、トークンの `o.id` [1] がそれと違えば拒否する。`o` の無いトークン（組織を選んでいない）も拒否する |
| R3 | 利用者を結び付ける | (`iss`, `sub`) で自分の利用者に結ぶ。メールアドレスでは結ばない。Keycloak を挟むあいだは、Keycloak の `iss` と `sub` のまま。Clerk の利用者の id を Keycloak から運べるかは未確認（xesm-deploy の U11） |
| R4 | 所属と役割は自分の DB に持つ | 認可は今の作り（bd の `Principal`、XESM の `Membership`・`ROLE_CAPS`）で行う。Clerk の role（`o.rol` [1]）は、最初の管理者を決めるときにだけ使う |
| R5 | 権利を受け取る | 道 A（独自 claim `cor_svc`）か道 B（署名を確かめた通知を自分の表に書く。重複を捨て、順番が入れ替わっても最後の状態になる）のどちらか |
| R6 | 権利を判定の一点に掛ける | 権限を判定する一点（bd は `current_principal` と `require`、XESM は `caps()` と `require_cap`）に権利を掛ける。止めた組織は、書く能力だけを落とせる形にする。お客様が書き換えられる欄（XESM の `Tenant.active`）を課金に使わない |
| R7 | テナントと所属を作る受け口を持つ | 契約で組織ができたら、サービスのテナントと最初の管理者を作る。同じ通知が何度届いても 1 つしか作らない。今は bd も XESM も人手のスクリプトだけ。所属は Clerk の組織への招待から作り、各サービスの画面では利用者を足さない（決定 10）。道 A のサービスは初めてのログインで、道 B のサービスはメンバーの通知で作る（通知の名前と中身は U13） |
| R8 | 記録を残す | 監査の記録に、Clerk の組織の id と利用者を残す。Keycloak を挟むあいだは、Keycloak の利用者とテナントに結んだ組織の id を残す |
| R9 | 鍵を持たない | Clerk の秘密鍵と Stripe の鍵をサービスに置かない。道 B のサービスは通知の署名を確かめる鍵だけを持つ（確かめるだけで、API は呼べない）。XESM が Clerk の Backend API を直接引く案は、秘密鍵が要るので採らない |

判定表は次のとおり。d は日本時間の今日の日付。

| 条件 | 結果 |
|---|---|
| 自分のサービスの行が無い | 閉じる |
| d が `from` より前 | 閉じる |
| `until` があり、d が `until` の翌日から 30 日以内 | 読む・書き出すだけ（終了日の当日までは開ける） |
| `until` があり、d が `until` の翌日から 30 日を過ぎた後 | 閉じる |
| `hold` が `true` | 見るだけ（書き込みを止める） |
| それ以外 | 開ける |

- 結果は「開ける」「見るだけ」「読む・書き出すだけ」「閉じる」の 4 つ。サービスは R6 の一点で、書く能力（と書き出す能力）を落として表す（決定 1）。
- `hold` にするのは、請求書の支払いの期限の 14 日後を過ぎても払われていないとき（決定 1）。`subscribe.sh` が照合のときに確かめて書く。

### 4. 役割の持ち方

- 所属と役割は各サービスの DB に持つ（R4、決定 3）。bd も XESM も今そうなっている。IdP を替えても、認可の作りは変わらない。
- XESM の調査によると、Clerk の role を認可に使うと、XESM の保証が Clerk 側の設定に左右される。今の保証は「承認は承認者の役割だけ」「見えないものは 404」。
- Clerk の独自の役割（例: `org:viewer`）は使わない。本番では有料の追加機能（Enhanced、月 $100）が要るうえ [6][9]、組織の中で 1 人に 1 つしか付けられず、サービスごとに違う役割を表せない。
- 独自の役割の数の上限は、文書では 1 つのインスタンスで 10 個まで [6]。料金のページには無制限と書かれていて、食い違う（未確認）。

### 5. bd と XESM の載せ方

- bd（Python の API と web）は Clerk に直接つなぐ（道 A）。`DOSSIER_AUTH_MODE=local|clerk` で切り替え、`Principal` の形は変えない。作業は bd-deploy のレーンの一覧（B1〜T1、9〜12 日の見込み）。
- XESM は、次の 2 つの候補のどちらかにする。今は (a)+道 B とし、寺田が Clerk の画面でアプリケーションを作った直後（K2〜K4）に行う実測 U1〜U13（xesm-deploy の表）の後に決め直す（決定 9）。
  - (b2) Clerk の SDK とセッショントークンに作り替える。R1〜R6 をそのまま満たし、道 A を使える。Keycloak の運用も無くなる。認証の層を書き直すので作業は大きい。ただし承認者の段階認証を Clerk の `fva` で満たせるなら、全体は (a) より小さい（xesm-deploy の見立て）。
  - (a)+道 B: Keycloak を残し、Clerk を Keycloak の上流の IdP にする。権利は道 B で受け取る。ログインのコードは変えずに足せて、戻すときは Keycloak で Clerk の IdP を無効にするだけ。権利の受け口と判定の一点のために、XESM のコードは変わる。
- (a)+道 B では 2 要素の確認が 2 か所になる。承認・共有・納品・組織管理の `acr=mfa` は Keycloak の TOTP で満たし、Clerk で済ませた 2 要素は Keycloak に伝わらない見込み。Keycloak の運用も残る。
- Clerk の 2 要素（Pro）は使う。2 か所になることは、U12 の結果が出るまで受け入れる（決定 6）。
- 実測の前の既定を (a)+道 B にしたのは、戻しが軽く、実測の結果に左右されないため。
- 実測で特に効くのは次の 4 つ。
  - U12: `fva` で承認者の段階認証（`acr=mfa` にあたるもの）を満たせるか。基準は、2 要素で守る操作ごとに、15 分以内の確認を、サーバーが確かめられること。操作ごとの確認を Clerk の SDK で呼べなければ、(b2) でも承認の 2 要素は別の手段が要り、(b2) の利点は小さくなる。(a) では `fva` が XESM に届かないので、U12 が効くのは (b2) のときだけ
  - U1: Clerk の ID トークンに `acr`・`amr` を載せられるか
  - U3: サインアウトや利用者の停止が伝わるか
  - U10: 共有の Cookie と `cor_svc` が XESM のホストに届くか
- Clerk を OIDC の IdP として XESM に直接つなぐ案（b1）は採らない。理由は Clerk の文書に次の記載が無いこと [8]。
  - ID トークンの `acr`・`amr`
  - ログアウト（end_session）
  - `/.well-known/openid-configuration`
- さらに、XESM が今求めるスコープには `offline_access` が無い。このまま直結すると、2 要素で守る操作が通らず、60 秒ごとの確認でセッションが切れる（xesm-deploy の調査）。
- Keycloak の mapper で権利を XESM まで運ぶ案も採らない。Clerk の ID トークンに組織の metadata は載らないので、利用者の metadata への写し直しが要り、書き込みが二重になる。反映も再ログインまで（最長 10 時間）遅れる（xesm-deploy の調査）。
- XESM の権利は、`caps()` と `require_cap` に組織の権利を掛ける形にする（R6）。テナントを作る受け口（R7）は新しく要る。今の XESM の Tenant は、人手のスクリプトでしか作れない。

### 6. 入口と画面

- サービスを選ぶ画面（freee や MF のような、使えるサービスの一覧）は corsweb のレーンが作る。段階 2 と並行で作る（決定 4）。
- Cloudflare Access の許可は、サービスが Clerk で認証できるようになるまで、寺田だけのまま変えない。
- Clerk の認証が入ったら、そのサービスの Access を外す。Access の IdP を Clerk にはしない（決定 5）。
- 組織に入っていない利用者（個人のアカウント）は許さない。組織が必須（決定 2）。
- bd の要件 SEC-01 は書き換える。ローカル認証は開発用だけに残す（決定 7）。

## 移行の順番と Yes の関門

| 段階 | 中身 | 誰が | Yes の関門 |
|---|---|---|---|
| 0 | 決めること 11 に答え、この ADR を Accepted にする | 寺田 | この ADR の PR の merge |
| 1 | 基盤: Clerk のアプリケーションと開発のインスタンス（寺田の画面の作業）。その直後に U1〜U13 の実測と、XESM の載せ方の決定。`subscribe.sh` から Clerk への書き込み（`clerk-sync`・`hold`）と照合、試験ベクトル、検証の見本。最後に本番のインスタンス | 寺田（画面と鍵）、xesm-deploy（U1〜U13）、contract-billing | PR ごとの merge、画面の作業ごとの確認、XESM の載せ方の決定（寺田） |
| 2 | bd を Clerk に載せ（道 A）、release して c01 に配置する。bd の 8 章（はじめの設定）は行わず、Clerk の組織への招待に置き換える。c01 にローカルのデータは無い（2026-11-09 に消去済み）。Clerk の認証が入ったら Access を外す。並行して corsweb がサービスを選ぶ画面を作る | bd-deploy、corsweb | PR ごとの merge、配置、Access の変更（寺田） |
| 3（(b2) のとき） | XESM の認証を Clerk の SDK とセッショントークンに作り替える（道 A）。`OidcIdentity` を先に 1 対多にし、利用者の (`iss`, `sub`) を付け替える。承認者の段階認証は `fva` で満たす。テナントを作る受け口、判定の一点への権利の掛け方、試験と CI の作り替え | xesm-deploy | 同上 |
| 3（(a)+道 B のとき） | Keycloak に Clerk を上流の IdP として足す。権利の表（例: `TenantEntitlement`）と道 B の受け口、テナントを作る受け口、判定の一点への権利の掛け方。2 要素の確認は Keycloak の TOTP のまま | xesm-deploy（道 B の送り手が B2 なら contract-billing も） | 同上 |
| 4 | 結合の試験（下の完了の条件） | contract-billing | — |
| 5 | 請求書で課金中の既存の顧客 1 社を、カードの引き落としに移す。組織を作り、カードを保存してもらい、支払い方法を `card` に変える。発行済みの請求書は振込のまま | 寺田（顧客への案内も寺田） | 顧客の同意と寺田の Yes |

段階 5 のために、`subscribe.sh` に支払い方法を変えるサブコマンドを足す（今の `subscribe.sh` は既存の顧客を書き換えない）。

## 完了の条件（反証できる形）

- 共通の試験ベクトルは、R5 の判定への入力（`services` の値と日付）と、期待する結果（開ける・閉じる・止める）の組の一覧。bd と XESM の両方の試験が、全件で期待どおりの結果を出す。どちらか一方の判定だけを変えると落ちる。
- 結合の試験では、試験用の組織の `services` を 1 回書き換え、各サービスがそれぞれの道で受け取る。bd は試験用の鍵で署名したトークンで受け取る。XESM は (b2) なら同じトークン、(a)+道 B なら試験用の鍵で署名した通知で受け取る。R5 の判定への入力が同じになり、開ける・閉じるが 2 つで一致すること。
- (a)+道 B では、同じトークンを 2 つのサービスに送る形の試験は成り立たない。XESM は Keycloak のトークンを検証するため。だから完了の条件を「R5 の判定への入力が同じ」で書いている（xesm-deploy の指摘）。

## 決まったこと（寺田、2026-11-09。統括が出した回答の案に「推奨通りでOK」と答えた）

1. `hold` の組織は、書き込みだけを止めて閲覧は残す。`hold` にするのは支払いの期限の 14 日後。終了日の後の 30 日は、読む・書き出すだけを残す
2. 個人のアカウントは許さない（組織が必須）
3. 役割は各サービスの DB に持つ（Clerk の独自の役割は使わない）
4. サービスを選ぶ画面は corsweb が作る。段階 2 と並行で作る
5. Clerk の認証が入った後は、Cloudflare Access を外す（Access の IdP を Clerk にはしない）
6. Clerk の 2 要素（Pro）は使う。(a) で 2 要素が 2 か所になるのは、U12 の結果が出るまで受け入れる
7. bd の要件 SEC-01 は書き換える（ローカル認証は開発用だけ）
8. 道 B の通知の送り手は B1（Clerk の webhook）
9. XESM は既定の (a)+道 B のまま。U1〜U13 の後に決め直す
10. メンバーの追加は Clerk の組織への招待にそろえる（各サービスの画面には残さない）

## まだ決めること（寺田）

11. Clerk の既存の Cor. 用のアプリケーション（`app.cor-jp.com`）を使うか、新しく作るか。使うなら、本番のドメインとセッションの共有をどうするか（1 節の 3 つの道）。今のプランは Hobby で、決定 6 のために Pro にする

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
