# アクセス解析（GA4・Clarity）を Cor. 所有にそろえる手順書

実行する人: 寺田康佑（ブラウザの作業と、PR ごとの Yes）と、エージェント（`gh` と `curl` のコマンド）。対象は cor-jp.com と griftai.org の 2 サイトです。

この手順書は、corsweb（Cor-Incorporated/corsweb2024）と griftai（Cor-Incorporated/griftai）の `docs/analytics/runbook.md` に同じ文面で置いてあります。コードの変更は 2 つの PR に入っています。corsweb は PR 497、griftai は PR 108 です。

誰が手を動かすか:

- ブラウザの作業（2・3・4 節と 5-2 節）は、寺田さんの手が要ります。GA4、Clarity、Cloudflare にサインインして行います。
- `gh` と `curl` のコマンドは、エージェントが打ちます。merge と本番への反映は、PR ごとの寺田さんの Yes のあとです。寺田さんが自分で打ってもかまいません。同じ文面で動きます。

## 0. 何がどう変わるか（現在値 → 設定値）

現在値は 2026-11-06 に測りました。

| サイト | 計測 | 現在値 | 作業のあとの値 | 値を置く場所 |
|---|---|---|---|---|
| cor-jp.com | Clarity | `z97a0rwaoh`（本番 HTML で確認）。secret `PUBLIC_CLARITY_ID` は 2026-11-06T03:34:46Z に更新済み | 変えない | corsweb2024 の secret |
| cor-jp.com | GA4 | なし。variable に `PUBLIC_GA4_ID` がない（variable は `CMS_DEPLOY_ENABLED` だけ） | 2 節で得た測定 ID | corsweb2024 の variable `PUBLIC_GA4_ID` |
| griftai.org | Clarity | `wk1nad97m0`。コードに直書き。GMO 所有の見込み（未確認） | 3 節で得た Project ID | Cloudflare Pages の `griftai`、Production の変数 `PUBLIC_CLARITY_ID` |
| griftai.org | GA4 | `G-3E8328E5V6`。コードに直書き。所有は未確認 | 4 節の結果で決まる測定 ID | 同じく Production の変数 `PUBLIC_GA4_ID` |

- griftai の GitHub には secret も variable もありません（`gh secret list -R Cor-Incorporated/griftai` と `gh variable list -R Cor-Incorporated/griftai` はどちらも 0 件）。本番は Cloudflare Pages の Git 連携がビルドします。ビルド時の値は、GitHub ではなく Pages の設定に置きます。
- Pages の Production に今どんな変数があるかは、読み取れていません（未確認）。5-2 節で画面を見て確かめます。

## 1. 守る順序（飛ばすと計測が止まる、または開示なしで計測が始まる）

1. griftai.org は、ID をコードから外します。Pages の Production に変数を入れる前に release すると、griftai.org の GA4 と Clarity が止まります。**5-2 節を、6-2 節より先に**します。
2. cor-jp.com の GA4 は、プライバシーポリシーに Google Analytics の開示が入ってから有効にします。corsweb の ja・en のポリシー（`src/i18n/locales/ja.json` と `en.json`）に「Google Analytics」は 0 件です（corsweb の checkout で `grep -c "Google Analytics" src/i18n/locales/ja.json` が 0）。開示の PR は別です。**その PR が merge されるまで、5-1 節を実行しません。**
3. PR の merge は 1 本ごとに寺田さんの Yes です。

## 2. GA4 のプロパティ「cor-jp.com」を作り、測定 ID を取る

ブラウザの作業です（CLI では実行できません）。画面の文言は公式ヘルプの記述です。この手順書を書いた時点では、画面を見ていません（未確認）。

- 作成: https://support.google.com/analytics/answer/9304153
- 測定 ID: https://support.google.com/analytics/answer/12270356

