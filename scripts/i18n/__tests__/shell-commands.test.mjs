// @vitest-environment node
/** 許可リスト方式の検査（workflow-trust-boundary.test.mjs）が使う、run からコマンドを取り出す関数のテスト。 */
import { describe, expect, it } from 'vitest';
import { shellCommands } from './shell-commands.mjs';

describe('shellCommands', () => {
  it.each([
    ['./x.sh', ['./x.sh']],
    ['bash x.sh && npm ci', ['bash', 'npm']],
    ['x=$(node y.mjs)', ['node']],
    ['y="$(wc -c < "$p" | tr -d " ")"', ['wc', 'tr']],
    ['echo `python -c 1`', ['echo', 'python']],
    ['if ! git push; then echo no; fi', ['git', 'echo']],
    ['IFS= read -r first < <(git cat-file -p ":$f") || true', ['read', 'git', 'true']],
    ['args=(--write --since "$(git rev-parse HEAD)")', ['git']],
    ['while IFS=$\'\\t\' read -r a b; do continue; done <<< "$x"', ['read', 'continue']],
    ['f() {\n  echo "::error::$1"\n  exit 1\n}\nf "m"', ['echo', 'exit', 'f']],
  ])('%s', (script, expected) => {
    expect(shellCommands(script).commands).toEqual(expected);
  });

  it('引用符の中の区切り・case のパターン・[[ ]] の中の演算子・算術はコマンドとして数えない', () => {
    expect(shellCommands('echo "a | b; c && d"').commands).toEqual(['echo']);
    expect(
      shellCommands('case "$s" in\n  A:1 | D:2) ;;\n  *) reject "x" ;;\nesac').commands
    ).toEqual(['reject']);
    expect(shellCommands('[[ "$a" =~ $re || -z "$b" ]] || reject "m"').commands).toEqual([
      '[[',
      'reject',
    ]);
    expect(shellCommands('n=$(( a * 2 ))').commands).toEqual([]);
  });

  // #339 最終レビュー LOW-4: for の本体・for の単語の並び・${…} の中に書いたコマンドを見落としていた
  it.each([
    ['for f in a b; do node evil.mjs; done', ['node']],
    ['for f in a b\ndo\n  node evil.mjs\ndone', ['node']],
    ['for f in $(node evil.mjs); do echo "$f"; done', ['node', 'echo']],
    ['for f in docs done; do node evil.mjs; done', ['node']],
    ['x=${FOO:-$(node evil.mjs)}', ['node']],
    ['echo ${FOO:-`node evil.mjs`}', ['echo', 'node']],
    ['echo "${FOO:-$(node evil.mjs)}"', ['echo', 'node']],
  ])('for と ${…} の中のコマンドも数える: %j', (script, expected) => {
    expect(shellCommands(script).commands).toEqual(expected);
  });

  it('関数定義の名前を返す', () => {
    expect(shellCommands('reject() {\n  exit 1\n}').functions).toEqual(['reject']);
  });
});
