# ADR-0024 サービスのページを作り、ヘッダーの「サービス」を説明のページへ向ける

## ステータス: Proposed (2026-10-26)

ADR-0011 の「サービス導線」（ヘッダーのサービスから intent 付きの /contact へ直行する）を置き換える。ヘッダーの並び（ADR-0011 の「Header IA の改訂」、2026-10-24）は変えない。

## 背景

- ヘッダーの「サービス」は、Grift 以外の 3 つ（機密データAI活用診断、ローカルLLM / セキュアAI PoC、AI基盤構築・AI受託）が、intent 付きの /contact（Cloudia）へ直行していた。`Header.astro` のコメントは「LP 未整備のため」だった。代表の指摘（2026-10-26。取りまとめは #421 の作業 C）。
- 読み手（エンジニアではない決裁者）は、何をしてもらえるのか、どう進むのかを読む前に、チャットへ送られていた。
- 診断と PoC の進め方は、実績の一覧の中（`/works/confidential-data-ai-assessment`、`/works/local-llm-poc`）にあった。AI受託開発の説明は、トップの事業の柱の短い文だけだった。

## 決定

### 1. 3 つのページを 5 言語で作る

| サービス | ja の URL | ほかの言語 | 最後の CTA の intent |
|---|---|---|---|
| 機密データAI活用診断 | `/services/confidential-ai-assessment/` | `/<lang>/services/confidential-ai-assessment/` | `confidential-ai-assessment` |
| ローカルLLM / セキュアAI PoC | `/services/local-llm-poc/` | `/<lang>/services/local-llm-poc/` | `local-llm-poc` |
| AI基盤構築・AI受託 | `/services/ai-development/` | `/<lang>/services/ai-development/` | `contract-dev` |

- 正本は `src/config/services.ts`（slug・intent・関係する実績）。ヘッダー、フッター、トップの事業の柱、OG 画像、`/llms.txt` はここを読む。
- ページ名は locale の `nav.<key>`、title と description は `meta.<key>`、本文は `servicePages.<key>` に置く（key は `serviceAssessment` / `serviceLocalLlm` / `serviceAiDev`）。本体の部品は `src/components/services/ServiceBody.astro` の 1 つ。
- `/services/` の一覧のページは作らない。入口はヘッダーのプルダウン、フッター、トップの事業の柱。

### 2. ページの流れ

物語の背骨（`docs/story-spine.md`）の場面 2 → 3 → 4 → 5 を、サービスごとの言葉で受け持つ。

1. 読み手が止まっているところ（「こんなところで、止まっていませんか。」）
2. 進め方
3. 手元に残るもの・そのあと（診断と PoC だけ。AI受託はサイトに書いた事実がないので作らない）
4. 費用
5. 関係する実績・事例、業種別ページ、ほかのサービス
6. 最後に 1 か所だけ、相談の CTA。見出しは背骨の締めの一文「まずは、扱う情報を確かめるところから。」

### 3. 相談は最後の CTA から Cloudia へ

- CTA は intent 付きの `/contact`（Cloudia）へつなぐ。`source` は `service-<slug>`（contact-chat の上限 100 文字に収まる）。
- intent のキーは ADR-0014 の 7 キーのまま。改名しない。

### 4. 本文はサイトにすでに載せている事実だけで書く

- 出どころは、実績の 2 ページ（診断・PoC の進め方）、FAQ、事業の柱（`services2026`）、トップの課題の欄（`homeChallenges`）、業種別ページ、セキュリティ方針。
- 価格、成果の数字、取引先の名前を新しく作らない（ADR-0007・ADR-0022）。

### 5. 価格はこのページに載せない（判断待ち）

