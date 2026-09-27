# コンテンツ自動翻訳（ja → en / zh / ko / es）

ブログ・ニュース・実績（`src/content/{blog,news,cases}`）は **日本語（ja）だけを書けば、英語・中国語（簡体）・韓国語・スペイン語が CI で自動的に揃う** 仕組みになっています。設計判断は [ADR-0019](./adr/ADR-0019-i18n-auto-translation.md)。

- 人（CMS）が編集するのは `src/content/<collection>/ja/*.md` だけ
- `en / zh / ko / es` のファイルは翻訳 CI が生成・更新・削除する（手で直した場合も、ja が次に変わった時点で上書きされる）
- 翻訳は Gemini API（`@google/genai`、既定モデル `gemini-3.8-flash`）で行い、**検証に 1 つでも落ちた翻訳は書き込まない**（品質より「壊さない」を優先）

## 1. 全体の流れ

```text
編集者: ja の記事を追加・修正して PR を作る（develop 宛て）
   │
   ▼  GitHub Actions「Translate content (i18n)」
translate ジョブ … PR で変わった記事だけを翻訳 → 検証 → bot コミットを PR に追加
   │
   ▼
i18n-check ジョブ … 翻訳の欠け・古さを検査（翻訳コミットを積んだ場合は、その新しいコミットで検査）
   │
   ▼
人: PR の差分（ja と各言語）を確認してマージ → 5 言語が揃った状態で公開
```

## 2. 何を訳し、何をコピーするか

frontmatter は「翻訳するフィールド」だけを訳し、それ以外は ja からそのままコピーします（`lang` だけは翻訳先の言語に設定）。

| コレクション | 翻訳するフィールド | tags | ja からコピーする主なフィールド |
|---|---|---|---|
| blog | `title` `description` `image.alt` | **訳さない**（ja のまま） | `pubDate` `updatedDate` `author` `category` `image.url` `ogImage` `isDraft` `featured` `readingTime` |
| cases | `title` `description` `summary` `securityNote` `heroImage.alt` | 訳す | `category` `publishedAt` `updatedAt` `heroImage.url` `ogImage` `ctaType` `relatedSlugs` `isDraft` `featured` |
| news | `title` `description` `source` | 訳す | `publishedAt` `updatedAt` `author` `category` `externalUrl` `ogImage` `isDraft` `featured` |

- **tags の扱い**は既存の翻訳ファイルの慣習に合わせています。blog は `/<lang>/blog/tags/<tag>` の言語切替（`src/utils/blog-i18n.ts`）が全言語で同じタグ文字列を前提にしているため訳しません。cases / news は既存の翻訳がすべて訳語なので訳します。
- ja の `isDraft: true` や `featured` の変更は、API を呼ばずに全言語へ同期されます（下の `meta-drift`）。
- 定義の正本: [`scripts/i18n/config.mjs`](../scripts/i18n/config.mjs) の `COLLECTIONS`。

翻訳ファイルには来歴として次の 3 つが付きます（`src/content/config.ts` の Zod スキーマは未知のキーを捨てるのでビルドには影響しません）。

```yaml
translationSourceHash: "<ja の翻訳対象部分の SHA-256>"
translatedAt: "2026-09-27T12:00:00.000Z"
translationModel: "gemini-3.8-flash"   # --adopt で採用した既存翻訳は "adopted-legacy"
```

`translationSourceHash` の入力は ja の「翻訳対象部分」だけ（上表の翻訳フィールド、cases / news は tags、そして本文）。`pubDate` などコピー対象の変更や、YAML のクォート・キー順・改行コードの違いではハッシュは変わりません。

## 3. 状態と、`--write` がすること

| 状態 | 意味 | `--check` | `--write` |
|---|---|---|---|
| `missing` | ja はあるが翻訳ファイルが無い | 問題として列挙 | 翻訳して作成 |
| `stale` | 翻訳の `translationSourceHash` が今の ja と一致しない | 問題 | 再翻訳して上書き |
| `untracked` | 翻訳はあるが `translationSourceHash` が無い（この仕組み以前の翻訳） | 問題 | **触らない**（`--adopt` で採用 / `--retranslate-untracked` で再翻訳） |
| `meta-drift` | ハッシュは一致するが、コピー対象（`pubDate` `featured` 等）や `lang` がずれている | 問題 | API なしで ja から同期 |
| `orphan` | ja が無い翻訳（ja を削除・改名した、または翻訳だけを追加した） | 問題 | 下の条件をすべて満たすものだけ削除。満たさないものは削除せず失敗として報告 |
| `invalid` | 翻訳ファイルの frontmatter が壊れている | 問題 | 再翻訳して上書き |
| `source-error` | ja の frontmatter が壊れている | 問題 | 何もしない（ja を直す） |
| `ok` | 同期済み | — | 何もしない |

