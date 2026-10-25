---
title: "点数をつけないツールを、実在のOSSで試すと何が出るか。Grift CLI 0.8.0で4つのリポジトリを測った"
description: "Grift CLIの次の版（0.8.0）で、click・flask・httpx・commander.jsの4つのOSSを測りました。コマンドと出力をそのまま載せ、何が見えて何が見えなかったか、数字をどう読むと誤るかを書きます。リポジトリ同士の優劣は比べません。"
summary: "Grift CLIの次の版（0.8.0）で4つのOSSを測ると、観測はどれも2.5秒以内に終わり、grift verifyの再計算と全項目が一致しました。作業領域・変更の間隔・検証の形は値が出る一方、レビュー、課題管理、個人の経験は理由付きの未観測になります。値はパスの規則と観測の窓で決まるため、リポジトリ同士を並べて優劣を読むことはできません。"
pubDate: 2026-10-25
author: "Terisuke"
category: "engineering"
ctaIntent: "grift-team-beta"
tags: ["Grift", "OSS", "CLI", "git", "実測"]
lang: "ja"
featured: false
isDraft: false
---

Grift CLIはgit履歴から確かめられる事実を取り出し、点数も順位もつけないと約束しています。では、実在のOSSにかけると何が出るのか。Cor.は2026年10月25日に、次の版（0.8.0）で4つのOSSを測りました。

この記事では手順と出力をそのまま載せます。リポジトリ同士の優劣は比べません。値の違いはリポジトリの性格の違いとして書きます。0.8で何を直すと決めたかは、同じ日の記事「[「点数も順位もつけない」を実装でどう守るか](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/)」に書きました。

## この記事で載せないもの

repoのレポートには、そのリポジトリに関わった人の一覧も入ります。この記事には個人単位の数字を1つも載せません。載せると実在のコントリビューターを数字で並べることになり、本人の同意のない観測を公開することになるためです。`grift actor`、`--actors`、`--top`も使っていません。

0.8.0は2026年10月25日の時点でPyPIに公開していません。公開版は0.7.2で、0.8.0は公開の準備中です。

## 測った環境と対象

- grift 0.8.0（定義版`tep-v0.8.0-2026-10-25`）。公開前のソース（開発用リポジトリの`87076c8`）を手元に入れました
- 比べるために、公開版の0.7.2も同じ4本にかけました
- Apple M4 Max、macOS 26.7.1、Python 3.12.9、git 2.54.0

対象は2026年9月2日にcloneしてから更新していない手元の4本です。cloneし直さず、その状態のまま測りました。

