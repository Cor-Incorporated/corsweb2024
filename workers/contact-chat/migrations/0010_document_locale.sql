-- 資料請求の受付言語（locale）を記録する。
-- 本番の migration 適用は別承認。
ALTER TABLE submission_intake ADD COLUMN locale TEXT NOT NULL DEFAULT '';
