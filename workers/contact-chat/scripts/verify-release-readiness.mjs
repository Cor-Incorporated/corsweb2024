#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const workerDir = resolve(scriptDir, '..');
const configPath = join(workerDir, 'wrangler.toml');
const securityPath = join(workerDir, 'src', 'security.ts');
const migrationName = '0005_submission_payload_fingerprint.sql';
const expectedTurnstileAction = 'contact-submit';
const schemaQuery =
  "SELECT COUNT(*) AS column_count FROM pragma_table_info('submission_intake') WHERE name='payload_fingerprint'";
const outboxQuery =
  'SELECT status, delivery_status, COUNT(*) AS item_count FROM notification_outbox GROUP BY status, delivery_status ORDER BY status, delivery_status';

const specs = {
  production: {
    wranglerEnv: [],
    workerName: 'cor-contact-chat',
    healthUrl: 'https://cor-jp.com/api/contact/health',
    queues: ['cor-contact-notifications', 'cor-contact-notifications-dlq'],
    turnstileAllowedHostnames: 'cor-jp.com,www.cor-jp.com',
  },
  preview: {
    wranglerEnv: ['--env', 'preview'],
    workerName: 'cor-contact-chat-preview',
    healthUrl: null,
    queues: ['cor-contact-notifications-preview', 'cor-contact-notifications-preview-dlq'],
    turnstileAllowedHostnames: 'cloudia-contact.pages.dev',
  },
};

const requiredSecrets = [
  'VERTEX_GATEWAY_URL',
  'VERTEX_GATEWAY_SECRET',
  'RESEND_API_KEY',
  'TURNSTILE_SECRET',
  'CLOUDIA_HANDOFF_AUTH_TOKEN',
];
const optionalSecrets = ['ANTHROPIC_API_KEY'];
const targetVars = new Set([
  'TURNSTILE_REQUIRED',
  'TURNSTILE_ALLOWED_HOSTNAMES',
  'GRIFT_HANDOFF_ENABLED',
  'GRIFT_API_ORIGIN',
  'GRIFT_PUBLIC_URL_ORIGINS',
]);

let blockers = 0;
let warnings = 0;

function pass(label, detail = '') {
  console.log(`[PASS] ${label}${detail ? `: ${detail}` : ''}`);
}

function block(label, detail = '') {
  blockers += 1;
  console.log(`[BLOCK] ${label}${detail ? `: ${detail}` : ''}`);
}

function warn(label, detail = '') {
  warnings += 1;
  console.log(`[WARN] ${label}${detail ? `: ${detail}` : ''}`);
}

function info(label, detail = '') {
  console.log(`[INFO] ${label}${detail ? `: ${detail}` : ''}`);
}

function usage() {
  console.log(`Usage:
  node scripts/verify-release-readiness.mjs [options]

Options:
  --env production|preview|all  Environments to inspect (default: all)
  --preview-url https://...     Preview base URL or health URL
  --local-only                  Run Wrangler dry-runs only; do not access remote state
  --skip-health                 Diagnostic only; skip HTTP health GETs and add blockers
  --self-test                   Test parsers and mutation guards without network access
  --help                        Show this help

This command permits only Wrangler dry-run and read-only subcommands. Child output
is captured and never printed verbatim, so secret values and PII are not emitted.
Manual Turnstile widget hostname/action, WAF, Grift tenant/base-URL, and Nagi UAT gates remain mandatory.`);
}

function parseArgs(argv) {
  const options = {
    environments: ['production', 'preview'],
    previewUrl: null,
    localOnly: false,
    skipHealth: false,
    selfTest: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help') return { ...options, help: true };
    if (arg === '--local-only') options.localOnly = true;
    else if (arg === '--skip-health') options.skipHealth = true;
    else if (arg === '--self-test') options.selfTest = true;
    else if (arg === '--preview-url') {
      options.previewUrl = argv[++i];
      if (!options.previewUrl) throw new Error('--preview-url requires a value');
    } else if (arg === '--env') {
      const value = argv[++i];
      if (value === 'all') options.environments = ['production', 'preview'];
      else if (value === 'production' || value === 'preview') options.environments = [value];
      else throw new Error('--env must be production, preview, or all');
    } else {
      throw new Error(`unknown option: ${arg}`);
    }
  }
  return options;
}

