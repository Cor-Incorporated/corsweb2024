# ADR-0026 文体の仕組み（yomiyasu・cor-voice）を定期的に更新し、どのエージェントでも使え、CMS で書いた記事にも検査がかかるようにする

## ステータス: Proposed (2026-10-28) / 改訂 2026-10-28（代表の答え: 指示は公開の Issue に記録する、反響と文体は Grok で集める、実装は Claude Code 以外のエージェントに分ける）

代表が残りの「決めてほしいこと」を選んだら、Accepted にする。作業は Epic #452 の子の Issue で進める。

## 背景

cor-jp.com と griftai.org の日本語の文章は、2 つのスキルで書いている（2026-10-23 に導入、`.claude/skills/`）。yomiyasu は推敲の規則と検査のスクリプト（nanaism/yomiyasu v2.1.3、MIT、手を加えずに同梱）、cor-voice は代表・寺田康佑の書き方とサイトの表現ルール。cor-voice の正本は corsweb2024 で、griftai は写しを持つ（ADR-0015）。

2026-10-28 に、代表の 3 つの問いについて実際の状態を確かめた。

1. **直近の記事や代表の指示を、定期的に取り込めるか → できない。**
   - 更新の手順は `cor-voice/SKILL.md` の §7「本人の新しい記事が出たら、`references/evidence.md` の一覧に足し、特徴が変わっていれば 3 と 4 を直す」だけで、手作業。
   - 定期的に動く workflow も予定の実行も無い。中身が変わったのは 2026-10-23（作成）と 2026-10-26（Grift の対象に採用担当）の 2 回。
   - 代表が会話で出した書き方の指示の一部は、Claude Code のメモリにだけ残り、スキルに入っていない。たとえば 2026-10-25 の「Grift の公開文章は読み手の目線で、平易な言葉で。キー名と数字は根拠として後ろに」。
   - 記事の反響（閲覧・スクロールの深さ）を書き方に戻す道も無い。
2. **Claude Code 以外（Codex・OpenCode・Cursor）でも使えるか → 一部だけ。**
   - corsweb2024 は `AGENTS.md` に「2 つの SKILL.md に従う」と書いてあり、Codex と OpenCode に届く（CLAUDE.md との食い違いは `scripts/__tests__/agents-md-parity.test.mjs` が止める）。
   - griftai には `AGENTS.md` が無い。どちらの repo にも Cursor のルール（`.cursor/rules`）が無い。利用者のグローバルの Codex・OpenCode・Cursor の設定にも、文体の決まりは無い。
   - 検査のスクリプト（`python3 -I .claude/skills/yomiyasu/scripts/yomiyasu_check.py`）は Python だけで動くので、どのツールからも使える。自動で呼び出されるのは Claude Code の Skill だけ。
3. **記事を CMS で作る・直す・消すことができるか → 一部だけ。**
   - 管理画面（Sveltia CMS、`https://cor-jp-cms-admin.web.app/`、ADR-0018）は動いている（ログイン画面まで確かめた。`deploy-cms.yml` の最後の配信は 2026-10-26）。
   - 編集できるのは cor-jp.com の ja のブログだけで、作成と編集はできるが削除はできない（`cms/public/config.yml` の `delete: false`）。news・cases と griftai は対象外。
   - CMS から作られた PR は 2026-10-01 のテストの #367 の 1 本だけ。
   - CMS で書いた記事には、文体の検査がかからない。yomiyasu・cor-voice・`npm run blog:check` は、書いたエージェントが自分で回すだけで、CI では回らない。

## 決定

### 1. 規則の本文は 1 か所に置き、ツールごとの入口は「そこを読め」とだけ書く