`--check` は 1 件でも問題があれば終了コード 1、`--write` は失敗・未処理が 1 件でもあれば終了コード 1、引数や設定の誤りは終了コード 2 です。

`orphan` を削除する条件（人が書いた翻訳や、ja の改名だけで消える事故を防ぐため）:

1. `--since`（PR の差分）で実行したときは、その差分で **ja の削除が確認できた**記事だけ。PR で en などの翻訳だけを追加した記事は消さない
2. 来歴（`translationSourceHash`）の無い翻訳は、`--prune-untracked` を明示したときだけ
3. 1 回に消す件数がコレクションの翻訳ファイル数 × `I18N_MAX_PRUNE_RATIO`（既定 0.25。最低でも記事 1 本分）以下で、ja ディレクトリが空でないこと。超えたらそのコレクションでは 1 件も消さない

## 4. 翻訳で守るもの（保護）と検証

API に送る前に、訳してはいけない部分をプレースホルダ（`⟦B3⟧` / `⟦P12⟧`）に置き換え、翻訳後に完全に元へ戻します。

- ブロック: フェンスコード（```` ``` ```` / `~~~`、コメントも訳さない）、`$$` 数式、HTML ブロック・コメント、URL だけの行（リンクカード）、参照リンク定義
- インライン: インラインコード、`$...$` 数式、`<https://...>`、インライン HTML、リンクと画像の**宛先**（リンクテキスト・alt は訳す）、脚注、`{#id}`、本文中の URL

翻訳結果は次をすべて満たしたときだけ書き込みます（1 回だけ自動で再生成し、それでも駄目なら書かずに失敗を報告）。

- プレースホルダが全部・1 回ずつ・壊れずに残っている／ブロックは単独行のまま
- 見出し（レベル別の数）、コードブロック（数と内容が完全一致）、リンク・画像の宛先、数式、HTML、リンクカード、表の行数、空行で区切られたブロック（段落・リスト・表など）の数、リスト項目の数が ja と一致（段落 1 つ・リスト項目 1 つの欠落や、2 段落の結合も落とす）
- 日本語が残っていない（本文は日本語文字が 10% 以下、frontmatter は 30% 以下。zh は仮名だけで判定）
- frontmatter が `src/content/config.ts` と同じ制約（Zod ミラー `scripts/i18n/schema.mjs`）を満たし、`lang` と来歴が正しい
- 書き込む直前に、生成したファイルを読み戻して状態が `ok` になること

## 5. ローカルでの使い方

```bash
npm run i18n:check                                    # 検査のみ（API キー不要）
npm run i18n:translate -- --dry-run                   # 何をするかだけ表示（API も書き込みもしない）
node --env-file=.env scripts/i18n/translate-content.mjs --write --only blog/<slug>   # 1 記事だけ翻訳
node scripts/i18n/translate-content.mjs --adopt --collections cases,news             # 既存翻訳を採用（API 不要）
node scripts/i18n/translate-content.mjs --check --since origin/develop               # develop からの差分の記事だけ検査
```

- `npm run i18n:translate` は `.env` を自動では読みません。ローカルで翻訳するときは `node --env-file=.env ...` で起動するか、シェルで `GEMINI_API_KEY` を設定してください。
- オプション: `--collections blog,cases,news` / `--langs en,zh,ko,es` / `--only <slug>` または `<collection>/<slug>`（カンマ区切り）/ `--since <git-ref>`（`--only` と併用不可）/ `--retranslate-untracked` / `--prune-untracked`（来歴の無い orphan も削除）/ `--dry-run` / `--root <dir>`。