function assertReadOnlyWrangler(args) {
  const signature = args.slice(0, 3).join(' ');
  if (args[0] === 'deploy' && args.includes('--dry-run')) return;
  if (signature.startsWith('deployments list')) return;
  if (signature.startsWith('deployments status')) return;
  if (signature.startsWith('versions list')) return;
  if (signature.startsWith('versions view')) return;
  if (signature.startsWith('secret list')) return;
  if (signature.startsWith('d1 migrations list')) return;
  if (signature.startsWith('queues info')) return;
  if (args[0] === 'whoami') return;

  if (signature.startsWith('d1 execute')) {
    const commandIndex = args.indexOf('--command');
    const query = commandIndex === -1 ? '' : args[commandIndex + 1];
    if (query === schemaQuery || query === outboxQuery) return;
  }

  throw new Error(`mutation-capable Wrangler command rejected: ${signature}`);
}

function runWrangler(args, extraEnv = {}) {
  assertReadOnlyWrangler(args);
  const result = spawnSync('npm', ['exec', '--', 'wrangler', ...args], {
    cwd: workerDir,
    encoding: 'utf8',
    env: { ...process.env, ...extraEnv },
    maxBuffer: 16 * 1024 * 1024,
  });
  return {
    ok: result.status === 0 && !result.error,
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function parseJson(text) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('empty JSON output');
  try {
    return JSON.parse(trimmed);
  } catch {
    const starts = [trimmed.indexOf('['), trimmed.indexOf('{')].filter((n) => n >= 0);
    if (starts.length === 0) throw new Error('JSON output not found');
    return JSON.parse(trimmed.slice(Math.min(...starts)));
  }
}

function listFrom(data, key) {
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.[key]) ? data[key] : [];
}

function safeId(value) {
  const text = typeof value === 'string' ? value : '';
  return /^[A-Za-z0-9_-]{6,128}$/.test(text) ? text : 'unknown';
}

function safeTimestamp(value) {
  const text = typeof value === 'string' ? value : '';
  return /^[0-9TZ:.-]{10,40}$/.test(text) ? text : 'unknown';
}

function secretNames(data) {
  return new Set(
    listFrom(data, 'secrets')
      .map((item) => (typeof item === 'string' ? item : item?.name || item?.key))
      .filter((name) => typeof name === 'string')
  );
}

function migrationStatus(text) {
  if (text.includes(migrationName)) return 'pending';
  if (/No migrations to apply/i.test(text)) return 'not-pending';
  return 'not-listed';
}

function columnCount(data) {
  const roots = Array.isArray(data) ? data : [data];
  for (const root of roots) {
    const rows = root?.results || root?.result?.[0]?.results;
    if (Array.isArray(rows) && rows.length > 0) {
      const value = Number(rows[0]?.column_count);
      if (Number.isFinite(value)) return value;
    }
  }
  return null;
}

function outboxRows(data) {
  const roots = Array.isArray(data) ? data : [data];
  const rows = roots.flatMap((root) => root?.results || root?.result?.[0]?.results || []);
  return rows.map((row) => ({
    status: /^[a-z_]+$/.test(String(row.status || '')) ? String(row.status) : 'unknown',
    deliveryStatus: /^[a-z_]+$/.test(String(row.delivery_status || ''))
      ? String(row.delivery_status)
      : 'unknown',
    count: Number.isSafeInteger(Number(row.item_count)) ? Number(row.item_count) : 0,
  }));
}

function extractTargetVars(data) {
  const found = new Map();
  function walk(value) {
    if (!value || typeof value !== 'object') return;
    if (!Array.isArray(value)) {
      for (const target of targetVars) {
        if (typeof value[target] === 'string') found.set(target, value[target]);
      }
      const name = value.name || value.binding;
      if (targetVars.has(name)) {
        if (typeof value.text === 'string') found.set(name, value.text);
        else if (typeof value.value === 'string') found.set(name, value.value);
      }
    }
    for (const child of Object.values(value)) walk(child);
  }
  walk(data);
  return found;
}

function sourceTurnstileAction() {
  const source = readFileSync(securityPath, 'utf8');
  const match = /export const TURNSTILE_EXPECTED_ACTION\s*=\s*['"]([^'"]+)['"]/.exec(source);
  return match?.[1] || null;
}

function inspectSourceTurnstileContract() {
  try {
    if (sourceTurnstileAction() === expectedTurnstileAction) {
      pass('Turnstile action parity', `exact ${expectedTurnstileAction}`);
    } else {
      block('Turnstile action parity', `source must require exact ${expectedTurnstileAction}`);
    }
  } catch {
    block('Turnstile action parity', 'security.ts unreadable');
  }
}

