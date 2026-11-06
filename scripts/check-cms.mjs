#!/usr/bin/env node
/**
 * cms/public/config.yml と認証 Worker の公開メタデータが src/config/cms-contract.ts と一致するかを見る。
 * OAuth の secret はファイルに無いことも見る。Worker のコードと secret は書き換えない。
 *
 * Node 22 は .ts をそのまま読める。Node 20（visual-text の CI）では typescript で transpile して読む。
 * 契約ファイルは他モジュールを import しない。
 */

import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import yaml from 'js-yaml';

const require = createRequire(import.meta.url);
const ROOT = process.cwd();
const CONTRACT_PATH = fileURLToPath(new URL('../src/config/cms-contract.ts', import.meta.url));

const read = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');

/** @returns {Promise<Record<string, unknown>>} */
export async function loadCmsContract() {
  const source = readFileSync(CONTRACT_PATH, 'utf8');
  // Node 22 は .ts をそのまま読む。Node 20 は ERR_UNKNOWN_FILE_EXTENSION になるので transpile する。
  // CMS_CONTRACT_TRANSPILE=1 は、その経路を Node 22 でも通すための検査用。
  if (process.env.CMS_CONTRACT_TRANSPILE !== '1') {
    try {
      return await import(pathToFileURL(CONTRACT_PATH).href);
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : '';
      if (code !== 'ERR_UNKNOWN_FILE_EXTENSION' && code !== 'ERR_MODULE_NOT_FOUND') throw error;
    }
  }
  const ts = require('typescript');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: CONTRACT_PATH,
  }).outputText;
  const dir = mkdtempSync(path.join(tmpdir(), 'cms-contract-'));
  const out = path.join(dir, 'cms-contract.mjs');
  writeFileSync(out, output);
  return import(pathToFileURL(out).href);
}

const show = (value) => (value === undefined ? '（なし）' : JSON.stringify(value));

const same = (failures, actual, expected, label) => {
  const left = show(actual);
  const right = show(expected);
  if (left !== right) failures.push(`${label}: 実際 ${left} / cms-contract ${right}`);
};

const isRequired = (field) => field?.required !== false;

/**
 * @param {string[]} failures
 * @param {unknown[]} actualFields
 * @param {readonly Record<string, unknown>[]} expectedFields
 * @param {string} where
 */
const assertFields = (failures, actualFields, expectedFields, where) => {
  if (!Array.isArray(actualFields)) {
    failures.push(`${where} が配列ではない`);
    return;
  }
  if (actualFields.length !== expectedFields.length) {
    failures.push(
      `${where} の項目数: config.yml ${actualFields.length} 件 [${actualFields
        .map((field) => field?.name)
        .join(', ')}] / cms-contract ${expectedFields.length} 件 [${expectedFields
        .map((field) => field.name)
        .join(', ')}]`
    );
    return;
  }
  actualFields.forEach((actual, index) => {
    const expected = expectedFields[index];
    const here = `${where}[${index}] ${expected.name}`;
    if (!actual || typeof actual !== 'object') {
      failures.push(`${here} が無い`);
      return;
    }
    same(failures, actual.name, expected.name, `${here} name`);
    same(failures, actual.label, expected.label, `${here} label`);
    same(failures, actual.widget, expected.widget, `${here} widget`);
    same(failures, isRequired(actual), expected.required, `${here} required`);
    same(failures, actual.hint, expected.hint, `${here} hint`);
    if (expected.default !== undefined) same(failures, actual.default, expected.default, `${here} default`);
    else same(failures, actual.default, undefined, `${here} default`);
    if (expected.options) {
      same(
        failures,
        (actual.options ?? []).map((option) => ({ label: option.label, value: option.value })),
        expected.options.map((option) => ({ label: option.label, value: option.value })),
        `${here} options`
      );
    } else if (actual.options) {
      failures.push(`${here} options: config.yml にある / cms-contract （なし）`);
    }
    if (expected.accept) {
      same(failures, actual.accept, expected.accept, `${here} accept`);
      if (String(actual.accept).includes('svg')) failures.push(`${here} が svg を受け付ける`);
    }
    if (expected.format) same(failures, actual.format, expected.format, `${here} format`);
    if (expected.dateType) same(failures, actual.type, expected.dateType, `${here} type`);
    if (expected.modes) same(failures, actual.modes, [...expected.modes], `${here} modes`);
    if (expected.fields) assertFields(failures, actual.fields, expected.fields, `${here}.fields`);
  });
};

