-- 問い合わせの受付に、入口の業種・元のページの path・機械の分類を足す。
-- 個人情報の列は増やさない。今の行は DEFAULT '' のまま壊さない。
ALTER TABLE contact_sessions ADD COLUMN industry TEXT NOT NULL DEFAULT '';
ALTER TABLE contact_sessions ADD COLUMN entry_path TEXT NOT NULL DEFAULT '';
ALTER TABLE contact_sessions ADD COLUMN machine_classification TEXT NOT NULL DEFAULT '';
ALTER TABLE contact_sessions ADD COLUMN classification_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE contact_sessions ADD COLUMN classification_origin TEXT NOT NULL DEFAULT '';
ALTER TABLE contact_sessions ADD COLUMN classification_version TEXT NOT NULL DEFAULT '';

ALTER TABLE submission_intake ADD COLUMN industry TEXT NOT NULL DEFAULT '';
ALTER TABLE submission_intake ADD COLUMN entry_path TEXT NOT NULL DEFAULT '';
ALTER TABLE submission_intake ADD COLUMN machine_classification TEXT NOT NULL DEFAULT '';
ALTER TABLE submission_intake ADD COLUMN classification_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE submission_intake ADD COLUMN classification_origin TEXT NOT NULL DEFAULT '';
ALTER TABLE submission_intake ADD COLUMN classification_version TEXT NOT NULL DEFAULT '';
