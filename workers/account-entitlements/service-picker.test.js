import assert from 'node:assert/strict';
import { generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { convertV4MiniflareOptions, Miniflare } from 'miniflare';

const networkFetch = globalThis.fetch;
globalThis.fetch = (input, options) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  assert.ok(url.hostname === '127.0.0.1' || url.hostname === 'localhost', 'blocked non-loopback fetch');
  return networkFetch(input, options);
};
const { verifyToken } = await import('@clerk/backend');
const { default: account } = await import('./account.js');
const { paidEntitlement } = await import('./service-picker.js');

const origin = 'https://cor-jp.com';
const issuer = 'https://clerk.example.invalid';
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

function session(subject, overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const data = encode({ alg: 'RS256', typ: 'JWT', kid: 'fixture', cat: 'cl_B7d4PD111AAA' }) + '.' + encode({
    iss: issuer, sub: subject, azp: origin, sid: 'sess_Fixture', v: 2, exp: now + 55,
    iat: now - 1, nbf: now - 1, ...overrides,
  });
  return data + '.' + sign('sha256', Buffer.from(data), privateKey).toString('base64url');
}

test('Clerk organization entitlement policy matches shared vectors', async () => {
  const { vectors } = JSON.parse(await readFile(new URL('../../docs/billing/contract/entitlement-vectors.json', import.meta.url)));
  for (const row of vectors) assert.equal(paidEntitlement(row.services, row.service, row.d), row.expect, row.id);
});

