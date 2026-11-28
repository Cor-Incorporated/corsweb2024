-- The ids that may appear in a confirmed paid contract row.
CREATE TABLE registered_services (
  id TEXT PRIMARY KEY NOT NULL
) STRICT;

INSERT INTO registered_services (id) VALUES ('sample'), ('business-dossier'), ('xesm');

-- Rebuild paid_contract_members so service can only name a registered id.
-- The rows are copied inside the same transaction. Deferred foreign keys keep
-- the copy valid while the old table is replaced.
PRAGMA defer_foreign_keys = ON;

CREATE TABLE paid_contract_members_new (
  issuer TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  service TEXT NOT NULL REFERENCES registered_services(id),
  tenant_id TEXT NOT NULL,
  approval_ref TEXT NOT NULL CHECK (length(trim(approval_ref)) > 0),
  revoked_at TEXT CHECK (revoked_at IS NULL OR unixepoch(revoked_at) IS NOT NULL),
  PRIMARY KEY (issuer, subject, service, tenant_id)
) STRICT;

INSERT INTO paid_contract_members_new
  (issuer, organization_id, subject, service, tenant_id, approval_ref, revoked_at)
SELECT issuer, organization_id, subject, service, tenant_id, approval_ref, revoked_at
FROM paid_contract_members;

DROP TABLE paid_contract_members;

ALTER TABLE paid_contract_members_new RENAME TO paid_contract_members;