| 環境変数 | 必須 | 既定値 | 意味 |
|---|---|---|---|
| `GEMINI_API_KEY` | `--write` で翻訳が必要なときのみ | なし | Gemini API キー |
| `GEMINI_MODEL` | いいえ | `gemini-3.8-flash` | モデル ID（例: コスト重視なら `gemini-3.5-flash-lite`） |
| `GEMINI_THINKING_LEVEL` | いいえ | `LOW` | `MINIMAL` / `LOW` / `MEDIUM` / `HIGH` / `NONE`（`NONE` は thinkingConfig を送らない。2.5 系など thinkingLevel 非対応モデル用） |
| `I18N_RPM` | いいえ | `10` | 1 分あたりのリクエスト上限（1〜600） |
| `I18N_CONCURRENCY` | いいえ | `2` | 同時翻訳数（1〜2） |
| `I18N_MAX_API_ATTEMPTS` | いいえ | `5` | 429 / 5xx / ネットワーク失敗時の試行回数（指数バックオフ、`retryDelay` も尊重） |
| `I18N_MAX_VALIDATION_ATTEMPTS` | いいえ | `2` | 検証に落ちたときの再生成を含む試行回数 |
| `I18N_REQUEST_TIMEOUT_MS` | いいえ | `180000` | 1 リクエストのタイムアウト |
| `I18N_MAX_PRUNE_RATIO` | いいえ | `0.25` | orphan を 1 回で削除してよい割合（コレクションの翻訳ファイル数に対して。0 より大きく 1 以下。最低でも記事 1 本分は許可） |

モデル ID の根拠: <https://ai.google.dev/gemini-api/docs/models>（2026-09-27 確認）。`gemini-3.8-flash` は Stable の最新 Flash で、新規プロジェクトには「3.5 Flash-Lite or 3.8 Flash」が推奨されています（2.5 系は既存ユーザー限定）。公開記事なので品質優先で 3.8 Flash を既定にしています。

## 6. CI（`.github/workflows/translate-content.yml`）

### pull_request（`src/content/**`・`scripts/i18n/**`・このワークフローを変更した PR）

1. **translate**（GEMINI_API_KEY があり、同一リポジトリの PR で、head が develop / main / master でないとき）
   - `--write --since <base>` で **PR で変更された記事だけ**を翻訳・同期・削除（削除は PR で ja を削除した記事の、来歴つき翻訳だけ）
   - 変更が `src/content/<collection>/{en,zh,ko,es}/*.md` だけであることを確かめてから、`github-actions[bot]` 名義でコミットし PR の head ブランチへ push
   - 一部の記事が失敗しても成功分は push し、最後にジョブを失敗させる
2. **i18n-check**（translate の後）
   - translate が翻訳コミットを push した場合: この実行の SHA はもう PR の HEAD ではないので、新しい HEAD 側の実行に検査を委ねて成功で終わる
   - push しなかった場合（キー未設定・fork・翻訳不要・失敗）: `scripts/i18n` の単体テストと `--check --since <base>` を実行

push に使うトークン:

| 方式 | 条件 | 翻訳コミット後の CI | 追加操作 |
|---|---|---|---|
| **TRANSLATION_BOT_TOKEN（推奨）** | secret が登録されている | 通常の `synchronize` で全 CI（required check 含む）が自動で再実行 | なし |
| GITHUB_TOKEN（フォールバック） | secret が無い | PR の各チェックは GitHub の仕様で「承認待ち」になる。i18n-check だけは `workflow_dispatch`（mode=check）で即時に再実行 | 書き込み権限者が PR の Checks で「Approve workflows to run」を 1 回押す |

根拠: GitHub Docs「Triggering a workflow from a workflow」— GITHUB_TOKEN による PR 更新で作られる `pull_request` の実行は approval-required になり、`workflow_dispatch` / `repository_dispatch` は例外として実行される（2026-09-27 確認）。

### workflow_dispatch（Actions タブ → Translate content (i18n) → Run workflow、または `gh workflow run`）

本ワークフローが既定ブランチ（main）に入ってから使えます（GitHub の仕様）。

| 入力 | 必須 | 既定値 | 意味 |
|---|---|---|---|
| `mode` | はい | `translate` | `translate` = 翻訳して `chore/i18n-backfill-<YYYYMMDD>` を push / `adopt` = 既存翻訳を採用して `chore/i18n-adopt-<YYYYMMDD>` を push / `check` = 検査のみ |
| `collections` | いいえ | 空（全部） | `blog,cases,news` のカンマ区切り |
| `langs` | いいえ | 空（全部） | `en,zh,ko,es` のカンマ区切り |
| `only` | いいえ | 空（全記事） | `slug` または `collection/slug` のカンマ区切り |
| `retranslate_untracked` | いいえ | `false` | `untracked` も再翻訳する（mode=translate のみ） |
| `since` | いいえ | 空 | 自動再実行用。通常は空のまま |

ブランチ名が同日に既に存在する場合は `-<run_id>` が付きます。PR は Actions では作れない設定（`can_approve_pull_request_reviews: false`）なので、ジョブの Summary に出る compare URL から人が PR を作成してください。

### ブランチ保護との関係

