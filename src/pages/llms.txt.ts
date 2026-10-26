import type { APIRoute } from 'astro';
import { GRIFT_CLI_RELEASE } from '../config/grift-cli';
import { GRIFT_CLI_GITHUB_URL, getGriftBaseUrl } from '../config/site';
import { SERVICE_PAGES, getServiceBasePath } from '../config/services';
import { getJaTranslations } from '../utils/i18n';

/**
 * llms.txt — 回答エンジン・LLM 向けのサイト要約（https://llmstxt.org/ の形式）。
 *
 * 会社の事実（事業の柱・所在地・設立・情報セキュリティの状況）と主要ページを Markdown で渡す。
 * 本文はページに表示している事実だけにする（ADR-0017・ADR-0022）。未確定の予定は「予定」「構想」と書き、
 * ISMS は登録前のため「取得済み」と書かない（ADR-0007）。内容を変えたら CONTENT_AS_OF も更新する。
 * Grift CLI の版は正本（src/config/grift-cli.ts、ADR-0023）から入れ、行に公開日を書く。版だけが変わったときは
 * CONTENT_AS_OF を変えない。
 */
const CONTENT_AS_OF = '2026-10-26';

export const GET: APIRoute = () => {
  const site = (import.meta.env.SITE || 'https://cor-jp.com').replace(/\/$/, '');
  const grift = getGriftBaseUrl();
  // サービスのページ（ADR-0024）。ページ名と説明は、ページの見出しと meta description と同じ ja の文言
  const ja = getJaTranslations();
  const serviceLines = SERVICE_PAGES.map(
    (page) => `- [${ja.nav[page.key]}](${site}${getServiceBasePath(page)}/): ${ja.meta[page.key].description}`,
  ).join('\n');
  const body = `# Cor.株式会社（Cor.Inc.）

> 福岡のAI実装会社。機密データを外に出さないローカルLLM、確かめられる根拠をつくる自社プロダクト「Grift」、設計から運用までの受託開発を軸に、教育や地域での場づくりにも取り組んでいる。必要なら「まだ作らない」選択肢も提案する。

Cor.株式会社（読み: コー株式会社、英文表記: Cor.Inc.）は福岡市に本社を置くAI実装会社。メイン見出しは「AIを、安心して使える形で現場へ。」。情報は${CONTENT_AS_OF}時点。

## 会社概要

- 社名: Cor.株式会社（Cor.Inc.）
- 設立: 2023年12月
- 代表者: 代表取締役 寺田 康佑
- 所在地: 〒810-0001 福岡県福岡市中央区天神2丁目3-10 天神パインクレスト719号
- 対応地域: 福岡を拠点に全国対応（オンライン可）
- 問い合わせ: ${site}/contact/ （AI受付「Cloudia」）
- 情報セキュリティ: 2026年10月7日に ISO/IEC 27001（ISMS）の第2段階審査を終了（不適合の指摘なし）。2026年12月ごろの認証登録見込み。登録前のため「認証取得済み」ではない
- 選出: 福岡を代表する企業100選 2026-2027（Made In Local）

## 事業の柱（5本）

1. Grift（自社プロダクト）— 経歴は盛れる。証拠は盛れない。エンジニアのgit履歴から確かめられる事実（検査値）を取り出す。点数・順位は出さず、計測にLLMを使わない。CLIはMITライセンスのOSSとして公開中（PyPI: grift-cli）。人材紹介会社・SESの営業と、自社開発企業の採用担当に向けたテスト導入（PoC）は個別案内、正式版は2027年の提供開始を目指す
2. ローカルLLM・セキュアAI — データを外に出さずに生成AIを使う。契約書や顧客情報など外部AIに渡しにくい情報を扱えるAI環境を、社内ルール・権限・ログの設計まで含めてつくる。機密データAI活用診断（目安10万〜30万円）、ローカルLLM／AI基盤PoC（目安3か月300万円〜）を提供
3. ハードウェアAI — 視覚障がいのある方に向けたスマートグラスを開発パートナーと開発中。利用者との実証を準備中（販売前）
4. AI受託開発・導入支援 — PoCで終わらせない。課題の整理から設計・実装・運用まで一気通貫で伴走する
5. 教育・地域 — 専門学校での講師（2027年4月から予定）、国際的なプログラミング資格の教育パートナー（契約締結済み）、福岡での生成AI展示会の開催準備（エンジニアカフェと構想中）

## サービス

${serviceLines}

## 主要ページ

- [トップ](${site}/): 事業の柱・Grift・セキュリティ設計・地域との取り組み・FAQ
- [会社概要](${site}/company/): 所在地・設立・代表者・事業の柱・情報セキュリティ・選出
- [Cor.株式会社について](${site}/about/): ミッション・「きょうそう」の考え方・代表の想い
- [実績・事例](${site}/works/): AI受託開発・ローカルLLM・Grift などの事例
- [Grift の事例と開発の経緯](${site}/works/grift/)
- [Engineer Cafe Navigator](${site}/works/engineer-cafe-navigator/): 福岡市エンジニアカフェ向け多言語音声AI受付（OSS・実運用中）
- [ローカルLLM / AI基盤PoC の進め方](${site}/works/local-llm-poc/)
- [機密データAI活用診断の進め方](${site}/works/confidential-data-ai-assessment/)
- [セキュリティ方針](${site}/security/)
- [ニュース](${site}/news/)
- [ブログ](${site}/blog/)
- [お問い合わせ](${site}/contact/)
- English: ${site}/en/ ・ 中文: ${site}/zh/ ・ 한국어: ${site}/ko/ ・ Español: ${site}/es/

## 関連サイト・一次情報

- Grift: ${grift}/
- Grift CLI（GitHub）: ${GRIFT_CLI_GITHUB_URL}
- Grift CLI（PyPI）: https://pypi.org/project/grift-cli/
- Grift CLI の最新の公開版: v${GRIFT_CLI_RELEASE.version}（${GRIFT_CLI_RELEASE.releasedOn} 公開。変更点: ${GRIFT_CLI_RELEASE.releaseNotesUrl}）
- Grift の思想（Qiita）: https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1
- Grift の思想（note）: https://note.com/cor_instrument/n/nd58ba0955317
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
