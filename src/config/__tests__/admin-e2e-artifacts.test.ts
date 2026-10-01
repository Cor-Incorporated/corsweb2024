// @vitest-environment node
/**
 * CMS 管理画面の e2e の失敗の記録が、CI の成果物に載るかを照合する。
 * playwright.admin.config.ts の outputDir ↔ 管理画面の e2e を動かす全ワークフロー（.github/workflows/）の
 * 成果物のアップロードの path。今は次の 2 つ。
 * - visual-text.yml（develop・main 宛の PR と develop への push）: 成果物 visual-text-audit（いつも上げる）
 * - deploy-cms.yml（main からの CMS の配信）: 成果物 cms-admin-e2e（記録が残るのは落ちたときだけ）
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
// 前のステップが落ちても動く条件（${{ }} と空白を除いて、どれかと一致すること）。部分一致にすると、!failure()・
// always() && success() のように、落ちたときに動かない条件も通ってしまう（#377 のレビュー）。ほかの形は、ここに足す
const ON_FAILURE_FORMS = ['always()', 'failure()', '!cancelled()', 'failure()||cancelled()'];
const normalize = (dir: string) => path.relative(ROOT, path.resolve(ROOT, dir)).replace(/\/+$/, '');
const NPM_SCRIPTS: Record<string, string> = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')).scripts ?? {};
const OUTPUT_DIR = normalize(adminConfig.outputDir ?? 'test-results');

const conditionOf = (value: unknown) =>
  String(value ?? '')
    .trim()
    .replace(/^\$\{\{([\s\S]*)\}\}$/, '$1')
    .replace(/\s+/g, '');
const runsOnFailure = (step: Step) => ON_FAILURE_FORMS.includes(conditionOf(step.if));
const isAdminE2e = (step: Step) => ADMIN_E2E.test(step.run ?? '');
const within = (dir: string, parent: string) => dir === parent || dir.startsWith(`${parent}/`);

/** with.path の各行（! で始まる行は除外。末尾の /** は、そのディレクトリ全体として扱う） */
const patternsOf = (step: Step) =>
  String(step.with?.path ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({ exclude: line.startsWith('!'), dir: normalize(line.replace(/^!/, '').replace(/\/\*\*$/, '')) }));
const shownPaths = (step: Step) => patternsOf(step).map((p) => `${p.exclude ? '!' : ''}${p.dir}`);

/**
 * outputDir 全体を載せるアップロードか（含める行があり、outputDir 全体を外す行が無い）。
 * outputDir の中の一部だけを外す行（例: 動画のファイルだけを外す行）は、意図した除外として通す
 */
const carries = (step: Step, outputDir: string) => {
  const patterns = patternsOf(step);
  return (
    patterns.some((p) => !p.exclude && within(outputDir, p.dir)) &&
    !patterns.some((p) => p.exclude && within(outputDir, p.dir))
  );
};

/** run の行と、そこから npm run で呼ぶ package.json のスクリプト（--output はどちらにも書ける） */
const expandNpmRun = (run: string, scripts: Record<string, string>) =>
  [run, ...[...run.matchAll(/npm run ([\w:.-]+)/g)].map(([, name]) => `${name}: ${scripts[name] ?? ''}`)].join('\n');

/** 管理画面の e2e を動かすジョブで、outputDir が、e2e より後の、失敗のときにも動くアップロードに載るか */
function checkJob(outputDir: string, where: string, steps: Step[], scripts: Record<string, string>): string[] {
  const e2eIndex = steps.findIndex(isAdminE2e);
  if (e2eIndex < 0) return [];
  const e2eRun = expandNpmRun((steps[e2eIndex].run ?? '').trim(), scripts);
  const uploads = steps.slice(e2eIndex + 1).filter((s) => UPLOAD.test(s.uses ?? ''));
  const carriers = uploads.filter((s) => carries(s, outputDir));
  // 成功のときだけのアップロードが先にあっても、失敗のときにも動くものがあればよい
  const carrier = carriers.find(runsOnFailure) ?? carriers[0];
  const wiped = uploads
    .flatMap(patternsOf)
    .filter((p) => !p.exclude && p.dir !== outputDir && within(p.dir, outputDir))
    .map((p) => p.dir);
  return [
    ...(/--output\b/.test(e2eRun)
      ? [`${where}: e2e のコマンド（package.json のスクリプトを含む）が --output で出力先を変えている（記録が outputDir=${outputDir} に出ない）: ${e2eRun}`]
      : []),
    ...(carrier
      ? []
      : [`playwright.admin.config.ts の outputDir=${outputDir} が、${where}の e2e より後のアップロードの path [${uploads.flatMap(shownPaths).join(', ')}] に無い`]),
    ...(!carrier || runsOnFailure(carrier)
      ? []
      : [`${where}: outputDir を載せるアップロード「${carrier.name ?? carrier.uses}」が失敗のときに動かない（if: ${String(carrier.if)}。受け入れる形: ${ON_FAILURE_FORMS.join('・')}）`]),
    ...(wiped.length === 0
      ? []
      : [`playwright.admin.config.ts の outputDir=${outputDir} は開始時に空にされるが、${where}はその中の別の成果物 [${wiped.join(', ')}] を上げている`]),
  ];
}

