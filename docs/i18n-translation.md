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
translate ジョブ … PR で変わった記事だけを翻訳 → 検証 → 変更をパッチにする（書き込み権限なし）
   │
   ▼
push ジョブ … パッチの変更先を検査してから、bot コミットとして PR に追加（コードは実行しない）
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
| `untracked` | 翻訳はあるが `translationSourceHash` が無い（この仕組み以前の翻訳） | 問題 | **触らない**（`--adopt` で採用 / `--retranslate-untracked` で再翻訳）。`--since` の差分で ja を変更した記事は `--adopt` を拒否し、`--write --retranslate-untracked --only <collection>/<slug>` を案内する（古い訳を最新として確定させない） |
| `meta-drift` | ハッシュは一致するが、コピー対象（`pubDate` `featured` 等）や `lang` がずれている | 問題 | API なしで ja から同期 |
| `orphan` | ja が無い翻訳（ja を削除・改名した、または翻訳だけを追加した） | 問題 | 下の条件をすべて満たすものだけ削除。満たさないものは削除せず失敗として報告 |
| `invalid` | 翻訳ファイルの frontmatter が壊れている、またはスキーマ違反（必須の `title` が無い・来歴の形が不正など。ハッシュが一致していても） | 問題 | 再翻訳して上書き |
| `source-error` | ja の frontmatter が壊れている、またはスキーマ違反（未知の `category`・必須フィールドの欠落など） | 問題 | 何もしない（ja を直す。API も呼ばない） |
| `ok` | 同期済み | — | 何もしない |

frontmatter は分類の時点で `src/content/config.ts` と同じ制約（Zod ミラー `scripts/i18n/schema.mjs`）で検証します（ja が不正なまま翻訳して API を使ったり、壊れた翻訳を `ok` と判定したりしないため）。

`--check` は 1 件でも問題があれば終了コード 1、`--write` は失敗・未処理が 1 件でもあれば終了コード 1、引数や設定の誤りは終了コード 2 です。

`orphan` を削除する条件（人が書いた翻訳や、ja の改名だけで消える事故を防ぐため）:

1. `--since`（PR の差分）で実行したときは、その差分で **ja の削除が確認できた**記事だけ。PR で en などの翻訳だけを追加した記事は消さない
2. 来歴（`translationSourceHash`）の無い翻訳は、`--prune-untracked` を明示したときだけ
3. 1 回に消す件数がコレクションの翻訳ファイル数 × `I18N_MAX_PRUNE_RATIO`（既定 0.25。最低でも記事 1 本分）以下で、ja ディレクトリが空でないこと。超えたらそのコレクションでは 1 件も消さない

## 4. 翻訳で守るもの（保護）と検証

API に送る前に、訳してはいけない部分をプレースホルダ（`⟦B3⟧` / `⟦P12⟧` / `⟦N0⟧`）に置き換え、翻訳後に元へ戻します。

- ブロック: フェンスコード（```` ``` ```` / `~~~`、コメントも訳さない）、`$$` 数式、HTML ブロック・コメント、URL だけの行（リンクカード）、参照リンク定義
- インライン: インラインコード、`$...$` 数式、`<https://...>`、インライン HTML、リンクと画像の**宛先**（リンクテキスト・alt・`"title"` は訳す。例: `![説明](/img.avif "タイトル")` はパスだけを保護）、脚注、`{#id}`、本文中の URL
- 社名: 「Cor.株式会社」とその表記ゆれ（「Cor.inc」「Cor.Inc.」「Cor. Inc.」「株式会社Cor.」「コー株式会社」など。ja の本文と frontmatter の両方）を `⟦N0⟧` にしてモデルに渡さず、翻訳後に**翻訳先言語の正式表記**に置き換える。モデルが自分で書いた表記ゆれ（「Cor.」を「Cor. Inc.」に広げた等）も正式表記にそろえる。「Cor.」単独（ブランド名）、コード・URL の中（例: `@Cor.Incorporated`）はそのまま

| 言語 | ja / zh | ko | en / es |
|---|---|---|---|
| 正式表記（ADR-0007） | `Cor.株式会社` | `Cor.주식회사` | `Cor.Inc.` |

用語集は [`scripts/i18n/glossary.mjs`](../scripts/i18n/glossary.mjs)。正本は `src/config/organization.ts` の `ORGANIZATION_NAMES`（PR #335）で、同じ値にしてあります（#335 のマージ後に両者を照合するテストを追加予定）。

