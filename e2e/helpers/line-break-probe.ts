// 文・題の塊が 1 行に収まるかを、字数ではなく実際の幅で見るための測る関数。
// font の違う環境（CI の Linux など）では、同じ字数でも英数字や等幅の字の幅が
// 違う。字数で決めると、実際には箱に収まらない文を「1 行のはず」と誤って数える。
//
// 使い方: `await page.evaluate(installLineBreakProbe)` で page に仕込み、
// `page.evaluate` の中で `window.__lineBreakProbe` の関数を呼ぶ。
// 業種別・読み物・LP と一覧の全部の試験が、この 1 つの実装を使い回す
// （同じ決めを 2 か所に持たない）。決めの本文は docs/design/layout-rules.md の 5。
export type LineBreakProbe = {
  /** 要素の行数（高さ ÷ 行の高さ。手で入れた <br> のうち前後に字が在る物だけ引く） */
  lineCount: (element: Element) => number;
  /** 折り返さない時の幅（nowrap にした複製で測る） */
  unwrappedWidth: (element: Element) => number;
  /** 文を置く箱（親）の中身の幅（padding と border を引く） */
  contentWidth: (element: Element) => number;
  /** 「1 行のはず」の文の試験（落ちた文の一覧） */
  sentenceFailures: (selector?: string) => string[];
  /** 題の塊 1 つ 1 つが 1 行の試験（落ちた塊の一覧） */
  clauseFailures: (selector: string) => string[];
  /** 「1 行のはず」と判定した文の数（報告用。合否は sentenceFailures が見る） */
  judgedCount: (selector?: string) => number;
  /** 「1 行のはず」と判定した題の塊の数（報告用） */
  judgedClauseCount: (selector: string) => number;
};

declare global {
  interface Window {
    __lineBreakProbe?: LineBreakProbe;
  }
}

