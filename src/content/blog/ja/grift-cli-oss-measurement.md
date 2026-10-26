---
title: "経歴書の年数では、仕事の仕方は分からない。点数をつけないGriftで、実在のOSSを4つ測ってみた"
description: "経歴書の年数や人月だけでは、その人がどんな仕事の仕方をしてきたかは分かりません。Cor.が点数も順位もつけないGriftを作った理由と、MBTIとの違い、実在のOSSを4つ測って見えたこと・見えなかったことを、紹介会社・SESの営業の方とエンジニアの方に向けて書きます。"
summary: "Griftは、gitに残った変更の記録から、仕事の傾向と、その根拠になった件数を出します。本人が質問に答えてタイプを出すMBTIとは違い、根拠は申告ではなく記録で、同じ記録なら誰が数えても同じ値になります。実在のOSSを4つ測ると、作業の領域や変更の間隔の違いは見えた一方、レビューの質や会議、本人の同意のない経験は見えませんでした。数字は分母と規則と一緒に読む必要があり、判断するのは人です。"
pubDate: 2026-10-25
updatedDate: 2026-10-26
author: "Terisuke"
category: "engineering"
ctaIntent: "grift-team-beta"
tags: ["Grift", "OSS", "CLI", "git", "実測"]
lang: "ja"
featured: false
isDraft: false
---

経歴書に「Python 5年」と書いてあっても、その5年でどんな仕事をしてきたのかは分かりません。

年数や人月は、仕事の量の目安にはなります。でも、動作を確かめるテストを書きながら進める人なのか。文書を整える人なのか。小さな変更をこまめに出す人なのか。仕事の仕方までは教えてくれません。

紹介会社やSESの営業の方が、推薦の理由を根拠で言えずに止まってしまう。その原因の1つは、このすき間にあるとCor.株式会社は考えています。

## 点数をつけない理由

Griftはこのすき間を埋めるために作った自社プロダクトです。git（ソフトウェアの変更を1回ずつ記録する仕組み）に残った記録から、仕事の傾向と、その根拠になった件数を取り出します。点数も順位も出しません。

代表の寺田康佑はリクルートで求人広告の営業をしていたころ、言葉が届かないもどかしさを味わいました。Griftについては「経歴は盛れる。証拠は盛れない。」と書いています。

点数にすると、何が起きるか。違う種類の記録を1つの数字に丸めると、何を数えたのか、何が数えられなかったのかが消えます。そして点数があれば、高い人が良い人に見えます。並べれば順位になります。

Griftで私たちがやりたいのは、人を順位で並べることではありません。その人の仕事の傾向に合った案件と、人をつなぐことです。そのために、確かめられる事実だけを出します。判断するのは人です。

## MBTIとの違い

順位をつけない、と聞いて、MBTIを思い浮かべる方もいるかもしれません。

MBTIは、本人が質問に答えて、4つの好みの組み合わせから16のタイプを出します。MBTIの財団（The Myers & Briggs Foundation）は、どのタイプにも価値があり、採用の目的で作られたものではないとしています。

Griftは質問をしません。タイプの名前も付けません。性格を診断する道具でもありません。gitに残った記録を数えて、傾向と、その根拠になった件数を出します。

違いは営業の方の困りごとに当てると分かりやすくなります。

経歴書の自己申告を、どこまで信じていいか分からない。MBTIの結果も経歴書と同じく本人の答えから出ます。Griftの根拠は記録です。同じ記録を渡せば、誰が数えても同じ値になります。

年数や人月では、仕事の仕方が分からない。Griftはどの領域を触ってきたか（テスト、文書、本体のプログラムなど）、変更をどのくらいの間隔で出しているか、直しの変更にテストが付いているかを、件数で出します。

ただし、記録に残らないことは出ません。会議での働き、レビューの質、公開されていない仕事は見えません。本人の同意がなければ、個人の経験や役割も出しません。

## TEPという手順

Griftは記録から事実を取り出す手順をTEP（Technical Evidence Pipeline、技術の証拠を取り出す流れ）と呼んでいます。中身は4つの段階です。

1. gitの記録を読む。AIの推測は使いません
2. 決まった規則で数える。たとえば、ファイルの置き場所と名前から、テストか文書かを分けます
3. 数えた値に、分母と、数えられなかったものの理由を付ける
4. 同じ手順で、誰でも数え直せるようにする

