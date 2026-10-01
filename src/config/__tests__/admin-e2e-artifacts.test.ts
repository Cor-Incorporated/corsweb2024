// @vitest-environment node
/**
 * CMS 管理画面の e2e の失敗の記録が、CI の成果物に載るかを照合する。
 * playwright.admin.config.ts の outputDir ↔ 管理画面の e2e を動かす全ワークフロー（.github/workflows/）の
 * 成果物のアップロードの path。今は次の 2 つ。
 * - visual-text.yml（develop・main 宛の PR と develop への push）: 成果物 visual-text-audit（いつも上げる）
 * - deploy-cms.yml（main からの CMS の配信）: 成果物 cms-admin-e2e（落ちたときだけ上げる）
 *
 * 片方だけ変えると、if-no-files-found: ignore のため何も言わずに記録が載らなくなる（必要なのは落ちたときなのに）。
 * また Playwright は実行の開始時に outputDir を空にするので、そこに別の成果物（表示監査の結果）を置くと消える。
 * 2026-10-01 まで、管理画面の e2e が既定の test-results/ を空にし、test-results/visual-text/ が毎回消えていた。
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import adminConfig from '../../../playwright.admin.config';

type Step = { name?: string; uses?: string; run?: string; if?: unknown; with?: Record<string, unknown> };
type Job = { steps?: Step[] };
type Workflow = { jobs?: Record<string, Job> };

const ROOT = process.cwd();
const WORKFLOWS = '.github/workflows';
const VISUAL = `${WORKFLOWS}/visual-text.yml`;
const DEPLOY = `${WORKFLOWS}/deploy-cms.yml`;
// npm のスクリプトを通さず、設定ファイルを指定して Playwright を直接動かす形も拾う
const ADMIN_E2E = /npm run test:e2e:admin\b|playwright\.admin\.config/;
const UPLOAD = /^actions\/upload-artifact@/;
// 前のステップが落ちても動く条件
const ON_FAILURE = /\balways\(\)|\bfailure\(\)|!\s*cancelled\(\)/;
const normalize = (dir: string) => path.relative(ROOT, path.resolve(ROOT, dir)).replace(/\/+$/, '');
const pathsOf = (step: Step) =>
  String(step.with?.path ?? '')
    .split('\n')
    .map((p) => p.trim())
    .filter(Boolean)
    .map(normalize);
const isAdminE2e = (step: Step) => ADMIN_E2E.test(step.run ?? '');

/** 1 つのワークフローの、管理画面の e2e を動かす各ジョブで、outputDir（Playwright の設定）と成果物のアップロードが噛み合っているか */
function check(outputDirOption: string | undefined, file: string, workflowText: string): string[] {
  const outputDir = normalize(outputDirOption ?? 'test-results');
  const { jobs = {} } = yaml.load(workflowText) as Workflow;
  return Object.entries(jobs).flatMap(([jobName, job]) => {
    const steps = job.steps ?? [];
    const e2eIndex = steps.findIndex(isAdminE2e);
    if (e2eIndex < 0) return [];
    const where = `${file} の ${jobName} ジョブ`;
    const uploads = steps.slice(e2eIndex + 1).filter((s) => UPLOAD.test(s.uses ?? ''));
    const uploaded = uploads.flatMap(pathsOf);
    const carrier = uploads.find((s) => pathsOf(s).some((p) => outputDir === p || outputDir.startsWith(`${p}/`)));
    const wiped = uploaded.filter((p) => p !== outputDir && `${p}/`.startsWith(`${outputDir}/`));
    return [
      ...(carrier
        ? []
        : [`playwright.admin.config.ts の outputDir=${outputDir} が、${where}の e2e より後のアップロードの path [${uploaded.join(', ')}] に無い`]),
      ...(!carrier || ON_FAILURE.test(String(carrier.if ?? ''))
        ? []
        : [`${where}: outputDir を載せるアップロード「${carrier.name ?? carrier.uses}」が失敗のときに動かない（if: ${String(carrier.if)}）`]),
      ...(wiped.length === 0
        ? []
        : [`playwright.admin.config.ts の outputDir=${outputDir} は開始時に空にされるが、${where}はその中の別の成果物 [${wiped.join(', ')}] を上げている`]),
    ];
  });
}