- `i18n-check` は `paths` フィルタ付きなので **required check にしないでください**（コンテンツを変更しない PR では実行されず、永久に pending になります）。赤表示で気づけるようにしています。
- 2026-09-27 時点の実測（`gh api .../branches/<b>/protection`）: develop は保護なし、main の required checks は `build_and_deploy` / `Chromium visual text audit` / `guard` / `h5-admission`。

## 7. CEO が行う設定

| 項目 | 現在値（2026-09-27 `gh secret list` / `gh variable list` 実測） | 設定する値 | コマンド |
|---|---|---|---|
| secret `GEMINI_API_KEY` | 未登録 | Google AI Studio（<https://aistudio.google.com/apikey>）で発行した API キー | `gh secret set GEMINI_API_KEY -R Cor-Incorporated/corsweb2024`（実行後にキーを貼り付けて Enter。チャット等には貼らない） |
| secret `TRANSLATION_BOT_TOKEN`（任意・推奨） | 未登録 | fine-grained PAT: Repository access = `Cor-Incorporated/corsweb2024` のみ、Permissions = Contents: Read and write（Metadata: Read は自動）。有効期限を設定し、期限前に再発行 | `gh secret set TRANSLATION_BOT_TOKEN -R Cor-Incorporated/corsweb2024` |
| variable `GEMINI_MODEL`（任意） | 未設定（既定 `gemini-3.8-flash` を使用） | 変える場合のみ。例: `gemini-3.5-flash-lite` | `gh variable set GEMINI_MODEL -R Cor-Incorporated/corsweb2024 --body gemini-3.5-flash-lite` |

- 設定後の確認: `gh secret list -R Cor-Incorporated/corsweb2024 | grep -E 'GEMINI_API_KEY|TRANSLATION_BOT_TOKEN'`
- PAT の代わりに GitHub App のインストールトークンを使う場合は、`actions/create-github-app-token` で発行したトークンを translate ジョブの push に渡す形に変更します（App の権限は Contents: Read and write のみ）。
- PAT は発行者本人の権限で push されます（コミットの作者は `github-actions[bot]`）。退職・権限変更で失効するため、長期運用では GitHub App を推奨します。

## 8. 初回移行（既存の翻訳 72 件 + 未翻訳 40 件）

2026-09-27 時点の `npm run i18n:check`: `missing=40`（blog 10 本 × 4 言語）、`untracked=72`（blog 10 本・cases 6 本・news 2 本 × 4 言語）。

1. このブランチを develop → main までマージする（workflow_dispatch は main にワークフローが必要）
2. 既存翻訳の扱いを決める
   - そのまま採用する（推奨: cases / news は人手で整えた訳、blog の既存訳も ja より新しい日付で作成済み）:
     `gh workflow run translate-content.yml -R Cor-Incorporated/corsweb2024 --ref develop -f mode=adopt`
     → `chore/i18n-adopt-<日付>` が push されるので、PR を作ってマージ。マージ後の `npm run i18n:check` は `missing=40` だけになる
   - 訳し直す: 手順 4 で `-f retranslate_untracked=true`（例: blog だけなら `-f collections=blog` も付ける）
3. `GEMINI_API_KEY` を登録する（7 章）
4. バックフィル: `gh workflow run translate-content.yml -R Cor-Incorporated/corsweb2024 --ref develop -f mode=translate`
   → `chore/i18n-backfill-<日付>` が push されるので、PR を作成。PR 上で i18n-check が緑になることを確認してマージ
5. 以後は ja を編集した PR ごとに自動で翻訳が積まれる

費用の目安（推定・未検証）: 未翻訳 40 件は ja 約 2.8 万字 × 4 言語で、`gemini-3.8-flash`（2026-12-31 まで入力 $0.75 / 出力 $3.75 per 1M tokens）なら 1〜2 ドル程度、全 112 件を訳し直しても数ドル程度。料金の根拠: <https://ai.google.dev/gemini-api/docs/pricing>（2026-09-27 確認）。

## 9. 失敗時の対処

