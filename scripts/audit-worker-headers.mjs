#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';

// yomimono（旧 CMS Worker）は 2026-09-27 に退役したため、検査対象は contact-chat のみ。
const FILES = {
  contact: path.resolve('workers/contact-chat/src/index.ts'),
  contactWrangler: path.resolve('workers/contact-chat/wrangler.toml'),
};

const assertIncludes = (violations, label, text, expected) => {
  if (!text.includes(expected)) {
    violations.push(`[worker-headers] ${label} must include: ${expected}`);
  }
};

const main = async () => {
  const [contact, contactWrangler] = await Promise.all(
    Object.values(FILES).map(file => readFile(file, 'utf8'))
  );
  const violations = [];

  assertIncludes(violations, 'contact route', contactWrangler, 'cor-jp.com/api/contact/*');

  assertIncludes(violations, 'contact json headers', contact, "'x-content-type-options': 'nosniff'");
  assertIncludes(violations, 'contact json headers', contact, "'referrer-policy': 'no-referrer'");
  assertIncludes(violations, 'contact json headers', contact, "'cache-control': 'no-store'");
  assertIncludes(violations, 'contact origin policy', contact, 'isSameOrigin(req)');

  if (violations.length > 0) {
    throw new Error(violations.join('\n'));
  }

  console.log('[worker-headers] Cloudflare Worker header baseline passed.');
};

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
