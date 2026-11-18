-- 資料請求の「どこで知りましたか（任意）」を受付の記録にだけ残す。GA4 には送らない。
-- 選択肢は決まった語だけ。自由記述は「その他」の時だけで、短い上限つき。
-- 本番への適用は別承認。既存の migration は変えない。
ALTER TABLE submission_intake ADD COLUMN discovery_source TEXT NOT NULL DEFAULT '';
ALTER TABLE submission_intake ADD COLUMN discovery_other_ciphertext TEXT NOT NULL DEFAULT '';
