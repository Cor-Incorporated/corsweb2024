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
import { writePaidProjection } from './paid-projection.js';
import { createClerkPaidProjector } from '../../docs/billing/project-paid-contracts.mjs';
import { createSandboxBillingRuntime } from '../../docs/billing/notification-reconcile.mjs';

const run = promisify(execFile);
const billing = fileURLToPath(new URL('../../docs/billing/', import.meta.url));
const NOW = 1795500000;
const CUSTOMER = 'cus_fixture';
const PRODUCTS = [['business-dossier', 'ws-fixture'], ['xesm', 'tenant-fixture']];
const dateFromToday = days => new Date(Date.now() + (days * 24 + 9) * 3600000).toISOString().slice(0, 10);
const ISSUER = 'https://clerk.example.invalid';

test('billing notifications reconcile current paid rights and preserve personal grants', async t => {
  const scratch = await mkdtemp(join(tmpdir(), 'billing-reconcile-'));
  t.after(() => rm(scratch, { recursive: true, force: true }));
  await symlink(join(billing, 'tests/fake-curl.sh'), join(scratch, 'curl'));
  const token = randomBytes(32).toString('base64url');
  const xesmToken = randomBytes(32).toString('base64url');
  const secret = randomBytes(32).toString('hex');
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true, scriptPath: fileURLToPath(new URL('index.js', import.meta.url)),
    compatibilityDate: '2026-10-26', d1Databases: ['ACCOUNT_GRANTS'],
    bindings: { CLERK_ISSUER: ISSUER, BD_ENTITLEMENT_QUERY_TOKEN: token, XESM_ENTITLEMENT_QUERY_TOKEN: xesmToken },
    cf: false, telemetry: { enabled: false },
  }));
  t.after(() => mf.dispose());
  const db = await mf.getD1Database('ACCOUNT_GRANTS');
  for (const name of ['0001_account_grants.sql', '0002_paid_contract_projection.sql', '0003_paid_projection_revision.sql']) {
    const migration = await readFile(new URL('migrations/' + name, import.meta.url), 'utf8');
    await db.batch(migration.split(';').map(sql => sql.trim()).filter(Boolean).map(sql => db.prepare(sql)));
  }
  for (const [service, tenantId] of PRODUCTS) {
    for (const [subject, kind] of [['user_Staff', 'staff'], ['user_Legacy', 'legacy']]) {
      await db.prepare(`INSERT INTO account_grants
        (id,issuer,subject,service,tenant_id,kind,starts_on,ends_on,approval_ref)
        VALUES (?,?,?,?,?,?,'2020-01-01','2099-12-31','fixture')`)
        .bind(`${service}-${kind}`, ISSUER, subject, service, tenantId, kind).run();
    }
  }
  const checkPersonal = async () => {
    for (const [service, tenantId] of PRODUCTS) {
      const credential = service === 'xesm' ? xesmToken : token;
      for (const [subject, allowed] of [['user_Staff', true], ['user_Legacy', true], ['user_PaidOnly', false]]) {
        const result = await mf.dispatchFetch('https://worker.example.invalid/v1/entitlements/check', {
          method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${credential}` },
          body: JSON.stringify({ issuer: ISSUER, subject, service, tenantId }),
        });
        assert.equal(result.status, 200);
        assert.deepEqual(await result.json(), { allowed });
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
    for (const [service, tenantId] of PRODUCTS) {
      for (const operation of ['view', 'edit', 'export']) {
        const result = await mf.dispatchFetch('https://worker.example.invalid/v2/entitlements/check', {
          method: 'POST', headers: {
            'content-type': 'application/json', authorization: `Bearer ${service === 'xesm' ? xesmToken : token}`,
          },
          body: JSON.stringify({
            issuer: ISSUER, subject: 'user_PaidOnly', organizationId: 'org_fixture', tenantId, service, operation,
            ...overrides,
          }),
        });
        assert.equal(result.status, 200, `${service}/${operation}`);
        assert.deepEqual(await result.json(), { access, allowed: allowedOperations.includes(operation) });
      }
    }
  };
  let rejectNext = false;
  let services = {};
  let resyncAt;
  let members = ['user_PaidOnly', 'user_Unbound'];
  let approvalRef = 'fixture';
  let incompleteMemberships = false;
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
      return Response.json({
        total_count: members.length + Number(incompleteMemberships),
        data: members.map(subject => ({
          organization: { id: 'org_fixture' }, public_user_data: { user_id: subject },
        })),
      });
    },
  });
  const runtime = createSandboxBillingRuntime({ secret, customer: CUSTOMER, now: () => NOW, project,
    reconcile: async customer => {
    assert.equal(customer, CUSTOMER);
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
  assert.deepEqual(repeated.map(result => result.result), ['reconciled', 'duplicate']);
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
  assert.deepEqual(await lookup('xesm', 'tenant-fixture', 'user_PaidOnly', xesmToken, 'view'),
    [200, { allowed: false, access: 'closed' }]);
  assert.deepEqual(await lookup('business-dossier', 'ws-fixture', 'user_PaidOnly', token, 'edit'),
    [200, { allowed: true, access: 'open' }]);
  assert.deepEqual(await lookup('xesm', 'tenant-fixture', 'user_PaidOnly', token, 'view'),
    [401, { error: 'unauthorized' }]);
  assert.deepEqual(await lookup('business-dossier', 'ws-fixture', 'user_PaidOnly', token, 'edit', { paid: true }),
    [400, { error: 'invalid_input' }]);
  await db.prepare('UPDATE paid_contract_members SET revoked_at = NULL').run();
  await db.prepare("UPDATE paid_contract_snapshots SET expires_at = datetime('now', '-1 second')").run();
  await checkPaid('closed', []);
  for (const [service, tenantId] of PRODUCTS) {
    for (const subject of ['user_Staff', 'user_Legacy']) {
      assert.deepEqual(await lookup(service, tenantId, subject, service === 'xesm' ? xesmToken : token, 'edit'),
        [200, { allowed: true, access: 'open' }]);
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
          const credential = service === 'xesm' ? xesmToken : token;
          for (const operation of ['view', 'edit', 'export']) {
            const ending = service === endedService;
            assert.deepEqual(await lookup(service, tenantId, 'user_PaidOnly', credential, operation), [
              200,
              { access: ending ? expectedAccess : 'open', allowed: !ending || allowedOperations.includes(operation) },
            ], `${service}/${operation}`);
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

  await checkPersonal();
  assert.deepEqual((await db.prepare('SELECT * FROM account_grants ORDER BY id').all()).results, original);
});
