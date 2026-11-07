# アクセス解析（GA4・Clarity）を Cor. 所有にそろえる手順書

実行する人: 寺田康佑（ブラウザの作業、5-1 節のブロック、7 節の `curl`、PR ごとの Yes）と、エージェント（`gh` のコマンド）。対象は cor-jp.com と griftai.org の 2 サイトです。

この手順書は、corsweb（Cor-Incorporated/corsweb2024）と griftai（Cor-Incorporated/griftai）の `docs/analytics/runbook.md` に同じ文面で置いてあります。コードの変更は 2 つの PR に入っていて、どちらも 2026-11-06 に develop へ merge 済みです。corsweb は PR 497、griftai は PR 108 です。corsweb の release PR 503 は、2026-11-07T01:19:15Z（10:19 JST）に main へ merge しました。merge commit は `9d62a18ef5ac8cc1c94f11c8a136db04f4086b43` で、deploy は、その直後は実行中でした。griftai の release PR は 110 で、まだ open です。

誰が手を動かすか:

- ブラウザの作業（2・3・4 節と 5-2 節）は、寺田さんの手が要ります。GA4、Clarity、Cloudflare にサインインして行います。
- `gh` のコマンドは、エージェントが打ちます。merge と本番への反映は、PR ごとの寺田さんの Yes のあとです。寺田さんが自分で打ってもかまいません。同じ文面で動きます。
- 5-1 節のブロックと、7 節の `curl` は、寺田さんが端末で打ちます。5-1 節のブロックは測定 ID を聞くので、端末のないエージェントでは読み取れずに終わります。エージェントの環境は、外部への `curl` を止めます。

## 当日の順番（2026-11-07 朝）

上から順に進めます。寺田さんが手を動かすのは、1 から 4 と 6、そして Yes の言葉です。残りはエージェントが打ちます。

| 順 | 誰が | どこで何をするか | 詳細 | 前提 |
|---|---|---|---|---|
| 0 | エージェントと寺田さん | この手順書を直した PR（corsweb2024 の 500 と griftai の 109）を develop に merge する。済んでいれば飛ばす | ― | 7 と 8 より前。release PR のブロックが、develop の `docs/analytics/release-pr-body.md` を読む |
| 1 | 寺田さん | analytics.google.com で、GA4 のプロパティ `cor-jp.com` を作り、測定 ID（`G-` で始まる値）を控える | 2 節 | なし |
| 2 | 寺田さん | analytics.google.com で、`G-3E8328E5V6` が Cor. のものかを確かめる。違えば、griftai.org 用のプロパティを作り、測定 ID を控える | 4 節 | なし |
| 3 | 寺田さん | clarity.microsoft.com で、プロジェクト `griftai.org` を作り、Project ID を控える | 3 節 | なし |
| 4 | 寺田さん | Cloudflare のダッシュボードの Workers & Pages で、`griftai` の Production に変数を 2 つ足す（`PUBLIC_GA4_ID` と `PUBLIC_CLARITY_ID`） | 5-2 節 | 2 と 3 が終わっている |
| 5 | corsweb-voice（プライバシーポリシーの PR の担当セッション）と寺田さん | プライバシーポリシーの PR（corsweb2024 の 501 と 499）を develop に merge する。501 は 382 の続きです。382 は base が `main` のままで、base を develop に変えられない（501 の本文では、変更が 422 で断られた）ので、501 が代わりに入る。この手順書の外の作業です | ― | 顧問弁護士の回答は、統括の連絡では 2026-11-06 に届いている |
| 6 | 寺田さん | 端末に 5-1 節のブロックを貼り、聞かれたら 1 の測定 ID を貼る | 5-1 節 | 5 が終わっている。ブロックが develop を読み、開示がなければ止まる |
| 7 | エージェントと寺田さん | corsweb の release PR を作り、承認を取り、merge する | 6-1 節 | 5 と 6 が終わり、501 と 499 が develop に入り、develop への merge が止まっている |
| 8 | エージェントと寺田さん | griftai の release PR を作り、merge する | 6-2 節 | 4 が終わっている |
| 9 | 寺田さん | 本番の HTML とダッシュボードを見る | 7 節 | 7 と 8 が終わっている |

