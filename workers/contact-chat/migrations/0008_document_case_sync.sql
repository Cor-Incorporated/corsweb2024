-- 資料請求の案件同期の状態だけを足す。暗号文の列は増やさない。
-- 未適用。本番の migration 適用は別承認。
ALTER TABLE submission_intake ADD COLUMN case_sync_status TEXT NOT NULL DEFAULT '';
