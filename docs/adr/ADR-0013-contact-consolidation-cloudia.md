# ADR-0013 問い合わせ一極集中（Cloudia UI + contact-chat）

## ステータス: Accepted (2026-07-11) / **一部撤回 2026-09-13**（fallback フォームの恒久維持。ADR-0005 改訂節を参照）

## 背景
- ADR-0005（Contact 段階移行）・ADR-0012（Cloudia 統合）で、Contact のチャットボット化と Cloudia の org 移管・Cloudflare 化を決定済み。
- Grift LP（griftai）は自前フォームを持たず、全 CTA を `cor-jp.com/contact/?intent=...` へ橋渡しする（griftai ADR-0002 / 本リポ ADR-0010）。
- 各導線の終着点が「corsweb の Contact」であることは事実上決まっていたが、「全問い合わせの受け口は Cloudia + contact-chat のペアである」というグランドデザインは明文化されていなかった。

## 決定

### 一極集中の定義
- Cor.inc に関わる**すべての問い合わせ導線**（corsweb 主 CTA・業種別 LP・Grift LP・ブログ CTA・将来の 050 AI 受付）の終着点を、次の**ペア**に固定する:
  1. **UI**: Cloudia（Cor-Incorporated/cloudia、LINE 風チャット + 8 表情）— corsweb `/contact/` に同一オリジンで埋め込み（#254）
  2. **API**: `workers/contact-chat`（本リポ配下の Cloudflare Worker、`/api/contact/*`）— 問い合わせ処理の正本（#250）
- 「一極集中」の実体は **Worker への集約**であり、UI 実装が何であれ問い合わせデータは contact-chat を必ず経由する。

### ~~fallback フォームの維持（単一障害点の回避）~~ → 撤回（2026-09-13 改訂）
- ~~SSGFORM ベースの従来フォームは **恒久的に fallback として維持**する（cloudia #19）。~~ → **撤回（2026-09-13）**。問い合わせ導線を Cloudia に一本化し、単一障害点となるリスクは認識したうえで受容した。検知手段・撤回条件は （ADR-0005「2026-09-13 改訂: 問い合わせ導線の Cloudia 一本化」を参照）
- ~~発動条件: (a) Cloudia の障害・応答不能時、(b) JavaScript 無効環境、(c) チャット UI が利用困難なユーザー（a11y）。~~ → **撤回（2026-09-13）**: fallback を持たないため発動しない。(a)〜(c) の利用者は `/contact` 上に問い合わせ手段が無い状態となり、これは受容したリスクとして ADR-0005 改訂節に記録している（(b) は計測手段が無いため撤回条件の根拠にしていない）。
- ~~fallback からの送信も intent / source を可能な範囲で引き継ぐ。~~ → **撤回（2026-09-13）**: fallback フォーム自体を持たないため対象外。なお Cloudia ランチャーのフォールバック**案内リンク**（`/contact` 以外のページで出る）は intent / source / locale を引き継ぐ（`e2e/contact-cloudia.spec.ts` で固定）。

### 公開順序との整合
- Epic #243 の公開順序「導線の真実性 → 有料入口 → 信頼証拠 → Cloudia → 050 AI 受付 → 背景演出」を維持する。
- `/contact/` は Cloudia への主導線（`/contact/chat/`、`embed=1`、`source`、`locale`、任意の `intent`）を表示する。~~従来の SSGFORM と日程調整は `details#contact-form-fallback` 内に残し、Cloudia 障害・JS 無効・a11y の fallback とする。~~ → **撤回（2026-09-13）**: `details#contact-form-fallback` の中身は所在地と（`PUBLIC_GCAL_ID` 設定時のみ）閲覧専用カレンダーで、**連絡手段としての fallback ではない**。日程調整は送信できないため問い合わせ手段として案内しない （ADR-0005「2026-09-13 改訂: 問い合わせ導線の Cloudia 一本化」を参照）。
- 全ページ右下の Cloudia launcher は同じ iframe 契約で常駐し、スマートフォンでは safe-area を考慮したボトムシートとして開閉する。

## 影響
- corsweb: #250（contact-chat 構造化 intent フロー）、#254（Cloudia 埋め込み）、#252（計測）
- cloudia: #7（contact-chat 直結）、#8（埋め込み + a11y）、#14（LINE 風 UI）、#19（fallback フォーム）
- griftai: CTA 橋渡し先は変更なし（`/contact/?intent=...` のまま。Contact の中身が Cloudia に変わっても URL 契約は不変）

## 参照
- ADR-0005 / ADR-0010 / ADR-0012 / ADR-0014（intent ルーティング） / ADR-0015（正本配置）
- griftai ADR-0002、cloudia ADR-0001〜0007
