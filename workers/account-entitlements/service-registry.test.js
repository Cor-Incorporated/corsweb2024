import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { convertV4MiniflareOptions, Miniflare } from 'miniflare';

import { services } from './services.js';

const issuer = 'https://clerk.example.invalid';
const bearer = () => randomBytes(32).toString('base64url');
const moduleDirectory = new URL('.', import.meta.url);

async function statements(name) {
  const migration = await readFile(new URL('migrations/' + name, import.meta.url), 'utf8');
  return migration.split(';').map(statement => statement.trim()).filter(Boolean);
}

async function apply(db, name) {
  await db.batch((await statements(name)).map(statement => db.prepare(statement)));
}

function body(service, version) {
  return version === 'v2'
    ? { service, issuer, subject: 'user_Fixture', tenantId: 'tenant-fixture', organizationId: null, operation: 'view' }
    : { service, issuer, subject: 'user_Fixture', tenantId: 'tenant-fixture' };
}

function worker(bindings) {
  return new Miniflare(convertV4MiniflareOptions({
    modules: [
      { type: 'ESModule', path: fileURLToPath(new URL('index.js', import.meta.url)) },
      { type: 'ESModule', path: fileURLToPath(new URL('services.js', import.meta.url)) },
    ],
    modulesRoot: fileURLToPath(moduleDirectory),
    compatibilityDate: '2026-10-26', d1Databases: ['ACCOUNT_GRANTS'], cf: false,
    telemetry: { enabled: false }, bindings: { CLERK_ISSUER: issuer, ...bindings },
  }));
}

async function query(mf, version, service, token) {
  const response = await mf.dispatchFetch(`https://entitlements.example.invalid/${version}/entitlements/check`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body(service, version)),
  });
  return [response.status, await response.json()];
}

test('L1: every active declared service is accepted and an undeclared id is invalid input', async t => {
  const bindings = Object.fromEntries(services
    .filter(service => service.status === 'active')
    .map(service => [service.queryTokenSecret, bearer()]));
  const mf = worker(bindings);
  t.after(() => mf.dispose());
  await apply(await mf.getD1Database('ACCOUNT_GRANTS'), '0001_account_grants.sql');
  for (const service of services.filter(row => row.status === 'active')) {
    const version = service.queryVersions[0];
    const [status, payload] = await query(mf, version, service.id, bindings[service.queryTokenSecret]);
    assert.equal(status, 200, `${service.id}/${version}`);
    assert.equal(typeof payload.allowed, 'boolean', `${service.id}/${version}`);
  }
  const [status, payload] = await query(mf, 'v1', 'not-declared', bearer());
  assert.deepEqual([status, payload], [400, { error: 'invalid_input' }]);
});

test('L1: service names do not remain in the Worker modules', async () => {
  const names = ['business-dossier', 'xesm', 'harbor'];
  const files = (await readdir(moduleDirectory))
    .filter(name => name.endsWith('.js') && !name.endsWith('.test.js') && name !== 'services.js');
  assert.ok(files.length > 0);
  for (const file of files) {
    const source = await readFile(new URL(file, import.meta.url), 'utf8');
    for (const name of names) assert.ok(!source.includes(name), `${file} still names ${name}`);
  }
});

test('L2: migration 0005 rejects an unregistered service and keeps the rows written before it', async t => {
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true, script: 'export default { fetch() { return new Response("ok"); } }',
    compatibilityDate: '2026-10-26', d1Databases: ['ACCOUNT_GRANTS'], cf: false,
    telemetry: { enabled: false },
  }));
  t.after(() => mf.dispose());
  const db = await mf.getD1Database('ACCOUNT_GRANTS');
  for (const name of ['0001_account_grants.sql', '0002_paid_contract_projection.sql',
    '0003_paid_projection_revision.sql', '0004_billing_notification_receipts.sql']) {
    await apply(db, name);
  }
  const insert = (service, tenant) => db.prepare(`INSERT INTO paid_contract_members
    (issuer, organization_id, subject, service, tenant_id, approval_ref, revoked_at)
    VALUES (?, 'org_fixture', 'user_Fixture', ?, ?, 'approval-fixture', NULL)`)
    .bind(issuer, service, tenant).run();
  await insert('business-dossier', 'ws-fixture');
  await apply(db, '0005_registered_services.sql');
  assert.deepEqual(
    (await db.prepare('SELECT service FROM paid_contract_members').all()).results,
    [{ service: 'business-dossier' }],
  );
  await insert('sample', 'ws-sample');
  await assert.rejects(insert('not-registered', 'ws-unknown'));
});

test('L3: the declared billing catalog matches docs/billing/plans.json', async () => {
  const plans = JSON.parse(await readFile(new URL('../../docs/billing/plans.json', import.meta.url), 'utf8'));
  const declared = services.filter(service => service.billed).map(service => service.id).sort();
  const catalog = [...new Set(plans.services.map(service => service.service))].sort();
  assert.deepEqual(declared, catalog, `declared ${JSON.stringify(declared)} vs catalog ${JSON.stringify(catalog)}`);
});

test('retired services close both versions before the token secret is checked', async t => {
  const mf = worker({});
  t.after(() => mf.dispose());
  const db = await mf.getD1Database('ACCOUNT_GRANTS');
  await apply(db, '0001_account_grants.sql');
  for (const service of ['business-dossier', 'xesm']) {
    await db.prepare(`INSERT INTO account_grants
      (id, issuer, subject, service, tenant_id, kind, starts_on, ends_on, approval_ref)
      VALUES (?, ?, 'user_Fixture', ?, 'tenant-fixture', 'staff', '2000-01-01', '2099-12-31', 'fixture')`)
      .bind('retired-' + service, issuer, service).run();
  }
  // No BD_/XESM_ query token is configured, so a missing secret must not turn
  // the retired answer into 503.
  const token = bearer();
  for (const service of ['business-dossier', 'xesm']) {
    assert.deepEqual(await query(mf, 'v1', service, token), [200, { allowed: false }]);
    assert.deepEqual(await query(mf, 'v2', service, token), [200, { allowed: false, access: 'closed' }]);
  }
});