title と本文の見出しの一致: ja で frontmatter の `title` と本文の最初の `# ` 見出し（H1）が同じ文言なら、訳文の H1 を訳した `title` に置き換えます（モデルは両者を別々に訳すため、同じ文言でも訳が割れることがあるため。PR #344 の実 API 検証で en / zh / ko に発生）。

翻訳結果は次をすべて満たしたときだけ書き込みます（1 回だけ自動で再生成し、それでも駄目なら書かずに失敗を報告）。

- プレースホルダ（社名の `⟦N…⟧` を含む。frontmatter はフィールドごと）が全部・1 回ずつ・壊れずに残っている／ブロックは単独行のまま
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
| `I18N_MAX_ITEMS` | いいえ | `20` | 1 回の `--write` で API 翻訳する件数（記事 × 言語）の上限（1〜10000）。超えたら何も変更せずに失敗する。全記事のバックフィル（workflow_dispatch）ではワークフローが引き上げる |
| `I18N_MAX_PRUNE_RATIO` | いいえ | `0.25` | orphan を 1 回で削除してよい割合（コレクションの翻訳ファイル数に対して。0 より大きく 1 以下。最低でも記事 1 本分は許可） |

モデル ID の根拠: <https://ai.google.dev/gemini-api/docs/models>（2026-09-27 確認）。`gemini-3.8-flash` は Stable の最新 Flash で、新規プロジェクトには「3.5 Flash-Lite or 3.8 Flash」が推奨されています（2.5 系は既存ユーザー限定）。公開記事なので品質優先で 3.8 Flash を既定にしています。

## 6. CI（`.github/workflows/translate-content.yml`）

### ジョブと権限（信頼境界）

書き込みトークンと、信頼しないコード（PR の `scripts/i18n` と npm 依存）を同じジョブに置きません。翻訳の結果は、書き込み権限のないジョブからパッチ（`git diff --binary`）として受け渡します。

| ジョブ | 権限 | 実行するもの | 渡す秘密情報 |
|---|---|---|---|
| `translate` | contents: read | `npm ci --ignore-scripts`（npm キャッシュなし）→ `translate-content.mjs` → 変更をパッチにして artifact（保存 1 日）へ | `GEMINI_API_KEY` |
| `push` | contents: write | パッチの検査 → `git apply` → hooks を無効にして commit / push。npm もリポジトリのコードも実行しない | `TRANSLATION_BOT_TOKEN`（登録したときだけ） |
| `dispatch-check` | actions: write | GITHUB_TOKEN で push したとき、i18n-check を workflow_dispatch で再実行する（checkout もしない） | なし |
| `translate-result` | なし | 翻訳・同期・削除の一部が失敗したとき赤にする（成功分は push 済み） | なし |
| `i18n-check` | contents: read | `scripts/i18n` の単体テストと `--check` | なし |

push ジョブがパッチを適用する条件（1 つでも外れたら何も適用・push しない）:

- 変更パスがすべて `src/content/<collection>/{en,zh,ko,es}/<slug>.md`（ワークフローの `ALLOWED_CHANGE_RE`。`scripts/i18n/config.mjs` と一致することをテストで照合）
- 通常ファイル（mode 100644）の変更・作成・削除だけ（シンボリックリンク・実行権限・改名・バイナリは拒否）。パッチは改名を検出しない形（`--no-renames`）で作るので、ja の改名に伴う「旧 slug の翻訳の削除＋新 slug の追加」はそのまま通る
- 削除は翻訳ファイル数 × 25%（最低 4 件）まで（`MAX_DELETE_PERCENT` / `MIN_DELETE_ALLOWANCE`。翻訳スクリプトの既定値と同じことをテストで照合）
- パッチが 5 MB 以下で、そのまま当たる（`git apply --check`）
- 適用した後、実際に stage された内容を 1 行ずつ照合する（`git diff --cached --raw --no-renames`）: 状態は追加・変更・削除だけ、モードは 100644 だけ、パスは上と同じ。保護パスからの改名は「保護パスの削除」として拒否し、既存のシンボリックリンクの中身の差し替えも拒否する
- 追加・変更した `.md` の 1 行目が厳密に `---`（Astro が使う gray-matter は `---js` の frontmatter を JavaScript として評価するため）

