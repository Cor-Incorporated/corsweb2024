# ADR-0012 Cloudia を Contact フォーム代用として corsweb に統合（org 移管・Cloudflare）

## ステータス: Accepted (2026-07-10) / **一部撤回 2026-09-13**（フォーム fallback。ADR-0005 改訂節を参照）

## 背景
- Cloudia（`terisuke/3d-emotional-chat-ai`）は別ドメイン・Netlify 想定・SNS 口調で、Contact 本線になっていない。
- corsweb には `workers/contact-chat`（同一オリジン API）と ContactChat UI フラグがあるが、3D Cloudia とは未接続。
- 最終目標（プロダクト方針）:
  1. Cloudia を **お問い合わせフォームの代用チャットボット**として corsweb に統合する
  2. リポジトリを **`Cor-Incorporated` org へ移管**する
  3. ホスティングを **Cloudflare** に寄せる

## 決定

### 役割分担
| コンポーネント | 正本 | 備考 |
|---|---|---|
| リード API | `workers/contact-chat` | `/api/contact/*`。PII は submit でメールのみ |
| リード UI | Cloudia | `/contact/` の主 UI。右下固定ボタンも可 |
| フォーム | SSGFORM / ContactForm | ~~**fallback のみ**（JS 無効・障害時）~~ → **撤回（2026-09-13）: 通常時は描画しない。JS 無効・障害時の fallback も持たない** （ADR-0005「2026-09-13 改訂: 問い合わせ導線の Cloudia 一本化」を参照） |
| 3D アバター | Cloudia three/VRM | 任意。失敗してもチャット完走必須 |

### リポジトリ
- 現: `terisuke/3d-emotional-chat-ai`
- 目標: `Cor-Incorporated/3d-emotional-chat-ai` または `Cor-Incorporated/cloudia`（Transfer 時に確定）
- Transfer 実行者は org admin。Secrets / Collaborators / ブランチ保護を再設定。

### ホスティング
- Netlify を廃止し **Cloudflare**（Pages または Workers 静的配信）へ。
- 本番は `cor-jp.com` 同一オリジン埋め込みを優先（例: `/contact/` 内 mount、または `/cloudia/` 静的配信 + API 同一オリジン）。
- Preview 用サブドメインは noindex（ADR-0010）。

### 統合方式（推奨）
1. **短期**: 独立リポのまま embed ビルド（iframe/widget）+ contact-chat API 直結。
2. **中期（推奨最終）**: corsweb monorepo 内 `packages/cloudia` または `apps/cloudia` へ移植し、同一 CI / Preview / デプロイ。
3. **代替**: ビルド成果物を `public/cloudia/` に vendoring。

### カットオーバー手順（概要）
1. Cloudia B2B 受付・intent・3D フォールバック完了
2. API 直結 + 埋め込み検証（Preview）
3. org Transfer + CF ホスティング
4. `/contact/` 主 UI 切替、`CONTACT_CHAT_ENABLED` 相当を Cloudia 本線に
5. ~~SSGFORM を fallback のみに降格~~ → **撤回（2026-09-13）: fallback としても残さない**、PP 更新 （ADR-0005「2026-09-13 改訂: 問い合わせ導線の Cloudia 一本化」を参照）
6. 旧 Netlify URL をリダイレクトまたは停止

### 受付トーン・intent
- ADR-0005 / ADR-0010 の intent 正本と敬語受付を共有。

## 理由
- 監査 §6: 別ドメインではヒアリング結果を問い合わせ・日程調整へ引き継げない。
- org 移管により Cor. のコード所有と CI/権限を一本化する。
- Cloudflare は contact-chat Worker・既存 CF 運用と整合する。

## 影響
- Issue #59 を本 ADR に合わせて更新。
- Cloudia 側 ADR-0001〜0004 と対で実装 Issue を切る。
- ローカル `_archive/3d-emotional-chat-ai` の remote URL は Transfer 後に更新する。

## 代替案
- **contact-chat テキスト UI のみで Cloudia を捨てる**: 短期は可だが、ブランド UI・3D 資産を捨てるため最終目標としては不採用。
- **個人リポのまま iframe 埋め込みのみ**: 所有権・CI・権限が分断されるため中長期は却下。

## 参照
- ADR-0005（Contact 段階移行・改訂）
- Cloudia `docs/adr/ADR-0002` / `ADR-0003` / `ADR-0004`
- 監査資料 §6, §12