| リポジトリ | 性格 | 測ったHEAD | HEADの日付 |
|---|---|---|---|
| [pallets/click](https://github.com/pallets/click) | PythonのCLIライブラリ | `36baa15ff831b939a22bc527cd76ce653ef6f66d` | 2026-08-26 |
| [pallets/flask](https://github.com/pallets/flask) | PythonのWebフレームワーク | `d318b683471101618febed18996405ad26462110` | 2026-08-16 |
| [encode/httpx](https://github.com/encode/httpx) | PythonのHTTPクライアント | `b5addb64f0161ff6bfe94c124ef76f6a1fba5254` | 2026-02-23 |
| [tj/commander.js](https://github.com/tj/commander.js) | JavaScriptのCLIライブラリ | `ba6d13ddb4243e5913367734f8c159089ffe7834` | 2026-05-29 |

## 実行したコマンド

手元で同じ値を出せるように、clickを例にコマンドを載せます。

```bash
git clone https://github.com/pallets/click
git -C click checkout 36baa15ff831b939a22bc527cd76ce653ef6f66d
grift repo click --format both --out out/click
grift verify out/click/report.json --repo click
```

`grift repo`はリポジトリ全体を観測し、`report.json`と`report.md`を書きます。`grift verify`は、レポートに記録した条件でもう一度計算し、全項目を比べます。新しくcloneしてこのSHAに合わせたclickでも、実行した時刻（`analyzed_at`）のほかは手元の結果と同じになりました。

公開版の0.7.2（`pipx install grift-cli`で入る版）と同じソースでも測り、この記事に載せた観測値は0.8.0と同じでした。0.8.0で変わったのは、人の一覧の並び順と注記です。違いは後の節で確かめます。

## 4本の観測結果

| 項目 | click | flask | httpx | commander.js |
|---|---|---|---|---|
| `grift repo`の実行時間 | 1.57秒 | 2.32秒 | 1.16秒 | 1.14秒 |
| `grift verify`の結果 | VERIFIED（1.62秒） | VERIFIED（2.40秒） | VERIFIED（1.33秒） | VERIFIED（1.28秒） |
| 人間のcommit（mergeを除く） | 2,000 | 3,674 | 1,335 | 1,095 |
| merge commit | 1,131 | 1,691 | 41 | 284 |
| 除外したbotのcommit | 200 | 191 | 147 | 138 |
| 作業領域の分母（pathが取れた人間のcommit） | 1,999 | 3,673 | 1,333 | 1,094 |
| 作業領域 test | 562 | 627 | 575 | 286 |
| 作業領域 docs | 1,024 | 1,841 | 501 | 468 |
| 作業領域 backend | 1,158 | 1,765 | 874 | 0 |
| 作業領域 other | 309 | 575 | 112 | 530 |
| 変更の間隔を数える窓（180日） | 2026-02-27〜2026-08-26 | 2026-02-17〜2026-08-16 | 2025-08-27〜2026-02-23 | 2025-11-30〜2026-05-29 |
| 窓の中のcommit / 活動日数 | 187件 / 62日 | 32件 / 19日 | 11件 / 8日 | 22件 / 18日 |
| 間隔の中央値 / p90 | 0.08日 / 3.36日 | 0.80日 / 15.60日 | 未観測（母数不足） | 2.88日 / 17.89日 |
| testを含むcommit | 562 / 2,000 | 627 / 3,674 | 575 / 1,335 | 286 / 1,095 |
| fixの件名でtestも変えたcommit | 80 / 249 | 58 / 408 | 46 / 114 | 30 / 106 |
| testの種類（pathから判定） | unit 555、不明 23 | unit 484、不明 204 | unit 554、不明 101 | 不明 286 |
| 由来（origin） | bot以外の全commitがunresolved | 同じ | 同じ | 同じ |
| 未観測（not_observed）の項目 | 23 | 23 | 27 | 23 |

作業領域は、1件のcommitが複数の区分に当たるので、合計は分母を超えます。

この表を横に読んで、どれが良いリポジトリかを決めることはできません。理由はこのあとの「数字の読み誤り」の節に書きます。

## 見えなかったもの

未観測（not_observed）は「測れなかった」という意味で、「実績がなかった」という意味ではありません。レポートは未観測の項目ごとに理由を書きます。4本に共通して出た23項目の理由は、次のとおりです。入力の欄に同じ理由が重なって出る分は、1行にまとめました。

| 未観測になった項目 | 理由（reason） | 観測するのに要るもの |
|---|---|---|
| レビュー、課題管理、イベントとその間隔 | `forge_export_not_provided`、`tracker_export_not_provided` | forgeとtrackerのexportファイル（`--forge-export`、`--tracker-export`） |
| 経験、役割、ライブラリの文脈 | `consenting_actor_required` | 同意を記録した本人のidentity |
| upstreamとの関係、テンプレートからの継承 | `no_upstream_lineage`、`parent_repo_not_provided`、`template_not_provided` | 親リポジトリやテンプレートのパス |
| 自社のcommitの8割が入る期間 | `no_tenant_commits` | 自社のメールアドレスを定義したidentity |
| 定着率（survival） | `survival_scan_disabled` | `--survival`（時間がかかります） |
| 作業の後に起きたことの宣言 | `outcome_declaration_not_provided` | `--outcome-declaration` |
| 行単位の手戻り | `deferred_to_v0.6` | 0.8.0では出ません |

httpxでは、これに変更の間隔の4項目（中央値、p90、2日以内の割合、30日以上の割合）が加わりました。理由は`insufficient_population`です。窓の中のcommitが11件で、率を出す下限の20件に届きませんでした。行単位の手戻りの理由は、0.8.0でも0.6のころの名前（`deferred_to_v0.6`）のままです。

由来（origin）が全件unresolvedになったのも、見えなかったものの1つです。由来は自社のメールアドレスを定義したidentity.tomlか、forkの親を渡したときに分類されます。OSSをそのまま測るときはどちらも渡さないので、bot以外のcommitはすべて「決められなかった」になります。同じ表の`tenant_unique`などは0件ですが、こちらは「該当がなかった」という意味です。unresolvedとは意味が違います。

## 数字の読み誤り

### commitの数

commitの数は、履歴の長さと取り込み方で変わります。flaskの人間のcommitは3,674件、httpxは1,335件です。この差は良し悪しではありません。最初のcommitからの日数は、flaskが5,976日、httpxが2,517日です。merge commitは、flaskが1,691件、httpxが41件でした。同じ変更でも、まとめて取り込むか、commitのまま取り込むかで件数は変わります。

### 作業領域の名前

作業領域の名前は、pathの規則の名前です。commander.jsのbackendは0件で、otherが530件でした。commander.jsの本体にあたる`.js`のファイルが、backendの規則に入っていないためです。backendの規則は`api/`や`services/`などのディレクトリと、`.py`・`.go`・`.rs`などの拡張子で決まります。

逆に、clickのbackendが1,158件あるのは、`.py`のファイルがすべてbackendに入るからです。clickはサーバーのプログラムではありません。レポート自身も「path と拡張子による作業領域の観測です」と書いています。

### docsの件数

docsの件数が多いことは、ドキュメントに熱心だという意味ではありません。docsの規則は`.md`・`.rst`の拡張子と`docs/`などのディレクトリです。変更のたびに変更履歴のファイルを書き足すリポジトリでは、docsの件数が増えます。

clickで、docsに数えたcommitの内訳を同じ規則でgit logから数え直すと、1,025件のうち414件は、docsとして触ったファイルが変更履歴（`CHANGES.rst`）だけでした。この内訳はgriftの出力ではなく、手元で数え直した概数です。レポートはclickに「docs系surfaceが相対的に多い傾向」と書き、その強さをweak、確からしさをdirectionalとしています。

### fixの件名

「fixの件名でtestも変えたcommit」は、件名が`fix`・`bug`・`revert`などで始まるcommitのうち、testのファイルも変えたものです。flaskでは408件のうち58件でした。

同じ規則でflaskのgit logを数え直すと、fixの件名のcommit 407件のうち198件は、docsか設定のファイルしか変えていませんでした。件名は「fix typo」やリンクの直しです。testを伴わない「fix」が半分近くあるので、この値を「バグを直してもテストを書かない」と読むのは誤りです。

### 変更の間隔を数える窓

変更の間隔は観測日から180日の窓で数えます。観測日を`--as-of`で指定しないと、HEADのcommitの日付が観測日になります（`window_basis=legacy_head_date`）。そのため、4本の窓はすべて違う期間です。

httpxの窓（2025-08-27〜2026-02-23）にはcommitが11件しかなく、間隔の値は未観測になりました。これを「開発が止まっている」と読むのも誤りです。測ったのは手元のcheckoutで、upstreamの今の状態ではありません。

### 活動日数

最後に、検証用の小さなリポジトリを2つ作って確かめました。どちらも初回のcommitのあとに、同じ5行のファイルを足します。片方は5行を1回でcommitし、もう片方は1行ずつ5日に分けてcommitしました。

| 作り方 | commit（初回を含む） | 最後のtree | 活動日数 |
|---|---|---|---|
| 5行を1回でcommit | 2 | `880a82d` | 2日 |
| 1行ずつ5日に分けてcommit | 6 | `880a82d` | 6日 |

中身が同じでも、活動日数は2日と6日になります。0.8.0はこの数字を補正しません。代わりに、数値の隣に「毎日 1 件の小さな commit を置けば増え、同じ変更を 1 日にまとめると減ります。」という文を載せます。

## 0.8.0で直したこと

同じ日の記事に書いたとおり、0.8.0では人の一覧の並び順を変え、活動日数の膨らませ方を開示しました。repoのレポートの人の一覧（`actor_directory`）を、同じ4本で0.7.2と0.8.0の出力で比べました。名前と数は見ず、並び方だけを比べています。

| 項目 | 0.7.2 | 0.8.0 |
|---|---|---|
| 行の並び | 4本ともcommit数の多い順 | 4本ともactor_idの順 |
| 先頭の行がcommit数の最も多い人か | 4本とも、そう | 4本とも、違う |
| commit数の最も多い人の行の位置 | 4本とも1行目 | click 120行目（467行中）、flask 280行目（870行中）、httpx 232行目（258行中）、commander.js 15行目（203行中） |
| 活動日数の膨らませ方の文 | なし | `activity.limitations`と`change_rhythm.limitations`にある |

0.7.2のMarkdownの見出しは「actor 一覧（品質ランキングではない）」でしたが、行はcommit数の多い順でした。0.8.0では同じ見出しの下に「行は actor_id 順（commit 数順ではない）。行の位置は何も意味しない。」と書かれています。

0.8.0の出力の行をcommit数の多い順に並べ直して`grift verify`にかけると、`MISMATCH: 1 field(s) differ`（`actor_directory.actors`）で、終了コード1になりました。並べ替えた一覧は検算を通りません。

ほかの値は変わっていません。作業領域、検証の形、由来、母数の値は、0.7.2と0.8.0で4本とも同じでした。変更の間隔の違いは、注記（limitations）が3文から4文に増えたことだけです。0.7.2で保存したレポートを0.8.0の`grift verify`にかけると、定義版が`tep-v0.7.2-2026-09-07`で今の版と違うため、`CANNOT_VERIFY`になります。

値の書き換えを見つけられるかも確かめました。clickのレポートで、fixとtestの組み合わせの値（`fix_with_test_pairing`）を0.3213から0.9に書き換えて`grift verify`にかけると、`report=0.9 recomputed=0.3213`と両方の値を挙げて、終了コード1で止まりました。

一方で、まだ載っていないものもありました。同じ日の記事の条件4では、テスト併修率もテストファイルへの形式的な1行の変更で上がると書きました。0.8.0のrepoのレポートでは、この経路はまだ数値の隣に書かれていません。0.8.0で数値の隣に置いたのは、活動日数の1文だけです。

## 案件の宣言と並べる

`grift project`は、案件側が書いた要求（宣言）と、gitから見た運用の形（観測）を、別の節に並べます。架空の小さな案件「Pythonライブラリの保守」を宣言して、4本にかけました。

```toml
schema_version = "tep-project-v1"
project_id = "example-python-lib-maintenance"
title = "Python ライブラリの保守（架空の案件）"

[requirements.change_rhythm]
active_days_180d_min = 12
median_gap_days_max = 7

[requirements.surfaces]
required = ["backend", "test"]

[requirements.verification]
required = ["unit"]

[requirements.inputs]
required = ["git", "forge"]
```

```bash
grift project click --requirements python-lib-maintenance.toml --format both --out project/click
```

出力は「案件側の宣言」と「観測された数値」の2つの節に分かれ、合否はありません。宣言していない間隔のp90は`not_declared`になり、レポートは「案件側が書いていない。不足ではない」と書きます。宣言でforgeを求めても、forgeのexportを渡していないので、観測側のレビューは未観測のままです。clickでは次のように並びました。

| 軸 | 宣言 | clickの観測 |
|---|---|---|
| 180日の活動日数 | 12日以上 | 62日（窓の中のcommit 187件） |
| 間隔の中央値 | 7日以下 | 0.08日 |
| 間隔のp90 | 宣言なし（not_declared） | 3.36日 |
| 作業領域 | backend、test | backend 1,158件、test 562件 |
| testの種類 | unit | unit 555件 |
| 入力 | git、forge | gitのみ（forgeは未観測） |

ほかの3本も同じ形で並びます。並べたあとも、前の節の読み誤りはそのまま残ります。commander.jsのbackendが0件なのは`.js`が規則にないためで、httpxの間隔の中央値は窓の母数が足りずに未観測です。

軸ごとに宣言と観測を突き合わせるのは`grift align`で、重なり・範囲外・0件・未観測・要求なしの5通りで出します。ただし`grift align`は候補者の側の観測を入力にします。実在の個人を測ることになるので、この記事では実行していません。

## 結び

4本とも、値は2.5秒以内に出て、検算と一致しました。ただ、どの値も分母と観測の窓とpathの規則を一緒に読まないと、意味を取り違えます。何が見えて何が見えなかったかは、レポート自身が理由付きで書いています。

自分のリポジトリでも、同じコマンドで確かめられます。並んだ値から何を判断するかは、読む人が決めることです。

## 参考資料

- [grift-cli（GitHub、MIT）](https://github.com/Cor-Incorporated/grift-cli) - CLIのソースコード。公開版は0.7.2で、0.8.0は公開の準備中
- [Grift](https://griftai.org) - 製品サイト
- [griftレポートの読み方（metrics-guide）](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/metrics-guide.md) - 指標ごとの平易な解説
- [TEP利用規範（norms）](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/norms.md) - 不在を負に読まない、重み付けと換算の禁止
- [「点数も順位もつけない」を実装でどう守るか（Cor.株式会社ブログ、2026年10月25日）](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/) - 0.8で決めた5つの条件
- [pallets/click](https://github.com/pallets/click) - 測ったOSS（HEAD `36baa15`）
- [pallets/flask](https://github.com/pallets/flask) - 測ったOSS（HEAD `d318b68`）
- [encode/httpx](https://github.com/encode/httpx) - 測ったOSS（HEAD `b5addb6`）
- [tj/commander.js](https://github.com/tj/commander.js) - 測ったOSS（HEAD `ba6d13d`）