function healthUrl(base) {
  const url = new URL(base);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('health URL must be a plain HTTPS URL');
  }
  if (url.pathname === '/' || url.pathname === '') url.pathname = '/api/contact/health';
  if (url.pathname !== '/api/contact/health')
    throw new Error('health URL path must be /api/contact/health');
  return url.toString();
}

function accountIdFromConfig() {
  const config = readFileSync(configPath, 'utf8');
  const match = /^account_id\s*=\s*"([a-f0-9]{32})"/m.exec(config);
  if (!match) throw new Error('account_id not found in wrangler.toml');
  return match[1];
}

function runDryRun(environment) {
  const outdir = mkdtempSync(join(tmpdir(), `contact-chat-${environment}-dry-run-`));
  try {
    const result = runWrangler([
      'deploy',
      '--dry-run',
      '--outdir',
      outdir,
      ...specs[environment].wranglerEnv,
    ]);
    if (result.ok) pass(`${environment} Wrangler dry-run`);
    else
      block(
        `${environment} Wrangler dry-run`,
        `exit=${result.status ?? 'spawn-error'}; raw output withheld`
      );
  } finally {
    rmSync(outdir, { recursive: true, force: true });
  }
}

function inspectDeployment(environment) {
  const envArgs = specs[environment].wranglerEnv;
  const deploymentsResult = runWrangler(['deployments', 'list', '--json', ...envArgs]);
  if (!deploymentsResult.ok) {
    block(
      `${environment} deployments`,
      `exit=${deploymentsResult.status ?? 'spawn-error'}; raw output withheld`
    );
    return null;
  }

  try {
    const deployments = listFrom(parseJson(deploymentsResult.stdout), 'deployments');
    const latest = deployments[0] || {};
    const deploymentId = safeId(latest.id || latest.deployment_id);
    const created = safeTimestamp(latest.created_on || latest.created_at);
    pass(
      `${environment} deployments`,
      `count=${deployments.length}, latest=${deploymentId}, created=${created}`
    );
  } catch {
    block(`${environment} deployments`, 'JSON parse failed; raw output withheld');
  }

  const versionsResult = runWrangler(['versions', 'list', '--json', ...envArgs]);
  if (!versionsResult.ok) {
    block(
      `${environment} versions`,
      `exit=${versionsResult.status ?? 'spawn-error'}; raw output withheld`
    );
    return null;
  }

  try {
    const versions = listFrom(parseJson(versionsResult.stdout), 'versions');
    const versionId = safeId(versions[0]?.id || versions[0]?.version_id);
    pass(`${environment} versions`, `count=${versions.length}, latest=${versionId}`);
    return versionId === 'unknown' ? null : versionId;
  } catch {
    block(`${environment} versions`, 'JSON parse failed; raw output withheld');
    return null;
  }
}

function inspectTargetVars(environment, versionId) {
  if (!versionId) return;
  const result = runWrangler([
    'versions',
    'view',
    versionId,
    '--json',
    ...specs[environment].wranglerEnv,
  ]);
  if (!result.ok) {
    warn(`${environment} deployed config vars`, 'version details unreadable; raw output withheld');
    return;
  }
  try {
    const vars = extractTargetVars(parseJson(result.stdout));
    const turnstileRequired = vars.get('TURNSTILE_REQUIRED');
    const turnstileHostnames = vars.get('TURNSTILE_ALLOWED_HOSTNAMES');
    const enabled = vars.get('GRIFT_HANDOFF_ENABLED');
    const apiOrigin = vars.get('GRIFT_API_ORIGIN');
    const publicOrigins = vars.get('GRIFT_PUBLIC_URL_ORIGINS');
    if (turnstileRequired === 'true') {
      pass(`${environment} deployed TURNSTILE_REQUIRED`, 'true');
    } else {
      block(`${environment} deployed TURNSTILE_REQUIRED`, 'must be exact true before release');
    }
    if (turnstileHostnames === specs[environment].turnstileAllowedHostnames) {
      pass(`${environment} deployed TURNSTILE_ALLOWED_HOSTNAMES`, 'exact allowlist matches');
    } else {
      block(`${environment} deployed TURNSTILE_ALLOWED_HOSTNAMES`, 'exact allowlist missing or mismatched');
    }
    info(
      `${environment} deployed GRIFT_HANDOFF_ENABLED`,
      enabled === 'true' ? 'true' : 'false-or-absent'
    );
    info(`${environment} deployed GRIFT_API_ORIGIN`, apiOrigin ? 'configured' : 'empty-or-absent');
    info(
      `${environment} deployed GRIFT_PUBLIC_URL_ORIGINS`,
      publicOrigins ? 'configured' : 'empty-or-absent'
    );
  } catch {
    warn(`${environment} deployed config vars`, 'JSON parse failed; raw output withheld');
  }
}

