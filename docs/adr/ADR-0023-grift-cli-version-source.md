# ADR-0023 Grift CLI の版は 1 か所に書き、記事はその時点の記録として書く

## ステータス: Accepted (2026-10-27)（Proposed 2026-10-26。#429 で実装済みなので、代表が承認）

## 背景

- Grift CLI は PyPI で、2026-09-08 に 0.7.2、2026-10-26（日本時間）に 0.8.0 を公開した。PyPI の JSON API の `upload_time_iso_8601` は 0.7.2 が `2026-09-08T01:01:31Z`、0.8.0 が `2026-10-25T23:39:22Z`。grift-cli の Release は v0.8.0（`2026-10-26T02:25:09Z`）だけで、v0.7.2 以前は tag だけ。0.9.0 は grift-cli-dev の `release/v0.9.0` で作っている。
- 0.8.0 の公開のあとも、cor-jp.com の ja の記事 3 本が古い版を「いまの版」として書いていた（2026-10-26、origin/develop `1ae26b7`。代表の指摘）。
  - 「公開中のv0.7.2では」「0.7.2（今の公開版）」「公開版は0.7.2で、0.8.0は公開の準備中」
  - 「次の版（0.8）では並びをIDの辞書順に変えます」「0.8はまだリリースしていません」
  - 直す前の記事に、この ADR の検査をかけると 13 件だった（ブログ 2 本と Grift の事例）。
- 版の数字は記事の本文にじかに書かれていて、次の版が出ても気づく手段がなかった。Grift のリリースは別のセッションが進めていて、cor-jp.com に知らせる経路もなかった。
- 取りまとめは corsweb2024#421（作業 B）、子の Issue は corsweb2024#426。

## 決定

1. **いまの版は `src/config/grift-cli-release.json` の 1 か所に書く。** 中身は `version` と `releasedOn`（その版を PyPI に上げた日の、日本時間の日付）の 2 つだけ。
   - サイトは `src/config/grift-cli.ts`（Zod）から、スクリプトは `scripts/lib/grift-cli-release.mjs`（Node の組み込みだけ）から読む。リリースノートの URL は版から作る（`https://github.com/Cor-Incorporated/grift-cli/releases/tag/v<版>`）。
   - 両側が同じ値を受け付け、同じ値を拒むことは `src/config/__tests__/grift-cli.test.ts` が照合する。
2. **いまの版を出すページは正本を読み、版を文字で書かない。** 2026-10-26 時点では `/llms.txt` の「Grift CLI の最新の公開版」の 1 行だけで、`tests/build-output/grift-cli-release.test.ts` が dist で照合する。この行は公開日を自分で持つので、版だけが変わったときは `CONTENT_AS_OF` を変えない。
3. **記事（ja の blog・news・cases）は、版をその時点の記録として書く。**
   - 「この記事を書いた時点で公開していたv0.7.2」「測った時点の公開版」「当時の公開版の0.7.2」のように、いつの話かを同じ文に書く。
   - 「公開中」「公開版」「最新」「現在」「今の」と版を一緒に書かない。「次の版（0.8）」「まだリリースしていません」も、その版が出た日から誤りになるので書かない。書くなら、同じ文に「時点」か「当時」を入れる。
   - 版を書いた所には、その版の情報源をリンクする。GitHub の Release があればそれ（`https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0`）、無ければ PyPI のその版のページ（`https://pypi.org/project/grift-cli/0.7.2/`。v0.7.2 以前は Release が無く tag だけ）。読み手が確かめられるようにするためで、記事全体の情報源の決まりは corsweb2024#423 で決める。
   - 出たあとの事実は日付つきで書き、リリースノートへリンクする（例: `src/content/blog/ja/grift-no-score-no-rank-in-code.md` の冒頭の引用）。最新の版を指したいときは、版のないリンク（`https://github.com/Cor-Incorporated/grift-cli/releases`、`https://pypi.org/project/grift-cli/`）にする。
   - 直すのは ja だけ。en・zh・ko・es は翻訳 CI が作る（ADR-0019）。日付つきのニュース（`src/content/news/ja/grift-cli-oss.md` の「2026年9月8日に PyPI で v0.7.2 を公開しました」など）は、そのままでよい。
4. **CI の検査。** `scripts/check-grift-version-claims.mjs` が、Grift に触れている ja の記事と `src/i18n/locales/ja.json`・`src/pages/llms.txt.ts` を 1 文ずつ見て、次の 2 つを落とす。
   - current-claim: 「公開中・公開版・最新・現在・現行・現時点・今の・いまの」と一緒に書いた版が、正本と違う。
   - unreleased-claim: 「まだリリース（公開）していない」「準備中」「公開前」「次の版」と書いた版が、正本ではもう公開済み。
   - 同じ文に「時点」「当時」「執筆時」があれば記録の形として通す（「現時点」は通さない）。コード・インラインのコード・URL・HTML のコメントは見ない。
   - `scripts/__tests__/grift-version-claims.test.mjs` が実際のファイルで 0 件であることを照合するので、`npm run test:run`（`ci.yml` の verify。develop と main の必須チェック）で止まる。手元では `npm run check:grift-version`。
   - 正本と同じ版を「最新」と書いた文は、いまは通るが、正本を次の版に上げた日に落ちる。そのときに記録の形へ直す。
