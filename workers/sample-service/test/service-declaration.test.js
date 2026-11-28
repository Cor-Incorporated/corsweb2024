// C-D2: the service name this product sends must be the one the central declaration knows.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { serviceById } from '../../account-entitlements/services.js';

const config = await readFile(new URL('../wrangler.toml', import.meta.url), 'utf8');

function configVar(name) {
  const match = new RegExp(`^${name}\\s*=\\s*"([^"]*)"\\s*$`, 'm').exec(config);
  return match ? match[1] : null;
}

test('C-D2 SERVICE_ID names an active service in the central declaration', () => {
  const id = configVar('SERVICE_ID');
  const declared = serviceById(id);
  assert.ok(declared, `wrangler.toml SERVICE_ID=${JSON.stringify(id)} is not in workers/account-entitlements/services.js`);
  assert.equal(declared.status, 'active', `SERVICE_ID=${id} is declared ${declared.status}, not active`);
});

test('C-D2 the declaration accepts the query version this product sends', () => {
  const declared = serviceById(configVar('SERVICE_ID'));
  assert.ok(declared?.queryVersions.includes('v2'),
    `the product sends v2, the declaration allows ${JSON.stringify(declared?.queryVersions)}`);
});

test('C-D2 the declaration lists this product with an entry URL variable', () => {
  const declared = serviceById(configVar('SERVICE_ID'));
  assert.equal(declared?.listed, true, `SERVICE_ID=${declared?.id} is not listed`);
  assert.equal(typeof declared?.entryUrlVar, 'string', `SERVICE_ID=${declared?.id} has no entryUrlVar`);
});