function inspectSecrets(environment) {
  const result = runWrangler([
    'secret',
    'list',
    '--format',
    'json',
    ...specs[environment].wranglerEnv,
  ]);
  if (!result.ok) {
    block(
      `${environment} secret inventory`,
      `exit=${result.status ?? 'spawn-error'}; raw output withheld`
    );
    return;
  }
  try {
    const names = secretNames(parseJson(result.stdout));
    for (const name of requiredSecrets) {
      if (names.has(name)) pass(`${environment} secret ${name}`, 'present');
      else block(`${environment} secret ${name}`, 'missing');
    }
    for (const name of optionalSecrets) {
      if (names.has(name)) pass(`${environment} optional secret ${name}`, 'present');
      else
        warn(
          `${environment} optional secret ${name}`,
          'missing; Anthropic rollback path is unavailable'
        );
    }
  } catch {
    block(`${environment} secret inventory`, 'JSON parse failed; raw output withheld');
  }
}

function inspectD1(environment, accountId) {
  const envArgs = specs[environment].wranglerEnv;
  const extraEnv = { CLOUDFLARE_ACCOUNT_ID: accountId };
  const migrations = runWrangler(
    ['d1', 'migrations', 'list', 'DB', '--remote', ...envArgs],
    extraEnv
  );
  if (!migrations.ok) {
    block(
      `${environment} D1 migration list`,
      `exit=${migrations.status ?? 'spawn-error'}; raw output withheld`
    );
  } else if (migrationStatus(`${migrations.stdout}\n${migrations.stderr}`) === 'pending') {
    block(`${environment} D1 ${migrationName}`, 'pending');
  } else {
    pass(`${environment} D1 ${migrationName}`, 'not pending');
  }

  const schema = runWrangler(
    ['d1', 'execute', 'DB', '--remote', '--json', '--command', schemaQuery, ...envArgs],
    extraEnv
  );
  if (!schema.ok) {
    block(
      `${environment} D1 schema read`,
      `exit=${schema.status ?? 'spawn-error'}; raw output withheld`
    );
  } else {
    try {
      if (columnCount(parseJson(schema.stdout)) === 1)
        pass(`${environment} D1 payload_fingerprint column`, 'present');
      else block(`${environment} D1 payload_fingerprint column`, 'missing');
    } catch {
      block(`${environment} D1 schema read`, 'JSON parse failed; raw output withheld');
    }
  }

  const outbox = runWrangler(
    ['d1', 'execute', 'DB', '--remote', '--json', '--command', outboxQuery, ...envArgs],
    extraEnv
  );
  if (!outbox.ok) {
    warn(
      `${environment} D1 outbox aggregate`,
      `exit=${outbox.status ?? 'spawn-error'}; raw output withheld`
    );
  } else {
    try {
      const rows = outboxRows(parseJson(outbox.stdout));
      const summary =
        rows.length === 0
          ? 'empty'
          : rows.map((row) => `${row.status}/${row.deliveryStatus}=${row.count}`).join(',');
      pass(`${environment} D1 outbox aggregate`, summary);
    } catch {
      warn(`${environment} D1 outbox aggregate`, 'JSON parse failed; raw output withheld');
    }
  }
}

function inspectQueues(environment) {
  for (const queue of specs[environment].queues) {
    const result = runWrangler(['queues', 'info', queue]);
    if (result.ok) pass(`${environment} queue ${queue}`, 'present');
    else
      block(
        `${environment} queue ${queue}`,
        `missing or unreadable; exit=${result.status ?? 'spawn-error'}`
      );
  }
}

async function inspectHealth(environment, previewUrl, skipHealth) {
  if (skipHealth) {
    block(`${environment} health`, 'skipped by option; health is a mandatory release gate');
    return;
  }
  const base = environment === 'preview' ? previewUrl : specs.production.healthUrl;
  if (!base) {
    block('preview health', 'provide --preview-url with the deployed Preview HTTPS URL');
    return;
  }
  let url;
  try {
    url = healthUrl(base);
  } catch (error) {
    block(`${environment} health`, error.message);
    return;
  }
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
    const text = await response.text();
    let ok = false;
    try {
      ok = JSON.parse(text)?.ok === true;
    } catch {
      ok = false;
    }
    if (response.status === 200 && ok) pass(`${environment} health`, 'HTTP 200, ok=true');
    else block(`${environment} health`, `HTTP ${response.status}, ok=${ok}; body withheld`);
  } catch {
    block(`${environment} health`, 'request failed; error details withheld');
  }
}

