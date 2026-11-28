import { contractServices } from './services.js';

const supportedServices = contractServices().map(service => service.id);
const organizationId = /^org_[A-Za-z0-9_]{1,123}$/;
const subjectId = /^user_[A-Za-z0-9_]{1,123}$/;
const tenantId = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(value + 'T00:00:00Z');
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

function contractRows(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error('Missing confirmed organization contracts');
  }
  return Object.fromEntries(supportedServices.flatMap(service => {
    const row = metadata[service];
    if (row == null) return [];
    if (!isDate(row.from) || typeof row.hold !== 'boolean' ||
        (row.until != null && (!isDate(row.until) || row.from > row.until))) {
      throw new Error('Invalid confirmed contract');
    }
    return [[service, { from: row.from, until: row.until ?? null, hold: row.hold }]];
  }));
}

function activeApprovals(approvedBindings, members) {
  if (!Array.isArray(approvedBindings) || !Array.isArray(members) ||
      members.some(member => typeof member !== 'string' || !subjectId.test(member))) {
    throw new Error('Invalid approved bindings or organization membership');
  }
  const activeSubjects = new Set(members);
  const seen = new Set();
  return approvedBindings.filter(binding => {
    if (typeof binding?.subject !== 'string' || !subjectId.test(binding.subject) ||
        !supportedServices.includes(binding.service) || typeof binding.tenantId !== 'string' ||
        !tenantId.test(binding.tenantId) || typeof binding.approvalRef !== 'string' ||
        !binding.approvalRef.trim() || binding.approvalRef.length > 180) {
      throw new Error('Invalid approved binding');
    }
    const key = JSON.stringify([binding.subject, binding.service, binding.tenantId]);
    if (seen.has(key)) throw new Error('Duplicate approved binding');
    seen.add(key);
    return activeSubjects.has(binding.subject);
  });
}

// The caller reads the current authorized sources after the Stripe reconciliation.
// Treat observation order as independent of delivery order and only write when confirmed.
export async function writePaidProjection(db, {
  issuer, confirmedOrganization, approvedBindings, members, observedAtMs,
}, { now = Date.now(), syncId = globalThis.crypto.randomUUID(), lease } = {}) {
  const origin = new URL(issuer);
  if (origin.protocol !== 'https:' || issuer !== origin.origin ||
      !organizationId.test(confirmedOrganization?.id ?? '') ||
      confirmedOrganization.object !== 'organization' ||
      !Number.isSafeInteger(observedAtMs) || observedAtMs > now ||
      observedAtMs <= now - 300_000) throw new Error('Invalid or expired source observation');
  const org = confirmedOrganization.id;
  const services = JSON.stringify(contractRows(confirmedOrganization.public_metadata?.services));
  const approved = activeApprovals(approvedBindings, members);
  const expiration = new Date(observedAtMs + 300_000).toISOString();
  const guard = `EXISTS (SELECT 1 FROM paid_contract_snapshots
    WHERE issuer = ? AND organization_id = ? AND sync_id = ?)`;

  // Check ownership inside the D1 write, including time spent waiting for D1.
  const currentLease = lease ? `EXISTS (SELECT 1 FROM billing_reconciliation_leases
    WHERE customer_id = ? AND owner = ? AND expires_at_ms > unixepoch('subsec') * 1000)` : '1';
  const leaseParameters = lease ? [lease.customer, lease.owner] : [];
  const snapshot = db.prepare(`INSERT INTO paid_contract_snapshots
    (issuer, organization_id, services_json, expires_at, observed_at_ms, sync_id)
    SELECT ?, ?, ?, ?, ?, ? WHERE ${currentLease}
    ON CONFLICT (issuer, organization_id) DO UPDATE SET services_json = excluded.services_json,
      expires_at = excluded.expires_at, observed_at_ms = excluded.observed_at_ms, sync_id = excluded.sync_id
    WHERE excluded.observed_at_ms > paid_contract_snapshots.observed_at_ms`)
    .bind(issuer, org, services, expiration, observedAtMs, syncId, ...leaseParameters);
  const revoke = db.prepare(`UPDATE paid_contract_members AS member SET revoked_at = datetime('now')
    WHERE issuer = ? AND organization_id = ? AND revoked_at IS NULL AND ${guard}
      AND NOT EXISTS (SELECT 1 FROM json_each(?) AS approved
        WHERE json_extract(approved.value, '$.subject') = member.subject
          AND json_extract(approved.value, '$.service') = member.service
          AND json_extract(approved.value, '$.tenantId') = member.tenant_id)`)
    .bind(issuer, org, issuer, org, syncId, JSON.stringify(approved));
  const upsert = db.prepare(`INSERT INTO paid_contract_members
    (issuer, organization_id, subject, service, tenant_id, approval_ref, revoked_at)
    SELECT ?, ?, json_extract(approved.value, '$.subject'), json_extract(approved.value, '$.service'),
      json_extract(approved.value, '$.tenantId'), json_extract(approved.value, '$.approvalRef'), NULL
    FROM json_each(?) AS approved WHERE ${guard}
    ON CONFLICT (issuer, subject, service, tenant_id) DO UPDATE
      SET approval_ref = excluded.approval_ref, revoked_at = NULL
      WHERE paid_contract_members.organization_id = excluded.organization_id
        AND paid_contract_members.approval_ref <> excluded.approval_ref`)
    .bind(issuer, org, JSON.stringify(approved), issuer, org, syncId);
  const [result] = await db.batch([snapshot, revoke, upsert]);
  return result.meta.changes > 0;
}