- 規則の本文は `.claude/skills/yomiyasu/` と `.claude/skills/cor-voice/` に置いたまま、ツールごとに写さない。
- 入口は 4 つ。
  - Claude Code: Skill と CLAUDE.md
  - Codex・OpenCode・Pi・dsh（DeepSeek Harness）: `AGENTS.md`。どれも repo の `AGENTS.md` を読む。Pi は repo の中のファイルを信頼させる `-a` を付けて動かす
  - Cursor: `.cursor/rules/japanese-copy.mdc`。対象のパスを globs で指定し、2 つの SKILL.md と検査のコマンドを指すだけにする
- 入口が指すパスがずれないように、リンクテストで結ぶ（#450、griftai#95）。
- 2026-10-30 の追記: 記事・メール・社内の手順書など、日本語の対外文すべての書き方の手順を、1 つの元ファイル（`.claude/skills/cor-voice-gate/references/harness-entry.md`）から生成する。生成先は `CLAUDE.md` と `AGENTS.md` の節「Japanese outbound text in any harness (generated)」と `.cursor/rules/cor-voice.mdc`（常時適用）で、生成は `cor-voice-gate/scripts/render_harness_entries.py`。手順には読むスキルと検査のコマンドだけを書き、規則の本文は写さない。Grok も `AGENTS.md` と `CLAUDE.md` を読む。入口と元ファイルのずれは `scripts/__tests__/harness-entries.test.mjs` が止める。

### 2. 検査は CI でも回し、書いた人やツールに関係なく同じ検査をかける

- `src/content/*/ja/**` を変えた PR（CMS の `cms/` の PR を含む）で、`blog:check` と yomiyasu の lint を回し、結果を PR にコメントする（#449）。
- 最初は PR を止めない。誤検知の割合を見てから、止めるかを決める。

### 3. cor-voice は週に 1 回、更新の材料を集める。直すのは人が承認する PR だけ

- **材料を集める**（GitHub Actions の cron、#448。この段では LLM を使わない）
  - note（cor_instrument）と Qiita（terisuke）から、`references/evidence.md` にまだ無い代表の公開記事を探す。
  - label `voice-feedback` の Issue に書いた代表の指示を拾う。
  - 見つけたものはその週の Issue 1 本にまとめる。
- **直す**: その Issue をエージェント（どのツールでもよい）が読み、cor-voice の §3〜§5 と `evidence.md` を直す PR を作る。代表が承認して merge する。
- **反響と文体の参考は Grok で集める**（2026-10-28 の改訂、#454）: Grok（xAI）に Web と X を検索させ、記事の反響を週の Issue にコメントで足す。新しい文体や特定の人の文体は、特徴を `references/styles/` の下書きにして PR にする。Grok の出力は材料で、cor-voice の規則に入れるのは代表が承認する PR だけ。特定の人の文体は参考として特徴を書くだけにし、その人が書いたように見える文をサイトに出さない。
- **代表の指示**: label `voice-feedback` の公開の Issue に 1 件ずつ記録する（代表の答え、2026-10-28）。人の名前、社内の数字、Slack の文面は書かない。最初の 3 件は #455・#456・#457。
- **griftai の写し**: griftai の CI が corsweb2024 の develop と比べて追いかける（griftai#94）。

### 4. CMS は、cor-jp.com の news・cases まで広げ、削除をできるようにする

- news と cases のコレクションを足し、`delete: true` にする（#451）。ja を消したときの訳は、翻訳 CI が条件つきで消す（`scripts/i18n/prune.mjs`、ADR-0019）。
- 管理画面の表示名を「Cor.株式会社」にそろえる（ADR-0007）。
- griftai.org を CMS で編集するかは、Cursor が案（選択肢と推し案）を作り、代表が決める（griftai#96。2026-10-28 の改訂）。

### 5. 実装は、Claude Code 以外のエージェントに分けて頼む（2026-10-28 の改訂）

代表の依頼で、残りの実装を Codex・Cursor・OpenCode・Pi・dsh に分ける。Issue に担当のラベル（`agent:<名前>`）を付け、どのツールでも Issue と `AGENTS.md` だけで進められるように、Issue に進め方を書く。merge は代表か監督（Claude Code）が検収してから。