test('self-service route and browser use signed user plus active D1 grants', async t => {
  const productKey = randomBytes(32).toString('base64url');
  const xesmKey = randomBytes(32).toString('base64url');
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true, scriptPath: fileURLToPath(new URL('index.js', import.meta.url)),
    bindings: { CLERK_ISSUER: issuer, BD_ENTITLEMENT_QUERY_TOKEN: productKey, XESM_ENTITLEMENT_QUERY_TOKEN: xesmKey },
    compatibilityDate: '2026-10-26', d1Databases: ['ACCOUNT_GRANTS'], cf: false,
  }));
  t.after(() => mf.dispose());
  const db = await mf.getD1Database('ACCOUNT_GRANTS');
  const migration = await readFile(new URL('migrations/0001_account_grants.sql', import.meta.url), 'utf8');
  await db.batch(migration.split(';').map(sql => sql.trim()).filter(Boolean).map(sql => db.prepare(sql)));
  const grant = async (id, subject, service, kind = 'staff') => db.prepare(`
    INSERT INTO account_grants VALUES (?1, ?2, ?3, ?4, 'tenant-fixture', ?5, '2020-01-01', '2099-01-01', 'fixture', NULL, NULL)
  `).bind(id, issuer, subject, service, kind).run();
  await grant('second', 'user_Two', 'business-dossier');
  await grant('third', 'user_Two', 'xesm');
  await grant('single', 'user_One', 'xesm', 'legacy');
  await grant('live-revoke', 'user_Revoke', 'business-dossier', 'legacy');
  await grant('revoked', 'user_None', 'xesm');
  const revoke = async id => db.prepare(
    "UPDATE account_grants SET revoked_at = datetime('now'), revocation_ref = 'fixture' WHERE id = ?1"
  ).bind(id).run();
  await revoke('revoked');

  const env = {
    ACCOUNT_SITE_ORIGIN: origin,
    CLERK_ISSUER: issuer,
    CLERK_JWT_KEY: publicKey.export({ type: 'spki', format: 'pem' }),
    CLERK_SIGN_IN_URL: 'https://accounts.example.invalid/sign-in',
    BD_SERVICE_URL: process.env.BD_SERVICE_URL ?? 'https://bd-fixture.cor-jp.com/',
    XESM_SERVICE_URL: process.env.XESM_SERVICE_URL ?? 'https://xesm-fixture.cor-jp.com/',
    ACCOUNT_GRANTS: db,
  };
  const request = (token, pathname = '/api/account/services', bindings = env) => account.fetch(new Request(origin + pathname, {
    headers: token ? { Cookie: '__session=' + token } : {},
  }), bindings);
  const rows = async token => {
    const res = await request(token);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'private, no-store');
    return (await res.json()).services.map(service => service.id);
  };
  assert.equal((await verifyToken(session('user_Two'), { jwtKey: env.CLERK_JWT_KEY, issuer, authorizedParties: [origin], clockSkewInMs: 0 })).sub, 'user_Two');
  assert.deepEqual(await rows(session('user_Two')), ['business-dossier', 'xesm']);
  assert.deepEqual(await rows(session('user_One')), ['xesm']);
  assert.deepEqual(await rows(session('user_None')), []);
  const revokeSession = session('user_Revoke');
  assert.deepEqual(await rows(revokeSession), ['business-dossier']);
  await revoke('live-revoke');
  assert.deepEqual(await rows(revokeSession), []);

  assert.equal((await request()).status, 401);
  assert.equal((await request(session('user_Two', { iss: 'https://other.example.invalid' }))).status, 401);
  assert.equal((await request(session('user_Two', { azp: 'https://other.example.invalid' }))).status, 401);
  assert.equal((await request(session('user_Two', { exp: 0 }))).status, 401);
  const token = session('user_Two');
  const pieces = token.split('.');
  pieces[2] = (pieces[2][0] === 'A' ? 'B' : 'A') + pieces[2].slice(1);
  assert.equal((await request(pieces.join('.'))).status, 401);
  assert.equal((await request(token, '/api/account/services?subject=user_One')).status, 404);
  assert.equal((await request(token, '/api/account/services', { ...env, XESM_SERVICE_URL: 'https://untrusted.invalid/' })).status, 503);
  assert.equal((await request(session('user_Two', { v: 1 }))).status, 401);
  assert.equal((await request(session('user_Two', { sts: 'pending' }))).status, 401);
  assert.equal((await request(session('user_Two', { nbf: Math.floor(Date.now() / 1000) + 20 }))).status, 401);
  const paidClerkClaims = {
    o: { id: 'org_Fixture' },
    cor_svc: {
      'business-dossier': { from: '2020-01-01', hold: true },
      xesm: { from: '2020-01-01', until: '2020-02-01', hold: false },
    },
  };
  const paidResponse = await request(session('user_Two', paidClerkClaims));
  assert.equal(paidResponse.status, 200);
  assert.deepEqual((await paidResponse.json()).services, [{ id: 'business-dossier', access: 'view_only', href: env.BD_SERVICE_URL }]);
  assert.deepEqual(await rows(session('user_Two', { ...paidClerkClaims, cor_svc: null })), []);
  assert.deepEqual(await rows(session('user_Two', { ...paidClerkClaims, iat: Math.floor(Date.now() / 1000) - 61 })), []);
  assert.deepEqual(await rows(session('user_Two')), ['business-dossier', 'xesm']);
  assert.deepEqual(await rows(session('user_None', { cor_svc: paidClerkClaims.cor_svc })), []);
  assert.equal((await account.fetch(new Request(origin + '/api/account/services', {
    headers: { Cookie: '__session=' + token, 'Sec-Fetch-Site': 'cross-site' },
  }), env)).status, 403);
  for (const [tenantId, allowed] of [['tenant-fixture', true], ['other-tenant', false]]) {
    const product = await mf.dispatchFetch('https://entitlements.example.invalid/v1/entitlements/check', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + productKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ service: 'business-dossier', issuer, subject: 'user_Two', tenantId }),
    });
    assert.deepEqual(await product.json(), { allowed });
  }
  const paidSubject = 'user_PaidOnly';
  const jstDate = days => new Date(Date.now() + (days * 24 + 9) * 3_600_000).toISOString().slice(0, 10);
  const paidPhases = [
    { name: 'Open', until: null, hold: false, access: 'open', label: 'Business Dossier' },
    { name: 'Held', until: null, hold: true, access: 'view_only', label: 'Business Dossier（閲覧のみ）' },
    { name: 'ReadExport', until: jstDate(-1), hold: false, access: 'read_export_only', label: 'Business Dossier（閲覧・書き出しのみ）' },
    { name: 'Closed', until: jstDate(-31), hold: false },
  ];
  const paidPhaseSession = ({ until, hold }) => session(paidSubject, {
    o: { id: 'org_PaidOnly' },
    cor_svc: { 'business-dossier': { from: jstDate(-90), until, hold } },
  });
  const products = [['business-dossier', productKey], ['xesm', xesmKey]];
  const grantSubjects = [['user_Two', [true, true]], ['user_One', [false, true]], [paidSubject, [false, false]]];
  const grantRows = () => db.prepare('SELECT * FROM account_grants ORDER BY id').all().then(result => result.results);
  const initialGrants = await grantRows();
  await t.test('paid stop and grace do not mutate independent personal product grants', async () => {
    for (const phase of paidPhases) {
      const response = await request(paidPhaseSession(phase));
      assert.equal(response.status, 200);
      assert.deepEqual((await response.json()).services, phase.access
        ? [{ id: 'business-dossier', href: env.BD_SERVICE_URL, access: phase.access }]
        : [], phase.name);
      for (const [subject, expected] of grantSubjects) {
        const allowedServices = [];
        for (const [index, [service, key]] of products.entries()) {
          const product = await mf.dispatchFetch('https://entitlements.example.invalid/v1/entitlements/check', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
            body: JSON.stringify({ service, issuer, subject, tenantId: 'tenant-fixture' }),
          });
          assert.equal(product.status, 200);
          assert.deepEqual(await product.json(), { allowed: expected[index] }, phase.name);
          if (expected[index]) allowedServices.push(service);
        }
        assert.deepEqual(await rows(session(subject)), allowedServices, phase.name);
      }
      assert.deepEqual(await grantRows(), initialGrants, phase.name);
    }
    console.log('Paid lifecycle: open → held → read/export → closed; staff 2 and legacy 1 stable at both entry points; paid-only personal 0; D1 unchanged.');
  });
  console.log('D1 revocation reflected on the next request; stopped or stale paid claims exposed zero links; personal access only for the granted tenant.');
  const output = process.env.ACCOUNT_PICKER_BROWSER_OUTPUT;
  if (!output) return;
  await mkdir(output, { recursive: true });
  const root = resolve(import.meta.dirname, '../..', 'dist');
  const server = createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url, origin).pathname;
      if (pathname === '/api/account/services') {
        const result = await account.fetch(new Request(origin + req.url, { headers: req.headers }), env);
        res.writeHead(result.status, Object.fromEntries(result.headers));
        return res.end(await result.text());
      }
      const path = resolve(root, '.' + pathname + (pathname.endsWith('/') ? 'index.html' : ''));
      if (!path.startsWith(root + '/')) return res.writeHead(404).end();
      const data = await readFile(path);
      const types = { js: 'text/javascript', css: 'text/css', html: 'text/html' };
      res.writeHead(200, { 'Content-Type': types[path.split('.').at(-1)] || 'application/octet-stream' });
      res.end(data);
    } catch {
      res.writeHead(404).end();
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const localUrl = 'http://127.0.0.1:' + server.address().port;
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-background-networking'] });
  t.after(() => browser.close());
  await grant('browser-revoke', 'user_BrowserRevoke', 'business-dossier', 'legacy');
  for (const [name, expected] of [
    ['Two', ['Business Dossier', 'XESM']], ['One', ['XESM']], ['None', []],
    ['Outside', []], ['BrowserRevoke', ['Business Dossier']], ['Guest', []],
  ]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await context.route('**/*', route => route.request().url().startsWith(localUrl + '/') ? route.continue() : route.abort());
    if (name !== 'Guest') await context.addCookies([{ name: '__session', value: session('user_' + name), url: localUrl, httpOnly: true }]);
    const page = await context.newPage();
    await page.goto(localUrl + '/account/services/');
    if (name === 'Guest') await page.getByRole('link', { name: 'Cor.アカウントでログイン' }).waitFor();
    if (name !== 'Guest' && !expected.length) await page.getByText('現在利用できるサービスはありません。').waitFor();
    if (expected.length) await page.getByText('開くサービスを選んでください。').waitFor();
    const productLinks = page.locator('#account-services a');
    assert.deepEqual(await productLinks.allTextContents(), expected);
    const linkTargets = await productLinks.evaluateAll(links => links.map(link => link.href));
    assert.deepEqual(linkTargets, expected.map(label => label === 'XESM' ? env.XESM_SERVICE_URL : env.BD_SERVICE_URL));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    if (name === 'Two') {
      await page.screenshot({ path: join(output, name + '.png') });
      await context.addCookies([{ name: '__session', value: session('user_Two', paidClerkClaims), url: localUrl, httpOnly: true }]);
      await page.reload();
      await page.getByText('開くサービスを選んでください。').waitFor();
      assert.deepEqual(await productLinks.allTextContents(), ['Business Dossier（閲覧のみ）']);
      await page.screenshot({ path: join(output, 'SameUserOrganization.png') });
      await context.addCookies([{ name: '__session', value: session('user_Two'), url: localUrl, httpOnly: true }]);
      await page.reload();
      await page.getByText('開くサービスを選んでください。').waitFor();
      assert.deepEqual(await productLinks.allTextContents(), expected);
    }
    await page.screenshot({ path: join(output, name + '.png') });
    if (name === 'BrowserRevoke') {
      await revoke('browser-revoke');
      await page.reload();
      await page.getByText('現在利用できるサービスはありません。').waitFor();
      assert.equal(await productLinks.count(), 0);
      await page.screenshot({ path: join(output, 'SameSessionRevoked.png') });
    }
    await context.close();
  }
  const paidContext = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await paidContext.route('**/*', route => route.request().url().startsWith(localUrl + '/') ? route.continue() : route.abort());
  const paidPage = await paidContext.newPage();
  for (const phase of paidPhases) {
    await paidContext.addCookies([{ name: '__session', value: paidPhaseSession(phase), url: localUrl, httpOnly: true }]);
    await paidPage.goto(localUrl + '/account/services/');
    const links = paidPage.locator('#account-services a');
    if (phase.label) {
      await paidPage.getByRole('link', { name: phase.label, exact: true }).waitFor();
      assert.deepEqual(await links.allTextContents(), [phase.label]);
    } else {
      await paidPage.getByText('現在利用できるサービスはありません。').waitFor();
      assert.equal(await links.count(), 0);
    }
    await paidPage.screenshot({ path: join(output, 'Paid' + phase.name + '.png') });
  }
  await paidContext.close();
  console.log('Chromium paid-only: open 1 → held 1 → read/export 1 → closed 0, same user and organization.');
  console.log('Chromium: staff 2, legacy 1, outside 0, same-session revocation 1 → 0, signed-out 0; configured hrefs; same user personal 2 → organization hold 1 → personal 2; live Clerk requests 0');
});
