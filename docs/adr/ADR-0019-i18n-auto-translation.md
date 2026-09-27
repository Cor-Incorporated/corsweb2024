# ADR-0019 コンテンツの多言語化は ja を正本とし、他言語は CI が Gemini で差分翻訳・検証して専有する

## ステータス: Proposed (2026-09-27)

## 背景
- CEO 決定: ブログ・ニュース・実績の全記事を 5 言語（ja / en / zh / ko / es）で出す。以前 Gemini を手動で呼んでいたスクリプトを活かし、自動翻訳にする。CMS は Sveltia CMS（Git ベース）を採用予定で、CMS は ja だけを編集する。
- 現状（2026-09-27 実測）: blog は ja 20 本に対して他言語は各 10 本で、翻訳は 2025-10-16 で止まっている。news 2 本・cases 6 本は 5 言語そろっているが、どの ja から作った訳なのかの記録が無い（`npm run i18n:check` で `missing=40` / `untracked=72`）。
- 旧スクリプト（`scripts/translate-blog*.js` ほか 6 本）の問題:
  - SDK `@google/generative-ai` は 2025-11-30 でサポート終了（<https://github.com/google-gemini/deprecated-generative-ai-js>）。モデル ID はプレビュー版 `gemini-2.5-flash-lite-preview-06-17` の直書き。
  - 手動実行・全文上書きで、ja が変わったかどうかの判定（鮮度）が無い。
  - 出力の検証が無い（コードブロック・URL・画像パスも訳文に含めて送り、壊れても気づけない。frontmatter は "Title:" 行の文字列解析）。
- UI 文言の i18n は ADR-0006 で `src/utils/i18n.ts` を唯一の正本にしたが、Content Collections（`src/content/<collection>/<lang>/*.md`）には同等の「正本と派生物」の取り決めが無かった。

## 決定
1. **正本は ja**。`src/content/{blog,news,cases}/ja/*.md` だけを人（CMS）が編集し、`en / zh / ko / es` は翻訳 CI が生成・更新・削除する派生物とする。
2. **鮮度はハッシュで判定する**。ja の翻訳対象部分（コレクション別の翻訳フィールド・訳すコレクションの tags・本文）の SHA-256 を翻訳先 frontmatter の `translationSourceHash` に記録し、`translatedAt` / `translationModel` を併記する。状態は `missing / stale / untracked / meta-drift / orphan / invalid / source-error / ok` の 8 つ。
3. **検証に落ちた翻訳は書かない**。コード・URL・数式・HTML・画像パス等をプレースホルダで保護して完全復元し、見出し・コードブロック・リンク・画像・表などの構造パリティ、未翻訳の検出、`src/content/config.ts` と機械照合した Zod ミラーでの frontmatter 検証、書き込み前の自己検査（読み戻して `ok`）をすべて通ったものだけを書き込む。
4. **実装は `scripts/i18n/`（ESM）**。`npm run i18n:check`（API 不要、問題があれば exit 1）/ `npm run i18n:translate`（`--dry-run` `--only` `--since` `--adopt` `--retranslate-untracked`）。旧スクリプト 6 本と `translate` / `translate:all` を削除する。
5. **SDK は `@google/genai`（2.24.0 に固定）、既定モデルは `gemini-3.8-flash`**（Stable、<https://ai.google.dev/gemini-api/docs/models> 2026-09-27 確認。新規プロジェクトには 3.5 Flash-Lite / 3.8 Flash が推奨、2.5 系は既存ユーザー限定）。`GEMINI_MODEL` で差し替え可能（コスト重視の代替は `gemini-3.5-flash-lite`）。429 / 5xx は指数バックオフで再試行し、並列度は 1〜2。
6. **CI（`.github/workflows/translate-content.yml`）**:
   - PR: `translate` ジョブが PR で変わった記事だけを翻訳し、bot 名義で PR の head に push。`i18n-check` はその後に走り、push した場合は新しい HEAD 側の実行に検査を委ねる。統合ブランチ（develop / main / master）が head の PR には push しない。
   - push トークンは `TRANSLATION_BOT_TOKEN`（GitHub App / fine-grained PAT）を推奨とし、無ければ `GITHUB_TOKEN` にフォールバックする。
   - `workflow_dispatch`: 既存記事のバックフィル（`chore/i18n-backfill-<日付>`）と既存翻訳の採用（`chore/i18n-adopt-<日付>`）はブランチの push まで。PR は人が作る。