/** 1 つのワークフローの、管理画面の e2e を動かす各ジョブで、outputDir（Playwright の設定）と成果物のアップロードが噛み合っているか */
function check(
  outputDirOption: string | undefined,
  file: string,
  workflowText: string,
  scripts: Record<string, string> = NPM_SCRIPTS
): string[] {
  const outputDir = normalize(outputDirOption ?? 'test-results');
  const { jobs = {} } = yaml.load(workflowText) as Workflow;
  return Object.entries(jobs).flatMap(([jobName, job]) =>
    checkJob(outputDir, `${file} の ${jobName} ジョブ`, job.steps ?? [], scripts)
  );
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
const isRecordUpload = (step: Step) => UPLOAD.test(step.uses ?? '') && carries(step, OUTPUT_DIR);
const withoutRecordUpload = (steps: Step[]) => steps.filter((s) => !isRecordUpload(s));
const editRecordUpload = (edit: (step: Step) => Step) =>
  deployWithBuildSteps((steps) => steps.map((s) => (isRecordUpload(s) ? edit(s) : s)));
const withIf = (condition: string) => editRecordUpload((s) => ({ ...s, if: condition }));
const withPath = (value: string) => editRecordUpload((s) => ({ ...s, with: { ...s.with, path: value } }));
const checkDeploy = (text: string) => check(adminConfig.outputDir, DEPLOY, text);

describe('F3 変異: 片側だけ変えると落ちる', () => {
  it('前提: deploy-cms.yml の build ジョブに、e2e と、その記録のアップロードが 1 つずつある', () => {
    const steps = (yaml.load(textOf(DEPLOY)) as Workflow).jobs?.build?.steps ?? [];
    expect({ outputDir: OUTPUT_DIR, e2e: steps.filter(isAdminE2e).length, upload: steps.filter(isRecordUpload).length }).toEqual({
      outputDir: OUTPUT_DIR,
      e2e: 1,
      upload: 1,
    });
  });

  it('deploy-cms.yml の記録のアップロードは、成功した配信では動かない（手順書 3-1 はいちばん新しい記録を開く）', () => {
    // always() にすると、trace の設定や隠しファイルの扱いを変えたときに、通った配信の記録も上がる（#377 のレビュー）
    const steps = (yaml.load(textOf(DEPLOY)) as Workflow).jobs?.build?.steps ?? [];
    expect(steps.filter(isRecordUpload).map((s) => conditionOf(s.if))).toEqual(['failure()||cancelled()']);
  });

  it('受け入れる形: if は always()・failure()・!cancelled()（${{ }} 付きでも）、path は /** でもよく、置き場所は e2e より後ならどこでもよい', () => {
    const last = deployWithBuildSteps((steps) => [...withoutRecordUpload(steps), ...steps.filter(isRecordUpload)]);
    // 成功のときだけ test-results/ 全体を上げるステップが、記録のアップロードより前にあってもよい
    const successFirst = deployWithBuildSteps((steps) => {
      const index = steps.findIndex(isRecordUpload);
      const all: Step = { name: 'Upload all test results', uses: steps[index].uses, with: { name: 'all', path: 'test-results/' } };
      return [...steps.slice(0, index), all, ...steps.slice(index)];
    });
    const variants = [
      withIf('${{ always() }}'),
      withIf('failure()'),
      withIf('${{ !cancelled() }}'),
      withIf('${{ failure() || cancelled() }}'),
      withPath(`${OUTPUT_DIR}/**`),
      last,
      successFirst,
    ];
    for (const text of variants) {
      expect(checkDeploy(text)).toEqual([]);
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
    expect(check(adminConfig.outputDir, VISUAL, changed).join('\n')).toContain('が失敗のときに動かない（if: undefined。');
  });

  it('deploy-cms.yml: 記録のアップロードを消す（残るのは配信用の cms-site だけ）', () => {
    expect(checkDeploy(deployWithBuildSteps(withoutRecordUpload))).toEqual([
      `playwright.admin.config.ts の outputDir=test-results/admin-cms が、${DEPLOY} の build ジョブの e2e より後のアップロードの path [cms/firebase.json, cms/dist] に無い`,
    ]);
  });

  it('deploy-cms.yml: 記録のアップロードを成功のときだけにする（if を外す・success() にする）', () => {
    const dropIf = editRecordUpload(({ if: _if, ...rest }) => rest);
    expect(checkDeploy(dropIf)).toEqual([
      `${DEPLOY} の build ジョブ: outputDir を載せるアップロード「Upload the CMS admin e2e failure records」が失敗のときに動かない（if: undefined。受け入れる形: always()・failure()・!cancelled()・failure()||cancelled()）`,
    ]);
    expect(checkDeploy(withIf('success()')).join('\n')).toContain('が失敗のときに動かない（if: success()。');
  });

  it.each([
    ['否定（${{ !failure() }}）', '${{ !failure() }}'],
    ['always() && success()（成功のときだけ）', 'always() && success()'],
    ['このワークフローでは起きないイベントを足す', "failure() && github.event_name == 'pull_request'"],
  ])('deploy-cms.yml: 落ちたときに動かない条件を、受け入れる形の一部で書く: %s', (_, condition) => {
    expect(checkDeploy(withIf(condition)).join('\n')).toContain('が失敗のときに動かない（if: ');
  });

  it('deploy-cms.yml: path に、outputDir 全体を外す行（!）を足す', () => {
    expect(checkDeploy(withPath(`${OUTPUT_DIR}/\n!${OUTPUT_DIR}/**`)).join('\n')).toContain(
      `outputDir=test-results/admin-cms が、${DEPLOY} の build ジョブの e2e より後のアップロードの path [test-results/admin-cms, !test-results/admin-cms, cms/firebase.json, cms/dist] に無い`
    );
  });

  it('deploy-cms.yml: e2e のコマンドで --output を渡して、出力先を変える', () => {
    const moved = deployWithBuildSteps((steps) =>
      steps.map((s) => (isAdminE2e(s) ? { ...s, run: `${s.run} -- --output=test-results/elsewhere` } : s))
    );
    expect(checkDeploy(moved).join('\n')).toContain(
      `${DEPLOY} の build ジョブ: e2e のコマンド（package.json のスクリプトを含む）が --output で出力先を変えている（記録が outputDir=test-results/admin-cms に出ない）`
    );
  });

  it('package.json: npm run で呼ぶスクリプトに --output を足して、出力先を変える（両方のワークフローで落ちる）', () => {
    const scripts = { ...NPM_SCRIPTS, 'test:e2e:admin': `${NPM_SCRIPTS['test:e2e:admin']} --output=test-results/elsewhere` };
    const violations = workflowFiles().flatMap((file) => check(adminConfig.outputDir, file, textOf(file), scripts)).join('\n');
    for (const where of [`${DEPLOY} の build ジョブ`, `${VISUAL} の visual_text ジョブ`]) {
      expect(violations).toContain(`${where}: e2e のコマンド（package.json のスクリプトを含む）が --output で出力先を変えている`);
    }
  });

  it('deploy-cms.yml: 記録のアップロードを e2e の前に移す', () => {
    const moved = deployWithBuildSteps((steps) => {
      const rest = withoutRecordUpload(steps);
      const e2eIndex = rest.findIndex(isAdminE2e);
      return [...rest.slice(0, e2eIndex), ...steps.filter(isRecordUpload), ...rest.slice(e2eIndex)];
    });
    expect(checkDeploy(moved).join('\n')).toContain(
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
    expect(checkDeploy(direct).join('\n')).toContain(
      `outputDir=test-results/admin-cms が、${DEPLOY} の build ジョブの e2e より後のアップロードの path [`
    );
  });
});
