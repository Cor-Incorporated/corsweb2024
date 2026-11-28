import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { convertV4MiniflareOptions, Miniflare } from 'miniflare';

const issuer = 'https://clerk.example.invalid';
const harbor = 'harbor';
const sample = 'sample';
const harborToken = randomBytes(32).toString('base64url');
const sampleToken = randomBytes(32).toString('base64url');
const requestUrl = 'https://entitlements.example.invalid/v1/entitlements/check';
const contractUrl = 'https://entitlements.example.invalid/v2/entitlements/check';
const known = { service: harbor, issuer, subject: 'user_LegacyFixture', tenantId: 'ws-a' };

test('product query against local Workers and D1 runtime', async (t) => {
  const options = {
    modules: [
      { type: 'ESModule', path: fileURLToPath(new URL('index.js', import.meta.url)) },
      { type: 'ESModule', path: fileURLToPath(new URL('services.js', import.meta.url)) },
    ],
    modulesRoot: fileURLToPath(new URL('.', import.meta.url)),
    compatibilityDate: '2026-10-26',
    d1Databases: ['ACCOUNT_GRANTS'],
    bindings: {
      CLERK_ISSUER: issuer,
      HARBOR_ENTITLEMENT_QUERY_TOKEN: harborToken,
      SAMPLE_ENTITLEMENT_QUERY_TOKEN: sampleToken,
    },
    cf: false,
    telemetry: { enabled: false },
  };
  const mf = new Miniflare(convertV4MiniflareOptions(options));
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

  await grant('legacy', known.subject, harbor, 'ws-a', 'legacy', today, today);
  await grant('staff-harbor', 'user_StaffFixture', harbor, 'ws-b', 'staff', '2000-01-01', '2099-12-31');
  await grant('staff-sample', 'user_StaffFixture', sample, 'org-a', 'staff', '2000-01-01', '2099-12-31');
  await grant('expired', 'user_Expired', harbor, 'ws-a', 'legacy', '2000-01-01', '2001-01-01');
  await grant('future', 'user_Future', harbor, 'ws-a', 'staff', '2099-01-01', '2099-12-31');

  const query = async (body, token = harborToken, url = requestUrl) => {
    const res = await mf.dispatchFetch(url, {
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
    assert.deepEqual(await query({
      service: sample, issuer, subject: 'user_StaffFixture', tenantId: 'org-a',
      organizationId: null, operation: 'view',
    }, sampleToken, contractUrl), [200, { allowed: true, access: 'open' }]);
  });

  await t.test('unapproved subjects, different tenant, issuer, and product are denied', async () => {
    for (const scope of [
      { subject: 'user_OtherFixture' }, { tenantId: 'ws-b' }, { issuer: 'https://other.example.invalid' },
      { subject: 'user_StaffFixture', tenantId: 'ws-a' },
    ]) {
      assert.deepEqual(await query({ ...known, ...scope }), [200, { allowed: false }]);
    }
    assert.deepEqual(await query({
      service: sample, issuer, subject: 'user_OtherFixture', tenantId: 'org-a',
      organizationId: null, operation: 'view',
    }, sampleToken, contractUrl), [200, { allowed: false, access: 'closed' }]);
  });

  await t.test('staff onboarding requires the current personal staff grant in this product tenant', async () => {
    await grant('fresh-staff-onboard', 'user_FreshFixture', sample, 'org-a', 'staff', today, today);
    const operation = { issuer, subject: 'user_FreshFixture', service: sample, tenantId: 'org-a',
      organizationId: null, operation: 'staff_onboarding' };
    const run = body => query(body, sampleToken, contractUrl);
    assert.deepEqual(await run(operation), [200, { allowed: true, access: 'open' }]);
    await grant('legacy-onboard', 'user_LegacyFixture', sample, 'org-a', 'legacy', today, today);
    for (const scope of [{ subject: 'user_LegacyFixture' }, { tenantId: 'other' },
      { subject: 'user_Unassigned' }, { issuer: 'https://other.example.invalid' }]) {
      assert.deepEqual(await run({ ...operation, ...scope }), [200, { allowed: false, access: 'closed' }]);
    }
    assert.equal((await run({ ...operation, organizationId: 'org_fixture' }))[0], 400);
    // Harbor does not offer staff onboarding, and a retired service is closed
    // before the token secret is read.
    assert.equal((await query({ ...operation, service: harbor, tenantId: 'ws-b' }, harborToken, contractUrl))[0], 400);
    assert.deepEqual(await query({ ...operation, service: 'business-dossier', tenantId: 'ws-a' },
      sampleToken, contractUrl), [200, { allowed: false, access: 'closed' }]);
    assert.deepEqual(await query({ ...operation, subject: known.subject, tenantId: 'ws-sample', operation: 'view' },
      sampleToken, contractUrl), [200, { allowed: false, access: 'closed' }]);
    assert.equal((await query(operation, harborToken, contractUrl))[0], 401);
    await db.prepare("UPDATE account_grants SET revoked_at=datetime('now'), revocation_ref='fixture' WHERE id='fresh-staff-onboard'").run();
    assert.deepEqual(await run(operation), [200, { allowed: false, access: 'closed' }]);
  });

  await t.test('requests require the product credential and reject caller-supplied role or paid status', async () => {
    assert.deepEqual(await query(known, ''), [401, { error: 'unauthorized' }]);
    assert.deepEqual(await query(known, sampleToken), [401, { error: 'unauthorized' }]);
    assert.deepEqual(await query({
      service: sample, issuer, subject: 'user_StaffFixture', tenantId: 'org-a',
      organizationId: null, operation: 'view',
    }, harborToken, contractUrl), [401, { error: 'unauthorized' }]);
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
    await assert.rejects(grant('long-date', known.subject, harbor, 'ws-a', 'legacy', '2000-02-30', '2099-12-31'));
    await assert.rejects(db.prepare("UPDATE account_grants SET revoked_at=datetime('now') WHERE id='staff-harbor'").run());
  });

  await t.test('Harbor keeps its workspace boundary and only accepts version 1', async () => {
    const shared = { service: harbor, issuer, subject: 'user_StaffFixture', tenantId: 'harbor-team' };
    await grant('harbor-staff', shared.subject, harbor, shared.tenantId, 'staff', today, today);
    await grant('harbor-existing', known.subject, harbor, shared.tenantId, 'legacy', today, today);
    assert.deepEqual(await query(shared, harborToken), [200, { allowed: true }]);
    assert.deepEqual(await query({ ...shared, organizationId: null, operation: 'view' },
      harborToken, contractUrl), [400, { error: 'invalid_input' }]);
    assert.deepEqual(await query({ ...shared, subject: known.subject }, harborToken), [200, { allowed: true }]);
    assert.deepEqual(await query({ ...shared, tenantId: 'other-team' }, harborToken), [200, { allowed: false }]);
    assert.deepEqual(await query(shared, sampleToken), [401, { error: 'unauthorized' }]);
    assert.deepEqual(await query({ ...shared, service: sample }, sampleToken, requestUrl),
      [400, { error: 'invalid_input' }]);
    await db.prepare("UPDATE account_grants SET revoked_at=datetime('now'), revocation_ref=? WHERE id=?")
      .bind('withdrawal', 'harbor-staff').run();
    assert.deepEqual(await query(shared, harborToken), [200, { allowed: false }]);
    assert.deepEqual(await query({ ...shared, subject: known.subject }, harborToken), [200, { allowed: true }]);
  });

  await t.test('a missing or duplicated active credential leaves the other active product usable', async () => {
    for (const value of ['', sampleToken]) {
      await mf.setOptions(convertV4MiniflareOptions({
        ...options, bindings: { ...options.bindings, HARBOR_ENTITLEMENT_QUERY_TOKEN: value },
      }));
      assert.deepEqual(await query({ ...known, service: harbor }, harborToken),
        [503, { error: 'unavailable' }]);
      const active = {
        service: sample, issuer, subject: 'user_StaffFixture', tenantId: 'org-a',
        organizationId: null, operation: 'view',
      };
      assert.deepEqual(await query(active, sampleToken, contractUrl),
        value === '' ? [200, { allowed: true, access: 'open' }] : [503, { error: 'unavailable' }]);
    }
    await mf.setOptions(convertV4MiniflareOptions(options));
  });

  await t.test('a missing or inaccessible grant database yields 503 and never allowed', async () => {
    const activeDb = await mf.getD1Database('ACCOUNT_GRANTS');
    await activeDb.prepare('DROP TABLE account_grants').run();
    assert.deepEqual(await query(known), [503, { error: 'unavailable' }]);
  });
});
