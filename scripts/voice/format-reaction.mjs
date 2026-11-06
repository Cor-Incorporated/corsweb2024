/**
 * Grok の検索応答から、週次 Issue へのコメントを生成する（#454 A）。
 * 投稿者の名前やアカウント名を除去し、リンク・要約・種類だけを残す。
 */

/**
 * 投稿者の名前やアカウント名を含む行を除去する。
 *
 * @param {string} content - Grok の応答の content
 * @returns {string} - 名前を除去した content
 */
export function removePersonalNames(content) {
  const lines = content.split('\n');
  const filtered = lines.filter((line) => {
    // 「投稿者:」「アカウント:」「ユーザー:」「by:」などを含む行を除去
    const patterns = [
      /投稿者[：:]/i,
      /アカウント[：:]/i,
      /ユーザー[：:]/i,
      /\bby[：:]/i,
      /@\w+\s*(さん|氏)?/, // @username さん などのパターン
      /\s+さん\s*$/,      // 行末の「さん」
    ];
    return !patterns.some((pattern) => pattern.test(line));
  });
  return filtered.join('\n');
}

/**
 * Grok の応答を週次 Issue のコメント形式に整形する。
 *
 * @param {object} grokResponse - Grok API のレスポンス
 * @returns {string} - Issue コメント本文
 */
export function formatReactionComment(grokResponse) {
  if (!grokResponse?.choices?.[0]?.message?.content) {
    throw new Error('Invalid Grok response format');
  }

  const content = grokResponse.choices[0].message.content;
  const cleaned = removePersonalNames(content);

  return cleaned;
}