- 診断の目安（10万〜30万円程度）と PoC の目安（3ヶ月300万円〜）は、FAQ、トップの実証の欄、実績の 2 ページ、`/llms.txt` にすでに出ている。サービスのページにも載せるかどうかは代表が決める。
- それまでは、業種別ページと同じ文（「費用は課題や内容により変わります。…正式な金額・納期は要件確認後に確定します。」）を置く。`src/config/__tests__/services.test.ts` が、サービスのページの文言に価格の書き方（通貨の記号、数字のあとの「円」など）があれば落とす。載せると決めたら、この項とテストを一緒に改める。

### 6. 専門用語は名前を変えず、平易な説明を添える

- ローカルLLM、セキュアAI、クラウドAI、PoC、RAG、AIエージェントは、各ページの「このページで使う言葉」で言い換える。言い換えはサイトにある説明から取る（例: ローカルLLM＝社外にデータを出さずに手元の環境で動かす生成AI）。
- 専門用語を「足切り」として残すかどうかは代表の判断待ち（凪沙さんのレビュー、#421 の作業 A）。この ADR では決めない。ヘッダーのサービス名も変えない。

### 7. 入口

- ヘッダー: サービス ▾ の中身を、3 つのページと Grift（griftai.org。変えない）にする。説明のページになったので、サービスのページを開いているときはプルダウンを現在地として光らせる。スマホのメニューも同じ。
- フッター: 「サービス」の列を足す。
- トップの事業の柱の欄: 「ローカルLLM・セキュアAI」を PoC のページへ（カードの中に診断のページへのリンク）、「AI受託開発・導入支援」を AI基盤構築・AI受託のページへ向ける。

### 8. 構造化データ・OG・llms.txt・sitemap

- 各ページに `Service`（name・description・url。provider は Organization の `@id`）を出す。価格を表示していないので `offers` は付けない（ADR-0017: 表示している内容だけを構造化データにする）。
- OG 画像は `/og/page/service-<slug>.png`（ほかのページと同じく ja の文言）。
- `/llms.txt` に「サービス」の節を足す（ページ名と description は ja の locale から作る）。
- sitemap は `config/indexing.ts` の判定どおり自動で載る。

## 理由

- 決裁者は、相談する前に中身と進め方を確かめたい。読む前にチャットへ送ると、相談の質も件数も落ちる。
- 1 つの正本と 1 つの部品にすると、ヘッダー、フッター、トップ、OG、llms.txt、構造化データのあいだで、URL と intent が食い違わない。
- サイトにある事実だけで書けば、新しいページが ADR-0007 の証拠のルールを破らない。

## 影響

- トップの「目的に合わせてご相談ください」（`ServiceCtas`）とヒーローの CTA は、読み終えた人が相談する入口なので、intent 付きの /contact のまま残す（トップの文は #414 が書き直している）。
- 実績の 2 ページ（診断・PoC の進め方）は残し、サービスのページから「関係する実績・事例」としてつなぐ。中身が重なるので、まとめるかどうかは別に決める。
- 非日本語の UI 文言は手で訳す（ADR-0022 の影響の節と同じ。コンテンツの翻訳 CI は locale を触らない）。
- 検査: `src/config/__tests__/services.test.ts`（正本と 5 言語の文言）、`tests/build-output/service-pages.test.ts`（ビルド結果のページ・CTA・ヘッダー・スマホのメニュー・フッター・トップ・sitemap・llms.txt・OG）。

## 代替案

- **ヘッダーから /contact へ直行のまま**: 代表の指摘のとおり、読んでから相談できないため却下。
- **実績の 2 ページをサービスのページとして使う**: AI受託のページがなく、実績の一覧に「サービスの説明」が混ざったままになるため却下。
- **業種別ページのように、サービスごとに別の部品を作る**: 同じ作りが 3 つになるため、1 つの部品と locale の文言にした。

## 参照

- ADR-0007 / ADR-0010 / ADR-0011 / ADR-0013 / ADR-0014 / ADR-0017 / ADR-0022
- `docs/story-spine.md`
- 取りまとめの Issue: #421（作業 C）。この ADR の Issue: #424
