/**
 * Grok の検索応答から、文体の下書きを生成する（#454 B）。
 * 引用は資料ごとに短く 1 か所まで。上限を超えるとエラー。
 */

// 引用の上限（文字数）
const MAX_QUOTE_LENGTH = 300;

/**
 * Markdown の引用ブロック（> で始まる行）を抽出する。
 *
 * @param {string} content - Markdown テキスト
 * @returns {string[]} - 引用ブロックの配列
 */
export function extractQuotes(content) {
  const lines = content.split('\n');
  const quotes = [];
  let currentQuote = [];

  for (const line of lines) {
    if (line.startsWith('>')) {
      currentQuote.push(line.slice(1).trim());
    } else if (currentQuote.length > 0) {
      quotes.push(currentQuote.join('\n'));
      currentQuote = [];
    }
  }

  if (currentQuote.length > 0) {
    quotes.push(currentQuote.join('\n'));
  }

  return quotes;
}

/**
 * 引用の長さが上限を超えているか検査する。
 *
 * @param {string} content - Markdown テキスト
 * @returns {{ valid: boolean, violations: Array<{ quote: string, length: number }> }}
 */
export function validateQuoteLength(content) {
  const quotes = extractQuotes(content);
  const violations = [];

  for (const quote of quotes) {
    if (quote.length > MAX_QUOTE_LENGTH) {
      violations.push({ quote: quote.slice(0, 100) + '...', length: quote.length });
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Grok の応答を文体の下書き（Markdown）に整形する。
 *
 * @param {object} grokResponse - Grok API のレスポンス
 * @param {string} slug - ファイル名に使う slug
 * @returns {string} - styles/<slug>.md の内容
 * @throws {Error} - 引用が上限を超えている場合
 */
export function formatStyleDraft(grokResponse, slug) {
  if (!grokResponse?.choices?.[0]?.message?.content) {
    throw new Error('Invalid Grok response format');
  }

  const content = grokResponse.choices[0].message.content;

  // 引用の長さを検査
  const validation = validateQuoteLength(content);
  if (!validation.valid) {
    const details = validation.violations
      .map((v) => `- ${v.length} 文字: ${v.quote}`)
      .join('\n');
    throw new Error(
      `引用が上限（${MAX_QUOTE_LENGTH} 文字）を超えています:\n${details}`
    );
  }

  return content;
}