function runSelfTest() {
  assert.equal(migrationStatus(`│ ${migrationName} │`), 'pending');
  assert.equal(migrationStatus('No migrations to apply!'), 'not-pending');
  assert.equal(columnCount([{ results: [{ column_count: 1 }] }]), 1);
  assert.deepEqual(
    outboxRows([{ results: [{ status: 'sent', delivery_status: 'accepted', item_count: 2 }] }]),
    [{ status: 'sent', deliveryStatus: 'accepted', count: 2 }]
  );
  assert.deepEqual([...secretNames([{ name: 'RESEND_API_KEY' }])], ['RESEND_API_KEY']);
  const vars = extractTargetVars({
    bindings: [
      { name: 'GRIFT_HANDOFF_ENABLED', type: 'plain_text', text: 'false' },
      { name: 'TURNSTILE_REQUIRED', type: 'plain_text', text: 'true' },
      {
        name: 'TURNSTILE_ALLOWED_HOSTNAMES',
        type: 'plain_text',
        text: 'cor-jp.com,www.cor-jp.com',
      },
    ],
  });
  assert.equal(vars.get('GRIFT_HANDOFF_ENABLED'), 'false');
  assert.equal(vars.get('TURNSTILE_REQUIRED'), 'true');
  assert.equal(vars.get('TURNSTILE_ALLOWED_HOSTNAMES'), 'cor-jp.com,www.cor-jp.com');
  assert.equal(sourceTurnstileAction(), expectedTurnstileAction);
  assert.equal(
    healthUrl('https://preview.example.test/'),
    'https://preview.example.test/api/contact/health'
  );
  assert.doesNotThrow(() => assertReadOnlyWrangler(['deploy', '--dry-run']));
  assert.doesNotThrow(() =>
    assertReadOnlyWrangler(['d1', 'execute', 'DB', '--command', schemaQuery])
  );
  assert.throws(() => assertReadOnlyWrangler(['deploy']));
  assert.throws(() => assertReadOnlyWrangler(['d1', 'migrations', 'apply', 'DB', '--remote']));
  assert.throws(() => assertReadOnlyWrangler(['secret', 'put', 'CLOUDIA_HANDOFF_AUTH_TOKEN']));
  assert.throws(() => assertReadOnlyWrangler(['rollback', 'version-id']));
  pass('self-test', 'parsers and mutation guards');
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`Argument error: ${error.message}`);
    usage();
    process.exitCode = 2;
    return;
  }

  if (options.help) {
    usage();
    return;
  }
  if (options.selfTest) {
    runSelfTest();
    return;
  }

  info('safety mode', 'Wrangler dry-run/read-only commands and HTTP GET only');
  inspectSourceTurnstileContract();
  for (const environment of options.environments) runDryRun(environment);

  if (!options.localOnly) {
    const auth = runWrangler(['whoami']);
    if (!auth.ok) {
      block(
        'Cloudflare authentication',
        `exit=${auth.status ?? 'spawn-error'}; raw output withheld`
      );
    } else {
      pass('Cloudflare authentication', 'authenticated; identity withheld');
      let accountId;
      try {
        accountId = accountIdFromConfig();
      } catch (error) {
        block('Wrangler account selection', error.message);
      }
      for (const environment of options.environments) {
        const versionId = inspectDeployment(environment);
        inspectTargetVars(environment, versionId);
        inspectSecrets(environment);
        if (accountId) inspectD1(environment, accountId);
        inspectQueues(environment);
        await inspectHealth(environment, options.previewUrl, options.skipHealth);
      }
    }
  }

  console.log('');
  info(
    'manual gates',
    'Turnstile widget hostname + exact action contact-submit, WAF, Grift public URL and Cor tenant isolation, and Nagi browser UAT are not automated here'
  );
  if (blockers > 0) {
    console.log(`[RESULT] NOT READY: blockers=${blockers}, warnings=${warnings}`);
    process.exitCode = 1;
  } else {
    console.log(
      `[RESULT] AUTOMATED CHECKS PASS: warnings=${warnings}; manual gates still required`
    );
  }
}

await main();