2026-11-07 10 時台の時点で、0 から 6 は済んでいます。7 は、503 の merge まで済んでいます。0 と 5 は、develop に merge 済みです。1 から 4 と 6 は、寺田さんが実施しました。値は 0 節に書きました。Cloudflare の画面と GitHub の読み戻しで確かめた記録によります。残るのは、corsweb の deploy の確認（9）と、griftai の release（8）です。

merge の Yes は、PR ごとに、PR の番号を指して言います。エージェントが、その PR の `Reviewed-Head` か本文の `head: <sha>` を示します。

## 0. 何がどう変わるか（現在値 → 設定値）

作業の前の値は 2026-11-06 に測りました。作業のあとの値は、2026-11-07 に寺田さんが登録した値です。corsweb の variable は、`gh variable list` で読み戻しました（2026-11-07T00:54:47Z）。Pages の変数は、寺田さんの記録によります。保存後に画面を再読み込みして、確かめています。

| サイト | 計測 | 作業の前の値 | 登録した値（2026-11-07） | 値を置く場所 |
|---|---|---|---|---|
| cor-jp.com | Clarity | `z97a0rwaoh`（本番 HTML で確認）。secret `PUBLIC_CLARITY_ID` は 2026-11-06T03:34:46Z に更新済み | 変えない（`z97a0rwaoh`） | corsweb2024 の secret |
| cor-jp.com | GA4 | なし。variable に `PUBLIC_GA4_ID` がない（variable は `CMS_DEPLOY_ENABLED` だけ） | `G-56XKQHYW4E`。プロパティ `cor-jp.com`（ID `562862691`）の Web ストリーム。2026-11-07T00:54:47Z に登録 | corsweb2024 の variable `PUBLIC_GA4_ID` |
| griftai.org | Clarity | `wk1nad97m0`。コードに直書き。GMO 所有の見込み（未確認） | `z9odztz8ov`。新しいプロジェクト `griftai.org` の Project ID | Cloudflare Pages の `griftai`、Production の変数 `PUBLIC_CLARITY_ID` |
| griftai.org | GA4 | `G-3E8328E5V6`。コードに直書き。所有は未確認 | `G-RK7E60SN6X`。新しいプロパティ `griftai.org`（ID `563024737`）の Web ストリーム。旧 ID は、Cor. の管理権限を確認できなかったので使わない（4 節） | 同じく Production の変数 `PUBLIC_GA4_ID` |

cor-jp.com は、503 が main に入った deploy（2026-11-07T01:19Z に開始）が成功したあと、本番に出ます。griftai.org は、griftai の release PR（110）が main に入り、Pages がビルドしたあとに出ます。

2026-11-07 09:59 JST（00:59Z）の本番の HTML は、まだ作業の前の値でした。cor-jp.com は GA4 なしと `clarity.ms/tag/z97a0rwaoh`、griftai.org は `G-3E8328E5V6` と `wk1nad97m0` です（寺田さんの記録）。

- griftai の GitHub には secret も variable もありません（`gh secret list -R Cor-Incorporated/griftai` と `gh variable list -R Cor-Incorporated/griftai` は、2026-11-07 も、どちらも 0 件）。本番は Cloudflare Pages の Git 連携がビルドします。ビルド時の値は、GitHub ではなく Pages の設定に置きます。
- Pages の Production には、`PUBLIC_GA4_ID` と `PUBLIC_CLARITY_ID` を Plain text で登録しました。Preview には入れていません。登録前は、この 2 つはありませんでした（寺田さんの記録）。この手順書の書き手は、Pages の画面を自分では読めていません。

## 1. 守る順序（飛ばすと計測が止まる、または開示なしで計測が始まる）