5. **PyPI との照合は、毎日の定期実行で Issue を開く方式にする**（`.github/workflows/grift-cli-release-watch.yml`、毎日 09:17 JST）。
   - `scripts/grift-cli-release-watch.mjs` が PyPI の JSON API（`https://pypi.org/pypi/grift-cli/json` の `info.version`）を正本と比べる。違えば「Grift CLI の版の正本（v<正本>）が PyPI の最新（v<PyPI>）と違う」という題の Issue を開き、本文に書き換えたあとの JSON と直し方を入れる。GitHub の最新の Release も本文に並べる（取れなくても止めない）。
   - 同じ題の Issue が開いていれば、もう開かない。正本と PyPI が同じになったら、開いている照合の Issue を閉じる。PyPI が取れなければ run は失敗する（黙って通さない）。
   - schedule は既定ブランチ（main）にあるファイルでだけ動き、main の正本を読む。develop で正本を直しても、main へのリリースまでは Issue が開いたまま（本番の `/llms.txt` も古いまま）で、リリースのあとの照合で閉じる。
   - build のときにネットから版を取る方式は採らない。比べた結果は次の表のとおり。

| | 毎日の照合で Issue を開く（採用） | build のときに PyPI から取る |
|---|---|---|
| 次の版に気づく | 翌朝までに Issue が開く | 次の build まで誰も気づかない（build が無ければ古いまま） |
| 記事の古い書き方 | 正本を上げると、CI の検査が直す文を指す | 記事の本文は直らない（直す文を誰も知らない） |
| build と deploy | 外の応答に左右されない | PyPI が落ちる・遅いと build が止まるか、古い値のまま通る |
| 同じ commit の再現 | 同じ dist になる | 日によって dist が変わる（`test:dist` や SEO の snapshot がぶれる） |
| 権限 | `issues: write` の workflow が 1 本増える | build のジョブから外へ通信する |
| 人の手間 | JSON の書き換えと記事の直しの PR が要る | 要らない（そのかわり記事は直らない） |

## 次の版が出たとき

Grift のリリースを進めるセッションか、照合の Issue を見た人が、cor-jp.com のリポジトリ（`~/Developer/corsweb`、GitHub `Cor-Incorporated/corsweb2024`）の直下で行う。下の `0.9.0` と日付は例で、実際の値は手順 1 の出力で決まる。

### 前提

- PyPI に新しい版が上がっている。
- grift-cli に Release `v<版>` がある（記事からリンクするリリースノート）。確かめるコマンド（読むだけ。`gh release` は hook が本番のリリースとして止めることがあるので `gh api` で読む）: `gh api repos/Cor-Incorporated/grift-cli/releases/tags/v0.9.0 --jq '[.tag_name, .published_at, .html_url] | @tsv'`。無ければ HTTP 404 になる。
- Node 20 以上と、Cor-Incorporated に通る gh（`gh auth status`）。

### 書き換える値

| 値 | いまの値（2026-10-26） | 新しい値の決め方 |
|---|---|---|
| `version` | `0.8.0` | PyPI の `info.version`。手順 3 のコマンドが書く |
| `releasedOn` | `2026-10-26` | その版の最初のファイルを PyPI に上げた時刻（`upload_time_iso_8601`、UTC）を日本時間にした日付。手順 3 のコマンドが書く |

いまの値は `node -p "require('./src/config/grift-cli-release.json')"` で見られる。

### 手順

1. 違いを確かめる: `node scripts/grift-cli-release-watch.mjs`
   - 「違う: 正本 v0.8.0、PyPI v0.9.0（2026-11-02）」のように出る。「同じ: 正本と PyPI の最新は v0.9.0」なら更新済みなので、ここで終わり。
2. 作業用の worktree を作る。lane-launch-gate が origin/main より古い起点を拒否するので、origin/main から切って develop を merge する。

   ```bash
   git fetch origin
   git worktree add .worktrees/claude/grift-cli-v0.9.0 -b chore/grift-cli-v0.9.0 origin/main
   git -C .worktrees/claude/grift-cli-v0.9.0 merge --no-edit origin/develop
   cd .worktrees/claude/grift-cli-v0.9.0 && npm ci
   ```

3. 正本を書き換える: `node scripts/grift-cli-release-watch.mjs --write`
   - 「src/config/grift-cli-release.json: v0.8.0（2026-10-26）→ v0.9.0（2026-11-02）」のように出る。JSON は手で書かない。
4. 記事を直す: `npm run check:grift-version`
   - 出た行（`ファイル:行: current-claim: …`）を、決定 3 の形に直し、版に情報源をリンクする。例: 「最新のv0.8.0では」→「この記事を書いた時点で公開していた[v0.8.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0)では」。直すのは ja だけ。
   - 0 件になるまで繰り返す。日本語を直したら、yomiyasu と cor-voice のスキルで整える（CLAUDE.md）。
