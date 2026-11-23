-- Optional projection of the confirmed Clerk organization services, never an event payload.
CREATE TABLE paid_contract_snapshots (
  issuer TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  services_json TEXT NOT NULL CHECK (json_valid(services_json) AND json_type(services_json) = 'object'),
  expires_at TEXT NOT NULL CHECK (unixepoch(expires_at) IS NOT NULL),
  PRIMARY KEY (issuer, organization_id)
) STRICT;

-- Explicit enrollment. This does not add a product role or tenant membership.
CREATE TABLE paid_contract_members (
  issuer TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  service TEXT NOT NULL CHECK (service IN ('business-dossier', 'xesm')),
  tenant_id TEXT NOT NULL,
  approval_ref TEXT NOT NULL CHECK (length(trim(approval_ref)) > 0),
  revoked_at TEXT CHECK (revoked_at IS NULL OR unixepoch(revoked_at) IS NOT NULL),
  PRIMARY KEY (issuer, subject, service, tenant_id)
) STRICT;
