# アクセス解析の設計（cor-jp.com）

計測タグの出し方と、その条件を固定するテストの対応表です。操作の手順は [runbook.md](./runbook.md) にあります。

## 3 つの計測

| 計測 | 環境変数 | 渡し方（`.github/workflows/deploy.yml`） | 出力 |
|---|---|---|---|
| Cloudflare Web Analytics | `PUBLIC_CF_BEACON_TOKEN` | secret（現在 repo に登録なし） | beacon の script |
| Microsoft Clarity | `PUBLIC_CLARITY_ID` | secret | loader の inline script |
| Google Analytics 4 | `PUBLIC_GA4_ID` | variable を先に読み、なければ secret | gtag.js の loader の inline script |

3 つとも `src/components/analytics/Analytics.astro` が出します。どの ID を出すかは `src/components/analytics/analytics-tags.ts` の `resolveAnalyticsTags` が決め、`Analytics.astro` は戻り値が空文字かどうかだけを見ます。

## タグを出す条件

次の条件がすべて満たされたときだけ、その計測のタグが出ます。

1. production のビルドである。`PUBLIC_SITE_ENV=production`。`deploy.yml` は main への push のときだけ production にし、ID もそのときだけ渡す。PR と develop のビルドには ID を渡さない（`config/site.ts` の `isAnalyticsEnabled` も production 以外を止める）。**`PUBLIC_SITE_ENV` が未設定のときも production 扱い**（`getSiteEnv`）なので、手元の `.env` に計測の ID を置かない。置くと、手元の `npm run dev` や `build` でもタグが出る
2. iframe 専用のページではない。`<Layout analytics={false}>` のページ（`/contact/chat/`）は出さない。Cloudia ランチャーが同じ訪問者に二重に計測するのを防ぐため（ADR-0004）
3. その計測の ID が設定されている。未設定なら何も出さない
4. GA4 の ID は `^G-[A-Z0-9]+$` に合う。前後の空白と改行は取り除く。合わない値（別の ID、引用符、`&`、バッククォートを含む値）は出さず、script の URL にも入れない

GA4 のタグは、View Transitions でページを移っても 1 回しか読み込まず、`config` も 1 回です（`window.__corGa4Id` で判定）。

## テストとの対応

| 条件 | テスト | 落ちるべき変更 |
|---|---|---|
| ID 未設定なら出さない | `analytics-tags.test.ts` の「未設定」「空文字」「空白だけ」「改行だけ」 | 未設定でも ID を返す |
| production 以外では出さない | 同「preview」「development」 | 本番ゲートを外す |
| iframe ページでは出さない | 同「enabled=false」 | `enabled` を無視する |
| 形式の崩れた GA4 の ID は出さない | 同「形式の崩れた PUBLIC_GA4_ID」の表（別の ID、UA、引用符、空白、クエリ、バッククォート、小文字、前に文字が付く、`G-` だけ、`_`、`-`、`.` と `/`） | 形式の検査を外す、緩める |
| ID を渡す式が main への push に限られる | `analytics-env-link.test.ts`（`deploy.yml` の行を完全一致で比べる） | かっこを外す、条件を外す |
| 前後の空白と改行は取り除く | 同「前後の空白と改行は取り除く」 | 取り除かずに形式の検査へ渡す |
| production の既存の条件（`isAnalyticsEnabled`） | `src/config/__tests__/site.test.ts` | 条件を OR にする |

## GA4 を足した経緯と、残っていること

- 2026-11-06、代表が「cor-jp.com に GA4 を足し、2 サイトの計測を Cor. 所有にそろえる」と決めた。
- ADR-0004（`docs/adr/ADR-0004-analytics-cloudflare-clarity.md`）は、代替案の欄で「GA4 をベースにする案」を採らないとしている。
- このブランチの GA4 はベースではない。Cloudflare Web Analytics と Clarity に足す計測で、ADR の「決定」の欄にはまだ書かれていない。**ADR-0004 の改訂は別の変更が要る（未実施）。**
- プライバシーポリシーは「Cookie等の利用及びアクセス解析ツール」の項で、Clarity と Cloudflare Web Analytics を名指しで開示している（`src/i18n/locales/ja.json` の 543 行目前後）。Google Analytics の記載は ja・en とも 0 件。
- **5 言語のポリシーへの開示が merge されるまで、本番で `PUBLIC_GA4_ID` を設定しない。** コードは ID が未設定なら何も出さない。この PR を merge しても、variable を設定するまで本番は変わらない。
- 同意導線（バナー、Consent API）はない。ADR-0004 は Clarity について、同意導線を設けない判断をしている。GA4 にその判断を広げるかは、ADR の改訂で決める。このブランチでは決めていない。
- 本番の判定の仕方が、2 つのサイトで違う。griftai.org は実行時にホスト名で判定し、cor-jp.com はビルド時の `PUBLIC_SITE_ENV` で判定する。サイトの作りが違うためで、条件の中身（本番だけ）は同じ。
