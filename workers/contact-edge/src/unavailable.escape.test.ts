import { describe, expect, it, vi } from 'vitest';

// 今の終わりの文は定数で、HTML の形を含まない。後で文が変わっても、文字として出ることを守る
// （本文や title に入れるときの escape を外すと落ちる）。文の定義だけを、この file の中で差し替える。
const MARKED = `A < B & C > "D" 'E'`;
const ESCAPED = 'A &lt; B &amp; C &gt; &quot;D&quot; &#39;E&#39;';

vi.mock('../../../src/components/contact/chat/cloudiaUnavailableCopy', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../../src/components/contact/chat/cloudiaUnavailableCopy')>();
  return {
    ...original,
    CLOUDIA_UNAVAILABLE_COPY: {
      ...original.CLOUDIA_UNAVAILABLE_COPY,
      ja: { ...original.CLOUDIA_UNAVAILABLE_COPY.ja, unavailable: `A < B & C > "D" 'E'` },
      zh: { ...original.CLOUDIA_UNAVAILABLE_COPY.zh, unavailable: `A < B & C > "D" 'E'` },
    },
  };
});

const { renderUnavailablePage } = await import('./unavailable');

describe('終わりのページの文は、HTML の形を含んでも文字として出す', () => {
  it('本文（見出しの在る ja）', () => {
    const html = renderUnavailablePage('ja');
    expect(html).toContain(`<p>${ESCAPED}</p>`);
    expect(html).not.toContain(MARKED);
  });

  it('見出しの無い言語では、title にも同じ文を入れる（zh）', () => {
    const html = renderUnavailablePage('zh');
    expect(html).toContain(`<title>${ESCAPED}</title>`);
    expect(html).toContain(`<p>${ESCAPED}</p>`);
    expect(html).not.toContain(MARKED);
  });
});