export function installLineBreakProbe(): void {
  // 手で入れた <br> のうち、その前と後の両方に同じ文の中の字が在る物だけが行を
  // 増やす。文の頭・尻の <br> は行を増やさないので数えない（尻の <br> まで引くと、
  // 実際に 2 行に割れた文が「1 行」と誤って通る）。
  const manualLineBreakCount = (element: Element): number =>
    Array.from(element.querySelectorAll('br')).filter((br) => {
      const before = document.createRange();
      before.setStart(element, 0);
      before.setEndBefore(br);
      const after = document.createRange();
      after.setStartAfter(br);
      after.setEnd(element, element.childNodes.length);
      const hasText = (range: Range): boolean => (range.toString().match(/\S/) ?? []).length > 0;
      const breaksALine = hasText(before) && hasText(after);
      before.detach();
      after.detach();
      return breaksALine;
    }).length;

  // 行の数は、要素の高さを行の高さで割って数える。inline の code は、同じ行でも
  // 上下の padding で Range の top が 9px ずれる事があり、矩形をまとめる数え方だと
  // 1 行を 2 行と誤る。line-height が数値で取れない要素は、代わりの数え方に落とさず
  // 「行の高さが取れない」と出して落とす（今の page には 1 つも無い。出たら、その
  // 要素を報告できるよう class と字を添える）。
  const lineCount = (element: Element): number => {
    const style = window.getComputedStyle(element);
    const lineHeight = Number.parseFloat(style.lineHeight);
    if (!Number.isFinite(lineHeight) || lineHeight <= 0) {
      throw new Error(
        `行の高さが取れない（line-height: ${style.lineHeight}）: ${element.tagName.toLowerCase()}.${Array.from(
          element.classList,
        ).join('.')}: ${(element.textContent ?? '').replace(/\s+/g, '').slice(0, 40)}`,
      );
    }
    const height = element.getBoundingClientRect().height;
    return Math.max(1, Math.round(height / lineHeight) - manualLineBreakCount(element));
  };

  // 折り返さない時の幅。複製を不可視・nowrap で親に置いて測り、終わったら必ず消す
  // （元の要素の見た目は変えない）。手で入れた <br> は、折り返さない時の幅を測るため
  // 空白に置き換える（<br> を残すと、複製の幅が長い方の行だけになる）。
  // width は max-content で測る（auto だと絶対配置の縮小計測で箱の幅に切り詰められ、
  // 本当の幅より小さく出る事がある）。
  const unwrappedWidth = (element: Element): number => {
    const clone = element.cloneNode(true) as HTMLElement;
    for (const br of Array.from(clone.querySelectorAll('br'))) br.replaceWith(' ');
    clone.style.position = 'absolute';
    clone.style.visibility = 'hidden';
    clone.style.whiteSpace = 'nowrap';
    clone.style.maxWidth = 'none';
    clone.style.width = 'max-content';
    clone.style.display = 'inline-block';
    element.parentElement?.appendChild(clone);
    const width = clone.getBoundingClientRect().width;
    clone.remove();
    return width;
  };

  // 文を置く箱（親）の中身の幅。文字が流れるのは padding と border の内側だけなので、
  // 親の矩形から左右の padding と border を引く。clientWidth は整数に丸めて返すので
  // 使わない（丸めた値と、折り返さない時の幅の小数が、境界でどちらにも転ぶ）。
  const contentWidth = (element: Element): number => {
    const parent = element.parentElement;
    if (!parent) return document.documentElement.clientWidth;
    const style = window.getComputedStyle(parent);
    const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
    const paddingRight = Number.parseFloat(style.paddingRight) || 0;
    const borderLeft = Number.parseFloat(style.borderLeftWidth) || 0;
    const borderRight = Number.parseFloat(style.borderRightWidth) || 0;
    return parent.getBoundingClientRect().width - paddingLeft - paddingRight - borderLeft - borderRight;
  };

  // 判定の決め（文も、題の塊も同じ）: 折り返さない時の幅が、箱より 1px 以上小さい
  // 要素だけを「1 行のはず」とする。箱との差が 1px 未満の物は、丸めでどちらにも転ぶ
  // ので判定から外す。箱より広い物は折り返して当然なので同じく外す。見えていない物
  // （幅 0。閉じた開閉の中など）も外す。
  const judged = (element: Element): { box: number; nowrapWidth: number } | null => {
    const nowrapWidth = unwrappedWidth(element);
    if (nowrapWidth <= 0) return null;
    const box = contentWidth(element);
    if (box <= 0) return null;
    if (nowrapWidth > box - 1) return null;
    return { box, nowrapWidth };
  };

  // 「1 行のはず」と判定した文が 2 行以上なら落とす。判定した文が 0 個の route は、
  // 測り方が空振りしているので落とす。
  const sentenceFailures = (selector = '.lb-sentence'): string[] => {
    const failures: string[] = [];
    let judgedSentences = 0;
    const sentences = Array.from(document.querySelectorAll(selector));
    if (sentences.length === 0) failures.push('.lb-sentence が 1 つも無い');
    for (const sentence of sentences) {
      const text = (sentence.textContent ?? '').replace(/\s+/g, '');
      if (text.length === 0) continue;
      const measurement = judged(sentence);
      if (!measurement) continue;
      judgedSentences += 1;
      const lines = lineCount(sentence);
      if (lines !== 1) {
        const chars = Array.from(text).length;
        const style = window.getComputedStyle(sentence);
        const lineHeight = Number.parseFloat(style.lineHeight);
        const height = sentence.getBoundingClientRect().height;
        const lineHeightText =
          Number.isFinite(lineHeight) && lineHeight > 0 ? `${lineHeight.toFixed(1)}px` : '取れない';
        failures.push(
          `文が 1 行に収まらない（${lines} 行 = 高さ ${height.toFixed(1)}px ÷ 行 ${lineHeightText}。幅 ${measurement.nowrapWidth.toFixed(1)}px / 箱 ${measurement.box.toFixed(1)}px、${chars} 字）: ${text.slice(0, 40)}`,
        );
      }
    }
    if (judgedSentences === 0) failures.push('「1 行のはず」と判定した文が 0 個（幅の測り方が空振りしている）');
    return failures;
  };

  // 題の塊 1 つ 1 つは 1 行（判定の決めは文と同じ。箱より長い塊は判定から外す）。
  const clauseFailures = (selector: string): string[] => {
    const failures: string[] = [];
    for (const clause of Array.from(document.querySelectorAll(selector))) {
      const text = (clause.textContent ?? '').replace(/\s+/g, '');
      if (text.length === 0) continue;
      const measurement = judged(clause);
      if (!measurement) continue;
      const lines = lineCount(clause);
      if (lines !== 1) {
        const style = window.getComputedStyle(clause);
        const lineHeight = Number.parseFloat(style.lineHeight);
        const height = clause.getBoundingClientRect().height;
        const lineHeightText =
          Number.isFinite(lineHeight) && lineHeight > 0 ? `${lineHeight.toFixed(1)}px` : '取れない';
        failures.push(
          `題の塊が ${lines} 行に割れている（高さ ${height.toFixed(1)}px ÷ 行 ${lineHeightText}。幅 ${measurement.nowrapWidth.toFixed(1)}px / 箱 ${measurement.box.toFixed(1)}px）: ${text.slice(0, 40)}`,
        );
      }
    }
    return failures;
  };

  const judgedCount = (selector = '.lb-sentence'): number => {
    let count = 0;
    for (const element of Array.from(document.querySelectorAll(selector))) {
      const text = (element.textContent ?? '').replace(/\s+/g, '');
      if (text.length === 0) continue;
      if (judged(element)) count += 1;
    }
    return count;
  };

  const judgedClauseCount = (selector: string): number => {
    let count = 0;
    for (const element of Array.from(document.querySelectorAll(selector))) {
      const text = (element.textContent ?? '').replace(/\s+/g, '');
      if (text.length === 0) continue;
      if (judged(element)) count += 1;
    }
    return count;
  };

  window.__lineBreakProbe = {
    lineCount,
    unwrappedWidth,
    contentWidth,
    sentenceFailures,
    clauseFailures,
    judgedCount,
    judgedClauseCount,
  };
}
