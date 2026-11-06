# cor-voice の週次取り込み

新しい公開記事と、公開の Issue に残した書き方の指示を、週の Issue から取り込む手順。どのエージェントでも同じ資料と検査を使う。検出には LLM を使わない。規則の変更は、代表が承認して merge する PR にする（ADR-0026、#448）。

## 材料を集める

`.github/workflows/cor-voice-weekly.yml` は `fixtures` でテストし、`collect` で週 1 回、次を照合する。

- note の `cor_instrument` の RSS と、Qiita の `terisuke` の公開記事 API
- この repo の、label `voice-feedback` が付いた開いている Issue
- `.claude/skills/cor-voice/references/evidence.md` の個別記事・指示の URL

未収録の URL があれば、label `voice-intake` の週次 Issue にまとめる。週は UTC の ISO 週で区切る。例は `2026-W44`、題は `cor-voice 更新の材料（2026-W44）`、本文の目印は `<!-- cor-voice-intake:2026-W44 -->`。同じ週の開いている Issue があれば、新しい URL をコメントで追記する。既存の本文と全コメントにある URL は重ねて追記しない。週次 Issue には URL を載せ、記事や指示の本文を転載しない。#454 の反響もこの `voice-intake` Issue にコメントで足す。候補がなければ新しい Issue は作らない。

note の標準 RSS は[最新 25 件](https://www.help-note.com/hc/ja/articles/4402395202841-iframe-RSS%E3%81%A7-%E8%87%AA%E5%88%86%E3%81%AE%E3%82%B5%E3%82%A4%E3%83%88%E3%81%ABnote%E3%82%92%E8%A1%A8%E7%A4%BA%E3%81%99%E3%82%8B)が対象。停止中や週の間にそれを超えて公開された記事と、過去の記事すべての検出は保証しない。Qiita は[記事一覧 API](https://qiita.com/api/v2/docs#get-apiv2usersuser_iditems)を 100 件ずつ最終ページまで読む。取得や解析に失敗した場合は、Issue に書き込まない。

`evidence.md` にプロフィールの URL があっても、個別記事の収録済みとは扱わない。従来の根拠 26 本には個別 URL が残っていないため、初回は既読の記事も候補に出る。記事の本文を照合してから URL を記録する。検出候補に挙がっただけでは既収録にしない。

schedule と手動起動の入口は、既定ブランチの `main` に workflow が入ってから使える。`develop` への merge だけでは定期実行は始まらない。本依頼では本番 merge・デプロイを行わず、定期実行の実地確認は人確認待ちにする。

## 書き方の指示を残す

この repo の公開 Issue に label `voice-feedback` を付け、1 件ずつ記録する。次の型を使う。

```markdown
## 書き方の指示（YYYY-MM-DD）

指示の本文。公開してよい言い方に整理する。

## 出た場面

何を書いたとき、どの点を直すように言われたか。

## 取り込み先

cor-voice の §3、§4、§5 のどこに当たるか。
取り込みは代表が承認する PR にする。
```

人の名前、社内の数字、Slack の文面は書かない。公開してよい形にできない指示は、Issue に移す前に代表に確認する。初回の移しは #455・#456・#457 にある。新しい Issue を重ねて作らず、今回の PR で §3 と §5、`evidence.md` に取り込む。

## 週次 Issue から PR を作る

1. 週次 Issue の URL を 1 件ずつ開き、本文と出た場面を読む。記事が書かれた時期と、手書き・AI 下書きの区別は、分かる範囲だけを記録する。
2. 採る指示と採らない指示を分け、理由を `evidence.md` に残す。確認した個別 URL と確認日を記録する。未読の URL は残さない。
3. cor-voice の §3〜§5 を直す。事実、数値、主張の強さは変えない。ADR と yomiyasu に反する変更は入れない。
4. 下の検査を実行し、PR 本文に結果を記録する。初回は #455・#456・#457 の各指示と差分を突き合わせる。
5. `develop` 宛てに PR を作り、代表の承認と merge を待つ。規則の自動書き換えや自動 merge は行わない。

取り込み PR の本文は次の型を使う。ブランチ、コミット、PR の type をそろえ、日本語で記述する。

```markdown
## 課題と変更

週次 Issue: <URL>
根拠の指示・記事: <URL>
読み手と場面:
§3〜§5 の変更:
採らなかった材料と理由:

## レビューで確かめること

- 指示・原文と意味、数値、主張の強さが同じか
- 未読の記事を既収録にしていないか
- 人の名前・社内の数字・非公開の発言を足していないか

## 検査

実行コマンドと生出力の要点、またはログのパス:

## 取り込みの状態

代表承認: 待ち
merge: 待ち
griftai #94: この PR の代表承認と develop への merge まで凍結

Refs: <週次 Issue 番号>、<voice-feedback Issue 番号>
Closes <今回の PR で受け入れ条件を満たす Issue 番号>
```

今回の初回 PR は `Closes #448` を記載する。PR を作るだけでは Issue は閉じない。#448 は「検出の実装」と「初回の取り込み PR の merge」を別々に確認し、代表の承認と merge の前に issue-closeable と報告しない。griftai #94 は本トラックの検収と初回取り込みの merge 後に解凍する。本手順の PR を作った段階では解凍しない。

## 検査と実行記録

検出器と固定 fixture をテストする。

```bash
python3 -m unittest discover -s .github/workflows/voice-intake -p 'test_*.py' -v
```

外部への書き込みをせず、公開ソースとの照合結果を確かめる。

```bash
python3 .github/workflows/voice-intake/intake.py --repo Cor-Incorporated/corsweb2024 --evidence .claude/skills/cor-voice/references/evidence.md --ledger /tmp/cor-voice-guard-ledger.jsonl --dry-run
```

日本語を直したら、yomiyasu の `run` と `verify` を実行する。推敲では変更前のファイルを `--source` に、新規作成では依頼と根拠を `--material` に渡す。記録と最終稿のハッシュが合うことを確かめる。

```bash
python3 -I .claude/skills/yomiyasu/scripts/yomiyasu_check.py run --source <変更前> --final <最終稿> --doc-type manual --reader expert --stance 決まり --fact-gaps
python3 -I .claude/skills/yomiyasu/scripts/yomiyasu_check.py verify --final <最終稿>
npm run test:run
npm run build
npm run security:audit:dist
npm run test:dist
```

検出結果と失敗は `guard-ledger.jsonl` に残し、workflow の artifact から読む。外部ソースの取得や解析に失敗した実行を「候補なし」と扱わない。ソース取得、Issue 生成、PR、merge、定期実行の実地確認を別々に報告する。

## 反響と後続の作業

反響の第 2 段階は #454。現行 ADR-0026 では Cloudflare・Clarity の数値取得から、Grok による公開の反響の検索へ変更されている。`XAI_API_KEY` の登録と有料実行は人確認待ち。本検出には secret を追加せず、有料 API を呼ばない。

#449 の文体 CI、#451 の CMS 変更とは別の workflow を使う。griftai の写しと #94 の検査は本依頼で変更しない。後続担当は、代表が承認した corsweb2024 の merge SHA を受け取ってから写しを更新する。