/** @param {Record<string, unknown>} config @param {Record<string, unknown>} contract */
export function configDrift(config, contract) {
  const failures = [];
  const {
    cmsBackend,
    cmsCommitMessages,
    cmsSite,
    cmsMedia,
    cmsSlug,
    cmsOutput,
    cmsCollections,
    draftField,
    authWorker,
  } = contract;
  const backend = config.backend ?? {};

  same(failures, backend.name, cmsBackend.name, 'backend.name');
  same(failures, backend.repo, cmsBackend.repo, 'backend.repo');
  same(failures, backend.branch, cmsBackend.branch, 'backend.branch');
  same(failures, backend.base_url, cmsBackend.baseUrl, 'backend.base_url');
  same(failures, backend.auth_methods, [...cmsBackend.authMethods], 'backend.auth_methods');
  same(failures, backend.auth_scope, cmsBackend.authScope, 'backend.auth_scope');
  same(failures, backend.squash_merges, cmsBackend.squashMerges, 'backend.squash_merges');
  same(failures, backend.open_authoring ?? false, cmsBackend.openAuthoring, 'backend.open_authoring');
  same(failures, backend.preview_context, cmsBackend.previewContext, 'backend.preview_context');
  same(failures, backend.commit_messages, { ...cmsCommitMessages }, 'backend.commit_messages');
  same(failures, config.publish_mode, cmsBackend.publishMode, 'publish_mode');
  same(failures, config.app_title, cmsSite.appTitle, 'app_title');
  same(failures, config.logo?.src, cmsSite.logoSrc, 'logo.src');
  same(failures, config.site_url, cmsSite.siteUrl, 'site_url');
  same(failures, config.media_folder, cmsMedia.mediaFolder, 'media_folder');
  same(failures, config.public_folder, cmsMedia.publicFolder, 'public_folder');
  same(
    failures,
    config.media_libraries?.default?.config?.slugify_filename,
    cmsMedia.slugifyFilename,
    'slugify_filename'
  );
  same(failures, config.media_libraries?.stock_assets, cmsMedia.stockAssets, 'stock_assets');
  same(
    failures,
    config.media_libraries?.default?.config?.transformations,
    cmsMedia.transformations,
    'transformations'
  );
  same(failures, config.slug?.encoding, cmsSlug.encoding, 'slug.encoding');
  same(failures, config.slug?.clean_accents, cmsSlug.cleanAccents, 'slug.clean_accents');
  same(
    failures,
    config.output?.omit_empty_optional_fields,
    cmsOutput.omitEmptyOptionalFields,
    'omit_empty_optional_fields'
  );
  same(failures, config.output?.yaml?.quote, cmsOutput.yamlQuote, 'yaml.quote');

  const composed = `https://${authWorker.name}.${authWorker.workersDevSubdomain}.workers.dev`;
  same(failures, cmsBackend.baseUrl, composed, 'cmsBackend.baseUrl の組み立て');
  if (authWorker.allowedDomains !== `${cmsSite.hostingSite}.web.app`) {
    failures.push(
      `ALLOWED_DOMAINS と hostingSite が食い違う: ${authWorker.allowedDomains} / ${cmsSite.hostingSite}.web.app`
    );
  }
  if (config.i18n) {
    failures.push(`全体の i18n がある（他言語ファイルを CMS が書く）: ${JSON.stringify(config.i18n)}`);
  }
  if (String(config.backend?.base_url ?? '').includes('api.netlify.com')) {
    failures.push('backend.base_url が api.netlify.com を指している');
  }

  if (!Array.isArray(config.collections) || config.collections.length !== cmsCollections.length) {
    failures.push(
      `collections の数: config.yml ${config.collections?.length ?? '（なし）'} / cms-contract ${cmsCollections.length}`
    );
  } else {
    config.collections.forEach((collection, index) => {
      const expected = cmsCollections[index];
      const here = `collections[${index}] ${expected.name}`;
      same(failures, collection.name, expected.name, `${here} name`);
      same(failures, collection.label, expected.label, `${here} label`);
      same(failures, collection.label_singular, expected.labelSingular, `${here} label_singular`);
      same(failures, collection.description, expected.description, `${here} description`);
      same(failures, collection.icon, expected.icon, `${here} icon`);
      same(failures, collection.folder, expected.folder, `${here} folder`);
      same(failures, collection.create, true, `${here} create`);
      same(failures, collection.delete, expected.delete, `${here} delete`);
      if (!/^src\/content\/[^/]+\/ja$/.test(String(collection.folder ?? ''))) {
        failures.push(`${here} folder が ja ではない: ${collection.folder}`);
      }
      same(failures, collection.extension, 'md', `${here} extension`);
      same(failures, collection.format, 'yaml-frontmatter', `${here} format`);
      same(failures, collection.preview_path, expected.previewPath, `${here} preview_path`);
      same(failures, collection.sortable_fields?.fields, [...expected.sortableFields], `${here} sortable_fields.fields`);
      same(
        failures,
        collection.sortable_fields?.default?.field,
        expected.sortableField,
        `${here} sortable default field`
      );
      same(
        failures,
        collection.sortable_fields?.default?.direction,
        expected.sortableDirection,
        `${here} sortable default direction`
      );
      same(failures, collection.slug?.editable, [...cmsSlug.editable], `${here} slug.editable`);
      same(failures, collection.slug?.hint, expected.slugHint, `${here} slug.hint`);
      same(failures, collection.slug?.pattern?.[0], cmsSlug.pattern, `${here} slug.pattern`);
      same(failures, collection.slug?.pattern?.[1], cmsSlug.patternMessage, `${here} slug message`);
      same(failures, collection.aliases_field, false, `${here} aliases_field`);
      if (collection.i18n) failures.push(`${here} に i18n がある: ${JSON.stringify(collection.i18n)}`);
      if (collection.path !== undefined && collection.path !== '{{slug}}') {
        failures.push(`${here} path が既定の {{slug}} ではない: ${collection.path}`);
      }
      const draft = (collection.fields ?? []).find((field) => field.name === draftField);
      if (!draft || draft.widget !== 'hidden') {
        failures.push(`${here} に下書き欄 ${draftField}（hidden）が無い`);
      }
      assertFields(failures, collection.fields, expected.fields, `${here}.fields`);
    });
  }
  return failures;
}

