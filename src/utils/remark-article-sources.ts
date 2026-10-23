/**
 * 記事の最後の「参考資料」の節を出典として扱う remark プラグイン（2026-10-23）。
 *
 * - 見出し（h2）の文言が参考資料・出典に当たる節を探し、その節のリストにあるリンクを
 *   frontmatter.citations に入れる。BlogStructuredData が Article.citation に出す
 *   （E-E-A-T の「情報源の表示」。2026-10-20 の GMO 定例で、出典の表示が評価に効くと共有された）。
 * - 見出しとリストに data 属性を付け、記事のスタイルで参考資料の欄として表示する。
 *
 * 見出しの文言は翻訳で変わるため、言語ごとの言い方を並べて判定する。翻訳 CI は見出しの数と順、
 * 見出しごとのリンクの順を検証する（ADR-0019）ので、節の形は訳文でも保たれる。
 * 該当する見出しが複数あるときは、最後のものだけを使う（本文の途中の「参考」は出典の欄にしない）。
 */
type MdastNode = {
  type: string;
  depth?: number;
  url?: string;
  value?: string;
  children?: MdastNode[];
  data?: { hProperties?: Record<string, unknown> } & Record<string, unknown>;
};
type AstroVFile = { data: { astro?: { frontmatter?: Record<string, unknown> } } };

export type ArticleCitation = { name: string; url: string };

/** 出典の欄の見出し（ja は人が書く。en / zh / ko / es は翻訳 CI の訳語の揺れを含める）。 */
const SOURCE_HEADING_TERMS: readonly RegExp[] = [
  /(?:参考資料|参考文献|参考リンク|参考情報|出典)/,
  /(?:references?|sources?|reference (?:links?|materials?)|further reading|bibliography)/i,
  /(?:参考资料|参考文献|参考链接|参考信息|资料来源|来源|出处)/,
  /(?:참고\s*자료|참고\s*문헌|참고\s*링크|참고\s*정보|출처)/,
  /(?:referencias|fuentes|enlaces de referencia|materiales? de referencia|bibliograf[ií]a)/i,
];

// 見出し全体がその語であること（後ろに括弧やコロンの補足が付くのは許す）。「Source code」などを外す。
const SOURCE_HEADING_PATTERNS: readonly RegExp[] = SOURCE_HEADING_TERMS.map(
  (term) => new RegExp(`^${term.source}\\s*(?:[（(:：].*)?$`, term.flags),
);

export function nodeText(node: MdastNode): string {
  if (typeof node.value === 'string') return node.value;
  return (node.children ?? []).map(nodeText).join('');
}

export function isSourcesHeading(text: string): boolean {
  const normalized = text.trim();
  return SOURCE_HEADING_PATTERNS.some((pattern) => pattern.test(normalized));
}

function collectLinks(node: MdastNode, out: ArticleCitation[]): void {
  if (node.type === 'link' && node.url && /^https?:\/\//.test(node.url)) {
    const name = nodeText(node).trim() || node.url;
    out.push({ name, url: node.url });
    return;
  }
  (node.children ?? []).forEach((child) => collectLinks(child, out));
}

function markNode(node: MdastNode, attribute: string): void {
  node.data = { ...(node.data ?? {}), hProperties: { ...(node.data?.hProperties ?? {}), [attribute]: '' } };
}

/**
 * ルート直下の h2 のうち最後の出典の見出しを探し、次の h1 / h2 までのリストからリンクを集める。
 * 見出しとリストには data 属性を付ける（tree を書き換える）。
 */
export function extractArticleSources(tree: MdastNode): ArticleCitation[] {
  const children = tree.children ?? [];
  let start = -1;
  children.forEach((node, index) => {
    if (node.type === 'heading' && node.depth === 2 && isSourcesHeading(nodeText(node))) start = index;
  });
  if (start < 0) return [];

  const citations: ArticleCitation[] = [];
  for (let i = start + 1; i < children.length; i += 1) {
    const node = children[i];
    if (node.type === 'heading' && (node.depth ?? 6) <= 2) break;
    if (node.type !== 'list') continue;
    const before = citations.length;
    collectLinks(node, citations);
    if (citations.length > before) markNode(node, 'data-article-sources-list');
  }
  if (citations.length > 0) markNode(children[start], 'data-article-sources');
  return citations;
}

// unified の Transformer に代入できるよう引数は unknown で受ける（mdast / vfile の型に依存しない）
export function remarkArticleSources() {
  return (tree: unknown, file: unknown): void => {
    const vfile = file as AstroVFile;
    const astro = vfile.data.astro ?? {};
    const citations = extractArticleSources(tree as MdastNode);
    vfile.data.astro = {
      ...astro,
      frontmatter: { ...(astro.frontmatter ?? {}), citations },
    };
  };
}