残るリスク: translate ジョブは PR head のコードを `GEMINI_API_KEY` 付きで実行します（同一リポジトリの PR だけ。fork の PR には secrets が渡りません）。また、リポジトリへの書き込み権限を持つ人は、PR でワークフローを書き換えれば secrets を読み出せます（GitHub の仕様）。キーが漏れた疑いがあれば Google AI Studio でキーを削除し、再発行して secret を登録し直してください。

### pull_request（`src/content/**`・`scripts/i18n/**`・このワークフローを変更した PR）

1. **translate**（`GEMINI_API_KEY` があり、同一リポジトリの PR で、head が develop / main / master でないとき）
   - `--write --since <base>` で **PR で変更された記事だけ**を翻訳・同期・削除（削除は PR で ja を削除した記事の、来歴つき翻訳だけ。1 回あたり `I18N_MAX_ITEMS=20` 件まで）
   - 一部の記事が失敗しても成功分はパッチに含め、終了コードを translate-result に渡す
2. **push**（パッチがあるとき）: 上の条件で検査して適用し、`github-actions[bot]` 名義でコミットして PR の head ブランチへ push（PR に新しいコミットが積まれていた場合は push せず、新しいコミットの実行に任せる）
3. **dispatch-check**（GITHUB_TOKEN で push したとき）: i18n-check を新しいコミットに対して workflow_dispatch で再実行
4. **translate-result**（一部が失敗したとき）: 赤にして知らせる
5. **i18n-check**
   - push した場合: この実行の SHA はもう PR の HEAD ではないので、新しい HEAD 側の実行に検査を委ねて成功で終わる
   - push しなかった場合（キー未設定・fork・翻訳不要・失敗）: `scripts/i18n` の単体テストと `--check --since <base>` を実行

push に使うトークン（既定は GITHUB_TOKEN）:

| 方式 | 条件 | 翻訳コミット後の CI | 追加操作 | リスク |
|---|---|---|---|---|
| **GITHUB_TOKEN（既定）** | `TRANSLATION_BOT_TOKEN` が無い | PR の各チェックは「承認待ち」（`action_required`）になる（**実測**: PR #344 の翻訳コミット後の実行 run 36329708078）。i18n-check だけは dispatch-check が即時に再実行する（実測: run 36329711063） | 書き込み権限者が PR の Checks で「Approve workflows to run」を押す。ボタンが出ない・押しても動かない場合は、人が空コミットを push して CI を起動する（下の手順） | 小さい: そのジョブの間だけ有効で、このリポジトリの宣言した権限（contents: write）に限られる |
| TRANSLATION_BOT_TOKEN（任意） | secret が登録されている | 通常の `synchronize` として全 CI（required check 含む）が自動で再実行 | なし | 大きい: fine-grained PAT は有効期限まで、発行者の権限で使える（漏れると他のブランチへの push にも使える）。push ジョブ以外には渡さないが、書き込み権限者は PR でワークフローを変えれば読み出せる。使う場合は対象リポジトリをこの 1 つ・権限を Contents だけ・有効期限を短くする |

承認ボタンが出ない場合の手順（空コミットで CI を起動する。PR のブランチで実行）:

```bash
git pull --rebase                      # bot の翻訳コミットを取り込む
git commit --allow-empty -m "chore: CI を再実行"
git push
```

根拠: GitHub Docs「Triggering a workflow from a workflow」— GITHUB_TOKEN による PR 更新で作られる `pull_request` の実行は approval-required になり、`workflow_dispatch` / `repository_dispatch` は例外として実行される（2026-09-27 確認）。本リポジトリでも、GITHUB_TOKEN で翻訳コミットを push した後の `pull_request` の実行（run 36329708078）が `action_required` になることを 2026-09-27 に確認した。

### workflow_dispatch（Actions タブ → Translate content (i18n) → Run workflow、または `gh workflow run`）

本ワークフローが既定ブランチ（main）に入ってから使えます（GitHub の仕様）。