1. griftai.org は、ID をコードから外します。Pages の Production に変数を入れる前に release すると、griftai.org の GA4 と Clarity が止まります。**5-2 節を、6-2 節より先に**します。
2. cor-jp.com の GA4 は、プライバシーポリシーに Google Analytics の開示が入ってから有効にします。2026-11-06 の時点で、develop の ja のポリシー（`src/i18n/locales/ja.json`）に「Google Analytics」は 0 件でした。2026-11-07 01 時台に 499 が develop に入り、3 件になりました。開示の PR は別です。「Google Analytics」の開示を入れるのは、corsweb2024 の 499 です。**499 が develop に merge されるまで、5-1 節を実行しません。** 5-1 節のブロックは、develop の `ja.json` を読み、0 件のときは止まります。501 は 382 の続きで、ポリシー全体の改訂です。corsweb の release の前に入れます（当日の順番の 7）。
3. PR の merge は 1 本ごとに寺田さんの Yes です。
4. corsweb の release PR は、develop への merge がすべて終わってから作ります。release PR の head は develop そのものなので、develop に push があるたびに、main に要る承認（1 件）が取り消されます。

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

2026-11-07 の結果です。Analytics のプロパティ選択画面で、`G-3E8328E5V6` と `griftai` を検索しました。該当は確認できませんでした。これは GMO 所有の確かな証拠ではありません。Cor. の管理権限を確認できなかった、という結果です。

判断がつかないときの扱いに従い、新しいプロパティ `griftai.org`（ID `563024737`）とストリームを作りました。測定 ID は `G-RK7E60SN6X` です。旧プロパティの履歴は、新しいプロパティに移していません（寺田さんの記録）。

## 5. 値を登録する

### 5-1　cor-jp.com の GA4（プライバシーポリシーの開示が merge されたあとだけ）

GA4 の測定 ID はページのソースに出る公開の値です。secret ではないので variable に置きます（`deploy.yml` は variable を先に読み、なければ secret を読みます）。

```bash
gh variable list -R Cor-Incorporated/corsweb2024
```

2026-11-06 の出力は、`CMS_DEPLOY_ENABLED` の 1 行だけでした。2026-11-07T00:54:47Z からは、`PUBLIC_GA4_ID`（`G-56XKQHYW4E`）の行もあります。`PUBLIC_GA4_ID` の行があれば、すでに設定済みなので、次の設定は上書きになります。

次のブロックは、3 つを確かめたときだけ登録します。1 つでも外れたら、何も登録しません。

- 開示: develop の `src/i18n/locales/ja.json` に「Google Analytics」が 1 件以上ある。読み取りに失敗したときも、ここで止まります
- 形: 貼った測定 ID が、`G-` のあとに英大文字と数字だけが続く形である
- 取り違え: griftai.org の旧 ID `G-3E8328E5V6` ではない。cor-jp.com には、2 節で作った別のプロパティの ID を使います

聞かれたら、2 節で取った測定 ID を貼ります。

```bash
(
set -eu
n=$(gh api 'repos/Cor-Incorporated/corsweb2024/contents/src/i18n/locales/ja.json?ref=develop' -H 'Accept: application/vnd.github.raw' | grep -c 'Google Analytics' || true)
[ "${n:-0}" -ge 1 ] || { echo "develop のポリシーに Google Analytics の開示がありません。登録しません"; exit 1; }
printf '測定 ID: '; read -r id
printf '%s' "$id" | grep -qE '^G-[A-Z0-9]+$' || { echo "形式が違うので登録しません: $id"; exit 1; }
[ "$id" != "G-3E8328E5V6" ] || { echo "G-3E8328E5V6 は griftai.org の旧 ID です。cor-jp.com 用に 2 節で作った ID を貼ります"; exit 1; }
gh variable set PUBLIC_GA4_ID -R Cor-Incorporated/corsweb2024 --body "$id"
)
```

「開示がありません」と出て止まったら、開示の PR が develop に入っていません。入るまで待ちます。

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

1. GA4 を足す PR 497 は、2026-11-06 17:36 JST（08:36:42Z）に develop へ merge 済みです。merge commit は `832012d674b9cb481853a8e715dd343ebd19e289` です。この手順では何もしません。確かめるコマンドです。出力の `state` が `MERGED` なら済んでいます。

```bash
gh pr view 497 -R Cor-Incorporated/corsweb2024 --json state,mergeCommit
```

2. develop から main へ release PR を作ります。head は develop です（別の branch は `guard` で落ちます）。作る前に、develop への merge が全部終わっているかを確かめます（1 節の 4）。すでに開いている release PR があるときは、作らずに、本文を今の develop に更新します。

