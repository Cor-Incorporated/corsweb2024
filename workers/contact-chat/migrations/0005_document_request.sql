-- 資料請求を問い合わせと同じ保存先に載せる。既存行は inquiry のまま。
-- 保持期間は 90 日（問い合わせと同じ）。寺田さん本人が 2026-11-12T09:21:21.565Z に Codex のチャットで「この案を採用」と答えた（問いに「受付記録は90日保持」）。期限の列は既存の expires_at を使う。
ALTER TABLE submission_intake ADD COLUMN request_kind TEXT NOT NULL DEFAULT 'inquiry';
ALTER TABLE submission_intake ADD COLUMN document_id TEXT NOT NULL DEFAULT '';
ALTER TABLE submission_intake ADD COLUMN industry TEXT NOT NULL DEFAULT '';
ALTER TABLE submission_intake ADD COLUMN consent_version TEXT NOT NULL DEFAULT '';
