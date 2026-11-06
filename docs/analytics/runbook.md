# アクセス解析（GA4・Clarity）を Cor. 所有にそろえる手順書

実行する人: 寺田康佑。対象は cor-jp.com と griftai.org の 2 サイトです。

この手順書は、corsweb（Cor-Incorporated/corsweb2024）と griftai（Cor-Incorporated/griftai）の `docs/analytics/runbook.md` に同じ文面で置いてあります。コードの変更は 2 つの PR に入っています。この手順書の作業は、PR の merge とは別に、寺田さんの手で進めます。

## 0. 何がどう変わるか（現在値 → 設定値）

現在値は 2026-11-06 に測りました。

| サイト | 計測 | 現在値 | 作業のあとの値 | 値を置く場所 |
|---|---|---|---|---|
| cor-jp.com | Clarity | `z97a0rwaoh`（本番 HTML で確認）。secret `PUBLIC_CLARITY_ID` は 2026-11-06T03:34:46Z に更新済み | 変えない | corsweb2024 の secret |
| cor-jp.com | GA4 | なし。variable に `PUBLIC_GA4_ID` がない（variable は `CMS_DEPLOY_ENABLED` だけ） | 手順 1 で得た測定 ID | corsweb2024 の variable `PUBLIC_GA4_ID` |
| griftai.org | Clarity | `wk1nad97m0`。コードに直書き。GMO 所有の見込み（未確認） | 手順 2 で得た Project ID | Cloudflare Pages の `griftai`、Production の変数 `PUBLIC_CLARITY_ID` |
| griftai.org | GA4 | `G-3E8328E5V6`。コードに直書き。所有は未確認 | 手順 3 の結果で決まる測定 ID | 同じく Production の変数 `PUBLIC_GA4_ID` |

- griftai の GitHub には secret も variable もありません（`gh secret list -R Cor-Incorporated/griftai` と `gh variable list -R Cor-Incorporated/griftai` はどちらも 0 件）。本番は Cloudflare Pages の Git 連携がビルドします。ビルド時の値は、GitHub ではなく Pages の設定に置きます。
- Pages の Production に今どんな変数があるかは、読み取れていません（未確認）。手順 5-2 で画面を見て確かめます。

## 1. 守る順序（飛ばすと計測が止まる、または開示なしで計測が始まる）

1. griftai.org は、ID をコードから外します。Pages の Production に変数を入れる前に release すると、griftai.org の GA4 と Clarity が止まります。**手順 5-2 を、手順 6-2 より先に**します。
2. cor-jp.com の GA4 は、プライバシーポリシーに Google Analytics の開示が入ってから有効にします。corsweb の ja・en のポリシー（`src/i18n/locales/ja.json` と `en.json`）に「Google Analytics」は 0 件です（corsweb の checkout で `grep -c "Google Analytics" src/i18n/locales/ja.json` が 0）。開示の PR は別です。**その PR が merge されるまで、手順 5-1 を実行しません。**
3. PR の merge は 1 本ごとに寺田さんの Yes です。

## 2. 手順 1　GA4 のプロパティ「cor-jp.com」を作り、測定 ID を取る

ブラウザの作業です（CLI では実行できません）。画面の文言は公式ヘルプの記述です。この手順書を書いた時点では、画面を見ていません（未確認）。

- 作成: https://support.google.com/analytics/answer/9304153
- 測定 ID: https://support.google.com/analytics/answer/12270356

1. https://analytics.google.com/ を開き、Cor. が管理する Google アカウントでサインインします。
2. Admin から Create、Property の順に進みます。プロパティ名は `cor-jp.com`。タイムゾーンは日本、通貨は日本円にします。
3. Web のデータストリームを作ります。URL は `cor-jp.com`、ストリーム名は `cor-jp.com` です。
4. 測定 ID を取ります。Admin の Data collection and modification から Data streams を開き、Web のタブで作ったストリームを開くと、`G-` で始まる値があります。
5. 取った値が、サイトが受け付ける形かを確かめます。出力が 1 行返れば合っています。

```bash
echo '<手順 4 で取った値>' | grep -E '^G-[A-Z0-9]+$'
```

サイトは、この形に合わない値を出しません。出さないときは何も表示せず、計測だけが止まります。

## 3. 手順 2　Clarity のプロジェクト「griftai.org」を作り、Project ID を取る

ブラウザの作業です。画面の文言は公式ヘルプの記述で、未確認です。

- https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-setup

1. https://clarity.microsoft.com/ を開きます。本日 `Cor.` を作ったのと同じアカウントでサインインします。
2. New project を選びます。Name は `griftai.org`、Website は `https://griftai.org` です。Add new project で作ります。
3. Project ID を取ります。Settings の Overview を開くと Project ID があります。
4. 取った値が、サイトが受け付ける形かを確かめます。出力が 1 行返れば合っています。

```bash
echo '<手順 3 で取った値>' | grep -E '^[A-Za-z0-9]+$'
```

旧プロジェクト `wk1nad97m0`（GMO 所有の見込み）には触りません。新しいプロジェクトの ID は別の値です。