const tomlValue = (text, key) => text.match(new RegExp(`^${key}\\s*=\\s*"([^"]*)"`, 'm'))?.[1];
const tomlBool = (text, key) => {
  const match = text.match(new RegExp(`^${key}\\s*=\\s*(true|false)\\s*$`, 'm'));
  return match ? match[1] === 'true' : undefined;
};

/** @param {string} text @param {Record<string, unknown>} contract */
export function workerDrift(text, contract) {
  const { authWorker } = contract;
  const failures = [];
  same(failures, tomlValue(text, 'name'), authWorker.name, 'wrangler name');
  same(failures, tomlValue(text, 'compatibility_date'), authWorker.compatibilityDate, 'wrangler compatibility_date');
  same(failures, tomlValue(text, 'account_id'), authWorker.accountId, 'wrangler account_id');
  same(failures, tomlValue(text, 'ALLOWED_DOMAINS'), authWorker.allowedDomains, 'ALLOWED_DOMAINS');
  same(failures, tomlBool(text, 'workers_dev'), authWorker.workersDev, 'wrangler workers_dev');
  same(failures, tomlBool(text, 'preview_urls'), authWorker.previewUrls, 'wrangler preview_urls');
  if (/GITHUB_CLIENT_(ID|SECRET)\s*=\s*["'][^"']+["']/m.test(text)) {
    failures.push('wrangler.toml に GitHub OAuth の secret が書いてある');
  }
  if (!String(authWorker.allowedDomains).trim() || String(authWorker.allowedDomains).includes('*')) {
    failures.push('ALLOWED_DOMAINS が空、または * を含む');
  }
  if (String(authWorker.allowedDomains).includes('--')) {
    failures.push('ALLOWED_DOMAINS にプレビューチャネル（--）がある');
  }
  return failures;
}