1. https://analytics.google.com/ を開き、Cor. が管理する Google アカウントでサインインします。サインインしたアカウントのメールアドレスを控えます（4 節で同じアカウントを使います）。
2. Admin から Create、Property の順に進みます。プロパティ名は `cor-jp.com`。タイムゾーンは日本、通貨は日本円にします。
3. Web のデータストリームを作ります。URL は `cor-jp.com`、ストリーム名は `cor-jp.com` です。
4. 測定 ID を取ります。Admin の Data collection and modification から Data streams を開き、Web のタブで作ったストリームを開くと、`G-` で始まる値があります。
5. 取った値が、サイトが受け付ける形かを確かめます。出力が 1 行返れば合っています。5-1 節の登録コマンドも、同じ形の検査を通った値だけを登録します。

```bash
echo '<この節の 4 で取った値>' | grep -E '^G-[A-Z0-9]+$'
```

6. ページを移ったときの閲覧を数える設定を確かめます。サイトはページの移動をブラウザの履歴の操作で行います。2 ページ目以降の閲覧は、GA4 の拡張計測にある「ブラウザの履歴イベントに基づくページの変更」が有効なときだけ数えられます。既定で有効のはずですが、この設定の画面の文言は未確認です。

サイトは、この形に合わない値を出しません。出さないときは何も表示せず、計測だけが止まります。

## 3. Clarity のプロジェクト「griftai.org」を作り、Project ID を取る

ブラウザの作業です。画面の文言は公式ヘルプの記述で、未確認です。

- https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-setup

1. https://clarity.microsoft.com/ を開きます。プロジェクト `Cor.`（Project ID `z97a0rwaoh`。cor-jp.com の本番が使っているもの）を開けるアカウントでサインインします。
2. New project を選びます。Name は `griftai.org`、Website は `https://griftai.org` です。Add new project で作ります。
3. Project ID を取ります。Settings の Overview を開くと Project ID があります。
4. 取った値が、サイトが受け付ける形かを確かめます。出力が 1 行返れば合っています。

```bash
echo '<この節の 3 で取った Project ID>' | grep -E '^[A-Za-z0-9]+$'
```

旧プロジェクト `wk1nad97m0`（GMO 所有の見込み）には触りません。新しいプロジェクトの ID は別の値です。

## 4. `G-3E8328E5V6` の所有を確かめる

ブラウザの作業です。画面の文言は公式ヘルプの記述で、未確認です。

- https://support.google.com/analytics/answer/9305788

1. 2 節と同じ Google アカウントで Analytics を開きます。アカウントとプロパティの一覧から、データストリームの測定 ID が `G-3E8328E5V6` のプロパティを探します。測定 ID は、2 節の 4 と同じ画面で見られます。
2. 見つかったら、そのプロパティの Admin で Property access management を開きます。Administrator に Cor. のアカウントがあるかを見ます。

| 結果 | 判断 | griftai.org の `PUBLIC_GA4_ID` に入れる値 |
|---|---|---|
| 一覧にある。Administrator に Cor. のアカウントがいる | Cor. 所有 | `G-3E8328E5V6`（変えない。これまでの履歴が続く） |
| 一覧にない、または Administrator が GMO のアカウントだけ | GMO 所有 | 新しいプロパティ「griftai.org」を 2 節と同じ要領で作り（ストリームの URL は `griftai.org`）、その測定 ID |

判断がつかないときは、GMO 所有として扱います。履歴は引き継げませんが、所有が確かになります。

## 5. 値を登録する

### 5-1　cor-jp.com の GA4（プライバシーポリシーの開示が merge されたあとだけ）

GA4 の測定 ID はページのソースに出る公開の値です。secret ではないので variable に置きます（`deploy.yml` は variable を先に読み、なければ secret を読みます）。

```bash
gh variable list -R Cor-Incorporated/corsweb2024
```

今の出力は `CMS_DEPLOY_ENABLED	true	…` の 1 行だけです。`PUBLIC_GA4_ID` の行があれば、すでに設定済みなので、次の設定は上書きになります。

次のコマンドは、測定 ID を聞き、サイトが受け付ける形のときだけ登録します（形が違えば何も登録しません）。聞かれたら、2 節で取った測定 ID を貼ります。

