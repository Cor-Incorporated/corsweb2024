---
name: cor-voice-gate
description: >-
  Use when drafting or polishing Japanese outbound text (blog, SNS, note,
  LinkedIn, X, pitch, cover mail, formal Q&A) through the Terada voice stack:
  pick Fast/Full, run yomiyasu + cor-voice + Semantic Review (incl. note same-key
  update item20, tech/safety investigation lens item21), never publish from
  this skill.
---
# Cor voice gate

Apply to all Japanese outbound text Terada or Cor. may send or publish: cor-jp.com, griftai.org, note, LinkedIn, X, pitch Q&A, **cover / outreach email, candidate questionnaires, and other formal written asks**. Never publish or send from this skill.

## Canonical paths
- Mac (source of truth): `~/Developer/corsweb/.claude/skills/cor-voice` and `.../yomiyasu` (identical copy under `~/Developer/griftai/.claude/skills/`)
- Agent-server copy: `$COR_VOICE_SKILLS_DIR/cor-voice` and `$COR_VOICE_SKILLS_DIR/yomiyasu` (the directory is set per environment and is not part of this repository)
If the agent-server copy is older, refresh from Mac before checking.

## Harness entries (Codex, OpenCode, Pi, dsh, Grok, Cursor, Claude Code)
- Every harness reads the same short entry: the generated block in `AGENTS.md` (Codex, OpenCode, Pi, dsh, Grok) and `CLAUDE.md` (Claude Code), and `.cursor/rules/cor-voice.mdc` (Cursor). The entry points at the skills and lists the checks; it never copies rule bodies (ADR-0026).
- Source: `references/harness-entry.md`. After editing it, run `python3 -I .claude/skills/cor-voice-gate/scripts/render_harness_entries.py --write` in both repos. `--check` (run by each repo's unit tests) fails when an entry was edited by hand, a source edit was not rendered, or `AGENTS.md` grows past Codex's 32 KiB read limit.

## Priority
1. ADR / CLAUDE.md wording rules for the product
2. yomiyasu: keep meaning; do not add facts
3. cor-voice register and anti-slop lists
4. Whole-post tone coherence (below) — blocks ship even when a media exception would allow a token
5. **Semantic Review (below) — hard stop; overrides soft pass** (items 13–18, item 21 (2026-10-29 tech/safety), and the §10.2 table added 2026-10-29 from `<agent-server>/reports/20261029_cor_voice_rewrite_review.md`)
6. cor-voice §5 readability (always loses on conflict with 1–5)
7. **note 編集UI反映ゲート（when reflecting to note）— hard stop; items 19–20**

## Steps
1. Choose register: company (です・ます, no 僕/私) vs personal/note/founder X (僕 OK, short plain lines OK; X-only tone exception in cor-voice §5 is optional, not a mandate).
2. Choose yomiyasu doc-type (promo for SNS, article for long posts, **mail / formal for email and questionnaires**) and reader (informed / expert).
3. Run yomiyasu Steps 1–5, then:
   `python3 -I .claude/skills/yomiyasu/scripts/yomiyasu_check.py run --source <original> --final <polished> --doc-type <type> --fact-gaps`
   and `verify --final <polished>` before handoff.
   Also run `python3 -I .claude/skills/cor-voice-gate/scripts/cor_voice_lint.py check --scene <company|founder|tech|mail|founder-x> <polished>` (the cor-voice rules a machine can check: site wording errors, banned patterns, sentence and paragraph length). Errors block handoff.
   **Scope:** `--source` and `--final` must be the **same document before/after polish** (same section, same ask). Do not diff a short outline against a long cover, or two different drafts, or that will inflate meaning_risk and cause false hard stops.
4. **Hard stop on meaning_risk:** if that same-document run reports `meaning_risk` count > 0 (or any meaning_risk items in diff/report), do **not** hand off as gate-passed. Rewrite, re-run, or escalate to Terada with the exact risks. Soft-continuing past meaning_risk is forbidden. If scopes were mismatched, fix the inputs and re-run before treating the stop as real.
   **Intentional framing fixes (security / architecture):** corrective edits that deliberately change assertion strength (e.g. external review on trust boundary / shared responsibility) will flag meaning_risk against the pre-fix source. Map each risk to the intentional fix, escalate for Terada OK, then set the **approved text as the new `--source`**, polish same-document again, and require `meaning_risk_count == 0` on that re-run before second reader. Do not soft-pass the first run.
5. Apply cor-voice keep/ban lists and §5 readability without changing facts or numbers.
6. **Whole-post tone check (required, Fast and Full):** read the polished text as one unit. Ask: would a careful reader find any line odd in context (register clash, dialect stuck into a sober tech announce, joke tone mid-security note, etc.)? If yes → rewrite or strip the odd part and re-run yomiyasu check. Media exceptions (founder X 「やねん」等) are optional spice for joke/casual posts only—not for ordinary tech/product/article announces—and never override this check. Do not ship on “exception says OK” alone.
7. **Thread / publish context:** before any X (or similar) publish or fix, check how the timeline will look after the action (parent post, replies, deletes). Fix the odd post itself when possible; do not delete a parent and leave only a reply (orphan reply + bare URL reply is a failed fix). Prefer rewrite-in-place or delete-and-repost as a clean standalone with the same substance and URL.
8. **Semantic Review (required, Fast and Full)** — checklist below. Fail any item → rewrite or escalate; do not mark ready for review.
9. Apply corsweb blog-guardrails rules in spirit (no retired brand names, no ISMS-as-certified, no *.web.app / draftKey / internal notes).
10. **Second reader:** the bot that wrote the draft must not be the only gate. Another bot (SNS統括, 発信QA, or Grok Bot) must re-read Semantic Review + open the cited run path on the agent server. If `ls` cannot open the run path, treat as not passed.
11. Return polished path + **absolute shared-box run path** (`/workspace/<case>/.yomiyasu/runs/<ID>` or equivalent) + `meaning_risk` count + what changed + questions for Terada. Do not post, schedule, or ship without explicit approval.

## Semantic Review (required)

Check every outbound medium, including email and formal documents:

1. □ **Sentence completeness:** every sentence has clear 何が／何を (subject/object). Incomplete 「気になっています」-style lines fail.
2. □ **Habit / frequency implication:** 「たびに／毎回／いつも／例年」 only when factually backed. First-time surveys must not sound recurring.
3. □ **Motive from the reader’s seat:** within the first ~5 lines, who is writing, why them, why now — clear to the recipient.
4. □ **Relationship / debt:** if Terada’s relationship to the reader or city (e.g. 支援を受けてきた) belongs in the piece, confirm with him before inventing; do not invent to satisfy this check. Escalate rather than fabricate (respects yomiyasu no-add-facts).
5. □ **Factual framing:** first-time vs recurring; personal vs official; no scoring / endorsement / popularity framing unless Terada ordered it. Labels must match the actual activity (e.g. do not call an in-session comparison 「宿題」).
6. □ **meaning_risk_count == 0** after the latest **same-document** shared-box run (hard stop if > 0). Mismatched source/final scopes do not count as a real pass or a real fail until re-run correctly. After Terada-approved intentional framing fixes, the zero-risk run must use the approved text as `--source`.
7. □ **Publish-path preview:** for SNS, open the final Postiz / intent / scheduler preview and confirm URL, link card, and thread shape. URL-required posts: if Postiz strips links, use `x.com/intent/post` (or equivalent) so the URL is in the parent body. When auditing live X, check short `text` **and** `note_tweet` / long text — short-text-only URL checks cause false “missing URL” alarms.
8. □ **No duplicate / orphan posts:** same substance must not already be live twice; no orphan replies after parent delete.
9. □ **Dialect:** never in tech / product / security / article announces (existing rule; machine-check mindset).
10. □ **Mail extras (when email):** auto-signature language, attachment name/size, reply-to, and that the cover does not lean on a packed form alone for motive.
11. □ **No draft / edit URLs in body (hard stop before Postiz or any one-tap publish):** reject `editor.note.com`, `note.com/.../edit`, and other draft-only or login-walled edit links. Linked article URLs must be the **public** note/blog URL and return HTTP 200. If the note is still unpublished, do **not** load Postiz / mark ready — escalate for publish-or-wait, then swap to the public URL and re-run this gate.
12. □ **Security / architecture framing (when the piece touches trust boundary, edge, zero trust, cloud vs local, or “what we sell”):** apply all of the following (source: 2026-10-29 note C external review → series gate). Fail → rewrite or escalate; do not invent new product claims.
    - Trust boundary: do **not** assert 「同じクラスタ＝同じ信頼境界」. Prefer 「単一クラスタに無条件で参加させると境界が曖昧になる」. NIST zero trust: do not treat physical / network location alone as trust.
    - Edge value: do **not** reduce edge to 「止まらないこと」 only. Name availability, real-time response, **and** the ability to **stop safely**.
    - Cloud vs local: do **not** say the cloud provider alone 「境界を引いてくれていた」. Use shared-responsibility wording; going local expands the company’s own physical and operational responsibility.
    - Offer framing: do **not** lead with 「売っているのは速さではない」 as a pure negative. Prefer 「性能要件を満たすだけでなく、安全に運用できる構成まで」 without denying inference R&D strength.
    - Keep: ISMS stage-2 finished vs certification-registration expected (never 「取得済み」); demo / watermelon-split = simulation only, no real-device assertion; readability (one sentence per line where that register applies) and 「安全に業務へ組み込める」 brand line.

13. □ **State labeling (2026-10-29 reviewer report §7.1) — hard stop on conflation:** every claim sentence is readable as exactly one of 方針／実装／検証／本番運用／顧客成果／計画. Fail if: policy written as implemented or safe; implementation written as "no operational issues"; one verified config written as "works anywhere"; demo called 本番; Cor.'s own experiment rate used as customer effect; plan in the delivered/実績 list. Also separate simulation vs real device, can-run vs permitted-to-use, own build vs verification help on someone else's PR. Conflation → hard stop; rewrite or escalate. Do not invent the missing state evidence.
14. □ **Numbers / comparison / safety minimums (§7.2):** each number names what was counted, period, denominator, target, conditions, unobserved; speed claims carry model / quantization / HW / impl version / I/O length / concurrency / method (detail may live in linked doc). No 日本初／最速／唯一／完全／100％安全／必ず without definition + strong evidence; 最適／高精度 say for whom. External surveys: year, population, forecast vs actual; never recast as Cor. product efficacy. Promises (all-local, no-log, no-AI, no individual scoring) checked against UI defaults, egress, error logs, options. Missing → escalate, not fill.
15. □ **P0 vocabulary (§要旨, §3, §4.1–4.5) — hard stop:**
    - 「証拠は盛れない」/「経歴は盛れる。証拠は盛れない。」 present anywhere (title, OGP, card, CTA) → fail. Replacement: 「経歴の説明に、確かめられる根拠を。」 Recomputable ≠ input complete/authentic ≠ ability measured. 「同じ記録なら同じ値」 needs same range/commit, CLI version, definitions/settings.
    - 「7倍」 tied to 生産性／開発速度／納品量 → fail. Must be GitHub contributions (incl. Issue/PR/review), title/lead/summary/OGP same metric, no quality/rework/time improvement rate.
    - Boundary: item 12 + item 18. Allowlist: vuln response vs allowlist not either/or; allowlist = who may connect, not who may use for what (authn/authz separate); local API call ≠ fully local processing; must not read as "reachability control is enough".
16. □ **Story shape (§7.4):** 出来事→問い→観測→判断→限界→読者への意味 present (missing step → report, don't fabricate). Limits near the result, once; flag over-hedging that hides what was learned. No chain of 「〜ではない」 negations denying performance/impl strength. One main next action; inquiry CTA says no real data / confidential docs / credentials needed initially (§8.1).
17. □ **Personal vs company (§2.3):** "worked under my conditions" and "Cor. can deliver in customer env" in separate paragraphs; scope / features / delivery record / certification / pricing in company voice only.
18. □ **Boundary / stop-design articles (続稿① n083decbc281b 境界・安全停止 and successors; Terada decision 2026-10-29):**
    - Edge value always as the triple **可用性・リアルタイム応答・安全に停止できること** (no single-item reduction).
    - シミュレーション ≠ 実機: simulation results never stated as real-device safety/performance.
    - 方針 ≠ 実装済み: 「分離する方針」 not written as 分離済み／検証済み unless evidence is cited.
    - Cor.の選択 vs 一般原則: 「Cor. はこの条件で分離を選ぶ」, not 「必ず別クラスタでなければ危険」. Illustrative flows (検査ID・時刻・判定結果のみ渡す) labeled 説明用の例, not implemented feature / customer case.
    - 「売っているのは速さではない」 → 「速度だけでは、業務に使えるかは決まらない」.
    - ISMS: stage 2 done / registration expected ~Dec 2026, separated from what each system verified.
    - 技術・安全系記事全般（続稿①に限らない）には item 21 も適用する。

19. □ **note 編集UI反映（when reflecting into editor.note.com）— hard stop（寺田承認 2026-10-29）:** 出典 `<agent-server>/reports/20261029_note_embed_header_loss_rca.md`・運用メモ `note-editor-formatting.md`。
    - **Markdown／HTML 全文ペースト禁止**（一時 http.server の HTML 全文コピー→貼付、全文選択→置換を含む）。段落本文の貼付は可。見出し・リストはツールバーまたは行頭ショートカットの**入力変換**。
    - 反映前に退避: カバー画像（Header／eyecatch）の有無、画像・埋込カードの一覧（位置・URL）を `note_preedit_<id>.md` に記録。無い場合は「未設定」と書く。
    - 反映後照合（タイトル・冒頭だけでは不十分）: **埋込カード数**、**カバー画像**、**素URL残存ゼロ**（`https://x.com/` / `https://twitter.com/` の素リンク行がカード化されず残っていない）、見出し数・画像数。不一致 → 保存完了／ready にしない。
    - **Header方針**: 改稿下書き＝**旧公開アイキャッチ流用が標準**（毎回確認不要）。続稿のように当初未設定なら載せない。流用アセットURLを照合に含める。
    - REFLECT の「埋込復元」は、カード化のスクショまたは DOM 証跡が付くまで ready にしない。箱上 md／paste_body は埋込メタを保持しない前提で扱う。
    - 詳細手順は [note-edit-safe](../note-edit-safe/SKILL.md) に従う。


20. □ **公開済み note の更新＝同一 key（when the job is 更新／改稿／リライト of a published note）— hard stop（寺田承認 2026-10-29）:** 出典 `<agent-server>/reports/20261029_note_new_key_publish_rca.md`・運用メモ `note-editor-formatting.md`（「更新／リライト」節）。
    - 編集URLの noteId（`editor.note.com/notes/<id>/edit/`）は、旧公開URLの noteId（`note.com/.../n/<id>`）と **一致必須**。報告に `targetPublicKey` / `editorNoteId` / `key一致: yes|no` を必ず書く。不一致、または旧公開URLの書き漏れ → FAIL。ready／ワンタップ公開導線に載せない。
    - 本文・タイトル・完了報告に「更新しました」等の更新フレーミングがあるのに key が新規 → FAIL。
    - 新規 key で作ってよいのは **続稿・新シリーズ**、または寺田が「別記事」と明示した場合のみ。その場合は更新フレーミングを使わない。
    - 詳細手順は [note-edit-safe](../note-edit-safe/SKILL.md) Hard stops §5–6。

21. □ **技術・安全系の調査／検証レンズ（when the piece is a 技術・安全／フィジカルAI／機能安全／エッジ安全停止／検証記事, or claims 検証した・実証・試験済み）— hard stop on checks 1・2・5; checks 3・4・6 are Full-required（寺田承認 2026-10-29）:** 出典: 2026-10-29 P0-S1 外部レビュー（「設計思想として良いが調査／検証記事として不足」; 原文保管先は未確認）＋`<agent-server>/reports/20261029_tech_safety_article_gate_draft.md`。item12／13／14／18 を置換せず補強する。
    - **(1 hard) 危険源から安全側状態を定義:** 停止・静止・帰還・待機を無条件に「安全」と呼ばない。何の危険源に対して、どの状態が安全側かを書く。書けない → 「安全側状態は未定義」と明記するか escalate。Fail = hard stop.
    - **(2 hard) AI推論と安全制御の分離:** 停止判断の主体が AI 自身だけになっていないか。独立した制御（ハードインターロック・ウォッチドッグ・人の停止権限など）の有無と状態（方針／実装／検証）を書く。無いなら無いと書く。Fail = hard stop.
    - **(3 Full必須) 確信度≠安全性:** 確信度・スコアを安全性の指標として使わない。高確信度での誤判断とキャリブレーションの問題に触れずに「確信度が低ければ止まるので安全」と書かない。
    - **(4 Full必須) ISMS≠機能安全:** ISO/IEC 27001（情報セキュリティ）と ISO 13849・IEC 61508 等（物理の機能安全）を混同しない。ISMS の取得・審査状況を機能安全の根拠にしない。
    - **(5 hard) 方針 vs 実装／試験済み:** 設計方針と実装済み・試験済みを文単位で分ける（item13 準拠）。未実施は「未実施」と書く。スイカ割り等のデモは、検証証跡（条件・回数・結果・記録）がなければ「証拠不足（説明用のデモ）」と明記。固定フレーズ（ある場合）: 「スイカ割りは説明用のデモであり、安全性の検証証跡ではありません。」「検証した」「実証」「試験済み」は証跡の所在を示せる場合だけ。Fail = hard stop.
    - **(6 Full必須) 一次資料の名称と位置づけ:** 規格・論文・実装ドキュメントを参照するときは名称（版・年）と URL を書き、「参考にした資料であり、認証・適合ではない」と位置づけを明示。読んでいない資料は引かない（operator note で「要確認」）。
    - Fail → 書き直し、または escalate。足りない証跡・事実をこの項目を満たすために作らない。

### Pre-publish table (§10.2) — fill for every Full-gate item; any ✗ = not passed

| 確認 | 合格条件 | ✓/✗ |
|---|---|---|
| 現在地 | 現行サービス・過去の記録・計画のどれかが分かる | |
| 主張 | タイトル・要約・OGP が本文より強くない | |
| 根拠 | 数字の対象・条件・版・時点を追える | |
| 限界 | 未検証・未観測・できないことを結果の近くに書く | |
| 情報管理 | 本文・画像・添付に秘密情報や無許可の顧客情報がない（画像のタブ・通知・パスも） | |
| 主体 | 自社開発・他者実装・検証協力・引用を区別 | |
| 実態 | 方針だけを実装済み・本番化済みと書いていない | |
| 読者 | 誰の何の判断に役立つかを一文で言える | |
| 導線 | その記事に合う一つの主な次の行動 | |
| 更新 | 更新担当、再確認条件、原公開日・更新日が分かる | |

For P0 article fixes also check title, description, summary, OGP, FAQ, related cards, CTA as one set (§11). Search-result staleness is recorded separately, never promised fixed.

### Operator prompt fragment (§10.3) — paste into any AI drafting / polishing instruction

> 公開用原稿は、確認済み事実・解釈・提案を分けて作成する。根拠のない数字、顧客成果、未実装の機能を追加しない。出典を読んでいない場合は「要確認」とする。古い記事の歴史を消さず、更新注記で現在との違いを示す。タイトルと要約を本文より強くしない。認証情報や顧客の実データは使わず、例は合成データと明記する。原稿作成と公開操作は分離し、公開・送信・push・本番反映前に対象と変更内容を示す。完了報告には、実際に確認した公開箇所と未確認箇所を記載する。各文の状態（方針／実装／検証／本番運用／顧客成果／計画）を混ぜない。「証拠は盛れない」は使わず「経歴の説明に、確かめられる根拠を。」とする。「7倍」はコントリビュート数として書く。このプロンプトの出力は下書きであり、公開・送信はしない。

("要確認" here belongs in the operator's draft notes; yomiyasu still keeps it out of reader-facing body text.)

Teaching materials / workshop briefs (extra, when the outbound is a class or study-session notice): who it is for, what experience it creates, and whether the design is skewed to only “improvement” or only “worsening” when both sides are required — flag and escalate; do not invent curriculum.

## Fast / Full

Pick the gate before polishing. Any one "Full" condition → Full.

| Condition | Fast OK | Full |
|---|---|---|
| Length | X / LinkedIn short post (≲400 chars, provisional) | note long-form, blog article, **outreach email, questionnaire cover** |
| Topic | Re-announcing / restating a published topic | New topic, first-time numbers, **external stakeholders (admin, candidates, clients)** |
| External constraints | None touched | ISMS, スイカ割り, Thor, MBP, product wording, **trust boundary / edge / zero trust / shared responsibility / “what we sell” framing**, **any number / comparison / safety promise, 7倍, Grift copy, allowlist, stop design (2026-10-29)** |
| Technical / safety | — (never Fast-only) | **技術・安全／フィジカルAI／機能安全／エッジ安全停止／検証記事, 「検証した」「実証」「試験済み」, ISO 13849 / IEC 61508 等の規格参照, スイカ割りデモを安全の根拠に使う, AIが停止判断する記述 → Full + item 21 (2026-10-29)** |
| Source | Terada's own handwriting | AI draft |

- Fast: register → cor-voice fast checklist (5 items) + 4 machine checks below + **whole-post tone check** + **Semantic Review** → `check run` and `verify` (never skipped) → meaning_risk hard stop (same-document only).
- Full: Steps 1–11 above (include Semantic Review item 12 / 18 / 21 when topic matches) + §10.2 pre-publish table.
- Fast still runs items 13 and 15 (state conflation and P0 vocab are hard stops in every gate), and item 21 when the topic is technical / safety. When reflecting into note editor, items 19–20 are also hard stops (Full-level for that step).
- Fast machine checks (provisional thresholds):
  1. Long-form: a claim / key point appears within the first ~200 chars of body.
  2. Measurement posts: date (or updated date) and measurement conditions near the top.
  3. X announcements: not a bare link; title or 1–2 line summary before the URL (audit `note_tweet` too when present).
  4. Body must not contain `editor.note.com` (or `.../edit` draft paths); linked note/blog URLs must be public and HTTP 200 before Postiz load.
  5. `cor_voice_lint.py check` reports 0 errors for the chosen scene (warns are candidates; keep them only when fixing would change meaning).
- X exception: for founder X (@cor_terisuke) only, see cor-voice §5 (「！」「www」「やねん」「やん」「んよね」、絵文字、「（笑）」「笑」 *may* appear). Not for company accounts or other media. **Optional spice, not a checklist item to insert.** Whole-post tone check and Semantic Review still win.
- Ban / keep lists live only in cor-voice. This gate references them and does not copy them.

## note 編集UI反映ゲート（hard stop・2026-10-29）

Applies when any bot reflects polished text into `editor.note.com`. Text polish alone does not satisfy this gate.

**Job type first:** 更新／改稿 of a published note → open **only** that published key's edit URL. 続稿／新規 → new draft OK (no 「更新」 framing of an existing public URL). Mixing them is a hard stop (item 20; P0-1b `n02c06b4ccfea` vs `n800a959f7284`).

1. **Forbidden:** Markdown or HTML **full-document paste** into the note editor (including copy from a temporary `http.server` page, select-all replace, or clearing the body then pasting the whole draft). Root cause of 2026-10-29 embed/Header loss (P0-1b).
2. **Forbidden for 更新／改稿:** creating a new note key, then reporting it as an update of a published URL or putting 「更新しました」 in the body.
3. **Allowed:** paste paragraph body only; set H2/H3 and lists via toolbar or line-start shortcuts after Enter×2; place each embed URL as its **own paragraph**, then convert to a card in the UI before saving as done.
4. **Before edit:** write `note_preedit_<noteId>.md` with cover (Header/eyecatch) present?, image count, embed list (URL + position). For 更新／改稿: record `targetPublicKey` and assert `editorNoteId == targetPublicKey` before any edit. For rewrites, also record the previous eyecatch asset URL (reuse is the default — do not ask Terada each time).
5. **After edit (must all pass before ready):**
   - embed **card** count matches preedit (or the intentional new set)
   - cover image matches Header policy (rewrite = previous eyecatch; sequel with no prior Header = leave unset)
   - **zero** plain X/Twitter URL lines left uncarded
   - heading/image counts reconciled; title + opening still match the gated md
   - for 更新／改稿: `editorNoteId == targetPublicKey` (report key一致: yes)
6. Do not mark ready / hand to Terada for publish until Semantic Review items 19–20 pass. No auto-publish.

Procedure detail: skill `note-edit-safe`. Ops memo: store doc `note-editor-formatting.md`.

## Escalate to Terada (via Grok Bot)
Hand up draft + ≤3 questions when any of:
- meaning_risk remains after rewrite attempts (same-document runs)
- intentional security / architecture framing fixes produced meaning_risk against the pre-fix source (attach risk↔fix mapping; wait for OK, then re-run with approved text as `--source`)
- motive / relationship / debt facts must be added
- publish-path preview cannot be obtained
- same document rejected twice
- recipient is external stakeholder (government, candidates, clients, counsel)
- state conflation (item 13) or P0 vocab (item 15) cannot be fixed without new facts
- P0 intentional fixes (7倍, 証拠コピー, boundary, allowlist, 続稿① 境界・安全停止) produced meaning_risk: same risk↔fix mapping → Terada OK → approved text as new `--source` → `meaning_risk_count == 0`
- outbound body still has `editor.note.com` / draft edit URLs, or the linked note is unpublished (404)
- note editor reflect used full paste, left plain X URLs, or Header policy failed (item 19)
- published-note update used a new key, key一致 is no, or 「更新しました」 framing on a new key (item 20)
- technical / safety article cannot pass item 21 without new evidence (安全側状態の危険源定義、独立した停止制御の状態、検証証跡、一次資料の所在が無い) — report what is missing; do not invent

Send / publish still requires Terada’s explicit OK. No auto-send.

## Do not use as voice sources
- `~/.claude/skills/blog` (dialect, （笑）, ! — conflicts with cor-voice except founder X §5)
- `corsweb/BLOG_FORMAT_GUIDE.md` plain-form mandate (outdated vs cor-voice)

## Publish context (hard rules)
- Dialect / 「やねん」等: optional spice for joke/casual only. Never add to tech, product, security, or article announces.
- Never "fix" by deleting a parent and leaving only a reply. Prefer one clean standalone with the same substance.
- X article announces must include the article URL in the main post body. If Postiz strips links, use x.com/intent/post (or equivalent) so the URL ships in the parent post—not a follow-up reply.
- Before ship: simulate the timeline after publish/delete. Orphan replies, URL-only replies, and dialect-in-tech are ship blockers.
- **note editor reflect:** no full Markdown/HTML paste. Embeds must be cards; plain `x.com`/`twitter.com` status URL lines are a hard stop. Header: rewrite reuses previous published eyecatch; sequel without prior Header stays unset.
- **published note update:** edit URL noteId must equal the public noteId. New-key drafts are not updates; do not hand them as 更新 or put 「更新しました」 in the body (item 20).
- **Before Postiz / one-tap publish:** scan the body for `editor.note.com` and other edit/draft URLs. Hard stop until swapped to a public URL that returns 200 (or Terada explicitly holds publish). Overnight “edit URL as placeholder” drafts are allowed only as pre-gate WIP — they must not pass this gate or load as ready-to-tap.
