CREATE TABLE account_grants (
  id TEXT PRIMARY KEY NOT NULL,
  issuer TEXT NOT NULL,
  subject TEXT NOT NULL,
  service TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('staff', 'legacy')),
  starts_on TEXT NOT NULL CHECK (
    length(starts_on) = 10 AND date(starts_on) IS NOT NULL AND date(starts_on) = starts_on
  ),
  ends_on TEXT NOT NULL CHECK (
    length(ends_on) = 10 AND date(ends_on) IS NOT NULL AND date(ends_on) = ends_on
    AND ends_on >= starts_on
  ),
  approval_ref TEXT NOT NULL CHECK (length(trim(approval_ref)) > 0),
  revoked_at TEXT,
  revocation_ref TEXT,
  CHECK (
    (revoked_at IS NULL AND revocation_ref IS NULL)
    OR (revoked_at IS NOT NULL AND revocation_ref IS NOT NULL
        AND unixepoch(revoked_at) IS NOT NULL AND length(trim(revocation_ref)) > 0)
  )
) STRICT;

CREATE INDEX account_grants_lookup
  ON account_grants (issuer, subject, service, tenant_id, starts_on, ends_on)
  WHERE revoked_at IS NULL;
