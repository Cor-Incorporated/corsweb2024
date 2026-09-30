/**
 * テスト用: bash の run スクリプトから「コマンドとして実行される語」を取り出す（許可リスト方式の検査用）。
 *
 * 完全な bash パーサではないが、ワークフローの run で使う構文は扱う:
 *   区切り（; && || | 改行 & ( { !）、コマンド置換 $( … ) / `…`、プロセス置換 <( … )、
 *   キーワード（if then elif else fi while until do done for case in esac）、
 *   case のパターン（pat1 | pat2) … ;;）、[[ … ]]（中の && || は区切りではない）、
 *   算術 $(( … ))・パラメータ展開 ${ … }（既定値などの中の $( … ) はコマンドとして数える）・
 *   引用符（'…' "…"。"…" の中の $( … ) はコマンドとして数える）、for の単語の並び（中の $( … ) を数え、do の後がコマンド）、
 *   コメント（語頭の #）、代入の前置き（IFS= read …）、関数定義（name() { … }）。
 * 迷う構文に出会ったら例外を投げる（取りこぼして許可するより、テストを落として人が見る方が安全）。
 */

const KEYWORDS = new Set([
  'if',
  'then',
  'elif',
  'else',
  'fi',
  'while',
  'until',
  'do',
  'done',
  'for',
  'case',
  'esac',
  'in',
  '!',
  '{',
  '}',
  'time',
]);
// この語のあとは再びコマンドの位置になる
const LEADS_TO_COMMAND = new Set([
  'if',
  'then',
  'elif',
  'else',
  'while',
  'until',
  'do',
  '!',
  '{',
  'time',
]);
const ASSIGNMENT_RE = /^[A-Za-z_][A-Za-z0-9_]*(\[[^\]]*\])?\+?=/;

/**
 * @param {string} script
 * @returns {{ commands: string[], functions: string[] }} 出現順のコマンド語と、定義された関数名
 */