本文は、このブロックが次の順に並べます。1 つ目は、先頭の `head: <sha>` の行です。作った時点の develop の sha で、3. の承認と merge がこの行を読みます。2 つ目は、develop にある `docs/analytics/release-pr-body.md` です。3 つ目は、この release に入る PR の一覧です。

`release-pr-body.md` には H5 のマーカーが入っています。この release は `.github/workflows/deploy.yml` を変えるので、`h5-admission` が H5 の 3 点（陰性テスト、台帳、廃止条件）と減算の宣言を求めるためです。本文が `head: <sha>` の 1 行だけだと、`H5-FAIL: admission fee incomplete` で止まります。2026-11-06 に、手元で `scripts/h5-admission-check.sh` に `deploy.yml` を変える差分と 1 行の本文を当てて、終了コード 1 を確かめました。

ブロックは、次の 2 つがそろったときに進みます。1 つ目は、変更された構造パスが `.github/workflows/deploy.yml` の 1 つだけであること。2 つ目は、その構造パスを変えた PR が、497 の 1 本だけであること。構造パスの式は、`scripts/h5-admission-check.sh` の `_H5_STRUCT_RE` と同じです。

ファイル名だけを見ると、別の PR が同じファイルを変えても気づけません。そこで、PR ごとにも数えます。PR の数え方は、「Merge pull request #」の merge commit を見ます。squash や rebase で develop に入った PR は、数えられません。この repo は merge commit で運用していて、今の履歴にその形はありません。

外れると、パスか PR の番号を出して止まります。止まったときは、その PR を見て、`release-pr-body.md` のマーカーが足りるかを、エージェントと寺田さんが判断します。

作る前に、develop に宛てた開いている PR を見ます。draft でないものが残っていれば、merge が終わるのを待ちます。draft のうち、501 と 499 は、この release の前に merge する PR です（行 5）。それ以外の draft を release に入れるかは、寺田さんが決めます。

```bash
gh pr list -R Cor-Incorporated/corsweb2024 --base develop --state open --json number,title,isDraft
```

```bash
(
set -euo pipefail
repo=Cor-Incorporated/corsweb2024
want="497"
struct='^(hooks/.+\.sh|scripts/.+\.sh|settings\.json|\.github/workflows/)'
sha=$(gh api "repos/$repo/commits/develop" -q .sha) || { echo "develop の sha を読めません"; exit 1; }
files=$(gh api --paginate "repos/$repo/compare/main...develop?per_page=100" -q '.files[].filename') || { echo "差分のファイル一覧を読めません"; exit 1; }
[ "$(printf '%s\n' "$files" | wc -l | tr -d ' ')" -lt 300 ] || { echo "差分が 300 ファイル以上です。構造パスを見落とす恐れがあるので、人が確かめます"; exit 1; }
paths=$(printf '%s\n' "$files" | grep -E "$struct" || true)
[ "$paths" = ".github/workflows/deploy.yml" ] || { echo "構造パスの変更が deploy.yml だけではありません。本文のマーカーが足りるかを、人が判断します:"; echo "$paths"; exit 1; }
merged=$(gh api --paginate "repos/$repo/compare/main...develop?per_page=100" -q '.commits[] | select((.parents | length) > 1) | .commit.message | split("\n")[0] | capture("Merge pull request #(?<n>[0-9]+)").n') || { echo "develop に入った PR の一覧を読めません"; exit 1; }
touching=""
while read -r pr; do
[ -n "$pr" ] || continue
fl=$(gh api --paginate "repos/$repo/pulls/$pr/files?per_page=100" -q '.[].filename') || { echo "PR $pr のファイル一覧を読めません"; exit 1; }
if printf '%s\n' "$fl" | grep -E "$struct" >/dev/null; then touching="$touching$pr"$'\n'; fi
done <<< "$merged"
got=$(printf '%s' "$touching" | sort -n | paste -sd' ' -)
[ "$got" = "$want" ] || { echo "構造パスを変える PR が、想定（$want）と違います: $got"; exit 1; }
tpl=$(gh api "repos/$repo/contents/docs/analytics/release-pr-body.md?ref=develop" -H 'Accept: application/vnd.github.raw') || { echo "release-pr-body.md を develop から読めません。当日の順番の 0（この手順書の PR）が develop に入っているかを確かめます"; exit 1; }
f=$(mktemp)
trap 'rm -f "$f"' EXIT
{
printf 'head: %s\n\n' "$sha"
printf '%s\n' "$tpl"
printf '\n## この release に入る PR\n\n'
printf '%s\n' "$merged" | while read -r pr; do [ -n "$pr" ] || continue; gh pr view "$pr" -R "$repo" --json number,title -q '"- #\(.number) \(.title)"' || echo "- #$pr（タイトルを取れませんでした）"; done
} > "$f"
open=$(gh pr list -R "$repo" --base main --head develop --json number -q '.[0].number // empty')
if [ -z "$open" ]; then gh pr create -R "$repo" --base main --head develop --title "release: $(date +%F) develop → main" --body-file "$f"; else gh pr edit "$open" -R "$repo" --body-file "$f"; fi
)
gh pr list -R Cor-Incorporated/corsweb2024 --base main --head develop --json number,headRefOid
```