/** @param {Record<string, unknown>} contract */
export function pinDrift(packageJson, contract) {
  const failures = [];
  const actual = packageJson.devDependencies?.['@sveltia/cms'];
  same(failures, actual, contract.cmsSite.sveltiaCmsVersion, '@sveltia/cms');
  if (typeof actual === 'string' && /^[\^~*]|\s/.test(actual)) {
    failures.push(`@sveltia/cms が固定の版ではない: ${actual}`);
  }
  return failures;
}

const blob = (rel) => execFileSync('git', ['hash-object', rel], { cwd: ROOT, encoding: 'utf8' }).trim();

/** @param {Record<string, unknown>} contract */
export function shellDrift(contract, files) {
  const failures = [];
  const { cmsSite, authWorker, cmsBackend } = contract;
  if (!files.indexHtml.includes('noindex, nofollow')) failures.push('cms/index.html に noindex が無い');
  if (!files.indexHtml.includes('rel="cms-config-url" href="/config.yml"')) {
    failures.push('cms/index.html の config の link が違う');
  }
  if (!files.indexHtml.includes(cmsSite.appTitle)) {
    failures.push(`cms/index.html の title に ${cmsSite.appTitle} が無い`);
  }
  if (!files.viteConfig.includes('port: cmsSite.devPort')) {
    failures.push('cms/vite.config.mjs が cmsSite.devPort を使っていない');
  }
  if (!files.viteConfig.includes("from '../src/config/cms-contract.ts'")) {
    failures.push('cms/vite.config.mjs が cms-contract.ts を import していない');
  }
  for (const piece of ['src/config/cms-contract.ts', 'npm run check:cms', 'npm run cms:dev', '共有パッケージ']) {
    if (!files.docs.includes(piece)) failures.push(`docs/cms-sveltia.md に「${piece}」が無い`);
  }
  const readme = files.authReadme;
  for (const piece of [authWorker.upstreamCommit, authWorker.indexBlob, authWorker.licenseBlob]) {
    if (!readme.includes(piece)) failures.push(`workers/sveltia-cms-auth/README.md に ${piece} が無い`);
  }
  same(failures, blob('workers/sveltia-cms-auth/src/index.js'), authWorker.indexBlob, 'auth worker blob');
  same(failures, blob('workers/sveltia-cms-auth/LICENSE.txt'), authWorker.licenseBlob, 'auth license blob');
  if (!String(cmsBackend.baseUrl).startsWith('https://')) {
    failures.push(`backend.base_url が https ではない: ${cmsBackend.baseUrl}`);
  }
  return failures;
}

export async function collectCmsDrift() {
  const contract = await loadCmsContract();
  const config = yaml.load(read('cms/public/config.yml'));
  const packageJson = JSON.parse(read('package.json'));
  const hosting = JSON.parse(read('cms/firebase.json')).hosting;
  const failures = [
    ...configDrift(config, contract),
    ...workerDrift(read('workers/sveltia-cms-auth/wrangler.toml'), contract),
    ...pinDrift(packageJson, contract),
    ...shellDrift(contract, {
      indexHtml: read('cms/index.html'),
      viteConfig: read('cms/vite.config.mjs'),
      docs: read('docs/cms-sveltia.md'),
      authReadme: read('workers/sveltia-cms-auth/README.md'),
    }),
  ];
  if (hosting.site !== contract.cmsSite.hostingSite) {
    failures.push(
      `cms/firebase.json hosting.site ${JSON.stringify(hosting.site)} / cms-contract ${JSON.stringify(contract.cmsSite.hostingSite)}`
    );
  }
  return failures;
}

const invokedDirectly =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (invokedDirectly) {
  const failures = await collectCmsDrift();
  if (failures.length > 0) {
    console.error('check-cms: failed\n');
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }
  console.log('check-cms: OK');
}