```bash
(
set -eu
printf '測定 ID: '; read -r id
printf '%s' "$id" | grep -qE '^G-[A-Z0-9]+$' || { echo "形式が違うので登録しません: $id"; exit 1; }
gh variable set PUBLIC_GA4_ID -R Cor-Incorporated/corsweb2024 --body "$id"
)
```

このブロックも、`(` から `)` までをまとめて貼ります。かっこの中は 1 つのコマンドとして読まれるので、`read` が次の行を入力として吸うことはありません。

登録したら、読み戻します。出力の値が、2 節で取った測定 ID と一致していれば登録できています。

```bash
gh variable list -R Cor-Incorporated/corsweb2024 | grep '^PUBLIC_GA4_ID'
```

### 5-2　griftai.org の GA4 と Clarity（6-2 節より先）

ブラウザの作業として書きます。Cloudflare の API でもビルド変数を設定できる見込みですが、使える API トークンが手元にありません（GitHub に Cloudflare の secret がないため）。設定する本文（payload）も試していないので、API の手順は書きません（未確認）。画面の文言も未確認です。

1. Cloudflare のダッシュボードで Workers & Pages を開き、プロジェクト `griftai` の Settings にある環境変数の画面を開きます。
2. 画面に、すでに `PUBLIC_GA4_ID` と `PUBLIC_CLARITY_ID` があるかを見ます。ある場合は、今の値を控えてから上書きします。
3. **Production** に、次の 2 つを Plain text（公開値）で追加します。名前は一字一句この通りにします。
   - `PUBLIC_GA4_ID`: 4 節で決めた測定 ID
   - `PUBLIC_CLARITY_ID`: 3 節で取った Project ID
4. Preview には入れません。
5. 保存します。変数はビルドの時に読まれるので、保存しただけでは本番は変わりません。

## 6. 本番に反映する（寺田さんの Yes のあと）

### 6-1　cor-jp.com

この節と次の節のブロックは、`(` から `)` までを 1 つのコマンドとして**まとめて**貼ります（エージェントがスクリプトとして実行しても、寺田さんが端末に貼っても、同じに動きます）。理由は次の 3 つです。

- `pr=RELEASE_PR_NUMBER` の行を書き換え忘れて貼ると、直後の `grep` の行（番号が数字だけかを確かめる）で、ブロックの残りが走りません。
- 変数が空のときは、`${変数:?…}` の行でブロックの残りが走りません。
- check が通らないときは、`gh pr checks` の行でブロックの残りが走りません。`set -eu` が効くのも、かっこの中だけです。

ブロックは前のブロックの変数に頼りません。release PR の番号だけは、2. で出た番号（数字だけ）を、`pr=RELEASE_PR_NUMBER` の行に書き換えます。行の後ろにコメントは付けません（zsh の対話シェルでは、`#` 以降が実行されてしまうためです）。

1. GA4 を足す PR 497（`feat/ga4-analytics-20261106`）を develop に merge します。merge は、寺田さんの Yes と、PR のコメントにあるレビュー記録の `Reviewed-Head` が先です。`--match-head-commit` に渡すのは、PR の今の head ではなく `Reviewed-Head` の sha です。head が `Reviewed-Head` と違えば、GitHub が merge を断ります。

develop への merge に、承認は要りません。必須の check は `h5-admission`、`Chromium visual text audit`、`verify` です（2026-11-06 に branch protection を読んだ結果）。次のブロックは、`Reviewed-Head` を読み（記録がなければ止まる）、check が通るのを待ち、通ったときだけ merge します。

```bash
(
set -eu
reviewed=$(gh pr view 497 -R Cor-Incorporated/corsweb2024 --json comments -q '[.comments[].body | capture("Reviewed-Head: (?<sha>[0-9a-f]{40})").sha] | last'); : "${reviewed:?Reviewed-Head の記録がありません。merge しません}"
gh pr checks 497 -R Cor-Incorporated/corsweb2024 --watch --fail-fast
gh pr merge 497 -R Cor-Incorporated/corsweb2024 --merge --match-head-commit "$reviewed"
)
gh pr view 497 -R Cor-Incorporated/corsweb2024 --json state,mergeCommit
```