export function shellCommands(script) {
  const s = script;
  const commands = [];
  const functions = [];
  let i = 0;
  let atCommand = true; // 次の語がコマンドの位置か
  let inDoubleBracket = false;
  const caseStack = []; // case … in の中なら 'pattern' | 'body'
  let pendingCase = false; // "case WORD" を読んだあと "in" を待っている

  const peek = (str) => s.startsWith(str, i);
  const skipTo = (close, from) => {
    const end = s.indexOf(close, from);
    if (end === -1) throw new Error(`閉じの ${close} が見つかりません`);
    return end + close.length;
  };

  // 対応する閉じ括弧までを入れ子（引用符・${}・$(( ))）を考えながら飛ばし、中身を返す
  const readBalanced = (start, open, close) => {
    let depth = 1;
    let j = start;
    let quote = null;
    while (j < s.length && depth > 0) {
      const c = s[j];
      if (quote) {
        if (c === '\\' && quote === '"') j += 1;
        else if (c === quote) quote = null;
      } else if (c === "'" || c === '"') {
        quote = c;
      } else if (c === '\\') {
        j += 1;
      } else if (c === open) {
        depth += 1;
      } else if (c === close) {
        depth -= 1;
      }
      j += 1;
    }
    if (depth !== 0) throw new Error(`閉じの ${close} が見つかりません`);
    return { inner: s.slice(start, j - 1), end: j };
  };

  // 語を 1 つ読む（引用符・展開を含む）。返り値は語の生の文字列
  const readWord = () => {
    const start = i;
    while (i < s.length) {
      const c = s[i];
      if (/[\s;&|<>()]/.test(c) && !(c === '(' && s[i - 1] === '$')) break;
      if (c === '\\') {
        i += 2;
      } else if (c === "'") {
        i = skipTo("'", i + 1);
      } else if (c === '"') {
        i = readDoubleQuoted(i + 1);
      } else if (peek('$((')) {
        i = skipTo('))', i + 3);
      } else if (peek('$(')) {
        const { inner, end } = readBalanced(i + 2, '(', ')');
        collectNested(inner);
        i = end;
      } else if (peek('${')) {
        // ${FOO:-$(cmd)} の既定値などに書いたコマンド置換も数える（中身は引数の位置として読む）
        const { inner, end } = readBalanced(i + 2, '{', '}');
        collectArguments(inner);
        i = end;
      } else if (c === '`') {
        const end = skipTo('`', i + 1);
        collectNested(s.slice(i + 1, end - 1));
        i = end;
      } else {
        i += 1;
      }
    }
    return s.slice(start, i);
  };

  // "…" の中を読み、$( … ) と `…` の中身はコマンドとして数える
  const readDoubleQuoted = (from) => {
    let j = from;
    while (j < s.length && s[j] !== '"') {
      if (s[j] === '\\') {
        j += 2;
      } else if (s.startsWith('$((', j)) {
        j = skipTo('))', j + 3);
      } else if (s.startsWith('$(', j)) {
        const saved = i;
        const { inner, end } = readBalanced(j + 2, '(', ')');
        collectNested(inner);
        i = saved;
        j = end;
      } else if (s[j] === '`') {
        const end = skipTo('`', j + 1);
        collectNested(s.slice(j + 1, end - 1));
        j = end;
      } else {
        j += 1;
      }
    }
    if (j >= s.length) throw new Error('閉じの " が見つかりません');
    return j + 1;
  };

  const collectNested = (inner) => {
    const nested = shellCommands(inner);
    commands.push(...nested.commands);
    functions.push(...nested.functions);
  };

  // 引数の並び（配列の代入の中身・${…} の中身）: 語はコマンドではないが、中のコマンド置換は数える
  const collectArguments = (inner) => {
    commands.push(...shellCommands(`true ${inner}`).commands.slice(1));
  };

  while (i < s.length) {
    const c = s[i];
    if (c === '\n' || c === ';' || c === '&' || c === '|') {
      if (peek(';;')) {
        i += 2;
        if (caseStack.length > 0) caseStack[caseStack.length - 1] = 'pattern';
        atCommand = caseStack.at(-1) !== 'pattern';
        continue;
      }
      if (inDoubleBracket && (peek('&&') || peek('||'))) {
        i += 2;
        continue;
      }
      i += peek('&&') || peek('||') ? 2 : 1;
      atCommand = caseStack.at(-1) !== 'pattern';
      continue;
    }
    if (/\s/.test(c)) {
      i += 1;
      continue;
    }
    if (c === '#' && (i === 0 || /\s/.test(s[i - 1]))) {
      i = s.indexOf('\n', i) === -1 ? s.length : s.indexOf('\n', i);
      continue;
    }
    if (caseStack.at(-1) === 'pattern') {
      // case のパターン: ")" までを飛ばし、その後はコマンドの位置
      if (peek('esac')) {
        caseStack.pop();
        i += 4;
        atCommand = false;
        continue;
      }
      const close = s.indexOf(')', i);
      if (close === -1) throw new Error('case のパターンの ) が見つかりません');
      i = close + 1;
      caseStack[caseStack.length - 1] = 'body';
      atCommand = true;
      continue;
    }
    if (peek('<(') || peek('>(')) {
      const { inner, end } = readBalanced(i + 2, '(', ')');
      collectNested(inner);
      i = end;
      continue;
    }
    if (c === '<' || c === '>') {
      // リダイレクト: 演算子と、その後の対象の語を読み飛ばす
      while (i < s.length && /[<>&0-9]/.test(s[i])) i += 1;
      while (i < s.length && /[ \t]/.test(s[i])) i += 1;
      if (!(peek('<(') || peek('>('))) readWord();
      continue;
    }
    if (c === '(' && atCommand) {
      i += 1; // サブシェル
      continue;
    }
    if (c === ')') {
      i += 1;
      atCommand = false;
      continue;
    }
    const word = readWord();
    if (word === '') throw new Error(`解釈できない文字です: ${JSON.stringify(s.slice(i, i + 20))}`);
    if (inDoubleBracket) {
      if (word === ']]') inDoubleBracket = false;
      continue;
    }
    if (pendingCase) {
      if (word === 'in') {
        pendingCase = false;
        caseStack.push('pattern');
      }
      continue;
    }
    if (caseStack.at(-1) === 'body' && word === 'esac') {
      caseStack.pop();
      atCommand = false;
      continue;
    }
    if (!atCommand) continue;
    if (ASSIGNMENT_RE.test(word)) {
      // 配列の代入 NAME=( … ): 中の語は引数。中のコマンド置換だけを数える
      if (word.endsWith('=') && s[i] === '(') {
        const { inner, end } = readBalanced(i + 1, '(', ')');
        collectArguments(inner);
        i = end;
      }
      continue; // 代入（前置きを含む）: 次の語がコマンド
    }
    if (/^[A-Za-z_][A-Za-z0-9_-]*\(\)$/.test(word) || peek('()')) {
      // 関数定義 name() { … }
      const name = word.replace(/\(\)$/, '');
      if (peek('()')) i += 2;
      functions.push(name);
      atCommand = true;
      continue;
    }
    if (KEYWORDS.has(word)) {
      if (word === 'case') pendingCase = true;
      // for NAME in WORDS; do …: for の後の語（変数名・in・単語の並び）は引数の位置として読む
      // （単語の並びのコマンド置換は readWord が数える）。区切り（; か改行）の後の do で、再びコマンドの位置になる
      atCommand = LEADS_TO_COMMAND.has(word);
      continue;
    }
    if (word === '[[') {
      commands.push('[[');
      inDoubleBracket = true;
      atCommand = false;
      continue;
    }
    commands.push(word);
    atCommand = false;
  }
  return { commands, functions };
}
