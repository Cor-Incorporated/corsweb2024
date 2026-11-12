-- 資料請求の受付言語（ページの言語）を保存行に持たせる。担当が返信の言語を決めるため。
-- 既存行は '' のまま（言語は記録なし）。暗号文の列は増やさない。PII ではない。
-- 未適用。本番の migration 適用は別承認。コードより先に適用する（古いコードは列を無視するので先に当てても壊れない）。
ALTER TABLE submission_intake ADD COLUMN locale TEXT NOT NULL DEFAULT '';