2. develop から main へ release PR を作ります。head は develop です（別の branch は `guard` で落ちます）。本文に、作った時点の develop の sha を `head: <sha>` の行で書きます。すでに開いている release PR があるときは、作らずに止まります。

```bash
(
set -eu
n=$(gh pr list -R Cor-Incorporated/corsweb2024 --base main --head develop --json number -q length)
[ "$n" = "0" ] || { echo "すでに開いている release PR があります。作りません"; exit 1; }
gh pr create -R Cor-Incorporated/corsweb2024 --base main --head develop --title "release: $(date +%F) develop → main" --body "head: $(gh api repos/Cor-Incorporated/corsweb2024/commits/develop -q .sha)"
)
gh pr list -R Cor-Incorporated/corsweb2024 --base main --head develop --json number,headRefOid
```

最後の行に出た `number` が release PR の番号です。この番号を、3. と 4. の `pr=RELEASE_PR_NUMBER` の行に書きます。作った直後は check がまだ出ていないことがあります。3. で `no checks reported` と出て止まったら、数十秒おいて 3. のブロックを打ち直します。

3. main は承認 1 件が必須です。承認は寺田さん以外の人が行います。直近のリリース PR（483、489、491）は、いずれも `cloudia-Cor` が承認しました。必須の check は `build_and_deploy`、`Chromium visual text audit`、`guard`、`h5-admission`、`verify` の 5 つで、必須の workflow に `gitleaks.yml` もあります。GitHub がこれらを強制するので、通らなければ merge は断られます。次のブロックは、承認された commit と本文の develop の sha が同じで、check が通ったときだけ merge します。

```bash
(
set -eu
pr=RELEASE_PR_NUMBER
printf '%s' "$pr" | grep -qE '^[0-9]+$' || { echo "pr=RELEASE_PR_NUMBER の行を、2. で出た release PR の番号（数字）に書き換えてください"; exit 1; }
body_sha=$(gh pr view "$pr" -R Cor-Incorporated/corsweb2024 --json body -q .body | grep -oE '^head: [0-9a-f]{40}' | cut -d' ' -f2); : "${body_sha:?本文に head: <sha> の行がありません}"
approved=$(gh pr view "$pr" -R Cor-Incorporated/corsweb2024 --json reviews -q '[.reviews[] | select(.state == "APPROVED") | .commit.oid] | last'); : "${approved:?承認がまだありません}"
[ "$approved" = "$body_sha" ] || { echo "承認された commit ($approved) と本文の sha ($body_sha) が違います。merge しません"; exit 1; }
gh pr checks "$pr" -R Cor-Incorporated/corsweb2024 --watch --fail-fast
gh pr merge "$pr" -R Cor-Incorporated/corsweb2024 --merge --match-head-commit "$body_sha"
)
```

承認された commit と本文の sha が違うときは、develop が進んでいます。本文の sha を今の develop に書き直し、承認を取り直します。

```bash
(
set -eu
pr=RELEASE_PR_NUMBER
printf '%s' "$pr" | grep -qE '^[0-9]+$' || { echo "pr=RELEASE_PR_NUMBER の行を、2. で出た release PR の番号（数字）に書き換えてください"; exit 1; }
gh pr edit "$pr" -R Cor-Incorporated/corsweb2024 --body "head: $(gh api repos/Cor-Incorporated/corsweb2024/commits/develop -q .sha)"
)
```

4. main への push で `deploy.yml` が走り、variable の値がビルドに渡ります。merge commit の run を探し、終わるまで待ちます。`conclusion` が `success` なら終わっています。merge していないときと、run がまだ無いときは、止まります。

```bash
(
set -eu
pr=RELEASE_PR_NUMBER
printf '%s' "$pr" | grep -qE '^[0-9]+$' || { echo "pr=RELEASE_PR_NUMBER の行を、2. で出た release PR の番号（数字）に書き換えてください"; exit 1; }
sha=$(gh pr view "$pr" -R Cor-Incorporated/corsweb2024 --json mergeCommit -q .mergeCommit.oid); : "${sha:?merge commit がありません。merge したかを確かめます}"
run=$(gh run list -R Cor-Incorporated/corsweb2024 --workflow deploy.yml --commit "$sha" --event push --json databaseId -q '.[0].databaseId'); : "${run:?run がまだありません。数十秒おいて、このブロックを打ち直します}"
gh run watch "$run" -R Cor-Incorporated/corsweb2024 --exit-status
)
```

