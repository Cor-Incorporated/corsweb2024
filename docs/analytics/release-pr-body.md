## Summary

develop を main（本番）に出す release PR です。この PR は自分では merge しません。merge は、寺田さんの Yes と、寺田さん以外の人の承認（1 件）のあとです。`main` に入ると、`.github/workflows/deploy.yml` が Firebase Hosting の本番に出します。

この release には、GA4 を足す変更（#497）が入っています。GA4 のタグが本番に出るのは、GitHub の variable `PUBLIC_GA4_ID` があるときだけです。variable がなければ、本番のページは今と同じで、GA4 のタグは出ません。手順は `docs/analytics/runbook.md` の 5-1 節と 7 節です。

この本文は、`docs/analytics/runbook.md` の 6-1 節のブロックが作ります。先頭の `head: <sha>` の行は、作った時点の develop の sha です。ブロックは、この release が変える `.github/workflows/` のファイルが `deploy.yml` の 1 つだけであることを確かめてから、本文を作ります。

## 人間ゲート

- この PR の merge（develop → main、merge commit）: 寺田さんの Yes と、寺田さん以外の人の承認
- GitHub の variable `PUBLIC_GA4_ID` の登録: 寺田さん。プライバシーポリシーに Google Analytics の開示が入ったあとだけ（`docs/analytics/runbook.md` の 5-1 節）

## 実環境貫通（C11 / Track B B1）

- [x] 実環境を 1 本通した（#497 の記録）。GA4 のタグが出る条件は、ビルドの出力と Chromium で確かめました。この release を main に merge したあとの本番の確認は、`docs/analytics/runbook.md` の 7 節です（merge 前は未実測）

## 未知の依存・API（C16 / Track B B4）

- [x] 該当なし（初出の依存・API は #497 でも使っていません。GA4 のタグは `googletagmanager.com` の gtag.js を、ページのスクリプトから読みます）

## 完了条件の形式（Track B B2）

- [x] F2 失敗モードの再現。#497 の `analytics-tags.test.ts` と `analytics-env-link.test.ts` が見ます。#497 の本文に、事故入力を注入して FAILED を測った記録があります

H5-guard: yes
H5-NEGATIVE: この release の workflow の変更は、#497 の deploy.yml（変数 PUBLIC_GA4_ID を本番ビルドに渡す 1 行）だけ。変数名を PUBLIC_GA4_IDX にすると analytics-env-link.test.ts が 2 件、式のかっこを外すと 1 件が FAILED（red 実測。#497 の本文に記録。戻すと green）
H5-LEDGER: 経路なし。この release の変更は block 権限を持つ guard ではない（ビルドへ環境変数を渡す設定と、タグを出す条件）。発火が aidd_ledger_append や guard-ledger.jsonl に届く経路は作っていない
H5-RETIRE: GA4 を使わない決定をして ADR-0004 から外した時点で、deploy.yml の PUBLIC_GA4_ID の行を削除する。測定は grep -c PUBLIC_GA4_ID .github/workflows/deploy.yml が 0 になること
H5-SUBTRACTION: N/A
H5-PAIR: .github/workflows/deploy.yml の PUBLIC_GA4_ID ↔ src/components/analytics/Analytics.astro の import.meta.env.PUBLIC_GA4_ID と src/env.d.ts; mutation=deploy.yml の名前を PUBLIC_GA4_IDX にすると analytics-env-link.test.ts が 2 件 red、式のかっこを外すと 1 件 red（#497 の本文に記録）
H5-E2E: PUBLIC_SITE_ENV=production PUBLIC_GA4_ID=G-TEST123456 PUBLIC_CLARITY_ID=testclarity astro build と Playwright（Chromium）で gtag/js のリクエストを数えた（#497 で実行）
H5-E2E-OUT: index.html は gtag/js 1 回・config 1 回、View Transitions で /works へ移っても 1 回・1 回のまま、/contact/chat/ は計測ホストへのリクエスト 0 回（#497 の本文に記録。merge 前の測定）