## 4. 手順 3　`G-3E8328E5V6` の所有を確かめる

ブラウザの作業です。画面の文言は公式ヘルプの記述で、未確認です。

- https://support.google.com/analytics/answer/9305788

1. 手順 1 と同じ Google アカウントで Analytics を開きます。アカウントとプロパティの一覧から、データストリームの測定 ID が `G-3E8328E5V6` のプロパティを探します。測定 ID は、手順 1 の 4 と同じ画面で見られます。
2. 見つかったら、そのプロパティの Admin で Property access management を開きます。Administrator に Cor. のアカウントがあるかを見ます。

| 結果 | 判断 | griftai.org の `PUBLIC_GA4_ID` に入れる値 |
|---|---|---|
| 一覧にある。Administrator に Cor. のアカウントがいる | Cor. 所有 | `G-3E8328E5V6`（変えない。これまでの履歴が続く） |
| 一覧にない、または Administrator が GMO のアカウントだけ | GMO 所有 | 新しいプロパティ「griftai.org」を手順 1 と同じ要領で作り（ストリームの URL は `griftai.org`）、その測定 ID |

判断がつかないときは、GMO 所有として扱います。履歴は引き継げませんが、所有が確かになります。

## 5. 手順 4　値を登録する

### 5-1　cor-jp.com の GA4（プライバシーポリシーの開示が merge されたあとだけ）

GA4 の測定 ID はページのソースに出る公開の値です。secret ではないので variable に置きます（`deploy.yml` は variable を先に読み、なければ secret を読みます）。

```bash
gh variable list -R Cor-Incorporated/corsweb2024
```

今の出力は `CMS_DEPLOY_ENABLED	true	…` の 1 行だけです。`PUBLIC_GA4_ID` の行があれば、すでに設定済みなので、次の設定は上書きになります。

```bash
gh variable set PUBLIC_GA4_ID -R Cor-Incorporated/corsweb2024 --body '<手順 1 で取った測定 ID>'
gh variable list -R Cor-Incorporated/corsweb2024 | grep '^PUBLIC_GA4_ID'
```

2 行目の出力の値が、手順 1 で取った測定 ID と一致していれば登録できています。

### 5-2　griftai.org の GA4 と Clarity（手順 6-2 より先）

ブラウザの作業です（Pages のビルド変数は CLI で入れられません。Git 連携のプロジェクト設定にあるためです）。画面の文言は未確認です。

1. Cloudflare のダッシュボードで Workers & Pages を開き、プロジェクト `griftai` の Settings にある環境変数の画面を開きます。
2. 画面に、すでに `PUBLIC_GA4_ID` と `PUBLIC_CLARITY_ID` があるかを見ます。ある場合は、今の値を控えてから上書きします。
3. **Production** に、次の 2 つを Plain text（公開値）で追加します。名前は一字一句この通りにします。
   - `PUBLIC_GA4_ID`: 手順 3 で決めた測定 ID
   - `PUBLIC_CLARITY_ID`: 手順 2 で取った Project ID
4. Preview には入れません。
5. 保存します。変数はビルドの時に読まれるので、保存しただけでは本番は変わりません。

## 6. 手順 5　本番に反映する（寺田さんの Yes のあと）

### 6-1　cor-jp.com

1. GA4 を足す PR（corsweb2024 の `feat/ga4-analytics-20261106`）を develop に merge します。Yes のあとに、レビュー記録の `Reviewed-Head` で固定します。

```bash
gh pr view <PR 番号> -R Cor-Incorporated/corsweb2024 --json headRefOid -q .headRefOid
gh pr merge <PR 番号> -R Cor-Incorporated/corsweb2024 --merge --match-head-commit <Reviewed-Head の sha>
gh pr view <PR 番号> -R Cor-Incorporated/corsweb2024 --json state,mergeCommit
```

2. develop から main へ release PR を作り、同じ要領で merge します。head は develop です。承認は寺田さん以外の 1 人が要ります。
3. main への push で `deploy.yml` が走り、variable の値がビルドに渡ります。run を確かめます。`conclusion` が `success` なら終わっています。

```bash
gh run list -R Cor-Incorporated/corsweb2024 --workflow deploy.yml --branch main --limit 1 --json databaseId,conclusion,headSha,createdAt
```

### 6-2　griftai.org（手順 5-2 のあと）

1. 直書きを env に変える PR（griftai の `fix/analytics-ids-env-20261106`）を develop に merge します。
2. develop から main へ release PR（題名は `release: YYYY-MM-DD develop → main`）を作り、merge します。main への merge で Cloudflare Pages が本番をビルドします。
3. 本番のビルドが成功したかは、main の最新コミットの check で見ます。名前が `Cloudflare Pages` の check が `success` になれば終わっています。同じコミットに `Deploy to Cloudflare Pages` という check もありますが、こちらは GitHub Actions の job で、今は `skipped` です（Cloudflare の secret が未設定のため）。見るのは前者だけです。