最後の行に出た `number` が release PR の番号です。この番号を、3. と 4. の `pr=RELEASE_PR_NUMBER` の行に書きます。作った直後は check がまだ出ていないことがあります。3. で `no checks reported` と出て止まったら、数十秒おいて 3. のブロックを打ち直します。

3. main は承認 1 件が必須です。承認は寺田さん以外の人が行います。直近のリリース PR（475、483、489、491）は、いずれも `cloudia-Cor`（GitHub の User アカウント）が承認しました。このアカウントを、いつ、誰が、どの画面で動かしているかは、この手順書の書き手は知りません（未確認）。前回までと同じ人に、PR の番号と本文の `head: <sha>` を渡して頼みます。

必須の check は `build_and_deploy`、`Chromium visual text audit`、`guard`、`h5-admission`、`verify` の 5 つで、必須の workflow に `gitleaks.yml` もあります。GitHub がこれらを強制するので、通らなければ merge は断られます。次のブロックは、承認された commit と本文の develop の sha が同じで、check が通ったときだけ merge します。

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

承認された commit と本文の sha が違うときは、develop が進んでいます。2. のブロックをもう一度打ち（本文の sha が、今の develop に書き変わります）、承認を取り直します。

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

1. 直書きを env に変える PR 108 は、2026-11-06 17:37 JST（08:37:11Z）に develop へ merge 済みです。merge commit は `bf5cc0c862303b4e06df6c4dfb56521eba913bf3` です。この手順では何もしません。確かめるコマンドです。出力の `state` が `MERGED` なら済んでいます。

```bash
gh pr view 108 -R Cor-Incorporated/griftai --json state,mergeCommit
```

griftai は develop にも main にも、必須の check と承認の設定がありません（2026-11-06 に読んだ結果。main の ruleset は `required_approving_review_count` が 0 で、必須の workflow は `gitleaks.yml` だけです）。GitHub は CI の結果で merge を止めてくれません。そこで、3. のブロックは、`Quality Check`、`E2E Smoke Tests`、`h5-admission`、`Cloudflare Pages` の 4 つが、すべて `pass` のときだけ merge します。同じ名前の check が複数あっても（PR の実行と push の実行）、同じ名前のものがすべて `pass` でなければ止まります。`skipping` も止まります。`A11y Tests (non-blocking)` は、落ちても止めません。`--fail-fast` は付けません。止めなくてよい check（`A11y Tests (non-blocking)` など）が先に落ちたとき、待たずに抜けてしまうためです。

2. develop から main へ release PR を作ります。すでに開いている release PR があるときは、作らずに、本文を今の develop に更新します。

本文は、このブロックが次の順に並べます。1 つ目は、先頭の `head: <sha>` の行です。作った時点の develop の sha で、3. の merge がこの行を読みます。2 つ目は、develop にある `docs/analytics/release-pr-body.md` です。3 つ目は、この release に入る PR の一覧です。