4つ目の数え直しをGriftでは検算と呼んでいます。TEPの詳しい説明はGriftのサイトの[TEPのページ](https://griftai.org/tep)にあります。

## 実在のOSSで試す

本当にこの手順で、仕事の傾向が見えるのか。2026年10月25日に、Grift CLI（コマンドで動かすGriftの道具）の0.8.0で確かめました。0.8.0はこの日の時点ではまだ公開の準備中で、翌日の10月26日に公開しました（[リリースノート](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0)）。

実在の人を同意なく測らないように、ソースコードが公開されているソフトウェア（OSS）を、リポジトリ（1つのソフトウェアの記録をまとめた場所）の単位で測りました。人ごとの数字はこの記事に1つも載せていません。

測ったのは、性格の違う4つです。

- click: Pythonで、コマンドで動かす道具を作るためのライブラリ（ほかのプログラムから使う部品）
- flask: PythonでWebのサービスを作るためのライブラリ
- httpx: PythonでWebと通信するためのライブラリ
- commander.js: JavaScriptで、コマンドで動かす道具を作るためのライブラリ

## 見えたこと

4つとも、測るのも検算するのも2.5秒以内に終わりました。検算の結果は4つとも全項目で一致しました。

リポジトリごとの性格の違いも見えました。

clickでは記録の最後の日までの180日に、187回の変更がありました。変更と変更の間隔は、真ん中の値で約2時間です。短い間隔で、変更が続いています。

flaskでは、文書に触れた変更が1,841回あり、本体のプログラムに触れた変更（1,765回）より多くありました。

httpxでは、テストのファイルを含む変更が、1,335回のうち575回ありました。

commander.jsでは、本体のJavaScriptのファイルが「本体のプログラム」に数えられず、「その他」に入りました。これはGriftの規則の穴です。本体のプログラムとして数える拡張子（ファイル名の末尾の部分）に、JavaScriptの`.js`が入っていないためです。

## 数字の読み誤り

測ってみて分かったのは、数字だけを並べると、すぐに読み誤ることでした。5つの例を挙げます。

### 変更の回数

変更の回数が多いリポジトリが、良いリポジトリではありません。flaskの変更は3,674回、httpxは1,335回でした。履歴の長さは、flaskが5,976日、httpxが2,517日です。回数は履歴の長さと、変更をまとめて取り込むかどうかで変わります。

### 文書の変更

文書の変更が多いことは、文書づくりに熱心だという意味ではありません。clickで文書に数えた変更の約4割は、文書として触ったファイルが変更履歴のファイルだけでした。変更のたびに変更履歴を書くリポジトリでは、文書の回数が増えます。

### 直しの変更

件名が「fix」（直し）で始まる変更にテストが付いていないことは、テストを書かないという意味ではありません。flaskで件名が「fix」で始まる変更を数え直すと、407回のうち198回は、文書か設定のファイルだけの変更でした。件名は「fix typo」（誤字の直し）などです。

### 少ない変更

変更が少ないことは、開発が止まっているという意味ではありません。httpxでは、観測した180日の中に変更が11回しかなく、間隔は「未観測」（測れなかった）になりました。測ったのは9月2日に手元へ取ってきた記録で、今の状態ではありません。

### 活動日数

活動日数（変更があった日の数）は、変更の切り方で増やせます。検証用に小さなリポジトリを2つ作り、同じ5行を足しました。1回でまとめて足すと活動日数は2日、5日に分けて1行ずつ足すと6日です（どちらも最初の1回を含みます）。中身は同じです。

Griftはこの数字を補正しません。代わりに、数字の隣に「毎日 1 件の小さな commit を置けば増え、同じ変更を 1 日にまとめると減ります。」と書きます。

## 見えなかったこと

Griftは測れなかったものを「未観測」と書きます。未観測は「測れなかった」という意味で、「実績がなかった」という意味ではありません。今回の4つでは、次のものが見えませんでした。

- レビューや課題管理: GitHubなどの記録を渡していないので、未観測です
- 個人の経験や役割: 本人の同意がないので、未観測です
- 自社の変更かどうか: 自社のメールアドレスを定義していないので、すべて「決められなかった」になりました

うまくいかなかったことも書きます。commander.jsの本体が「その他」に入ったのは、前に書いたとおり規則の穴です。また、同じ日の記事で「テスト併修率（本体と同時にテストも変えた割合）も、形だけのテストの変更で上がる」と書きました。0.8.0では、この注意はまだ数字の隣に載っていません。載ったのは、活動日数の1文だけです。

## 0.8.0で直したこと

[0.7.2](https://pypi.org/project/grift-cli/0.7.2/)（測った時点の公開版）では、リポジトリに関わった人の一覧が、変更の多い順に並んでいました。一番上の人を「一番よくやった人」と読めてしまいます。0.8.0ではID（人ごとに付けた記号）の順に並べます。

4つのリポジトリで、0.7.2と0.8.0の一覧を比べました。名前と数は見ず、並び方だけを見ています。0.7.2は4つとも、一番上が変更の最も多い人でした。0.8.0では、その人の行は、clickで467行中120行目、flaskで870行中280行目、httpxで258行中232行目、commander.jsで203行中15行目でした。

0.8.0の一覧を変更の多い順に並べ直すと、検算で通りません。ほかの値は0.7.2と0.8.0で同じでした。

## 案件と並べる

案件とつなぐときは、案件側が求めることを先に書いておきます。Griftではこれを宣言と呼びます。gitから見えたこと（観測）とは別の欄に並べ、合否は出しません。

試しに、架空の小さな案件「Pythonライブラリの保守」を宣言しました。180日で12日以上の活動があること、変更の間隔が真ん中の値で7日以内であること、本体のプログラムとテストに触れていること、単体のテストがあること、GitHubなどの記録も見ること、という宣言です。

clickに当てると、宣言の「12日以上」の隣に、観測の「62日」が並びます。GitHubなどの記録は渡していないので、その欄は未観測のままです。

並べたあとも、前の節の読み誤りはそのまま残ります。commander.jsで「本体のプログラム」が0回なのは規則の穴で、httpxの間隔は記録が足りずに未観測です。並んだ値をどう読むかは、人が決めます。

エンジニア本人の記録と案件を並べる使い方もあります。そのときは、本人の同意のある記録だけを使います。実在の個人を測ることになるので、この記事では試していません。

## 結び

gitの記録は経歴書の言葉を確かめる材料になります。でも、記録に残らない仕事もあります。

Griftが出すのは、傾向と、その根拠の件数と、見えなかったものの理由です。そこから何を判断するかは、読む人が決めることです。

## 根拠の数字

エンジニアの方が手元で確かめられるように、測った条件と数字をまとめます。

- grift 0.8.0（定義版`tep-v0.8.0-2026-10-25`）。公開前のソース（開発用リポジトリの`87076c8`）を手元に入れました。公開した0.8.0の`src/`（プログラムの本体）は、このソースと同じです
- 比べるために、当時の公開版の[0.7.2](https://pypi.org/project/grift-cli/0.7.2/)も同じ4つにかけました
- Apple M4 Max、macOS 26.7.1、Python 3.12.9、git 2.54.0
- 対象は2026年9月2日にcloneしてから更新していない手元の4つです

測ったcommit（1回分の変更の記録）のSHA（commitごとに付く識別子）と、その日付は次のとおりです。

```text
pallets/click    36baa15ff831b939a22bc527cd76ce653ef6f66d  2026-08-26
pallets/flask    d318b683471101618febed18996405ad26462110  2026-08-16
encode/httpx     b5addb64f0161ff6bfe94c124ef76f6a1fba5254  2026-02-23
tj/commander.js  ba6d13ddb4243e5913367734f8c159089ffe7834  2026-05-29
```

clickを例にしたコマンドです。

```bash
git clone https://github.com/pallets/click
git -C click checkout 36baa15ff831b939a22bc527cd76ce653ef6f66d
grift repo click --format both --out out/click
grift verify out/click/report.json --repo click
```

`grift repo`は4つとも2.5秒以内に終わり、`grift verify`は4つとも`VERIFIED`でした。新しくcloneしたclickでも、実行した時刻のほかは同じ結果になりました。当時の公開版の[0.7.2](https://pypi.org/project/grift-cli/0.7.2/)と同じソースでも、ここに載せた観測値は同じでした。

| リポジトリ | 人間のcommit / merge / bot |
|---|---|
| click | 2,000 / 1,131 / 200 |
| flask | 3,674 / 1,691 / 191 |
| httpx | 1,335 / 41 / 147 |
| commander.js | 1,095 / 284 / 138 |

人間のcommitはmerge（別の流れの変更を取り込む記録）を除いた件数です。bot（自動で変更を入れるプログラム）の変更は外しています。

作業領域（`surface_profile`）は、ファイルの置き場所と拡張子で区分を決め、区分ごとにcommitを数えます。1件のcommitが複数の区分に当たるので、合計は分母を超えます。

| リポジトリ | 分母 | test / docs / backend / other |
|---|---|---|
| click | 1,999 | 562 / 1,024 / 1,158 / 309 |
| flask | 3,673 | 627 / 1,841 / 1,765 / 575 |
| httpx | 1,333 | 575 / 501 / 874 / 112 |
| commander.js | 1,094 | 286 / 468 / 0 / 530 |

変更の間隔（`change_rhythm`）は、HEADの日付を観測日にして、それまでの180日で数えます。観測日は上のSHAの右に書いた日付です。

| リポジトリ | commit / 活動日数 | 間隔の中央値 / p90 |
|---|---|---|
| click | 187 / 62日 | 0.08日 / 3.36日 |
| flask | 32 / 19日 | 0.80日 / 15.60日 |
| httpx | 11 / 8日 | 未観測 |
| commander.js | 22 / 18日 | 2.88日 / 17.89日 |

httpxの未観測の理由は`insufficient_population`です。窓の中のcommitが11件で、率を出す下限の20件に届きませんでした。

検証の形（`verification_profile`）は、testの置き場所に当たったcommitを数えます。

| リポジトリ | testを含むcommit | fixの件名でtestも変えたcommit |
|---|---|---|
| click | 562 / 2,000 | 80 / 249 |
| flask | 627 / 3,674 | 58 / 408 |
| httpx | 575 / 1,335 | 46 / 114 |
| commander.js | 286 / 1,095 | 30 / 106 |

testの種類は、clickがunit 555・不明23、flaskがunit 484・不明204、httpxがunit 554・不明101、commander.jsが不明286でした。

未観測の項目は、click・flask・commander.jsが23、httpxが27です。主な理由は次のとおりです。

- `forge_export_not_provided`、`tracker_export_not_provided`: レビュー、課題管理、イベント
- `consenting_actor_required`: 経験、役割、ライブラリの文脈
- `no_upstream_lineage`、`parent_repo_not_provided`、`template_not_provided`: upstreamとの関係、テンプレートからの継承
- `no_tenant_commits`: 自社のcommitの8割が入る期間
- `survival_scan_disabled`: コードの新しさ（いまのコードがどれだけ最近書かれたか）
- `outcome_declaration_not_provided`: 作業の後に起きたことの宣言
- `deferred_to_v0.6`: 行単位の手戻り（0.8.0でも、0.6のころの名前のままです）

由来（`origin`）は、4つともbot以外の全commitが`unresolved`でした。自社のメールアドレスを定義したidentity.tomlも、forkの親も渡していないためです。

clickで文書に数えたcommitの内訳と、flaskのfixのcommitの内訳は、Griftの出力ではありません。同じ規則をgit logに当てて、手元で数え直した概数です。clickは1,025件のうち414件で、文書として触ったのが`CHANGES.rst`だけでした。flaskは、fixの件名のcommit 407件のうち198件が、文書か設定のファイルだけを変えていました。

一覧の並び（`actor_directory`）は、0.8.0の行をcommit数の多い順に並べ直して`grift verify`にかけると、`MISMATCH: 1 field(s) differ`で終了コード1になりました。0.7.2で保存したレポートを0.8.0で検算すると、定義版が違うため`CANNOT_VERIFY`になります。活動日数の注意の文は、0.8.0では`activity.limitations`と`change_rhythm.limitations`に載り、0.7.2にはありませんでした。

案件の宣言には次のファイルを使いました。

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

出力は「案件側の宣言」と「観測された数値」の2つの節に分かれ、宣言していない項目は`not_declared`（案件側が書いていない。不足ではない）になりました。軸ごとに宣言と観測を突き合わせるのは`grift align`で、重なり・範囲外・0件・未観測・要求なしの5通りで出します。

## 参考資料

- [grift-cli（GitHub、MIT）](https://github.com/Cor-Incorporated/grift-cli) - CLIのソースコード。測った時点の公開版は0.7.2で、0.8.0は2026年10月26日に公開
- [grift-cli 0.8.0のリリースノート（GitHub）](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0) - 0.8.0の変更点
- [grift-cli 0.7.2（PyPI）](https://pypi.org/project/grift-cli/0.7.2/) - 測った時点の公開版
- [Grift](https://griftai.org) - 製品サイト
- [TEPのページ（Grift）](https://griftai.org/tep) - TEPの詳しい説明
- [griftレポートの読み方（metrics-guide）](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/metrics-guide.md) - 指標ごとの平易な解説
- [TEP利用規範（norms）](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/norms.md) - 不在を負に読まない、重み付けと換算の禁止
- [「点数も順位もつけない」を実装でどう守るか（Cor.株式会社ブログ、2026年10月25日）](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/) - 0.8で決めた5つの条件
- [「ああ、伝わった」を日常にするために、僕は会社をつくった（Cor.株式会社ブログ）](https://cor-jp.com/blog/founder-story/) - 代表の話と、Griftが生まれた考え
- [Ethical Use of the MBTI（The Myers & Briggs Foundation）](https://www.myersbriggs.org/unique-features-of-myers-briggs/ethical-use-of-the-mbti/) - MBTIの使い方の決まり（任意であること、採用の目的ではないこと）
- [MBTI Basics（The Myers & Briggs Foundation）](https://www.myersbriggs.org/my-mbti-personality-type/mbti-basics/) - 4つの好みと16のタイプ
- [pallets/click](https://github.com/pallets/click) - 測ったOSS（HEAD `36baa15`）
- [pallets/flask](https://github.com/pallets/flask) - 測ったOSS（HEAD `d318b68`）
- [encode/httpx](https://github.com/encode/httpx) - 測ったOSS（HEAD `b5addb6`）
- [tj/commander.js](https://github.com/tj/commander.js) - 測ったOSS（HEAD `ba6d13d`）
