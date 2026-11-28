import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHmac, randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { createD1NotificationReceipts } from '../../docs/billing/notification-receipts.mjs';
import { writePaidProjection } from './paid-projection.js';
import { paidEntitlement } from './index.js';
import { createClerkPaidProjector } from '../../docs/billing/project-paid-contracts.mjs';
import { createSandboxBillingRuntime } from '../../docs/billing/notification-reconcile.mjs';

const run = promisify(execFile);
const billing = fileURLToPath(new URL('../../docs/billing/', import.meta.url));
const NOW = 1795500000;
const CUSTOMER = 'cus_fixture';
const PRODUCTS = [['business-dossier', 'ws-fixture'], ['xesm', 'tenant-fixture']];
const PERSONAL = [['sample', 'ws-sample']];
const dateFromToday = days => new Date(Date.now() + (days * 24 + 9) * 3600000).toISOString().slice(0, 10);
const ISSUER = 'https://clerk.example.invalid';

test('billing notifications reconcile current paid rights and preserve personal grants', async t => {
  const scratch = await mkdtemp(join(tmpdir(), 'billing-reconcile-'));
  t.after(() => rm(scratch, { recursive: true, force: true }));
  await symlink(join(billing, 'tests/fake-curl.sh'), join(scratch, 'curl'));
  const token = randomBytes(32).toString('base64url');
  const xesmToken = randomBytes(32).toString('base64url');
  const sampleToken = randomBytes(32).toString('base64url');
  const secret = randomBytes(32).toString('hex');
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: [
      { type: 'ESModule', path: fileURLToPath(new URL('index.js', import.meta.url)) },
      { type: 'ESModule', path: fileURLToPath(new URL('services.js', import.meta.url)) },
    ],
    modulesRoot: fileURLToPath(new URL('.', import.meta.url)),
    compatibilityDate: '2026-10-26', d1Databases: ['ACCOUNT_GRANTS'],
    bindings: { CLERK_ISSUER: ISSUER, BD_ENTITLEMENT_QUERY_TOKEN: token, XESM_ENTITLEMENT_QUERY_TOKEN: xesmToken,
      SAMPLE_ENTITLEMENT_QUERY_TOKEN: sampleToken },
    cf: false, telemetry: { enabled: false },
  }));
  t.after(() => mf.dispose());
  const db = await mf.getD1Database('ACCOUNT_GRANTS');
  for (const name of ['0001_account_grants.sql', '0002_paid_contract_projection.sql', '0003_paid_projection_revision.sql', '0004_billing_notification_receipts.sql']) {
    const migration = await readFile(new URL('migrations/' + name, import.meta.url), 'utf8');
    await db.batch(migration.split(';').map(sql => sql.trim()).filter(Boolean).map(sql => db.prepare(sql)));
  }
  for (const [service, tenantId] of [...PRODUCTS, ...PERSONAL]) {
    for (const [subject, kind] of [['user_Staff', 'staff'], ['user_Legacy', 'legacy']]) {
      await db.prepare(`INSERT INTO account_grants
        (id,issuer,subject,service,tenant_id,kind,starts_on,ends_on,approval_ref)
        VALUES (?,?,?,?,?,?,'2020-01-01','2099-12-31','fixture')`)
        .bind(`${service}-${kind}`, ISSUER, subject, service, tenantId, kind).run();
    }
  }
  const checkPersonal = async () => {
    for (const [service, tenantId] of PERSONAL) {
      for (const [subject, allowed] of [['user_Staff', true], ['user_Legacy', true], ['user_PaidOnly', false]]) {
        const result = await mf.dispatchFetch('https://worker.example.invalid/v2/entitlements/check', {
          method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${sampleToken}` },
          body: JSON.stringify({
            issuer: ISSUER, subject, service, tenantId, organizationId: null, operation: 'view',
          }),
        });
        assert.equal(result.status, 200);
        assert.deepEqual(await result.json(), { allowed, access: allowed ? 'open' : 'closed' });
      }
    }
  };
  const original = (await db.prepare('SELECT * FROM account_grants ORDER BY id').all()).results;
  const servicesFile = join(scratch, 'services.json');
  let state = 'overdue';
  let calls = 0;
  let expires = dateFromToday(-1);
  let endingService;
  const checkPaid = async (access, allowedOperations, overrides = {}) => {
    const subject = overrides.subject ?? 'user_PaidOnly';
    const organizationId = Object.hasOwn(overrides, 'organizationId') ? overrides.organizationId : 'org_fixture';
    for (const [service, tenantId] of PRODUCTS) {
      const requestedTenant = overrides.tenantId ?? tenantId;
      let actual = 'closed';
      if (organizationId && requestedTenant === tenantId) {
        const row = await db.prepare(`
          SELECT s.services_json, date('now', '+9 hours') AS today
          FROM paid_contract_members AS m
          JOIN paid_contract_snapshots AS s
            ON s.issuer = m.issuer AND s.organization_id = m.organization_id
          WHERE m.issuer = ?1 AND m.subject = ?2 AND m.service = ?3 AND m.tenant_id = ?4
            AND m.organization_id = ?5 AND m.revoked_at IS NULL
            AND unixepoch(s.expires_at) > unixepoch('now')
        `).bind(ISSUER, subject, service, requestedTenant, organizationId).first();
        if (row) actual = paidEntitlement(JSON.parse(row.services_json), service, row.today);
      }
      assert.equal(actual, access, `${service}/${organizationId ?? 'none'}`);
      for (const operation of ['view', 'edit', 'export']) {
        assert.equal(access === 'open' || (access === 'view_only' && operation === 'view')
          || (access === 'read_export_only' && operation !== 'edit'),
        allowedOperations.includes(operation), `${service}/${operation}`);
      }
    }
  };
  let rejectNext = false;
  let services = {};
  let resyncAt;
  let members = ['user_PaidOnly', 'user_Unbound'];
  let approvalRef = 'fixture';
  let incompleteMemberships = false;
  let beforeReconciliation;
  let beforeMemberRead;
  const project = createClerkPaidProjector({
    db, issuer: ISSUER, clerkSecret: 'sk_test_fixture',
    loadApprovedBindings: async (issuer, org) => {
      assert.equal(issuer, ISSUER);
      assert.equal(org, 'org_fixture');
      return PRODUCTS.map(([service, tenantId]) => ({
        service, tenantId, subject: 'user_PaidOnly', approvalRef,
      }));
    },
    fetchClerk: async (url, request) => {
      assert.equal(request.headers.Authorization, 'Bearer sk_test_fixture');
      assert.equal(request.redirect, 'error');
      const path = 'https://api.clerk.com/v1/organizations/org_fixture';
      if (url === path) return Response.json({
        id: 'org_fixture', object: 'organization', public_metadata: { services, resync_at: resyncAt },
      });
      assert.equal(url, path + '/memberships?limit=100&offset=0');
      if (beforeMemberRead) await beforeMemberRead();
      return Response.json({
        total_count: members.length + Number(incompleteMemberships),
        data: members.map(subject => ({
          organization: { id: 'org_fixture' }, public_user_data: { user_id: subject },
        })),
      });
    },
  });
  const createReceiver = () => createSandboxBillingRuntime({
    secret, customer: CUSTOMER, now: () => NOW, project, receipts: createD1NotificationReceipts(db),
    reconcile: async customer => {
    assert.equal(customer, CUSTOMER);
    if (beforeReconciliation) await beforeReconciliation();
    const log = join(scratch, `curl-${++calls}`);
    const metadata = {
      customer_code: 'fixture', clerk_org_id: 'org_fixture',
      'contract_business-dossier_start': dateFromToday(-70),
      'contract_business-dossier_hold': state === 'cancelled' ? 'false' : 'true',
    };
    Object.assign(metadata, {
      'contract_xesm_start': metadata['contract_business-dossier_start'],
      'contract_xesm_hold': metadata['contract_business-dossier_hold'],
    });
    if (state === 'cancelled') {
      for (const [service] of PRODUCTS) {
        if (!endingService || service === endingService) metadata[`contract_${service}_end`] = expires;
      }
    }
    const env = {
      PATH: `${scratch}:${process.env.PATH}`, FAKE_LOG: log, FAKE_RESYNC: '1',
      FAKE_SCENARIO: 'match', FAKE_PLANS: join(billing, 'plans.json'),
      FAKE_CUST_PAGE1: JSON.stringify([{ id: customer, object: 'customer', metadata }]),
      FAKE_OPEN_INVOICES: JSON.stringify({ [customer]: PRODUCTS.map(([service], index) => ({
        id: `in_fixture${index}`, due_date: 1470000000,
        service, status: state === 'overdue' ? 'open' : 'paid',
      })) }),
      COR_BILLING_API_KEY: 'fixture-stripe-key', FAKE_STRIPE_KEY: 'fixture-stripe-key',
      COR_CLERK_SECRET_KEY: 'sk_test_fixture', FAKE_CLERK_KEY: 'sk_test_fixture',
      ...(rejectNext ? { FAKE_CLERK_STATUS: '500' } : {}),
    };
    const { stdout } = await run('bash', [join(billing, 'subscribe.sh'), 'resync', '--apply', '--mode', 'test'], { env })
      .catch(error => {
        if (!rejectNext) t.diagnostic(error.stderr || error.message);
        throw error;
      });
    assert.match(stdout, /Clerk へ送った顧客 1 件/);
    const bodies = (await readFile(log, 'utf8')).split('\n').filter(line => line.startsWith('CLERK_BODY '));
    assert.equal(bodies.length, 1);
    const confirmed = JSON.parse(bodies[0].slice('CLERK_BODY '.length)).public_metadata;
    services = confirmed.services;
    resyncAt = confirmed.resync_at;
    await writeFile(servicesFile, JSON.stringify(services));
    return { organizationId: 'org_fixture', resyncAt };
  } });

  let runtime = createReceiver();
  const listener = createServer(async (request, response) => {
    try {
      const method = request.method;
      const result = await runtime.fetch(new Request('http://127.0.0.1' + request.url, {
        method, headers: request.headers,
        ...(method === 'GET' ? {} : { body: Readable.toWeb(request), duplex: 'half' }),
      }));
      response.writeHead(result.status, Object.fromEntries(result.headers));
      response.end(Buffer.from(await result.arrayBuffer()));
    } catch {
      response.writeHead(500).end();
    }
  });
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  t.after(() => new Promise(resolve => listener.close(resolve)));
  const base = `http://127.0.0.1:${listener.address().port}`;
  const webhook = base + '/webhooks/stripe/billing';
  const send = async (id, type, payload, options = {}) => {
    const { signedAt = NOW, secretOverride = secret, ...overrides } = options;
    const body = Buffer.from(JSON.stringify({
      object: 'event', livemode: false, id, type, created: NOW - 5000, data: { object: payload }, ...overrides,
    }));
    const signature = createHmac('sha256', secretOverride).update(signedAt + '.').update(body).digest('hex');
    const response = await fetch(webhook, {
      method: 'POST', body,
      headers: { 'Content-Type': 'application/json', 'Stripe-Signature': `t=${signedAt},v1=${signature}` },
    });
    return { status: response.status, ...await response.json() };
  };
  const invoice = { object: 'invoice', customer: CUSTOMER, status: 'paid' };
  const customer = { object: 'customer', id: CUSTOMER, metadata: { 'contract_business-dossier_end': '' } };
  const judge = async date => (await run('bash', [join(billing, 'contract/judge.sh'), '--services-json',
    servicesFile, '--service', 'business-dossier', '--date', date])).stdout.trim();

  await checkPersonal();
  await checkPaid('closed', []);
  assert.equal((await fetch(base + '/other')).status, 404);
  assert.equal((await fetch(webhook)).status, 405);
  assert.equal((await fetch(webhook, { method: 'POST', body: 'text' })).status, 415);
  assert.equal((await fetch(webhook, {
    method: 'POST', body: 'x'.repeat(262145), headers: { 'Content-Type': 'application/json' },
  })).status, 413);
  const unsigned = await fetch(webhook, {
    method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' },
  });
  assert.equal(unsigned.status, 400);
  assert.deepEqual(await unsigned.json(), { result: 'bad_signature' });
  assert.deepEqual(await send('evt_bad', 'invoice.paid', invoice, { secretOverride: 'wrong' }),
    { status: 400, result: 'bad_signature' });
  assert.deepEqual(await send('evt_stale', 'invoice.paid', invoice, { signedAt: NOW - 301 }),
    { status: 400, result: 'bad_signature' });
  assert.deepEqual(await send('evt_live', 'invoice.paid', invoice, { livemode: true }),
    { status: 400, result: 'invalid_event' });
  assert.deepEqual(await send('evt_other', 'invoice.paid', { ...invoice, customer: 'cus_other' }),
    { status: 400, result: 'wrong_customer' });
  assert.equal(calls, 0);

  // A valid paid notification about another invoice cannot dismiss a current overdue invoice.
  assert.equal((await send('evt_overdue', 'invoice.paid', { ...invoice, id: 'in_alreadyPaid' })).result, 'reconciled');
  assert.equal(await judge(dateFromToday(0)), 'view_only');
  await checkPaid('view_only', ['view']);
  state = 'paid';
  rejectNext = true;
  assert.equal((await send('evt_paid', 'invoice.paid', invoice)).result, 'retry');
  await checkPaid('view_only', ['view']);
  rejectNext = false;
  const repeated = await Promise.all([send('evt_paid', 'invoice.paid', invoice), send('evt_paid', 'invoice.paid', invoice)]);
  assert.deepEqual(repeated.map(result => result.result).sort(), ['duplicate', 'reconciled']);
  assert.equal(await judge(dateFromToday(0)), 'open');
  await checkPaid('open', ['view', 'edit', 'export']);
  await checkPaid('closed', [], { organizationId: 'org_wrong' });
  await checkPaid('closed', [], { subject: 'user_Unbound' });
  await checkPaid('closed', [], { tenantId: 'tenant-other' });
  await checkPaid('closed', [], { organizationId: null });
  await db.prepare("UPDATE paid_contract_members SET revoked_at = datetime('now') WHERE service = 'xesm'").run();
  const lookup = async (service, tenantId, subject, credential, operation, extra = {}) => {
    const result = await mf.dispatchFetch(`https://worker.example.invalid/v2/entitlements/check`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${credential}` },
      body: JSON.stringify({ issuer: ISSUER, subject, tenantId, service, operation, organizationId: 'org_fixture', ...extra }),
    });
    return [result.status, await result.json()];
  };
  // Both products in plans.json are retired, so the Worker answers closed
  // before it reads their token secrets. The projection itself is checked above.
  assert.deepEqual(await lookup('xesm', 'tenant-fixture', 'user_PaidOnly', xesmToken, 'view'),
    [200, { allowed: false, access: 'closed' }]);
  assert.deepEqual(await lookup('business-dossier', 'ws-fixture', 'user_PaidOnly', token, 'edit'),
    [200, { allowed: false, access: 'closed' }]);
  assert.deepEqual(await lookup('xesm', 'tenant-fixture', 'user_PaidOnly', token, 'view'),
    [200, { allowed: false, access: 'closed' }]);
  assert.deepEqual(await lookup('business-dossier', 'ws-fixture', 'user_PaidOnly', token, 'edit', { paid: true }),
    [400, { error: 'invalid_input' }]);
  await db.prepare('UPDATE paid_contract_members SET revoked_at = NULL').run();
  await db.prepare("UPDATE paid_contract_snapshots SET expires_at = datetime('now', '-1 second')").run();
  await checkPaid('closed', []);
  for (const [service, tenantId] of PRODUCTS) {
    // A retired id answers closed even when a personal grant row still exists.
    for (const subject of ['user_Staff', 'user_Legacy']) {
      assert.deepEqual(await lookup(service, tenantId, subject, service === 'xesm' ? xesmToken : token, 'edit'),
        [200, { allowed: false, access: 'closed' }]);
    }
  }

  state = 'cancelled';
  assert.equal((await send('evt_cancel', 'customer.updated', customer)).result, 'reconciled');
  assert.equal(services['business-dossier'].until, expires);
  assert.equal(services.xesm.until, expires);
  await checkPaid('read_export_only', ['view', 'export']);
  assert.equal(await judge(dateFromToday(0)), 'read_export_only');

  expires = dateFromToday(-30);
  assert.equal((await send('evt_day30', 'customer.updated', customer)).result, 'reconciled');
  await checkPaid('read_export_only', ['view', 'export']);

  expires = dateFromToday(-31);
  assert.equal((await send('evt_close', 'customer.updated', customer)).result, 'reconciled');
  await checkPaid('closed', []);
  assert.equal((await send('evt_late', 'invoice.paid', invoice)).result, 'reconciled');
  assert.equal(services['business-dossier'].until, expires);
  await checkPaid('closed', []);
  assert.equal(calls, 7);

  const boundaryCases = [
    [1, 'open', ['view', 'edit', 'export']],
    [0, 'open', ['view', 'edit', 'export']],
    [-1, 'read_export_only', ['view', 'export']],
    [-30, 'read_export_only', ['view', 'export']],
    [-31, 'closed', []],
  ];
  for (const [endedService] of PRODUCTS) {
    endingService = endedService;
    for (const [daysRemaining, expectedAccess, allowedOperations] of boundaryCases) {
      await t.test(`ending ${endedService} at day ${daysRemaining} leaves the other service open`, async () => {
        expires = dateFromToday(daysRemaining);
        const eventId = `evt_boundary${calls}`;
        assert.equal((await send(eventId, 'customer.updated', customer)).result, 'reconciled');
        assert.equal(services[endedService].until, expires);
        for (const [service, tenantId] of PRODUCTS) {
          const row = await db.prepare(`
            SELECT s.services_json, date('now', '+9 hours') AS today
            FROM paid_contract_members AS m
            JOIN paid_contract_snapshots AS s
              ON s.issuer = m.issuer AND s.organization_id = m.organization_id
            WHERE m.issuer = ?1 AND m.subject = 'user_PaidOnly' AND m.service = ?2 AND m.tenant_id = ?3
              AND m.organization_id = 'org_fixture' AND m.revoked_at IS NULL
              AND unixepoch(s.expires_at) > unixepoch('now')
          `).bind(ISSUER, service, tenantId).first();
          const actualAccess = row ? paidEntitlement(JSON.parse(row.services_json), service, row.today) : 'closed';
          const ending = service === endedService;
          assert.equal(actualAccess, ending ? expectedAccess : 'open', `${service}/${expectedAccess}`);
          for (const operation of ['view', 'edit', 'export']) {
            const permitted = actualAccess === 'open'
              || (actualAccess === 'view_only' && operation === 'view')
              || (actualAccess === 'read_export_only' && operation !== 'edit');
            assert.equal(permitted, !ending || allowedOperations.includes(operation), `${service}/${operation}`);
          }
        }
      });
    }
  }
  await t.test('fresh Clerk organization readback drives removal and requires new approval to rejoin', async () => {
    state = 'paid';
    assert.equal((await send('evt_beforeMembershipRemoval', 'invoice.paid', invoice)).result, 'reconciled');
    await checkPaid('open', ['view', 'edit', 'export']);

    members = ['user_Unbound'];
    incompleteMemberships = true;
    assert.equal((await send('evt_removeMembership', 'customer.updated', customer)).result, 'retry');
    await checkPaid('open', ['view', 'edit', 'export']);
    incompleteMemberships = false;
    assert.equal((await send('evt_removeMembership', 'customer.updated', customer)).result, 'reconciled');
    await checkPaid('closed', []);
    assert.equal((await send('evt_removeMembership', 'customer.updated', customer)).result, 'duplicate');
    members = ['user_PaidOnly', 'user_Unbound'];
    assert.equal((await send('evt_rejoin', 'customer.updated', customer)).result, 'reconciled');
    await checkPaid('closed', []);
    approvalRef = 'new-owner-approval';
    assert.equal((await send('evt_reapprove', 'customer.updated', customer)).result, 'reconciled');
    await checkPaid('open', ['view', 'edit', 'export']);
  });

  await t.test('an earlier observation cannot overwrite confirmed rights or revoke membership', async () => {
    const latest = await db.prepare('SELECT observed_at_ms FROM paid_contract_snapshots').first();
    const outcome = await writePaidProjection(db, {
      issuer: ISSUER, observedAtMs: latest.observed_at_ms - 1,
      confirmedOrganization: { id: 'org_fixture', object: 'organization', public_metadata: { services: {} } },
      approvedBindings: [], members: [],
    });
    assert.equal(outcome, false);
    await checkPaid('open', ['view', 'edit', 'export']);
  });

  await t.test('the periodic trigger refreshes the same snapshot before normal reads', async () => {
    await db.prepare("UPDATE paid_contract_snapshots SET expires_at = datetime('now', '-1 second')").run();
    await checkPaid('closed', []);
    const scheduled = new Promise(resolve => {
      const timer = setInterval(() => {
        clearInterval(timer);
        resolve(runtime.scheduled());
      }, 10);
    });
    assert.equal((await scheduled).result, 'reconciled');
    await checkPaid('open', ['view', 'edit', 'export']);
  });

  await t.test('a restarted webhook receiver returns a durable receipt without repeating the billing sync', async () => {
    const id = 'evt_restartReplay';
    assert.equal((await send(id, 'invoice.paid', invoice)).result, 'reconciled');
    const beforeRestart = calls;
    runtime = createReceiver();
    assert.equal((await send(id, 'invoice.paid', invoice)).result, 'duplicate');
    assert.equal(calls, beforeRestart);
  });

  await t.test('separate receivers and the scheduler cannot run the same customer simultaneously', async () => {
    const id = 'evt_replicaRace';
    const ready = Promise.withResolvers();
    const unblock = Promise.withResolvers();
    const previous = calls;
    beforeReconciliation = () => {
      ready.resolve();
      return unblock.promise;
    };
    const inflight = send(id, 'invoice.paid', invoice);
    try {
      await ready.promise;
      runtime = createReceiver();
      assert.deepEqual(await send(id, 'invoice.paid', invoice), { status: 503, result: 'retry' });
      assert.deepEqual(await runtime.scheduled(), { status: 503, result: 'retry' });
      assert.equal(calls, previous);
    } finally {
      beforeReconciliation = undefined;
      unblock.resolve();
      assert.deepEqual(await inflight, { status: 200, result: 'reconciled' });
    }
    assert.deepEqual(await send(id, 'invoice.paid', invoice), { status: 200, result: 'duplicate' });
    assert.equal(calls, previous + 1);
  });

  await t.test('delivery recovers when a crashed receiver’s unfinished lease expires', async () => {
    const id = 'evt_crashRecovery';
    await db.prepare('INSERT INTO billing_reconciliation_leases VALUES (?, ?, ?)')
      .bind(CUSTOMER, 'crashed-fixture', Date.now() + 60_000).run();
    const previous = calls;
    assert.deepEqual(await send(id, 'invoice.paid', invoice), { status: 503, result: 'retry' });
    assert.equal(calls, previous);
    await db.prepare('UPDATE billing_reconciliation_leases SET expires_at_ms = ? WHERE customer_id = ?')
      .bind(Date.now() - 1, CUSTOMER).run();
    assert.deepEqual(await send(id, 'invoice.paid', invoice), { status: 200, result: 'reconciled' });
    assert.deepEqual(await send(id, 'invoice.paid', invoice), { status: 200, result: 'duplicate' });
    assert.equal(calls, previous + 1);
    await checkPaid('open', ['view', 'edit', 'export']);
  });

  for (const takeover of [false, true]) {
    await t.test(`an expired receiver cannot project paid rights (takeover=${takeover})`, async () => {
      const before = await db.prepare('SELECT * FROM paid_contract_snapshots').all();
      const beforeMembers = await db.prepare('SELECT * FROM paid_contract_members ORDER BY subject, service').all();
      const id = takeover ? 'evt_FenceTakeover' : 'evt_FenceExpired';
      const ready = Promise.withResolvers();
      const resume = Promise.withResolvers();
      beforeMemberRead = () => { ready.resolve(); return resume.promise; };
      const old = send(id, 'invoice.paid', invoice);
      let newLease;
      const receipts = createD1NotificationReceipts(db);
      try {
        await ready.promise;
        await db.prepare('UPDATE billing_reconciliation_leases SET expires_at_ms = 0 WHERE customer_id = ?')
          .bind(CUSTOMER).run();
        if (takeover) {
          newLease = await receipts.reserve(CUSTOMER, 'evt_NextOwner');
          assert.equal(newLease.state, 'reserved');
        }
      } finally {
        beforeMemberRead = undefined;
        resume.resolve();
      }
      try {
        assert.deepEqual(await old, { status: 503, result: 'retry' });
        assert.deepEqual((await db.prepare('SELECT * FROM paid_contract_snapshots').all()).results, before.results);
        assert.deepEqual((await db.prepare('SELECT * FROM paid_contract_members ORDER BY subject, service').all()).results, beforeMembers.results);
        assert.equal(await db.prepare('SELECT event_id FROM billing_notification_receipts WHERE event_id = ?').bind(id).first(), null);
        if (takeover) {
          assert.equal((await db.prepare('SELECT owner FROM billing_reconciliation_leases WHERE customer_id = ?').bind(CUSTOMER).first()).owner, newLease.owner);
        }
      } finally {
        if (newLease?.owner) await receipts.abandon(CUSTOMER, newLease.owner);
      }
    });
  }

  await checkPersonal();
  assert.deepEqual((await db.prepare('SELECT * FROM account_grants ORDER BY id').all()).results, original);
});

test('a projection that is not applied keeps the receipt open for the same event', async t => {
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true, script: 'export default { fetch() { return new Response("ok"); } }',
    compatibilityDate: '2026-10-26', d1Databases: ['ACCOUNT_GRANTS'],
    cf: false, telemetry: { enabled: false },
  }));
  t.after(() => mf.dispose());
  const db = await mf.getD1Database('ACCOUNT_GRANTS');
  for (const file of ['0002_paid_contract_projection.sql', '0003_paid_projection_revision.sql', '0004_billing_notification_receipts.sql']) {
    const migration = await readFile(new URL('migrations/' + file, import.meta.url), 'utf8');
    await db.batch(migration.split(';').map(sql => sql.trim()).filter(Boolean).map(sql => db.prepare(sql)));
  }

  const secret = randomBytes(32).toString('hex');
  const customerId = 'cus_projection';
  const confirmed = { organizationId: 'org_fixture', resyncAt: 'resync_fixture' };
  const observedAtMs = Date.now() - 1000;
  const observation = {
    issuer: ISSUER, observedAtMs, members: [], approvedBindings: [],
    confirmedOrganization: { id: confirmed.organizationId, object: 'organization', public_metadata: { services: {} } },
  };
  assert.equal(await writePaidProjection(db, observation), true);
  let projections = 0;
  const receivers = {
    secret, customer: customerId, now: () => NOW,
    reconcile: async customer => {
      assert.equal(customer, customerId);
      return confirmed;
    },
    receipts: createD1NotificationReceipts(db),
  };
  assert.throws(() => createSandboxBillingRuntime(receivers), /Invalid sandbox configuration/);

  const runtime = createSandboxBillingRuntime({
    ...receivers,
    project: async (observed, lease) => {
      assert.deepEqual(observed, confirmed);
      assert.equal(lease.customer, customerId);
      assert.match(lease.owner, /^[0-9a-f-]{36}$/);
      const timestamp = observedAtMs + projections++;
      return writePaidProjection(db, { ...observation, observedAtMs: timestamp }, { lease });
    },
  });
  const send = async () => {
    const body = Buffer.from(JSON.stringify({
      object: 'event', livemode: false, id: 'evt_projectionGate', type: 'invoice.paid',
      created: NOW - 1, data: { object: { object: 'invoice', customer: customerId, status: 'paid' } },
    }));
    const signature = createHmac('sha256', secret).update(NOW + '.').update(body).digest('hex');
    const response = await runtime.fetch(new Request('https://worker.example.invalid/webhooks/stripe/billing', {
      method: 'POST', body,
      headers: { 'Content-Type': 'application/json', 'Stripe-Signature': `t=${NOW},v1=${signature}` },
    }));
    return { status: response.status, ...await response.json() };
  };

  assert.deepEqual(await send(), { status: 503, result: 'retry' });
  assert.equal(projections, 1);
  assert.equal(await db.prepare('SELECT event_id FROM billing_notification_receipts WHERE customer_id = ?')
    .bind(customerId).first(), null);
  assert.equal(await db.prepare('SELECT owner FROM billing_reconciliation_leases WHERE customer_id = ?')
    .bind(customerId).first(), null);

  assert.deepEqual(await send(), { status: 200, result: 'reconciled' });
  assert.equal(projections, 2);
  assert.deepEqual(await db.prepare('SELECT event_id FROM billing_notification_receipts WHERE customer_id = ?')
    .bind(customerId).first(), { event_id: 'evt_projectionGate' });

  assert.deepEqual(await send(), { status: 200, result: 'duplicate' });
  assert.equal(projections, 2);
});