| 入力 | 必須 | 既定値 | 意味 |
|---|---|---|---|
| `mode` | はい | `translate` | `translate` = 翻訳して `chore/i18n-backfill-<YYYYMMDD>` を push（`I18N_MAX_ITEMS=500`）/ `adopt` = 既存翻訳を採用して `chore/i18n-adopt-<YYYYMMDD>` を push / `check` = 検査のみ。translate / adopt も translate ジョブ（読み取りのみ）→ push ジョブ（検査して push）の 2 段で動く |
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
| secret `TRANSLATION_BOT_TOKEN`（任意。6 章のリスクを読んでから） | 未登録 | 登録しなくても動く（GITHUB_TOKEN で push）。翻訳コミット後の CI の承認操作を無くしたい場合だけ、fine-grained PAT: Repository access = `Cor-Incorporated/corsweb2024` のみ、Permissions = Contents: Read and write（Metadata: Read は自動）、有効期限は短く（例: 30 日）して期限前に再発行 | `gh secret set TRANSLATION_BOT_TOKEN -R Cor-Incorporated/corsweb2024` |
| variable `GEMINI_MODEL`（任意） | 未設定（既定 `gemini-3.8-flash` を使用） | 変える場合のみ。例: `gemini-3.5-flash-lite` | `gh variable set GEMINI_MODEL -R Cor-Incorporated/corsweb2024 --body gemini-3.5-flash-lite` |

- 設定後の確認: `gh secret list -R Cor-Incorporated/corsweb2024 | grep -E 'GEMINI_API_KEY|TRANSLATION_BOT_TOKEN'`
- PAT の代わりに GitHub App のインストールトークンを使う場合は、`actions/create-github-app-token` で発行したトークンを push ジョブだけに渡す形に変更します（App の権限は Contents: Read and write のみ。translate ジョブには渡さない）。
- PAT は発行者本人の権限で push されます（コミットの作者は `github-actions[bot]`）。退職・権限変更で失効するため、長期運用するなら PAT より GitHub App が適しています。

## 8. 初回移行（既存の翻訳 68 件 + 未翻訳 40 件）

PR #339 の時点の `npm run i18n:check`: `missing=40`（blog 10 本 × 4 言語）、`untracked=68`（blog 9 本・cases 6 本・news 2 本 × 4 言語）、`ok=4`（`blog/complete-multilingual-blog-expansion` は、リンクの修正と同時に PR #339 で採用済み）。

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

手順 2 の採用（adopt）は、既存翻訳のある記事の ja を編集する PR より先に済ませてください。採用前に ja を変更した記事は、古い訳を最新として確定させないよう採用を拒否し、再翻訳を案内します。

費用の目安（推定・未検証）: 未翻訳 40 件は ja 約 2.8 万字 × 4 言語で、`gemini-3.8-flash`（2026-12-31 まで入力 $0.75 / 出力 $3.75 per 1M tokens）なら 1〜2 ドル程度、全 112 件を訳し直しても数ドル程度。料金の根拠: <https://ai.google.dev/gemini-api/docs/pricing>（2026-09-27 確認）。

## 9. 失敗時の対処