### 6-2　griftai.org（5-2 節のあと）

ブロックの貼り方は 6-1 と同じです（かっこごと、まとめて貼る。`pr=RELEASE_PR_NUMBER` の行は、2. で出た番号に書き換える）。

1. 直書きを env に変える PR 108（`fix/analytics-ids-env-20261106`）を develop に merge します。merge は、寺田さんの Yes と、PR のコメントにある `Reviewed-Head` が先です。

griftai は develop にも main にも、必須の check と承認の設定がありません（2026-11-06 に読んだ結果。main の ruleset は `required_approving_review_count` が 0 で、必須の workflow は `gitleaks.yml` だけです）。GitHub は CI の結果で merge を止めてくれません。そこで次のブロックは、`Quality Check`、`E2E Smoke Tests`、`h5-admission`、`Cloudflare Pages` の 4 つが、すべて `pass` のときだけ merge します。同じ名前の check が複数あっても（PR の実行と push の実行）、同じ名前のものがすべて `pass` でなければ止まります。`skipping` も止まります。`A11y Tests (non-blocking)` は、落ちても止めません。

```bash
(
set -eu
reviewed=$(gh pr view 108 -R Cor-Incorporated/griftai --json comments -q '[.comments[].body | capture("Reviewed-Head: (?<sha>[0-9a-f]{40})").sha] | last'); : "${reviewed:?Reviewed-Head の記録がありません。merge しません}"
gh pr checks 108 -R Cor-Incorporated/griftai --watch --fail-fast || echo "（check が落ちたか、まだ終わっていません。下で名前ごとに確かめます）"
ok=$(gh pr checks 108 -R Cor-Incorporated/griftai --json name,bucket -q '["Quality Check","E2E Smoke Tests","h5-admission","Cloudflare Pages"] as $need | . as $all | [$need[] | . as $n | ([$all[] | select(.name == $n)] | (length > 0 and all(.bucket == "pass")))] | all')
[ "$ok" = "true" ] || { echo "必要な 4 つの check が、まだ全部は pass になっていません"; gh pr checks 108 -R Cor-Incorporated/griftai; exit 1; }
gh pr merge 108 -R Cor-Incorporated/griftai --merge --match-head-commit "$reviewed"
)
gh pr view 108 -R Cor-Incorporated/griftai --json state,mergeCommit
```

2. develop から main へ release PR を作ります。本文に、作った時点の develop の sha を `head: <sha>` の行で書きます。すでに開いている release PR があるときは、作らずに止まります。

```bash
(
set -eu
n=$(gh pr list -R Cor-Incorporated/griftai --base main --head develop --json number -q length)
[ "$n" = "0" ] || { echo "すでに開いている release PR があります。作りません"; exit 1; }
gh pr create -R Cor-Incorporated/griftai --base main --head develop --title "release: $(date +%F) develop → main" --body "head: $(gh api repos/Cor-Incorporated/griftai/commits/develop -q .sha)"
)
gh pr list -R Cor-Incorporated/griftai --base main --head develop --json number,headRefOid
```

最後の行に出た `number` が release PR の番号です。この番号を、3. と 4. の `pr=RELEASE_PR_NUMBER` の行に書きます。作った直後は check がまだ出ていないことがあります。3. で `no checks reported` と出て止まったら、数十秒おいて 3. のブロックを打ち直します。

3. release PR の CI が通ったときだけ、本文に書いた develop の sha を `--match-head-commit` に渡して merge します。main への merge で、Cloudflare Pages が本番をビルドします。main の merge で GitHub が強制するのは、ruleset の `gitleaks.yml` だけです。CI の 4 つは、次のブロックが確かめます。

