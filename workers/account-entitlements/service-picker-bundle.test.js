import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { convertV4MiniflareOptions, Miniflare } from 'miniflare';

test('一覧の配布物が署名済み主体のサービスを返し、製品サーバーの照会を受けない', async t => {
  const { ACCOUNT_PICKER_BUNDLE: scriptPath } = process.env;
  assert.ok(scriptPath, 'Wranglerのdry-runで生成した一覧Workerのファイルを指定してください');
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const origin = 'https://account.example.invalid';
  const issuer = 'https://clerk.example.invalid';
  const worker = new Miniflare(convertV4MiniflareOptions({
    modules: true, script: await readFile(scriptPath, 'utf8'), compatibilityDate: '2026-07-13', cf: false,
    telemetry: { enabled: false }, d1Databases: ['ACCOUNT_GRANTS'],
    bindings: {
      ACCOUNT_SITE_ORIGIN: origin, CLERK_ISSUER: issuer,
      CLERK_SIGN_IN_URL: 'https://accounts.example.invalid/sign-in',
      CLERK_JWT_KEY: publicKey.export({ type: 'spki', format: 'pem' }),
      SAMPLE_SERVICE_URL: 'https://sample-fixture.cor-jp.com/',
    },
  }));
  t.after(() => worker.dispose());
  const url = origin + '/api/account/services';
  const guest = await worker.dispatchFetch(url);
  assert.equal(guest.status, 401);
  assert.equal((await guest.json()).error, 'sign_in_required');
  assert.equal((await worker.dispatchFetch(url, { method: 'POST' })).status, 405);
  assert.equal((await worker.dispatchFetch(origin + '/v2/entitlements/check', { method: 'POST' })).status, 404);

  const db = await worker.getD1Database('ACCOUNT_GRANTS');
  const migration = await readFile(new URL('./migrations/0001_account_grants.sql', import.meta.url), 'utf8');
  await db.batch(migration.split(';').map(s => s.trim()).filter(Boolean).map(sql => db.prepare(sql)));
  await db.prepare(`INSERT INTO account_grants VALUES
    ('fixture',?1,'user_Fixture','sample','tenant-fixture','staff','2020-01-01','2099-01-01','fixture',NULL,NULL)`)
    .bind(issuer).run();
  const now = Math.floor(Date.now() / 1000);
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const data = encode({ alg: 'RS256', typ: 'JWT', kid: 'fixture', cat: 'cl_B7d4PD111AAA' }) + '.' +
    encode({ sub: 'user_Fixture', iss: issuer, sid: 'sess_Fixture', azp: origin, v: 2, iat: now, nbf: now, exp: now + 60 });
  const cookie = '__session=' + data + '.' + sign('sha256', Buffer.from(data), privateKey).toString('base64url');
  const request = () => worker.dispatchFetch(url, { headers: { Cookie: cookie } });
  const allowed = await request();
  assert.equal(allowed.status, 200);
  assert.deepEqual((await allowed.json()).services,
    [{ id: 'sample', label: '見本のサービス', href: 'https://sample-fixture.cor-jp.com/', access: 'open' }]);
  await db.prepare("UPDATE account_grants SET revoked_at = datetime('now'), revocation_ref = 'fixture' WHERE id = 'fixture'").run();
  assert.deepEqual((await (await request()).json()).services, []);
});
