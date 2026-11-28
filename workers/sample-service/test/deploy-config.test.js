// C-D1: the deploy config must not carry secret values. Secrets are put with `wrangler secret put`.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const config = await readFile(new URL('../wrangler.toml', import.meta.url), 'utf8');
const lines = config.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));

const secretNames = ['CLERK_JWT_KEY', 'SAMPLE_ENTITLEMENT_QUERY_TOKEN'];
const secretShapes = [
  /-----BEGIN [A-Z ]+-----/,
  /\bsk_(?:live|test)_[A-Za-z0-9]+/,
  /\bwhsec_[A-Za-z0-9]+/,
  /"[A-Za-z0-9_-]{43,}"/,
];

test('C-D1 the deploy config does not assign a secret name', () => {
  for (const name of secretNames) {
    const assigned = lines.filter(line => new RegExp(`^${name}\\s*=`).test(line));
    assert.deepEqual(assigned, [], `${name} must be put as a secret, found: ${assigned.join(' | ')}`);
  }
});

test('C-D1 the deploy config does not carry a secret-shaped value', () => {
  for (const shape of secretShapes) {
    const found = lines.filter(line => shape.test(line));
    assert.deepEqual(found, [], `secret-shaped value ${shape}: ${found.join(' | ')}`);
  }
});

test('C-D1 the vars are only the five public settings', () => {
  const start = lines.indexOf('[vars]');
  assert.notEqual(start, -1, '[vars] is missing');
  const vars = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('[')) break;
    vars.push(line.split('=')[0].trim());
  }
  assert.deepEqual(vars.sort(), ['CLERK_ISSUER', 'ENTITLEMENTS_URL', 'SERVICE_ID', 'SITE_ORIGIN', 'TENANT_ID']);
});
