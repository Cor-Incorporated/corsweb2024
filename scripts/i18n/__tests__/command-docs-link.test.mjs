// @vitest-environment node
/**
 * リンクテスト: --check のヒント・docs・README・package.json に書いたコマンドが、
 * 実際の CLI 引数検証（parseCliArgs）を通ることを機械照合する。
 * 例: `npm run i18n:translate -- --adopt` は i18n:translate が --write を含むため実行不能（過去に書きかけた誤り）。
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCliArgs } from '../cli.mjs';
import { PRUNE_REASONS } from '../prune.mjs';
import { HINTS } from '../run.mjs';

const root = path.resolve(import.meta.dirname, '../../..');
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');
const scripts = JSON.parse(read('package.json')).scripts;
const BIN = 'scripts/i18n/translate-content.mjs';

/** npm run の script 本体から translate-content.mjs に渡る引数を取り出す。 */
function npmScriptArgs(name) {
  const body = scripts[name];
  expect(body, `package.json scripts.${name}`).toMatch(new RegExp(`^node ${BIN}`));
  return body.split(/\s+/).slice(2);
}

/** テキスト中のコマンド例を、CLI に渡る引数列に変換する（<slug> 等のプレースホルダは実値に置換）。 */
function commandsIn(text) {
  const found = [];
  const npmRe = /npm run (i18n:[a-z]+)(?: -- ([^`\n#（）|]*))?/g;
  const nodeRe = new RegExp(`node (?:--env-file=\\.env )?${BIN}([^\`\\n#（）|]*)`, 'g');
  for (const m of text.matchAll(npmRe)) found.push([...npmScriptArgs(m[1]), ...split(m[2])]);
  for (const m of text.matchAll(nodeRe)) found.push(split(m[1]));
  return found;
}

function split(raw = '') {
  return raw
    .replace(/<slug>|your-post/g, 'sample-post')
    .replace(/<git-ref>/g, 'origin/develop')
    .replace(/<dir>/g, '.')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !token.startsWith('...'));
}

describe('documented commands are accepted by the CLI', () => {
  it('package.json exposes i18n:check (--check) and i18n:translate (--write)', () => {
    expect(npmScriptArgs('i18n:check')).toEqual(['--check']);
    expect(npmScriptArgs('i18n:translate')).toEqual(['--write']);
  });

  it.each([
    ['--check hints (scripts/i18n/run.mjs)', Object.values(HINTS).join('\n')],
    ['orphan reasons (scripts/i18n/prune.mjs)', Object.values(PRUNE_REASONS).join('\n')],
    ['docs/i18n-translation.md', read('docs/i18n-translation.md')],
    ['README.md', read('README.md')],
    ['README-en.md', read('README-en.md')],
    ['CLAUDE.md', read('CLAUDE.md')],
  ])('%s', (_source, text) => {
    const commands = commandsIn(text);
    expect(commands.length).toBeGreaterThan(0);
    for (const argv of commands) {
      expect(() => parseCliArgs(argv), argv.join(' ')).not.toThrow();
    }
  });

  it('would catch the invalid combination that once slipped into a hint', () => {
    expect(() => parseCliArgs([...npmScriptArgs('i18n:translate'), '--adopt'])).toThrow(/1 つだけ/);
  });
});