| 症状（ログの文言） | 原因 | 対処 |
|---|---|---|
| `GEMINI_API_KEY が未設定です` / translate ジョブが `GEMINI_API_KEY が未設定のため自動翻訳をスキップ` | secret が無い | 7 章の手順で登録 |
| `プレースホルダ ⟦B3⟧ が欠落しています`（または `⟦P..⟧`） | モデルがコード・URL 等の保護部分を落とした | 自動で 1 回再生成済み。PR に空コミットを push して再実行、それでも駄目なら ja の該当箇所（長い表・入れ子の多いリスト等）を見直す |
| `見出し H2 の数が一致しません` / `表の行数が一致しません` / `画像の数が一致しません` | 翻訳で Markdown の構造が変わった | 同上（再実行）。繰り返すなら記事を分割する |
| `段落などのブロック数が一致しません` / `リスト項目の数が一致しません` | 翻訳で段落・リスト項目が落ちた、または段落が結合・分割された | 同上（再実行）。繰り返すなら、ja 側で空行の入れ方（段落の区切り）を見直す |
| `コードブロック #1 の内容が ja と一致しません` | 保護したはずのコードが変わった（通常起きない） | ログを添えて開発者に連絡 |
| `日本語が残っています（割合 0.xx）` | モデルが訳さずに返した | 再実行。固有名詞が大半を占める短い記事なら開発者に相談 |
| `生成が途中で止まりました（finishReason=MAX_TOKENS）` | 記事が長すぎる | 記事を分割する |
| `finishReason=SAFETY` など | 安全フィルタで止まった | 表現を見直すか、その言語だけ手で翻訳して `--adopt` で採用 |
| ログに `429` / `RESOURCE_EXHAUSTED` の再試行が続く | レート上限・日次上限 | 自動で指数バックオフ。日次上限なら翌日に再実行、`I18N_RPM` を下げる、または課金ティアを上げる |
| `404` / `models/... is not found` | `GEMINI_MODEL` の ID 誤り・提供終了 | 5 章の根拠 URL で現行 ID を確認し、variable を直す |
| `[untracked]` が出る | 来歴の無い既存翻訳 | `--adopt`（採用）か `--retranslate-untracked`（再翻訳） |
| `[meta-drift]` | ja の `featured` 等を変えた | PR なら translate ジョブが自動同期。ローカルは `npm run i18n:translate` |
| `[orphan]` | ja を削除・改名した | PR なら translate ジョブが翻訳を削除する（来歴つきの翻訳のみ） |
| `ja が無いのに翻訳があり、ja の削除が差分にありません` | PR で翻訳（en 等）だけを追加した | ja を追加するか、その翻訳ファイルを PR から削除する |
| `来歴のない翻訳は自動では削除しません` | ja を削除・改名したが、翻訳は旧来のもの | 削除してよければ手元で `npm run i18n:translate -- --prune-untracked`、または翻訳ファイルを PR で `git rm` する |
| `削除が多すぎるため中止しました（blog: N 件 / 翻訳 M 件、上限 K 件）` | 1 回の削除が上限を超えた | 意図した削除なら `I18N_MAX_PRUNE_RATIO=1 npm run i18n:translate` のように上限を上げて手元で実行する |
| `[source-error]` | ja の frontmatter が壊れている | ja を直す（`npm run build` でも同じ箇所が落ちる） |
| `ja ディレクトリが空のため削除を中止しました（安全装置）` | ja が 1 本も無いのに翻訳だけある | 意図した削除なら翻訳ファイルを手で削除する |
| `翻訳ディレクトリ以外が変更されたため push しません` | スクリプトが想定外のファイルを変更した | バグ。ログを添えて開発者に連絡（何も push されていない） |
| `自己検査に失敗しました` | 書き込み内容と判定ロジックの食い違い | バグ。開発者に連絡（何も書き込まれていない） |
| 翻訳コミット後、PR のチェックが「承認待ち」 | GITHUB_TOKEN 方式 | PR の Checks で「Approve workflows to run」を押す。恒久対応は `TRANSLATION_BOT_TOKEN` の登録 |
| `i18n-check の再実行を起動できませんでした` | ワークフローがまだ main に無い（workflow_dispatch 不可） | main 反映後は自動で解消。それまでは承認で代替 |
| `--only に該当する記事がありません: blog/xxx` | slug の打ち間違い、または `--collections` / `--langs` と矛盾 | `ls src/content/<collection>/ja` でファイル名（拡張子なし）を確認 |
| `--only と --since は同時に指定できません` など | 引数の誤り | `--help` を参照 |

## 10. 既知の制約

- コードブロック内のコメントは訳しません（保護を優先）。HTML ブロック（`<details>` 等）の中身も訳しません。
- 機械翻訳の品質は人のレビューで担保します（PR の差分で確認）。対外表現ガードレール（ADR-0007）の機械検査は日本語向けのため、訳文での「主張の強まり」はプロンプトで禁止したうえで、人が確認してください。
- hreflang（翻訳の有無に応じた代替ページ指定）は別レーンで対応します。
- Sveltia CMS を導入する際は、コレクションのフォルダを `src/content/<collection>/ja` に限定してください（他言語は CI 専有）。
