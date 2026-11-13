-- 資料請求を問い合わせと同じ保存先に載せる。既存行は inquiry のまま。
-- 保持期間の最終判断は未確定。期限の列は既存の expires_at を使う。
ALTER TABLE submission_intake ADD COLUMN request_kind TEXT NOT NULL DEFAULT 'inquiry';
ALTER TABLE submission_intake ADD COLUMN document_id TEXT NOT NULL DEFAULT '';
ALTER TABLE submission_intake ADD COLUMN industry TEXT NOT NULL DEFAULT '';
ALTER TABLE submission_intake ADD COLUMN consent_version TEXT NOT NULL DEFAULT '';
