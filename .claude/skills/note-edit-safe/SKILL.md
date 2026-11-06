---
name: note-edit-safe
description: >-
  Use when reflecting polished Japanese drafts into note.com editor (new or
  rewrite): same-key update for published notes, preedit inventory, no full
  Markdown/HTML paste, embed card conversion, Header reuse policy, postedit
  checks; never publish from this skill.
---
# note-edit-safe

Safe procedure for reflecting polished Japanese drafts into note.com (`editor.note.com`). Never publish from this skill. Pair with cor-voice-gate Semantic Review items 19–20.

## When to use
- Creating or updating a note draft after cor-voice → yomiyasu → cor-voice-gate text polish
- Restoring embeds / Header after a broken reflect
- Any computerUse or browser step that writes into the note editor

## Hard stops (Terada 2026-10-29)
1. **No full Markdown/HTML paste** into the editor (includes copy from a temporary `http.server` page, select-all replace, clear-body-then-paste-all).
2. **No ready** while plain `https://x.com/` or `https://twitter.com/` status URL lines remain uncarded.
3. **Header policy:** rewrite of a published note → reuse previous eyecatch by default (do not ask each time). Sequel / new series with no prior Header → leave unset.
4. No auto-publish. Terada publishes (or explicitly asks a bot after OK).
5. **Same-key update (2026-10-29 P0-1b):** If the brief is 更新／改稿／リライト／上書き of a **published** note, open only `https://editor.note.com/notes/<既存公開key>/edit/`. Never create a new note / new key for that job. New keys are allowed only for 続稿・新シリーズ, or when Terada explicitly says 「別記事」. Preedit must record `targetPublicKey` and assert `editorNoteId == targetPublicKey` before any edit. Fail → hard stop; do not mark ready.
6. **Publish-path wording:** Body / title / report may say 「更新しました」 (or equivalent update framing) **only** when `editorNoteId` is that published key. A new-key draft must not use 更新 framing or be handed as an update of an existing public URL.

## Steps
1. Classify the job: **更新／改稿** vs **続稿／新規**. Open the edit URL. Confirm note id.
2. **Preedit inventory** — write `<agent-server>/.../note_preedit_<noteId>.md`:
   - cover/Header present? asset URL if yes
   - image count and short list
   - embed cards: each URL + approx position
   - if rewrite/update: `targetPublicKey` (from public URL) and assert `editorNoteId == targetPublicKey`
   - if rewrite: previous published eyecatch URL (from public note or API)
3. Edit **by paragraph**, not by whole document:
   - Paste body paragraphs only
   - Headings: toolbar H2/H3 or type `## ` / `### ` at a **new paragraph** start (Enter×2 first). See ops memo `note-editor-formatting.md`
   - Lists: type `- ` / `1. ` at new paragraph start, or toolbar
4. **Embeds:** put each URL on its own paragraph, then convert to an embed card in the UI (do not leave as a blue plain link). Record screenshot or DOM proof per REFLECT "埋込復元".
5. **Header:** apply policy in Hard stops §3. For rewrites, set previous eyecatch if missing.
6. **Postedit check** (all must pass):
   - embed **card** count matches intentional set
   - cover matches Header policy
   - **zero** plain X/Twitter status URL lines
   - heading/image counts reconciled
   - title + opening match gated md
   - for 更新／改稿: `editorNoteId == targetPublicKey` still holds
7. Draft-save only. Report must include: 種別（更新｜続稿｜新規）／旧公開key（更新時）／編集key／key一致 yes|no／edit URL／preedit path／what changed／item 19–20 pass|fail. Do not mark ready if any check fails or key一致 is no.

## Forbidden shortcuts
- `python -m http.server` (or similar) → copy all HTML → paste into note
- Replacing the entire body to "save time"
- Relying on box `paste_body.md` alone as proof of embeds (md does not keep embed metadata)
- Creating a new draft key for a published-note **update**, then reporting it as 更新 or putting 「更新しました」 in the body

## Sources
- RCA (embed/Header): `<agent-server>/reports/20261029_note_embed_header_loss_rca.md`
- RCA (new-key publish): `<agent-server>/reports/20261029_note_new_key_publish_rca.md`
- Ops memo: store `note-editor-formatting.md` (SNS・note統括)
- Gate: cor-voice-gate items 19–20 + note 編集UI反映ゲート section
