-- 資料の版を記録する（#537）。資料ID は既存の document_id（0007）、元のページの path は既存の entry_path（0005）を使う。
-- 同じ表に同じ列を足す migration は 2 つ置かない（migration-columns.test.ts が落ちる）。
-- 既存の行は DEFAULT '' のまま（版の記録なし）。本番の migration 適用は別承認。
ALTER TABLE submission_intake ADD COLUMN document_version TEXT NOT NULL DEFAULT '';
