-- Attribution is initially declared by the browser and then fixed by the session.
ALTER TABLE contact_sessions ADD COLUMN entry_route TEXT NOT NULL DEFAULT 'unknown'
  CHECK (entry_route IN ('corJpDirect', 'griftaiLink', 'unknown'));
ALTER TABLE submission_intake ADD COLUMN entry_route TEXT NOT NULL DEFAULT 'unknown'
  CHECK (entry_route IN ('corJpDirect', 'griftaiLink', 'unknown'));