`release-pr-body.md` には H5 のマーカーが入っています。この release は `.github/workflows/ci.yml` を変えるので、`h5-admission` が H5 の 3 点（陰性テスト、台帳、廃止条件）と減算の宣言を求めるためです。本文が `head: <sha>` の 1 行だけだと、`H5-FAIL: admission fee incomplete` で止まります。2026-11-06 に、手元で griftai の `scripts/h5-admission-check.sh` に、`ci.yml` を変える差分と 1 行の本文を当てて、終了コード 1 を確かめました。

ブロックは、次の 2 つがそろったときに進みます。1 つ目は、変更された構造パスが `.github/workflows/ci.yml` の 1 つだけであること。2 つ目は、その構造パスを変えた PR が、107 と 108 の 2 本だけであること。107 は cor-voice の写しを corsweb2024 の develop と比べる検査、108 は ID の環境変数化です。構造パスの式は、`scripts/h5-admission-check.sh` の `_H5_STRUCT_RE` と同じです。

ファイル名だけを見ると、別の PR が同じファイルを変えても気づけません。そこで、PR ごとにも数えます。PR の数え方は、「Merge pull request #」の merge commit を見ます。squash や rebase で develop に入った PR は、数えられません。この repo は merge commit で運用していて、今の履歴にその形はありません。

外れると、パスか PR の番号を出して止まります。止まったときは、その PR を見て、`release-pr-body.md` のマーカーが足りるかを、エージェントと寺田さんが判断します。

作る前に、develop に宛てた開いている PR を見ます。draft でないものが残っていれば、merge が終わるのを待ちます。draft を release の前に入れるかは、寺田さんが決めます。

```bash
gh pr list -R Cor-Incorporated/griftai --base develop --state open --json number,title,isDraft
```

```bash
(
set -euo pipefail
repo=Cor-Incorporated/griftai
want="107 108"
struct='^(hooks/.+\.sh|scripts/.+\.sh|settings\.json|\.github/workflows/)'
sha=$(gh api "repos/$repo/commits/develop" -q .sha) || { echo "develop の sha を読めません"; exit 1; }
files=$(gh api --paginate "repos/$repo/compare/main...develop?per_page=100" -q '.files[].filename') || { echo "差分のファイル一覧を読めません"; exit 1; }
[ "$(printf '%s\n' "$files" | wc -l | tr -d ' ')" -lt 300 ] || { echo "差分が 300 ファイル以上です。構造パスを見落とす恐れがあるので、人が確かめます"; exit 1; }
paths=$(printf '%s\n' "$files" | grep -E "$struct" || true)
[ "$paths" = ".github/workflows/ci.yml" ] || { echo "構造パスの変更が ci.yml だけではありません。本文のマーカーが足りるかを、人が判断します:"; echo "$paths"; exit 1; }
merged=$(gh api --paginate "repos/$repo/compare/main...develop?per_page=100" -q '.commits[] | select((.parents | length) > 1) | .commit.message | split("\n")[0] | capture("Merge pull request #(?<n>[0-9]+)").n') || { echo "develop に入った PR の一覧を読めません"; exit 1; }
touching=""
while read -r pr; do
[ -n "$pr" ] || continue
fl=$(gh api --paginate "repos/$repo/pulls/$pr/files?per_page=100" -q '.[].filename') || { echo "PR $pr のファイル一覧を読めません"; exit 1; }
if printf '%s\n' "$fl" | grep -E "$struct" >/dev/null; then touching="$touching$pr"$'\n'; fi
done <<< "$merged"
got=$(printf '%s' "$touching" | sort -n | paste -sd' ' -)
[ "$got" = "$want" ] || { echo "構造パスを変える PR が、想定（$want）と違います: $got"; exit 1; }
tpl=$(gh api "repos/$repo/contents/docs/analytics/release-pr-body.md?ref=develop" -H 'Accept: application/vnd.github.raw') || { echo "release-pr-body.md を develop から読めません。当日の順番の 0（この手順書の PR）が develop に入っているかを確かめます"; exit 1; }
f=$(mktemp)
trap 'rm -f "$f"' EXIT
{
printf 'head: %s\n\n' "$sha"
printf '%s\n' "$tpl"
printf '\n## この release に入る PR\n\n'
printf '%s\n' "$merged" | while read -r pr; do [ -n "$pr" ] || continue; gh pr view "$pr" -R "$repo" --json number,title -q '"- #\(.number) \(.title)"' || echo "- #$pr（タイトルを取れませんでした）"; done
} > "$f"
open=$(gh pr list -R "$repo" --base main --head develop --json number -q '.[0].number // empty')
if [ -z "$open" ]; then gh pr create -R "$repo" --base main --head develop --title "release: $(date +%F) develop → main" --body-file "$f"; else gh pr edit "$open" -R "$repo" --body-file "$f"; fi
)
gh pr list -R Cor-Incorporated/griftai --base main --head develop --json number,headRefOid
```