const textOf = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');
const workflowFiles = () =>
  readdirSync(path.join(ROOT, WORKFLOWS))
    .filter((name) => /\.ya?ml$/.test(name))
    .sort()
    .map((name) => `${WORKFLOWS}/${name}`);
const runsAdminE2e = (text: string) =>
  Object.values((yaml.load(text) as Workflow).jobs ?? {}).some((job) => (job.steps ?? []).some(isAdminE2e));
const checkAll = (outputDir: string | undefined) =>
  workflowFiles().flatMap((file) => check(outputDir, file, textOf(file)));

describe('CMS 管理画面の e2e の失敗の記録（outputDir ↔ 管理画面の e2e を動かす全ワークフローの成果物）', () => {
  it('管理画面の e2e を動かすワークフローを見落とさない（visual-text.yml と deploy-cms.yml）', () => {
    expect(workflowFiles().filter((file) => runsAdminE2e(textOf(file)))).toEqual(expect.arrayContaining([DEPLOY, VISUAL]));
  });

  it('どのワークフローでも、outputDir が失敗のときにも動くアップロードの path に入っていて、別の成果物を消さない', () => {
    expect(checkAll(adminConfig.outputDir)).toEqual([]);
  });
});

/** deploy-cms.yml の build ジョブのステップだけを書き換えた YAML（ほかはそのまま） */
function deployWithBuildSteps(edit: (steps: Step[]) => Step[]): string {
  const workflow = yaml.load(textOf(DEPLOY)) as Workflow & { jobs: Record<string, Job> };
  const build = workflow.jobs.build;
  return yaml.dump({ ...workflow, jobs: { ...workflow.jobs, build: { ...build, steps: edit(build.steps ?? []) } } });
}
const isRecordUpload = (step: Step) => UPLOAD.test(step.uses ?? '') && pathsOf(step).includes('test-results/admin-cms');
const withoutRecordUpload = (steps: Step[]) => steps.filter((s) => !isRecordUpload(s));

