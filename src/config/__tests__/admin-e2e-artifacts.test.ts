// @vitest-environment node
/**
 * CMS 管理画面の e2e の失敗の記録が、CI の成果物に載るかを照合する。
 * playwright.admin.config.ts の outputDir ↔ .github/workflows/visual-text.yml の成果物のアップロードの path。
 *
 * 片方だけ変えると、if-no-files-found: ignore のため何も言わずに記録が載らなくなる（必要なのは落ちたときなのに）。
 * また Playwright は実行の開始時に outputDir を空にするので、そこに別の成果物（表示監査の結果）を置くと消える。
 * 2026-10-01 まで、管理画面の e2e が既定の test-results/ を空にし、test-results/visual-text/ が毎回消えていた。
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import adminConfig from '../../../playwright.admin.config';

type Step = { name?: string; uses?: string; run?: string; if?: unknown; with?: Record<string, unknown> };
type Workflow = { jobs: Record<string, { steps?: Step[] }> };

const ROOT = process.cwd();
const WORKFLOW = '.github/workflows/visual-text.yml';
const ADMIN_E2E = /npm run test:e2e:admin\b/;
const normalize = (dir: string) => path.relative(ROOT, path.resolve(ROOT, dir)).replace(/\/+$/, '');

/** outputDir（Playwright の設定）と、ワークフローの成果物のアップロードが噛み合っているか */
function check(outputDirOption: string | undefined, workflowText: string): string[] {
  const outputDir = normalize(outputDirOption ?? 'test-results');
  const workflow = yaml.load(workflowText) as Workflow;
  const job = Object.values(workflow.jobs).find((j) => (j.steps ?? []).some((s) => ADMIN_E2E.test(s.run ?? '')));
  if (!job) return [`${WORKFLOW}: npm run test:e2e:admin を動かすジョブが無い`];
  const steps = job.steps ?? [];
  const e2eIndex = steps.findIndex((s) => ADMIN_E2E.test(s.run ?? ''));
  const upload = steps.find((s, i) => i > e2eIndex && /^actions\/upload-artifact@/.test(s.uses ?? ''));
  if (!upload) return [`${WORKFLOW}: 管理画面の e2e の後に upload-artifact のステップが無い`];
  const uploaded = String(upload.with?.path ?? '')
    .split('\n')
    .map((p) => p.trim())
    .filter(Boolean)
    .map(normalize);
  const wiped = uploaded.filter((p) => p !== outputDir && `${p}/`.startsWith(`${outputDir}/`));
  return [
    ...(/always\(\)|failure\(\)/.test(String(upload.if ?? ''))
      ? []
      : [`${WORKFLOW}: 成果物のアップロードが失敗のときに動かない（if: ${String(upload.if)}）`]),
    ...(uploaded.some((p) => outputDir === p || outputDir.startsWith(`${p}/`))
      ? []
      : [`playwright.admin.config.ts の outputDir=${outputDir} が、${WORKFLOW} のアップロードの path [${uploaded.join(', ')}] に無い`]),
    ...(wiped.length === 0
      ? []
      : [`playwright.admin.config.ts の outputDir=${outputDir} は開始時に空にされるが、その中に別の成果物 [${wiped.join(', ')}] がある`]),
  ];
}

const workflowText = () => readFileSync(path.join(ROOT, WORKFLOW), 'utf8');

describe('CMS 管理画面の e2e の失敗の記録（outputDir ↔ visual-text.yml の成果物）', () => {
  it('outputDir が、失敗のときにも動くアップロードの path に入っていて、別の成果物を消さない', () => {
    expect(check(adminConfig.outputDir, workflowText())).toEqual([]);
  });
});

describe('F3 変異: 片側だけ変えると落ちる', () => {
  it('outputDir だけを変える', () => {
    const violations = check('test-results/admin', workflowText()).join('\n');
    // 両方の値（outputDir と、アップロードの path の一つ）を出す。path の一覧は増えうるので、全体は照合しない
    expect(violations).toContain('playwright.admin.config.ts の outputDir=test-results/admin が、.github/workflows/visual-text.yml のアップロードの path [');
    expect(violations).toContain('test-results/admin-cms');
  });

  it('アップロードの path から管理画面の行だけを消す', () => {
    const changed = workflowText().replace('            test-results/admin-cms/\n', '');
    expect(changed).not.toBe(workflowText());
    expect(check(adminConfig.outputDir, changed).join('\n')).toContain('outputDir=test-results/admin-cms が');
  });

  it('outputDir を既定（test-results）に戻す（表示監査の結果を消していた 2026-10-01 までの形）', () => {
    const violations = check(undefined, workflowText()).join('\n');
    expect(violations).toContain('outputDir=test-results は開始時に空にされるが、その中に別の成果物 [');
    expect(violations).toContain('test-results/visual-text');
  });

  it('アップロードを成功のときだけにする', () => {
    const changed = workflowText().replace('        if: always()\n        uses: actions/upload-artifact', '        uses: actions/upload-artifact');
    expect(changed).not.toBe(workflowText());
    expect(check(adminConfig.outputDir, changed).join('\n')).toContain('成果物のアップロードが失敗のときに動かない');
  });
});
