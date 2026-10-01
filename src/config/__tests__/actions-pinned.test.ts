// @vitest-environment node
/**
 * ワークフローの action は、コミットの SHA（40 桁）と版のコメント（# vX.Y.Z）で固定し、同じ action はどのワークフローでも
 * 同じ版を使う。
 *
 * タグ（@v4 など）は、あとから別のコミットを指すように動かせる。また 2026-10-01 まで、visual-text.yml・h5-admission.yml・
 * claude*.yml の @v4 と、deploy.yml の v4.4.0 の SHA が、ほかのワークフロー（v7）から取り残され、Node.js 20 の非推奨の
 * 注記を出していた（v4 は Node.js 20 で動く）。同じ action の版をそろえておけば、1 つだけ古いまま残ると落ちる。
 *
 * SHA が版のコメントのタグを本当に指すかは、ここでは確かめない（ネットワークが要る）。版を上げるときに
 * `gh api repos/<owner>/<repo>/git/ref/tags/<tag>` で確かめる（注釈つきのタグは、その先のコミット）。
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type Use = { file: string; line: number; ref: string; version?: string };
type Files = Record<string, string>;

const ROOT = process.cwd();
const WORKFLOWS = '.github/workflows';
// 「uses:」と「- uses:」の行（YAML として読むとコメントが消えるので、行で読む）
const USES = /^\s*(?:-\s+)?uses:\s*(\S+)(?:\s+#\s*(\S+))?\s*$/;
const PINNED = /^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/;
const VERSION = /^v\d+(?:\.\d+){0,2}$/;

const actionOf = (use: Use) => use.ref.split('@')[0];
const pinOf = (use: Use) => `${use.ref.split('@')[1]} # ${use.version ?? '（版のコメントなし）'}`;

function usesOf(files: Files): Use[] {
  return Object.entries(files).flatMap(([file, text]) =>
    text.split('\n').flatMap((lineText, index) => {
      const m = USES.exec(lineText);
      return m ? [{ file, line: index + 1, ref: m[1], version: m[2] }] : [];
    })
  );
}

/** 固定の形（40 桁の SHA と版のコメント）と、同じ action の版がそろっているか */
function check(files: Files): string[] {
  const uses = usesOf(files).filter((use) => !use.ref.startsWith('./') && !use.ref.startsWith('docker://'));
  const shape = uses.flatMap((use) =>
    PINNED.test(use.ref) && VERSION.test(use.version ?? '')
      ? []
      : [`${use.file}:${use.line}: ${use.ref}${use.version ? ` # ${use.version}` : ''} は、40 桁の SHA と版のコメント（# vX.Y.Z）で固定されていない`]
  );
  const byAction = uses
    .filter((use) => PINNED.test(use.ref))
    .reduce<Record<string, Use[]>>((acc, use) => ({ ...acc, [actionOf(use)]: [...(acc[actionOf(use)] ?? []), use] }), {});
  const drift = Object.entries(byAction).flatMap(([action, list]) =>
    new Set(list.map(pinOf)).size <= 1
      ? []
      : [`${action} の版がワークフローごとに違う: ${list.map((use) => `${use.file}:${use.line} ${pinOf(use)}`).join(' / ')}`]
  );
  return [...shape, ...drift];
}

const workflowTexts = (): Files =>
  Object.fromEntries(
    readdirSync(path.join(ROOT, WORKFLOWS))
      .filter((name) => /\.ya?ml$/.test(name))
      .sort()
      .map((name) => [`${WORKFLOWS}/${name}`, readFileSync(path.join(ROOT, WORKFLOWS, name), 'utf8')])
  );

describe('ワークフローの action の固定（40 桁の SHA と版のコメント・同じ action は同じ版）', () => {
  it('すべての uses: が固定され、同じ action はどのワークフローでも同じ版', () => {
    expect(check(workflowTexts())).toEqual([]);
  });

  it('照合が空振りしていない（uses: を読めている）', () => {
    const actions = usesOf(workflowTexts()).map(actionOf);
    expect(actions.length).toBeGreaterThan(20);
    expect(actions).toEqual(
      expect.arrayContaining(['actions/checkout', 'actions/setup-node', 'actions/upload-artifact', 'anthropics/claude-code-action'])
    );
  });
});

/** 1 つのワークフローの文字列だけを書き換えた写し（書き換える場所が無ければ落とす） */
function edited(file: string, from: string, to: string): Files {
  const files = workflowTexts();
  const key = `${WORKFLOWS}/${file}`;
  expect(files[key].includes(from), `${key} に ${from} が無い`).toBe(true);
  return { ...files, [key]: files[key].replace(from, to) };
}
const CHECKOUT = 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1';

describe('F3 変異: 片側だけ変えると落ちる', () => {
  it('タグで参照する（visual-text.yml の checkout を @v4 に戻す）', () => {
    expect(check(edited('visual-text.yml', CHECKOUT, 'actions/checkout@v4')).join('\n')).toMatch(
      /\.github\/workflows\/visual-text\.yml:\d+: actions\/checkout@v4 は、40 桁の SHA と版のコメント/
    );
  });

  it('「- uses:」の形も読む（h5-admission.yml の checkout を @v4 に戻す）', () => {
    expect(check(edited('h5-admission.yml', CHECKOUT, 'actions/checkout@v4')).join('\n')).toMatch(
      /\.github\/workflows\/h5-admission\.yml:\d+: actions\/checkout@v4 は/
    );
  });

  it('版のコメントを消す・SHA を短くする', () => {
    const noComment = check(edited('claude.yml', CHECKOUT, 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1'));
    const shortSha = check(edited('claude.yml', CHECKOUT, 'actions/checkout@3d3c42e # v7.0.1'));
    expect(noComment.join('\n')).toMatch(/claude\.yml:\d+: actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 は/);
    expect(shortSha.join('\n')).toMatch(/claude\.yml:\d+: actions\/checkout@3d3c42e # v7\.0\.1 は/);
  });

  it('1 つのワークフローだけ古い版にする（deploy.yml の checkout を v4.4.0 に戻す。両方の版を出す）', () => {
    const drift = check(
      edited('deploy.yml', CHECKOUT, 'actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0')
    ).join('\n');
    expect(drift).toContain('actions/checkout の版がワークフローごとに違う: ');
    expect(drift).toMatch(/deploy\.yml:\d+ 11d5960a326750d5838078e36cf38b85af677262 # v4\.4\.0/);
    expect(drift).toMatch(/ci\.yml:\d+ 3d3c42e5aac5ba805825da76410c181273ba90b1 # v7\.0\.1/);
  });
});
