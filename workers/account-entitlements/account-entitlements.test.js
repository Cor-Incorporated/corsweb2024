import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { convertV4MiniflareOptions, Miniflare } from 'miniflare';

const issuer = 'https://clerk.example.invalid';
const bd = 'business-dossier';
const bdToken = randomBytes(32).toString('base64url');
const xesmToken = randomBytes(32).toString('base64url');
const requestUrl = 'https://entitlements.example.invalid/v1/entitlements/check';
const known = { service: bd, issuer, subject: 'user_LegacyFixture', tenantId: 'ws-a' };

test('product query against local Workers and D1 runtime', async (t) => {
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true,
    scriptPath: fileURLToPath(new URL('index.js', import.meta.url)),
    compatibilityDate: '2026-10-26',
    d1Databases: ['ACCOUNT_GRANTS'],
    bindings: {
      CLERK_ISSUER: issuer,
      BD_ENTITLEMENT_QUERY_TOKEN: bdToken,
      XESM_ENTITLEMENT_QUERY_TOKEN: xesmToken,
    },
    cf: false,
    telemetry: { enabled: false },
  }));
  t.after(() => mf.dispose());
  const db = await mf.getD1Database('ACCOUNT_GRANTS');
  const migration = await readFile(new URL('migrations/0001_account_grants.sql', import.meta.url), 'utf8');
  const migrationStatements = migration.split(';').map((statement) => statement.trim()).filter(Boolean);
  await db.batch(migrationStatements.map((statement) => db.prepare(statement)));
  const { today } = await db.prepare("SELECT date('now', '+9 hours') AS today").first();

  const grant = (id, subject, service, tenant, kind, start, end) => db.prepare(
    `INSERT INTO account_grants
        (id, issuer, subject, service, tenant_id, kind, starts_on, ends_on, approval_ref)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, issuer, subject, service, tenant, kind, start, end, 'approval-fixture').run();

  await grant('legacy', known.subject, bd, 'ws-a', 'legacy', today, today);
  await grant('staff-bd', 'user_StaffFixture', bd, 'ws-b', 'staff', '2000-01-01', '2099-12-31');
  await grant('staff-xesm', 'user_StaffFixture', 'xesm', 'org-a', 'staff', '2000-01-01', '2099-12-31');
  await grant('expired', 'user_Expired', bd, 'ws-a', 'legacy', '2000-01-01', '2001-01-01');
  await grant('future', 'user_Future', bd, 'ws-a', 'staff', '2099-01-01', '2099-12-31');

  const query = async (body, token = bdToken) => {
    const res = await mf.dispatchFetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    assert.equal(res.headers.get('Cache-Control'), 'no-store');
    return [res.status, await res.json()];
  };

  await t.test('exact existing user and approved staff are admitted without an organization', async () => {
    assert.deepEqual(await query(known), [200, { allowed: true }]);
    assert.deepEqual(await query({ ...known, subject: 'user_StaffFixture', tenantId: 'ws-b' }),
      [200, { allowed: true }]);
    assert.deepEqual(await query({ ...known, service: 'xesm', subject: 'user_StaffFixture', tenantId: 'org-a' }, xesmToken),
      [200, { allowed: true }]);
  });

  await t.test('unapproved subjects, different tenant, issuer, and business product are denied', async () => {
    for (const scope of [
      { subject: 'user_OtherFixture' }, { tenantId: 'ws-b' }, { issuer: 'https://other.example.invalid' },
      { subject: 'user_StaffFixture', tenantId: 'ws-a' },
    ]) {
      assert.deepEqual(await query({ ...known, ...scope }), [200, { allowed: false }]);
    }
    assert.deepEqual(await query({ ...known, service: 'xesm' }, xesmToken), [200, { allowed: false }]);
  });

  await t.test('requests require the product credential and reject caller-supplied role or paid status', async () => {
    assert.deepEqual(await query(known, ''), [401, { error: 'unauthorized' }]);
    assert.deepEqual(await query(known, xesmToken), [401, { error: 'unauthorized' }]);
    assert.deepEqual(await query({ ...known, service: 'xesm' }), [401, { error: 'unauthorized' }]);
    assert.deepEqual(await query({ ...known, email: 'staff@example.invalid' }), [400, { error: 'invalid_input' }]);
    assert.deepEqual(await query({ ...known, paid: false }), [400, { error: 'invalid_input' }]);
    assert.deepEqual(await query({ ...known, tenantId: 'w'.repeat(3000) }), [400, { error: 'invalid_input' }]);
  });

  await t.test('the grant period uses dates in JST and revocation applies to the next request', async () => {
    for (const subject of ['user_Expired', 'user_Future']) {
      assert.deepEqual(await query({ ...known, subject }), [200, { allowed: false }]);
    }
    await db.prepare("UPDATE account_grants SET revoked_at=datetime('now'), revocation_ref=? WHERE id=?")
      .bind('revocation-fixture', 'legacy').run();
    assert.deepEqual(await query(known), [200, { allowed: false }]);
    assert.deepEqual(await query({ ...known, subject: 'user_StaffFixture', tenantId: 'ws-b' }),
      [200, { allowed: true }]);
  });

  await t.test('a grant without a dated approval cannot become active', async () => {
    await assert.rejects(grant('long-date', known.subject, bd, 'ws-a', 'legacy', '2000-02-30', '2099-12-31'));
    await assert.rejects(db.prepare("UPDATE account_grants SET revoked_at=datetime('now') WHERE id='staff-bd'").run());
  });

  await t.test('a missing or inaccessible grant database yields 503 and never allowed', async () => {
    await db.prepare('DROP TABLE account_grants').run();
    assert.deepEqual(await query(known), [503, { error: 'unavailable' }]);
  });
});