7. **frontmatter の慣習は既存翻訳に合わせる**: blog の tags は訳さない（タグページの言語切替が同一文字列前提）、cases / news の tags と news の `source` は訳す。

## 理由
- 「ja を 1 本マージすれば 5 言語が揃う」には、翻訳の要否を機械的に決める鮮度判定と、人の介在なく走るトリガー（PR 上の CI）が必要。ハッシュを翻訳ファイル自身に持たせれば、別の状態ファイルや DB が要らない（ADR-0008 / 0009 の「静的・DB なし」方針と整合）。
- 公開ページを壊すリスク（コードや URL の改変、見出しの欠落、frontmatter 不正によるビルド失敗）は翻訳品質の低さより重い。構造パリティとスキーマ検証を満たさない出力は書かず、次の実行で再挑戦させる方が安全。
- UI 文言（ADR-0006）とコンテンツで「正本は 1 つ、他は派生物」という同じ原則を適用でき、編集者の運用が単純になる（ja だけを見ればよい）。
- `GITHUB_TOKEN` による push は後続の CI を通常起動しない（PR 更新時は承認待ちの実行になる。GitHub Docs「Triggering a workflow from a workflow」）。required check を含めて追加操作なしで回すには、別トークンでの push が必要。

## 影響
- 翻訳ファイルに `translationSourceHash` / `translatedAt` / `translationModel` が増える。`src/content/config.ts` の `z.object` は未知キーを捨てるため、ビルド・型に影響しない（2026-09-27、既存 72 翻訳に付与した状態で `npm run build` 成功を確認）。
- 既存の 72 翻訳は `untracked`。移行時に `--adopt`（そのまま採用）か `--retranslate-untracked`（再翻訳）を選ぶ。手順は `docs/i18n-translation.md`。
- 人が翻訳ファイルを直接直しても、ja が次に変わった時点で CI が上書きする（派生物のため）。訳の手直しが必要なら ja 側の表現を調整する。
- 機械翻訳による対外表現の変化（ADR-0007）: `blog-guardrails.mjs` は日本語表現を検査するため訳文には効かない。プロンプトで「主張の確度を強めも弱めもしない」を指示し、PR の差分で人が確認する。訳文向けの機械検査は今後の課題。
- 運用に必要な設定: secret `GEMINI_API_KEY`（必須）、secret `TRANSLATION_BOT_TOKEN`（推奨）、variable `GEMINI_MODEL`（任意）。
- Gemini API の従量課金が発生する（未翻訳 40 件の一括翻訳で数ドル以内の見込み・推定）。
- 関連: ADR-0006（UI 文言の正本。本 ADR はそれを置き換えず、同じ原則をコンテンツへ拡張する）、ADR-0007（対外表現ガードレール）、ADR-0008 / ADR-0009（記事 bot・静的 SSG 方針。bot トークンに GitHub App を使う場合は同様の最小権限にする）。hreflang の出し分けは別途対応する。

## 代替案
- **手動スクリプトの継続（旧方式）**: 実行漏れで翻訳が止まった実績があり、SDK もサポート終了。鮮度判定と検証が無く、壊れた訳が混入しても気づけないため却下。
- **ビルド時にオンザフライで翻訳**: ビルドのたびに API 呼び出し・費用・非決定性が発生し、訳がレビューされないまま公開されるため却下。
- **翻訳管理 SaaS / 人手翻訳**: 品質は高いが、記事ごとの費用とリードタイムが「ja を書けば揃う」要件に合わない。重要ページのみ人手で整え `--adopt` で取り込む運用は併用可能。
- **状態を別ファイル（マニフェスト）で管理**: 翻訳ファイルと状態の二重管理になり、片方だけ更新される事故が起きうる。来歴を翻訳ファイル自身の frontmatter に持たせる方式を採用。
- **push 後の再実行を GITHUB_TOKEN + workflow_dispatch だけで賄う**: `h5-admission` など workflow_dispatch を持たない required check を再実行できず、承認操作が残るため、推奨はボットトークンとした（GITHUB_TOKEN はフォールバックとして残す）。
