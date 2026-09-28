/**
 * Markdown に数式があるかを frontmatter.hasMath に記録する remark プラグイン（Epic #330 / #293）。
 * post.render() の remarkPluginFrontmatter.hasMath で参照し、KaTeX の CSS を数式を含む記事だけで読み込む。
 * 数式として扱うもの:
 * - remark-math が作る math / inlineMath ノード（$$…$$ / $…$）
 * - 言語が math のコードフェンス（```math）。Astro の Shiki は math を着色せず、rehype-katex 7 が
 *   `code.language-math` を数式として描画するため、CSS が無いと崩れる
 * remark-math の構文拡張はパース時に効くため、プラグイン順に依存しない。
 */
type MdastNode = { type: string; lang?: string | null; children?: readonly MdastNode[] };
type AstroVFile = { data: { astro?: { frontmatter?: Record<string, unknown> } } };

export function hasMathNode(node: MdastNode): boolean {
  if (node.type === 'math' || node.type === 'inlineMath') return true;
  if (node.type === 'code' && node.lang === 'math') return true;
  return (node.children ?? []).some(hasMathNode);
}

// unified の Transformer に代入できるよう引数は unknown で受ける（mdast / vfile の型に依存しない）
export function remarkHasMath() {
  return (tree: unknown, file: unknown): void => {
    const vfile = file as AstroVFile;
    const astro = vfile.data.astro ?? {};
    vfile.data.astro = {
      ...astro,
      frontmatter: { ...(astro.frontmatter ?? {}), hasMath: hasMathNode(tree as MdastNode) },
    };
  };
}