describe('F3 変異: 片側だけ変えると落ちる', () => {
  it('前提: deploy-cms.yml の build ジョブに、e2e と、その記録のアップロードが 1 つずつある', () => {
    const steps = (yaml.load(textOf(DEPLOY)) as Workflow).jobs?.build?.steps ?? [];
    expect([steps.filter(isAdminE2e).length, steps.filter(isRecordUpload).length]).toEqual([1, 1]);
  });

  it('受け入れる形: if は always()・!cancelled() でもよく、置き場所は e2e より後ならどこでもよい（cms-site の後でも）', () => {
    const withIf = (condition: string) =>
      deployWithBuildSteps((steps) => steps.map((s) => (isRecordUpload(s) ? { ...s, if: condition } : s)));
    const last = deployWithBuildSteps((steps) => [...withoutRecordUpload(steps), ...steps.filter(isRecordUpload)]);
    for (const text of [withIf('always()'), withIf('${{ !cancelled() }}'), last]) {
      expect(check(adminConfig.outputDir, DEPLOY, text)).toEqual([]);
    }
  });

  it('outputDir だけを変える（両方のワークフローで落ちる）', () => {
    const violations = checkAll('test-results/admin').join('\n');
    // 両方の値（outputDir と、アップロードの path の一つ）を出す。path の一覧は増えうるので、全体は照合しない
    for (const where of [`${DEPLOY} の build ジョブ`, `${VISUAL} の visual_text ジョブ`]) {
      expect(violations).toContain(
        `playwright.admin.config.ts の outputDir=test-results/admin が、${where}の e2e より後のアップロードの path [`
      );
    }
    expect(violations).toContain('test-results/admin-cms');
  });

  it('visual-text.yml: アップロードの path から管理画面の行だけを消す', () => {
    const changed = textOf(VISUAL).replace('            test-results/admin-cms/\n', '');
    expect(changed).not.toBe(textOf(VISUAL));
    expect(check(adminConfig.outputDir, VISUAL, changed).join('\n')).toContain(
      `outputDir=test-results/admin-cms が、${VISUAL} の visual_text ジョブの e2e より後のアップロードの path [`
    );
  });

  it('outputDir を既定（test-results）に戻す（表示監査の結果を消していた 2026-10-01 までの形）', () => {
    // ほかのメッセージにも path の一覧が出るので、「空にされる」の行だけを照合する
    const wipe = check(undefined, VISUAL, textOf(VISUAL)).find((line) => line.includes('開始時に空にされる')) ?? '';
    expect(wipe).toContain(
      `outputDir=test-results は開始時に空にされるが、${VISUAL} の visual_text ジョブはその中の別の成果物 [`
    );
    expect(wipe).toContain('test-results/visual-text');
  });

  it('visual-text.yml: アップロードを成功のときだけにする', () => {
    const changed = textOf(VISUAL).replace('        if: always()\n        uses: actions/upload-artifact', '        uses: actions/upload-artifact');
    expect(changed).not.toBe(textOf(VISUAL));
    expect(check(adminConfig.outputDir, VISUAL, changed).join('\n')).toContain('が失敗のときに動かない（if: undefined）');
  });

  it('deploy-cms.yml: 記録のアップロードを消す（残るのは配信用の cms-site だけ）', () => {
    expect(check(adminConfig.outputDir, DEPLOY, deployWithBuildSteps(withoutRecordUpload))).toEqual([
      `playwright.admin.config.ts の outputDir=test-results/admin-cms が、${DEPLOY} の build ジョブの e2e より後のアップロードの path [cms/firebase.json, cms/dist] に無い`,
    ]);
  });

  it('deploy-cms.yml: 記録のアップロードを成功のときだけにする（if を外す・success() にする）', () => {
    const dropIf = deployWithBuildSteps((steps) =>
      steps.map((s) => {
        if (!isRecordUpload(s)) return s;
        const { if: _if, ...rest } = s;
        return rest;
      })
    );
    const success = deployWithBuildSteps((steps) => steps.map((s) => (isRecordUpload(s) ? { ...s, if: 'success()' } : s)));
    expect(check(adminConfig.outputDir, DEPLOY, dropIf).join('\n')).toContain(
      `${DEPLOY} の build ジョブ: outputDir を載せるアップロード「Upload the CMS admin e2e records (on failure)」が失敗のときに動かない（if: undefined）`
    );
    expect(check(adminConfig.outputDir, DEPLOY, success).join('\n')).toContain('が失敗のときに動かない（if: success()）');
  });

  it('deploy-cms.yml: 記録のアップロードを e2e の前に移す', () => {
    const moved = deployWithBuildSteps((steps) => {
      const rest = withoutRecordUpload(steps);
      const e2eIndex = rest.findIndex(isAdminE2e);
      return [...rest.slice(0, e2eIndex), ...steps.filter(isRecordUpload), ...rest.slice(e2eIndex)];
    });
    expect(check(adminConfig.outputDir, DEPLOY, moved).join('\n')).toContain(
      `outputDir=test-results/admin-cms が、${DEPLOY} の build ジョブの e2e より後のアップロードの path [cms/firebase.json, cms/dist] に無い`
    );
  });

  it('deploy-cms.yml: e2e を npm を通さずに動かす形に変えても、照合から外れない', () => {
    const direct = deployWithBuildSteps((steps) =>
      withoutRecordUpload(steps).map((s) =>
        isAdminE2e(s) ? { ...s, run: 'npx playwright test --config=playwright.admin.config.ts' } : s
      )
    );
    expect(runsAdminE2e(direct)).toBe(true);
    expect(check(adminConfig.outputDir, DEPLOY, direct).join('\n')).toContain(
      `outputDir=test-results/admin-cms が、${DEPLOY} の build ジョブの e2e より後のアップロードの path [`
    );
  });
});