| 症状（ログの文言） | 原因 | 対処 |
|---|---|---|
| `GEMINI_API_KEY が未設定です` / translate ジョブが `GEMINI_API_KEY が未設定のため自動翻訳をスキップ` | secret が無い | 7 章の手順で登録 |
| `プレースホルダ ⟦B3⟧ が欠落しています`（または `⟦P..⟧` / 社名の `⟦N..⟧`） | モデルがコード・URL 等の保護部分を落とした | 自動で 1 回再生成済み。PR に空コミットを push して再実行、それでも駄目なら ja の該当箇所（長い表・入れ子の多いリスト等）を見直す |
| `見出し H2 の数が一致しません` / `表の行数が一致しません` / `画像の数が一致しません` | 翻訳で Markdown の構造が変わった | 同上（再実行）。繰り返すなら記事を分割する |
| `見出し（H1）をタイトルにそろえると構造が ja と一致しません` | ja の `title` にコードなどのマークダウン記法があり、訳した `title` でそれが変わった | ja の `title` からマークダウン記法を外す（`title` はページのタイトルとして文字のまま表示されるので、記法は不要） |
| `段落などのブロック数が一致しません` / `リスト項目の数が一致しません` | 翻訳で段落・リスト項目が落ちた、または段落が結合・分割された | 同上（再実行）。繰り返すなら、ja 側で空行の入れ方（段落の区切り）を見直す |
| `コードブロック #1 の内容が ja と一致しません` | 保護したはずのコードが変わった（通常起きない） | ログを添えて開発者に連絡 |
| `日本語が残っています（割合 0.xx）` | モデルが訳さずに返した | 再実行。固有名詞が大半を占める短い記事なら開発者に相談 |
| `生成が途中で止まりました（finishReason=MAX_TOKENS）` | 記事が長すぎる | 記事を分割する |
| `finishReason=SAFETY` など | 安全フィルタで止まった | 表現を見直すか、その言語だけ手で翻訳して `--adopt` で採用 |
| ログに `429` / `RESOURCE_EXHAUSTED` の再試行が続く | レート上限・日次上限 | 自動で指数バックオフ。日次上限なら翌日に再実行、`I18N_RPM` を下げる、または課金ティアを上げる |
| `404` / `models/... is not found` | `GEMINI_MODEL` の ID 誤り・提供終了 | 5 章の根拠 URL で現行 ID を確認し、variable を直す |
| `[untracked]` が出る | 来歴の無い既存翻訳 | 今の ja の訳なら `--adopt`（採用）、ja を変更した記事なら `--retranslate-untracked`（再翻訳） |
| `ja がこの差分で変更されているため、旧翻訳は採用できません` | 旧翻訳のある記事の ja を PR で変更した | 表示された `node scripts/i18n/translate-content.mjs --write --retranslate-untracked --only <collection>/<slug>` を手元で実行して PR に push する（`GEMINI_API_KEY` が必要） |
| `[meta-drift]` | ja の `featured` 等を変えた | PR なら translate ジョブが自動同期。ローカルは `npm run i18n:translate` |
| `[orphan]` | ja を削除・改名した | PR なら translate ジョブが翻訳を削除する（来歴つきの翻訳のみ） |
| `ja が無いのに翻訳があり、ja の削除が差分にありません` | PR で翻訳（en 等）だけを追加した | ja を追加するか、その翻訳ファイルを PR から削除する |
| `来歴のない翻訳は自動では削除しません` | ja を削除・改名したが、翻訳は旧来のもの | 削除してよければ手元で `npm run i18n:translate -- --prune-untracked`、または翻訳ファイルを PR で `git rm` する |
| `削除が多すぎるため中止しました（blog: N 件 / 翻訳 M 件、上限 K 件）` | 1 回の削除が上限を超えた | 意図した削除なら `I18N_MAX_PRUNE_RATIO=1 npm run i18n:translate` のように上限を上げて手元で実行する |
| `[source-error]` | ja の frontmatter が壊れている・スキーマ違反（行末の括弧内に違反箇所。例: `schema category: Invalid enum value`） | ja を直す（`npm run build` でも同じ箇所が落ちる）。直すまでその記事は翻訳しない |
| `[invalid]` | 翻訳の frontmatter が壊れている・スキーマ違反（手で編集して `title` を消した等） | `npm run i18n:translate` で再生成（PR なら translate ジョブが再生成） |
| `ja ディレクトリが空のため削除を中止しました（安全装置）` | ja が 1 本も無いのに翻訳だけある | 意図した削除なら翻訳ファイルを手で削除する |
| `許可されていない変更のため適用しません` / `許可されていない種類の変更のため適用しません` | 翻訳が翻訳ディレクトリ以外・ja を変えた、またはシンボリックリンク・実行権限を作った | バグか改ざんの疑い。ログを添えて開発者に連絡（何も push されていない） |
| `パッチが大きすぎるため適用しません` | 1 回の変更が 5 MB を超えた | 記事を分けて処理する |
| `削除が多すぎるため適用しません（N 件 / 翻訳 M 件、上限 K 件）`（push ジョブ） | 1 回で削除する翻訳ファイルが多すぎる | 意図した削除なら、翻訳ファイルを人が PR で `git rm` する |
| `許可されていない変更が stage されました` / `許可されていない種類の変更が stage されました` / `許可されていないパスが stage されました` / `frontmatter の 1 行目が --- ではありません` | 適用後の照合に落ちた（改名・シンボリックリンク・翻訳ディレクトリ以外・frontmatter の形式） | バグか改ざんの疑い。ログを添えて開発者に連絡（何も push されていない） |
| `push できませんでした` | 翻訳中に PR へ新しいコミットが積まれた | 新しいコミットの実行で処理し直されるので待つ |
| translate-result が赤（`一部の翻訳・同期・削除が失敗または検証に通らず`） | 一部の記事が失敗した（成功分は push 済み） | translate ジョブの Translate ステップのログで記事と理由を確認し、上の各行に従う |
| `自己検査に失敗しました` | 書き込み内容と判定ロジックの食い違い | バグ。開発者に連絡（何も書き込まれていない） |
| 翻訳コミット後、PR のチェックが「承認待ち」 | GITHUB_TOKEN 方式 | PR の Checks で「Approve workflows to run」を押す。出ない・動かない場合は 6 章の空コミット手順。毎回の操作を無くしたい場合だけ、リスクを理解したうえで `TRANSLATION_BOT_TOKEN` を登録 |
| `i18n-check の再実行を起動できませんでした` | ワークフローがまだ main に無い（workflow_dispatch 不可） | main 反映後は自動で解消。それまでは承認で代替 |
| `翻訳が必要な件数 N 件が上限 20 件（I18N_MAX_ITEMS）を超えたため、何も変更せずに中止しました` | 1 つの PR・1 回の実行で翻訳する記事が多すぎる | 記事を分けて PR を出す。意図した一括翻訳なら workflow_dispatch の mode=translate（バックフィル）を使うか、手元で `I18N_MAX_ITEMS=100` のように上限を上げて実行 |
| `--only に該当する記事がありません: blog/xxx` | slug の打ち間違い、または `--collections` / `--langs` と矛盾 | `ls src/content/<collection>/ja` でファイル名（拡張子なし）を確認 |
| `--only と --since は同時に指定できません` など | 引数の誤り | `--help` を参照 |