```bash
(
set -eu
pr=RELEASE_PR_NUMBER
printf '%s' "$pr" | grep -qE '^[0-9]+$' || { echo "pr=RELEASE_PR_NUMBER の行を、2. で出た release PR の番号（数字）に書き換えてください"; exit 1; }
body_sha=$(gh pr view "$pr" -R Cor-Incorporated/griftai --json body -q .body | grep -oE '^head: [0-9a-f]{40}' | cut -d' ' -f2); : "${body_sha:?本文に head: <sha> の行がありません}"
gh pr checks "$pr" -R Cor-Incorporated/griftai --watch --fail-fast || echo "（check が落ちたか、まだ終わっていません。下で名前ごとに確かめます）"
ok=$(gh pr checks "$pr" -R Cor-Incorporated/griftai --json name,bucket -q '["Quality Check","E2E Smoke Tests","h5-admission","Cloudflare Pages"] as $need | . as $all | [$need[] | . as $n | ([$all[] | select(.name == $n)] | (length > 0 and all(.bucket == "pass")))] | all')
[ "$ok" = "true" ] || { echo "必要な 4 つの check が、まだ全部は pass になっていません"; gh pr checks "$pr" -R Cor-Incorporated/griftai; exit 1; }
gh pr merge "$pr" -R Cor-Incorporated/griftai --merge --match-head-commit "$body_sha"
)
```

本文の sha と release PR の head が違うときは、develop が進んでいます。`--match-head-commit` が merge を断ります。本文の sha を今の develop に書き直し、CI を待ち直します。

```bash
(
set -eu
pr=RELEASE_PR_NUMBER
printf '%s' "$pr" | grep -qE '^[0-9]+$' || { echo "pr=RELEASE_PR_NUMBER の行を、2. で出た release PR の番号（数字）に書き換えてください"; exit 1; }
gh pr edit "$pr" -R Cor-Incorporated/griftai --body "head: $(gh api repos/Cor-Incorporated/griftai/commits/develop -q .sha)"
)
```

4. 本番のビルドが成功したかは、merge commit の check で見ます。名前が `Cloudflare Pages` の check の `conclusion` が `success` になれば終わっています。merge の直後は、出力が空か `"conclusion": null` です。まだ check が作られていないか、実行中なので、数分おいてもう一度打ちます。同じコミットに `Deploy to Cloudflare Pages` という check もありますが、こちらは GitHub Actions の job で、今は `skipped` です（Cloudflare の secret が未設定のため）。見るのは前者だけです。

```bash
(
set -eu
pr=RELEASE_PR_NUMBER
printf '%s' "$pr" | grep -qE '^[0-9]+$' || { echo "pr=RELEASE_PR_NUMBER の行を、2. で出た release PR の番号（数字）に書き換えてください"; exit 1; }
sha=$(gh pr view "$pr" -R Cor-Incorporated/griftai --json mergeCommit -q .mergeCommit.oid); : "${sha:?merge commit がありません。merge したかを確かめます}"
gh api "repos/Cor-Incorporated/griftai/commits/$sha/check-runs" -q '.check_runs[] | select(.name == "Cloudflare Pages") | {name, conclusion}'
)
```

## 7. 反映できたかを本番の HTML で確かめる

出力は、設定した値と一致している必要があります。ここに書いたコマンドは、手元のビルドでは出力を確かめました。本番の HTML での出力は、反映前なので未実測です。

cor-jp.com の GA4（2 節の測定 ID が 1 行だけ出ます）:

```bash
curl -s --compressed https://cor-jp.com/ | grep -oE '"G-[A-Z0-9]+"' | sort -u
```

cor-jp.com の Clarity（`clarity.ms/tag/z97a0rwaoh` が 1 行だけ出ます）:

```bash
curl -s --compressed https://cor-jp.com/ | grep -oE 'clarity\.ms/tag/[A-Za-z0-9]+' | sort -u
```

griftai.org の GA4（4 節で決めた測定 ID が 1 行だけ出ます）:

```bash
curl -s --compressed https://griftai.org/ | grep -oE 'G-[A-Z0-9]{6,}' | sort -u
```

griftai.org の Clarity（3 節の Project ID を含む行が出ます）:

```bash
curl -s --compressed https://griftai.org/ | grep -oE 'clarityId = "[A-Za-z0-9]+"|clarity\.ms/tag/[A-Za-z0-9]+' | sort -u
```

griftai.org の旧 Clarity ID が残っていないこと（`0` と出れば合っています）:

```bash
curl -s --compressed https://griftai.org/ | grep -oE 'wk1nad97m0' | wc -l
```

4 節で GMO 所有と判断して GA4 を作り直した場合は、旧 GA4 の ID も残っていないことを確かめます（`0` と出れば合っています）:

```bash
curl -s --compressed https://griftai.org/ | grep -oE 'G-3E8328E5V6' | wc -l
```

ダッシュボードに数字が届いたかは、寺田さんの目視です。自分で本番のページを開いて、GA4 は Reports の Realtime、Clarity は Dashboard で確かめます。画面の文言と、数字が出るまでの時間は未確認です。

計測されるのは本番だけです。cor-jp.com は main の push でビルドした本番のページ、griftai.org は `griftai.org` と `www.griftai.org` で開いたページです。preview や手元のページは数えません。

## 8. 問題が起きたら

| 症状 | 原因の候補 | 切り分けと直し方 |
|---|---|---|
| cor-jp.com の本番 HTML に `G-` が 0 件 | variable の値の形が崩れている。サイトは崩れた値を出さず、何も表示しない | 下の 1 行で値を読む。出力が空なら形が崩れている。バッククォート、小文字、`UA-` で始まる旧 ID、Clarity の ID との取り違えを疑う |
| cor-jp.com の deploy は成功しているのに `G-` が 0 件 | 変数を入れる前の run だった | 5-1 節のあとに main への push がないと、値はビルドに入らない。次の main への push で入る |
| griftai.org のリリース後にタグが消えた | Pages の Production に変数がない。名前が違う（`PUBLIC_` から始まる必要がある）。値の形が崩れている（バッククォート、小文字、`UA-` で始まる旧 ID、GA4 と Clarity の取り違え。崩れた値は、サイトが何も出さずに捨てる） | 5-2 節を見直し、Production に 2 つあるかを確かめる。値は 2 節の 5 と 3 節の 4 の `grep -E` に通して形を確かめる。直したあと、main の最新コミットで本番ビルドをやり直す（画面の操作は未確認） |
| 数字がダッシュボードに出ない | ストリームの URL や Project の Website が実際のホストと違う。ブラウザの広告ブロックで止まっている | 本番 HTML で ID が一致していれば、サイト側は届いている。ブラウザの開発者ツールの Network で `gtag/js?id=` と `clarity.ms/tag/` のリクエストを見る |
| preview の PR で数字が出ない | 仕様 | preview では計測しない（社内の確認で解析が汚れないようにするため） |

```bash
gh variable list -R Cor-Incorporated/corsweb2024 --json name,value -q '.[] | select(.name == "PUBLIC_GA4_ID") | .value' | grep -E '^G-[A-Z0-9]+$'
```

## 9. 元に戻す

- cor-jp.com の GA4 を止める: variable を消します。タグが消えるのは、次の main への push でビルドし直したあとです。すぐには止まりません。

```bash
gh variable delete PUBLIC_GA4_ID -R Cor-Incorporated/corsweb2024
gh variable list -R Cor-Incorporated/corsweb2024
```

- griftai.org を元の ID に戻す: Pages の Production の変数を、旧値（`PUBLIC_GA4_ID` は `G-3E8328E5V6`、`PUBLIC_CLARITY_ID` は `wk1nad97m0`）に直して、本番ビルドをやり直します。

## 10. 出典

- 変更の中身: corsweb の `src/components/analytics/Analytics.astro` と `analytics-tags.ts`、`.github/workflows/deploy.yml`。griftai の `src/config/analytics.ts` と `src/layouts/BaseLayout.astro`。
- 設計の説明: 各 repo の `docs/analytics/README.md`。
- GA4 の画面の根拠: 2・4 節に書いた Google アナリティクス ヘルプ。Clarity の画面の根拠: 3 節に書いた Microsoft の文書。どちらも画面は未確認です。
