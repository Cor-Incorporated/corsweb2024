// @vitest-environment node
/**
 * リンクテスト（PR #339 レビュー指摘 L2）: ワークフローの ALLOWED_CHANGE_RE（push ジョブが適用を許すパス）と、
 * スクリプト側の定義（config.mjs の COLLECTIONS / TARGET_LANGS / CONTENT_ROOT、plan.mjs の SLUG_RE）を照合する。
 * コレクションや言語を片側だけ足す・消すと、両側の値を並べて red になる。
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import {
  COLLECTION_NAMES,
  CONTENT_ROOT,
  readRuntimeConfig,
  SOURCE_LANG,
  TARGET_LANGS,
} from '../config.mjs';
import { SLUG_RE } from '../plan.mjs';

const workflowPath = '.github/workflows/translate-content.yml';
const workflow = yaml.load(
  readFileSync(path.resolve(import.meta.dirname, '../../..', workflowPath), 'utf8')
);
const actual = workflow.env.ALLOWED_CHANGE_RE;
const expected =
  `^${CONTENT_ROOT}/(${COLLECTION_NAMES.join('|')})/(${TARGET_LANGS.join('|')})/` +
  `${SLUG_RE.source.slice(1, -1)}\\.md$`;

describe(`${workflowPath} env.ALLOWED_CHANGE_RE ↔ scripts/i18n の定義`, () => {
  it('同じ値である（片方だけ変えると両側の値を出して落ちる）', () => {
    expect({ 'workflow env.ALLOWED_CHANGE_RE': actual }).toEqual({
      'workflow env.ALLOWED_CHANGE_RE': expected,
    });
  });

  const allowed = new RegExp(actual);
  const allTargets = COLLECTION_NAMES.flatMap((c) =>
    TARGET_LANGS.map((l) => `${CONTENT_ROOT}/${c}/${l}/sample-post.md`)
  );

  it.each(allTargets)('翻訳先のパスは許可する: %s', (file) => {
    expect(allowed.test(file)).toBe(true);
  });

  it.each([
    `${CONTENT_ROOT}/blog/${SOURCE_LANG}/sample-post.md`,
    `${CONTENT_ROOT}/blog/en/../ja/sample-post.md`,
    `${CONTENT_ROOT}/blog/en/nested/sample-post.md`,
    `${CONTENT_ROOT}/blog/en/sample-post.md.bak`,
    `${CONTENT_ROOT}/blog/en/.hidden.md`,
    `${CONTENT_ROOT}/wiki/en/sample-post.md`,
    `${CONTENT_ROOT}/config.ts`,
    '.github/workflows/translate-content.yml',
    'scripts/i18n/cli.mjs',
  ])('それ以外は許可しない: %s', (file) => {
    expect(allowed.test(file)).toBe(false);
  });
});

describe(`${workflowPath} の削除上限 ↔ scripts/i18n の既定値`, () => {
  it('MAX_DELETE_PERCENT は I18N_MAX_PRUNE_RATIO の既定値、MIN_DELETE_ALLOWANCE は対象言語数（記事 1 本分）', () => {
    expect({
      'workflow env.MAX_DELETE_PERCENT': workflow.env.MAX_DELETE_PERCENT,
      'workflow env.MIN_DELETE_ALLOWANCE': workflow.env.MIN_DELETE_ALLOWANCE,
    }).toEqual({
      'workflow env.MAX_DELETE_PERCENT': String(
        Math.round(readRuntimeConfig({}).maxPruneRatio * 100)
      ),
      'workflow env.MIN_DELETE_ALLOWANCE': String(TARGET_LANGS.length),
    });
  });
});