## 10. 止め方と、日々の運用で気をつけること

### 止め方

| 止めたいもの | コマンド | 影響 | 再開 |
|---|---|---|---|
| ワークフロー全体（翻訳・push・i18n-check） | `gh workflow disable translate-content.yml -R Cor-Incorporated/corsweb2024` | PR で翻訳も検査も走らなくなる | `gh workflow enable translate-content.yml -R Cor-Incorporated/corsweb2024` |
| 翻訳（Gemini API の呼び出し）だけ | `gh secret delete GEMINI_API_KEY -R Cor-Incorporated/corsweb2024` | translate ジョブは「未設定のためスキップ」になり、i18n-check は動き続ける（翻訳の欠けは赤で見える） | 7 章の手順でキーを登録し直す |
| bot トークンでの push だけ | `gh secret delete TRANSLATION_BOT_TOKEN -R Cor-Incorporated/corsweb2024` | GITHUB_TOKEN での push に戻る（6 章の承認操作が必要になる） | 7 章の手順で登録し直す |
| 実行中の 1 回 | `gh run list --workflow translate-content.yml -R Cor-Incorporated/corsweb2024` で ID を確認し `gh run cancel <ID> -R Cor-Incorporated/corsweb2024` | その実行だけ止まる（push 前なら何も書かれない） | PR に push し直すと再実行される |

### bot が PR にコミットしたあと

translate / push ジョブは、あなたの PR ブランチに `github-actions[bot]` の翻訳コミットを追加します。手元でそのブランチの作業を続ける前に、必ず取り込んでください（取り込まずに push すると `non-fast-forward` で拒否されます）。

```bash
git pull --rebase
```

## 11. 既知の制約

- コードブロック内のコメントは訳しません（保護を優先）。HTML ブロック（`<details>` 等）の中身も訳しません。
- 参照リンクの定義行（`[ref]: https://... "title"`）は行ごと保護するため、その title は訳しません（本文中のインラインのリンク・画像の title は訳します）。
- 機械翻訳の品質は人のレビューで担保します（PR の差分で確認）。対外表現ガードレール（ADR-0007）の機械検査は日本語向けのため、訳文での「主張の強まり」はプロンプトで禁止したうえで、人が確認してください。
- この仕組みより前の翻訳（`untracked`、`--adopt` で採用したもの）は、社名が「Cor. Inc.」などの旧表記のまま残っています（2026-09-28 時点で en 7 件・es 4 件など）。再翻訳（`--retranslate-untracked`）するか手で直すまで変わりません。
- hreflang（翻訳の有無に応じた代替ページ指定）は別レーンで対応します。
- Sveltia CMS を導入する際は、コレクションのフォルダを `src/content/<collection>/ja` に限定してください（他言語は CI 専有）。