5. 確かめる: `npm run test:run`、`npm run build`、`npm run test:dist`、`npm run security:audit:dist`
   - `grep 最新の公開版 dist/llms.txt` が新しい版の 1 行を出す。
6. commit して、develop へ PR を出す。

   ```bash
   git add src/config/grift-cli-release.json src/content
   git commit -m "chore: Grift CLI の版の正本を v0.9.0 にする"
   git push -u origin chore/grift-cli-v0.9.0
   gh pr create -R Cor-Incorporated/corsweb2024 --base develop --title "chore: Grift CLI の版の正本を v0.9.0 にする" --body-file pr-body.md
   ```

   - `pr-body.md` には、手順 1・3・5 の出力と `H5-E2E: none`（workflow を変えないとき）、照合の Issue があれば `Refs #<番号>` を書く。
   - 照合の Issue は手で閉じない。閉じると、main の正本がまだ古いので翌朝また開く。
7. 本番に出るのは develop から main へのリリースのとき（代表の判断）。リリースの翌朝の照合のあと、次のコマンドが何も出さなければ終わり（workflow と同じく、題の先頭で探す）: `gh issue list -R Cor-Incorporated/corsweb2024 --state open --limit 200 --json number,title --jq '.[] | select(.title | startswith("Grift CLI の版の正本（")) | "#\(.number) \(.title)"'`

### 問題が起きたら

| 起きたこと | 原因 | 直し方 |
|---|---|---|
| 手順 1 が `PyPI の info.version が版の形ではない（observed "…"）` で exit 1 | PyPI の最新が `0.9.0rc1` のようなプレリリースになった | 正本はプレリリースを持たない。正式版が出るまで待つ（そのあいだ照合の run は失敗する） |
| `npm run test:run` の `grift-cli.test.ts` が落ちる | JSON を手で書き、形が違う（`v0.9.0`、`0.9`、`2026/11/02`、ほかのキー） | 手順 3 のコマンドは、いまの JSON が読めないと止まる。先に `git checkout origin/develop -- src/config/grift-cli-release.json` で JSON を戻してから、手順 3 をやり直す。落ちたメッセージの observed に、実際の値が出る |
| `check:grift-version` が文を指すが、どこが悪いか分からない | 版と「最新」「公開中」「次の版」などを同じ文に書いている | 同じ文に「この記事を書いた時点」や「当時」を入れるか、版のないリンクにする |
| 照合の Issue が毎朝開き直す | 照合の Issue を手で閉じた | 閉じない。main へのリリースのあとに workflow が閉じる |
| 照合の run が失敗し、GitHub からメールが来る | PyPI が取れなかった（HTTP 5xx、20 秒の時間切れ） | 翌朝の run を待つ。続くときは PyPI の状態を見る |
| Issue に「GitHub の最新の Release（…）が PyPI の版と違う」と出る | PyPI だけ先に上がり、Release がまだ無い | 正本の更新は進めてよい。記事からリンクするのは、Release ができてから |

## 理由

- 版の数字を 1 か所に書けば、次の版で変える所は JSON と、検査が指す記事の文だけになる。
- 記事は書いた日の記録なので、正本から版を差し込むと、書いた時点の事実（「0.7.2 では、一覧が変更の多い順に並んでいた」）が別の意味になる。記事は正本を読まずに記録の形で書き、検査で守る。
- 毎日照合すれば、リリースを進めるセッションが cor-jp.com に知らせなくても、翌朝までに Issue が開く。

## 影響

- 新しい依存はない（Node の組み込み、gh、jq は GitHub の runner にある）。
- 照合の workflow が動き始めるのは、この変更が develop から main へリリースされたあと。
- griftai.org（`griftai` リポジトリ）にも版を書いた所がある（2026-10-26 時点で `src/pages/tep.astro:107` のコメントに v0.7.2）。この ADR の範囲は cor-jp.com だけで、griftai は直していない。
- 検査が見るのは ja だけ。en・zh・ko・es の UI 文言（`src/i18n/locales/*.json`）に版を書くときも、文字で書かずに正本から入れる。

## 代替案

- **build のときに PyPI から取る**: 決定 5 の表のとおり採らない。
- **記事の版を正本から差し込む**（remark のプラグインで置き換える）: 書いた時点の事実が変わる。翻訳のパイプラインの保護（ADR-0019）にも新しい書き方が要る。採らない。
- **Renovate や Dependabot で正本を上げる**: grift-cli は cor-jp.com の依存ではないので使えない。
- **Issue ではなく PR を自動で作る**: 記事を記録の形に書き直すには人の判断が要り、PR を作る権限（`contents: write`）も要る。採らない。

## 参照

- ADR-0007 / ADR-0019 / ADR-0022
- corsweb2024#421（取りまとめ、作業 B）、corsweb2024#426（この ADR の Issue）
- grift-cli v0.8.0 のリリースノート: https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0