```bash
gh api repos/Cor-Incorporated/griftai/commits/main/check-runs -q '.check_runs[] | select(.name == "Cloudflare Pages") | {name, conclusion}'
```

## 7. 反映できたかを本番の HTML で確かめる

出力は、設定した値と一致している必要があります。ここに書いたコマンドは、手元のビルドでは出力を確かめました。本番の HTML での出力は、反映前なので未実測です。

cor-jp.com の GA4（手順 1 の測定 ID が 1 行だけ出ます）:

```bash
curl -s --compressed https://cor-jp.com/ | grep -oE '"G-[A-Z0-9]+"' | sort -u
```

cor-jp.com の Clarity（`clarity.ms/tag/z97a0rwaoh` が 1 行だけ出ます）:

```bash
curl -s --compressed https://cor-jp.com/ | grep -oE 'clarity\.ms/tag/[A-Za-z0-9]+' | sort -u
```

griftai.org の GA4（手順 3 で決めた測定 ID が 1 行だけ出ます）:

```bash
curl -s --compressed https://griftai.org/ | grep -oE 'G-[A-Z0-9]{6,}' | sort -u
```

griftai.org の Clarity（手順 2 の Project ID を含む行が出ます）:

```bash
curl -s --compressed https://griftai.org/ | grep -oE 'clarityId = "[A-Za-z0-9]+"|clarity\.ms/tag/[A-Za-z0-9]+' | sort -u
```

griftai.org の旧 Clarity ID が残っていないこと（`0` と出れば合っています）:

```bash
curl -s --compressed https://griftai.org/ | grep -oE 'wk1nad97m0' | wc -l
```

手順 3 で GMO 所有と判断して GA4 を作り直した場合は、旧 GA4 の ID も残っていないことを確かめます（`0` と出れば合っています）:

```bash
curl -s --compressed https://griftai.org/ | grep -oE 'G-3E8328E5V6' | wc -l
```

ダッシュボードに数字が届いたかは、寺田さんの目視です。自分で本番のページを開いて、GA4 は Reports の Realtime、Clarity は Dashboard で確かめます。画面の文言と、数字が出るまでの時間は未確認です。

計測されるのは本番だけです。cor-jp.com は main の push でビルドした本番のページ、griftai.org は `griftai.org` と `www.griftai.org` で開いたページです。preview や手元のページは数えません。

## 8. 問題が起きたら

| 症状 | 原因の候補 | 切り分けと直し方 |
|---|---|---|
| cor-jp.com の本番 HTML に `G-` が 0 件 | variable の値の形が崩れている。サイトは崩れた値を出さず、何も表示しない | 下の 1 行で値を読む。出力が空なら形が崩れている。バッククォート、小文字、`UA-` で始まる旧 ID、Clarity の ID との取り違えを疑う |
| cor-jp.com の deploy は成功しているのに `G-` が 0 件 | 変数を入れる前の run だった | 手順 5-1 のあとに main への push がないと、値はビルドに入らない。次の main への push で入る |
| griftai.org のリリース後にタグが消えた | Pages の Production に変数がない、または名前が違う（`PUBLIC_` から始まる必要がある） | 手順 5-2 を見直し、Production に 2 つあるかを確かめる。直したあと、main の最新コミットで本番ビルドをやり直す（画面の操作は未確認） |
| 数字がダッシュボードに出ない | ストリームの URL や Project の Website が実際のホストと違う。ブラウザの広告ブロックで止まっている | 本番 HTML で ID が一致していれば、サイト側は届いている。ブラウザの開発者ツールの Network で `gtag/js?id=` と `clarity.ms/tag/` のリクエストを見る |
| preview の PR で数字が出ない | 仕様 | preview では計測しない（社内の確認で解析が汚れないようにするため） |

```bash
gh variable list -R Cor-Incorporated/corsweb2024 --json name,value -q '.[] | select(.name == "PUBLIC_GA4_ID") | .value' | grep -E '^G-[A-Z0-9]+$'
```

## 9. 元に戻す

- cor-jp.com の GA4 を止める: variable を消します。次の main への push から、タグが出なくなります。

```bash
gh variable delete PUBLIC_GA4_ID -R Cor-Incorporated/corsweb2024
gh variable list -R Cor-Incorporated/corsweb2024
```

- griftai.org を元の ID に戻す: Pages の Production の変数を、旧値（`PUBLIC_GA4_ID` は `G-3E8328E5V6`、`PUBLIC_CLARITY_ID` は `wk1nad97m0`）に直して、本番ビルドをやり直します。

## 10. 出典

- 変更の中身: corsweb の `src/components/analytics/Analytics.astro` と `analytics-tags.ts`、`.github/workflows/deploy.yml`。griftai の `src/config/analytics.ts` と `src/layouts/BaseLayout.astro`。
- 設計の説明: 各 repo の `docs/analytics/README.md`。
- GA4 の画面の根拠: 手順 1・3 に書いた Google アナリティクス ヘルプ。Clarity の画面の根拠: 手順 2 に書いた Microsoft の文書。どちらも画面は未確認です。