最後の行に出た `number` が release PR の番号です。この番号を、3. と 4. の `pr=RELEASE_PR_NUMBER` の行に書きます。作った直後は check がまだ出ていないことがあります。3. で `no checks reported` と出て止まったら、数十秒おいて 3. のブロックを打ち直します。

3. release PR の CI が通ったときだけ、本文に書いた develop の sha を `--match-head-commit` に渡して merge します。main への merge で、Cloudflare Pages が本番をビルドします。main の merge で GitHub が強制するのは、ruleset の `gitleaks.yml` だけです。CI の 4 つは、次のブロックが確かめます。

`Quality Check` は、corsweb2024 の develop の `.claude/skills/cor-voice/` と、griftai の写しを比べます（107 の検査）。corsweb の develop でその領域が動くと、この check が落ちます（8 節）。Pages の production branch が `main` であることは、設定画面では未確認です。過去の release PR（105）が、同じ前提で運用されました。

```bash
(
set -eu
pr=RELEASE_PR_NUMBER
printf '%s' "$pr" | grep -qE '^[0-9]+$' || { echo "pr=RELEASE_PR_NUMBER の行を、2. で出た release PR の番号（数字）に書き換えてください"; exit 1; }
body_sha=$(gh pr view "$pr" -R Cor-Incorporated/griftai --json body -q .body | grep -oE '^head: [0-9a-f]{40}' | cut -d' ' -f2); : "${body_sha:?本文に head: <sha> の行がありません}"
gh pr checks "$pr" -R Cor-Incorporated/griftai --watch || echo "（check が落ちたか、まだ終わっていません。下で名前ごとに確かめます）"
ok=$(gh pr checks "$pr" -R Cor-Incorporated/griftai --json name,bucket -q '["Quality Check","E2E Smoke Tests","h5-admission","Cloudflare Pages"] as $need | . as $all | [$need[] | . as $n | ([$all[] | select(.name == $n)] | (length > 0 and all(.bucket == "pass")))] | all')
[ "$ok" = "true" ] || { echo "必要な 4 つの check が、まだ全部は pass になっていません"; gh pr checks "$pr" -R Cor-Incorporated/griftai; exit 1; }
gh pr merge "$pr" -R Cor-Incorporated/griftai --merge --match-head-commit "$body_sha"
)
```

本文の sha と release PR の head が違うときは、develop が進んでいます。`--match-head-commit` が merge を断ります。2. のブロックをもう一度打ち（本文の sha が、今の develop に書き変わります）、CI を待ち直します。

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

出力は、0 節の「登録した値」と一致している必要があります。ここに書いたコマンドの形は、ID を入れた手元のビルドの HTML で、それぞれ 1 回ずつ出ることを確かめました（2026-11-07）。反映後の本番の HTML での出力は、まだ確かめていません。

cor-jp.com の GA4（`"G-56XKQHYW4E"` が 1 行だけ出ます）:

```bash
curl -s --compressed https://cor-jp.com/ | grep -oE '"G-[A-Z0-9]+"' | sort -u
```

cor-jp.com の Clarity（`clarity.ms/tag/z97a0rwaoh` が 1 行だけ出ます）:

```bash
curl -s --compressed https://cor-jp.com/ | grep -oE 'clarity\.ms/tag/[A-Za-z0-9]+' | sort -u
```

griftai.org の GA4（`G-RK7E60SN6X` が 1 行だけ出ます）:

```bash
curl -s --compressed https://griftai.org/ | grep -oE 'G-[A-Z0-9]{6,}' | sort -u
```

