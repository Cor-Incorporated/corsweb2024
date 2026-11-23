import { writePaidProjection } from '../../workers/account-entitlements/paid-projection.js';

const clerkOrigin = 'https://api.clerk.com';
const orgPattern = /^org_[A-Za-z0-9_]{1,123}$/;
const subjectPattern = /^user_[A-Za-z0-9_]{1,123}$/;

async function readClerk(fetchClerk, secret, path) {
  const response = await fetchClerk(clerkOrigin + path, {
    headers: { Authorization: `Bearer ${secret}` },
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error('Clerk readback failed');
  return response.json();
}

async function readOrganizationMembers(read, path, id) {
  const seen = new Set();
  let total;
  for (let offset = 0; total === undefined || offset < total;) {
    const page = await read(`${path}/memberships?limit=100&offset=${offset}`);
    if (!page || !Array.isArray(page.data) || !Number.isSafeInteger(page.total_count) ||
        page.total_count < 0 || page.total_count > 10_000 || page.data.length > 100 ||
        (total !== undefined && page.total_count !== total)) {
      throw new Error('Incomplete Clerk membership readback');
    }
    total = page.total_count;
    if (offset + page.data.length > total || (!page.data.length && offset < total)) {
      throw new Error('Incomplete Clerk membership readback');
    }
    for (const membership of page.data) {
      const subject = membership?.public_user_data?.user_id;
      if (membership?.organization?.id !== id || typeof subject !== 'string' ||
          !subjectPattern.test(subject) || seen.has(subject)) {
        throw new Error('Inconsistent Clerk membership readback');
      }
      seen.add(subject);
    }
    offset += page.data.length;
  }
  return [...seen];
}

// Invoke after the existing billing reconciler has confirmed the Clerk update.
// Approval records are loaded from the operator's authoritative tenant mapping.
export function createClerkPaidProjector({
  db, issuer, clerkSecret, loadApprovedBindings, fetchClerk = fetch, now = Date.now,
}) {
  return async function project({ organizationId, resyncAt }) {
    if (typeof organizationId !== 'string' || !orgPattern.test(organizationId) ||
        typeof resyncAt !== 'string' || !resyncAt || typeof clerkSecret !== 'string' || !clerkSecret) {
      throw new Error('Missing confirmed billing reconciliation');
    }
    const observedAtMs = now();
    const path = '/v1/organizations/' + organizationId;
    const read = resource => readClerk(fetchClerk, clerkSecret, resource);
    const [confirmedOrganization, members, approvedBindings] = await Promise.all([
      read(path), readOrganizationMembers(read, path, organizationId), loadApprovedBindings(issuer, organizationId),
    ]);
    if (confirmedOrganization?.id !== organizationId || confirmedOrganization.public_metadata?.resync_at !== resyncAt) {
      throw new Error('Clerk organization or billing revision did not match');
    }
    return writePaidProjection(db, { issuer, confirmedOrganization, approvedBindings, members, observedAtMs },
      { now: now() });
  };
}
