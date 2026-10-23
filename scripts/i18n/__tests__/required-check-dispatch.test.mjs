/**
 * 翻訳コミットの後に、承認の操作なしで必須チェックが動くことの照合（2026-10-23）。
 *
 * GITHUB_TOKEN で翻訳コミットを push すると、その上の pull_request の実行は承認待ちになり、develop の
 * 必須チェックが揃わず merge できない。translate-content.yml の dispatch-check が、必須チェックを出す
 * ワークフローを workflow_dispatch（承認の対象外）で起動する。ここでは次の 3 点を照合する。
 * 1. docs/i18n-translation.md に書いた develop の必須チェックは、どれも dispatch-check が起動するワークフローの
 *    ジョブ名として存在し、そのワークフローは workflow_dispatch を受け付ける
 * 2. h5-admission の起動に渡す入力（pr_number / base_ref）が、h5-admission.yml の入力と一致する
 * 3. PR での翻訳の上限（I18N_MAX_ITEMS）が、全記事 × 4 言語より大きい（全記事を直す PR でも 1 回で訳せる）
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { COLLECTION_NAMES, CONTENT_ROOT, SOURCE_LANG, TARGET_LANGS } from '../config.mjs';

const root = path.resolve(import.meta.dirname, '../../..');
const readWorkflow = (file) =>
  yaml.load(readFileSync(path.join(root, '.github/workflows', file), 'utf8'));

const translate = readWorkflow('translate-content.yml');
const dispatchScript = translate.jobs['dispatch-check'].steps
  .filter((step) => step.run)
  .map((step) => step.run)
  .join('\n')
  // 行末の \ でつないだ行を 1 行にする
  .replace(/\\\n\s*/g, ' ');

/** dispatch-check の `gh workflow run <file> ... -f key=...` を、ファイル名ごとの入力名の一覧にする */
function dispatchedWorkflows(script) {
  const result = new Map();
  for (const line of script.split('\n')) {
    const match = line.match(/gh workflow run (\S+\.yml)\b(.*)/);
    if (!match) continue;
    const inputs = [...match[2].matchAll(/-f (\w+)=/g)].map((m) => m[1]);
    result.set(match[1], inputs);
  }
  return result;
}

/** docs の「develop: required checks は `a` / `b` / `c`」から必須チェックの名前を読む */
function developRequiredChecks() {
  const docs = readFileSync(path.join(root, 'docs/i18n-translation.md'), 'utf8');
  const line = docs.split('\n').find((l) => /develop: required checks は/.test(l));
  if (!line) return [];
  const listed = line.split('required checks は')[1].split('、')[0];
  return [...listed.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
}

const workflowDispatchAccepts = (workflow) =>
  // js-yaml は `on:` を真偽値 true のキーとして読む
  Object.prototype.hasOwnProperty.call(workflow.on ?? workflow[true] ?? {}, 'workflow_dispatch');

const jobNames = (workflow) =>
  Object.entries(workflow.jobs).map(([id, job]) => job.name ?? id);

describe('翻訳コミットの後の必須チェック（dispatch-check）', () => {
  const dispatched = dispatchedWorkflows(dispatchScript);
  const required = developRequiredChecks();

  it('docs に develop の必須チェックが書いてある', () => {
    expect(required.length).toBeGreaterThan(0);
  });

  it.each(required)('必須チェック「%s」を出すワークフローを workflow_dispatch で起動する', (check) => {
    const owners = [...dispatched.keys()].filter((file) => jobNames(readWorkflow(file)).includes(check));
    expect({ check, owners }).not.toEqual({ check, owners: [] });
    for (const file of owners) {
      expect({ file, acceptsDispatch: workflowDispatchAccepts(readWorkflow(file)) }).toEqual({
        file,
        acceptsDispatch: true,
      });
    }
  });

  it('i18n-check も起動する', () => {
    expect(dispatched.get('translate-content.yml')).toEqual(['mode', 'since']);
  });

  it('h5-admission に渡す入力は、h5-admission.yml の入力と一致する', () => {
    const h5 = readWorkflow('h5-admission.yml');
    const declared = Object.keys((h5.on ?? h5[true]).workflow_dispatch.inputs).sort();
    expect([...(dispatched.get('h5-admission.yml') ?? [])].sort()).toEqual(declared);
  });
});

describe('PR での翻訳の上限', () => {
  const step = translate.jobs.translate.steps.find((s) => s.env && 'I18N_MAX_ITEMS' in s.env);
  const limit = Number(step.env.I18N_MAX_ITEMS);
  const articles = COLLECTION_NAMES.reduce(
    (sum, collection) =>
      sum + readdirSync(path.join(root, CONTENT_ROOT, collection, SOURCE_LANG)).filter((f) => f.endsWith('.md')).length,
    0
  );

  it('全記事 × 翻訳先の言語数より大きい（全記事を直す PR でも 1 回で訳せる）', () => {
    expect({ limit, needed: articles * TARGET_LANGS.length }).toEqual({
      limit,
      needed: Math.min(articles * TARGET_LANGS.length, limit),
    });
  });
});