griftai.org の Clarity（`clarityId = "z9odztz8ov"` の行が出ます）:

```bash
curl -s --compressed https://griftai.org/ | grep -oE 'clarityId = "[A-Za-z0-9]+"|clarity\.ms/tag/[A-Za-z0-9]+' | sort -u
```

griftai.org の旧 Clarity ID が残っていないこと（`0` と出れば合っています）:

```bash
curl -s --compressed https://griftai.org/ | grep -oE 'wk1nad97m0' | wc -l
```

GA4 は新しいプロパティに替えたので、旧 GA4 の ID `G-3E8328E5V6` も残っていないことを確かめます（`0` と出れば合っています）:

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
| 5-1 節のブロックが「開示がありません」で止まる | develop の ja のポリシーに、まだ「Google Analytics」がない。または、develop の読み取りに失敗した | 開示の PR（corsweb2024 の 499）が develop に入るまで待つ。入ったあとも止まるなら、`gh api 'repos/Cor-Incorporated/corsweb2024/contents/src/i18n/locales/ja.json?ref=develop' -H 'Accept: application/vnd.github.raw'` の出力に、`Google Analytics` が入っているかを見る |
| release PR のブロックが「release-pr-body.md を develop から読めません」で止まる | この手順書を直した PR（当日の順番の 0）が、develop に入っていない | 0 を先に済ませる。release PR を作ったあとに develop が動いたときは、2. のブロックを打ち直し、承認を取り直す |
| griftai の release PR で `Quality Check` が落ちる | step `Check cor-voice copy matches corsweb2024 develop` が、corsweb2024 の develop の `.claude/skills/cor-voice/` と griftai の写しの違いを見つけた（107 の検査） | check の詳細で step の名前を見る。写しを揃える PR を griftai の develop に入れる。develop が動くので、2. のブロックを打ち直す |
| release PR の `h5-admission` が `H5-FAIL: admission fee incomplete` で落ちる | 本文に H5 のマーカーがない。2. のブロックを通らずに、本文を 1 行で作った | 2. のブロックをもう一度打つ。本文が作り直される。ブロックが「構造パスの変更が … だけではありません」で止まるときは、混じった変更の PR を見て、`release-pr-body.md` のマーカーで足りるかを人が判断する |

```bash
gh variable list -R Cor-Incorporated/corsweb2024 --json name,value -q '.[] | select(.name == "PUBLIC_GA4_ID") | .value' | grep -E '^G-[A-Z0-9]+$'
```

## 9. 元に戻す

- cor-jp.com の GA4 を止める: variable を消します。タグが消えるのは、次の main への push でビルドし直したあとです。すぐには止まりません。手動実行（`workflow_dispatch`）はビルドだけで本番に出さないので、止める手段になりません（`deploy.yml` のコメントで確認）。今すぐ止める経路は、確かめていません（未確認）。確かめた経路は、新しい release PR（承認つき）で main に push する方法だけです。

```bash
gh variable delete PUBLIC_GA4_ID -R Cor-Incorporated/corsweb2024
gh variable list -R Cor-Incorporated/corsweb2024
```

- griftai.org を元の ID に戻す: Pages の Production の変数を、旧値（`PUBLIC_GA4_ID` は `G-3E8328E5V6`、`PUBLIC_CLARITY_ID` は `wk1nad97m0`）に直して、本番ビルドをやり直します。

## 10. 出典

- 変更の中身: corsweb の `src/components/analytics/Analytics.astro` と `analytics-tags.ts`、`.github/workflows/deploy.yml`。griftai の `src/config/analytics.ts` と `src/layouts/BaseLayout.astro`。
- 設計の説明: 各 repo の `docs/analytics/README.md`。
- release PR の本文: 各 repo の `docs/analytics/release-pr-body.md`（H5 のマーカー。repo ごとに中身が違う）。マーカーの要件は、各 repo の `scripts/h5-admission-check.sh`。
- GA4 の画面の根拠: 2・4 節に書いた Google アナリティクス ヘルプ。Clarity の画面の根拠: 3 節に書いた Microsoft の文書。どちらも画面は未確認です。