| 担当 | Issue |
|---|---|
| Codex | #449（CI の検査）、#448（週 1 回の材料と、代表の指示の取り込み） |
| Cursor | #450（Cursor のルール）、Cor-Incorporated/griftai#95（griftai の AGENTS.md と Cursor のルール）、Cor-Incorporated/griftai#96（griftai の CMS の案） |
| OpenCode | #451（CMS の範囲） |
| dsh | Cor-Incorporated/griftai#94（cor-voice の写しの検査） |
| Pi | #454（Grok で反響と文体の参考を集める） |

## 理由

- 規則を 1 か所に置けば、ツールが増えても直すのは 1 か所で済む。写しを増やすと、片方だけが古くなる。2026-10-26 には、CLAUDE.md だけが直って AGENTS.md が古いまま残っていた（#441 で直した）。
- 検査を CI に置けば、規則を読まないツールや CMS で書いた記事にもかかる。エージェントに「回してください」と頼むだけでは、回したかどうかを確かめられない。
- 書き方の変更は、公開の文章すべてに及ぶ。だから、LLM が自動で直して merge する形にはしない。材料集めは機械に任せ、規則を直すのは代表が承認する PR にする。
- CMS はコードを書かない人が記事を書くための入口だが、削除ができず news・cases も対象外なので、結局コードの PR が要る。使われていない理由の一部はここにある（未検証。代表に確かめる）。

## 影響

- `voice-feedback` の Issue は公開の repo に置く。人の名前、社内の数字、Slack の文面は書かない。
- CI の時間が少し増える（内容の PR だけ）。
- 反響と文体の取り込みには、GitHub Actions の secret `XAI_API_KEY` が要る（代表が登録する）。Grok の検索の料金がかかる。
- CMS の範囲を広げると、`cms-config.test.ts` が照合するスキーマが増える（news・cases のスキーマは `src/content/config.ts`）。

## 決めてほしいこと（代表）

1. ~~代表の書き方の指示を、公開の repo の Issue（label `voice-feedback`）に記録してよいか~~ → 記録する（代表の答え、2026-10-28）
2. ~~反響の取り込み（第 2 段階）のために、Cloudflare Web Analytics と Clarity の API のトークンを発行するか~~ → Grok の検索で集める（代表の答え、2026-10-28。#454）。`XAI_API_KEY` を Actions の secret に登録するのは代表
3. note の記事を書くとき、cor-jp.com を正本にするか（今回のローカル AI の記事 2 本で出た問い。正本の決め方は、どの記事を `evidence.md` に足すかにも関わる）

## 代替案

- **反響を Cloudflare Web Analytics・Clarity の閲覧数とスクロールの深さで取る**（当初の第 2 段階）: 数だけでは、どこが響いたか、どんな言葉で受け取られたかが分からず、新しい文体の参考にも使えない。代表の判断で、Grok の検索に替えた。
- **LLM が週に 1 回、cor-voice を自動で書き直して merge する**: 書き方の変更が人の確認なしに全部の公開の文章に効くので採らない。
- **ツールごとに規則の本文を写す**（`.cursor/rules` に全文など）: 写しが古くなる。2026-10-26 に AGENTS.md で実際に起きたので採らない。
- **CMS をやめ、記事はエージェントに PR を作らせるだけにする**: コードを書かない人が直せなくなる。CMS の範囲を広げてから、使われ方を見て決める。

## 参照

- Epic #452、#448・#449・#450・#451・#454、`voice-feedback` の #455・#456・#457、Cor-Incorporated/griftai#94・#95・#96
- ADR-0007（対外表現）、ADR-0015（横断 ADR の正本）、ADR-0018（Sveltia CMS）、ADR-0019（翻訳 CI）、ADR-0022（事業の柱と Grift）
- `.claude/skills/cor-voice/SKILL.md` §7、`.claude/skills/cor-voice/references/evidence.md`、`cms/public/config.yml`
