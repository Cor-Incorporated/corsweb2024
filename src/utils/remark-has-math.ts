/**
 * Markdown に数式（remark-math が作る math / inlineMath ノード）があるかを frontmatter.hasMath に記録する
 * remark プラグイン（M6）。post.render() の remarkPluginFrontmatter.hasMath で参照し、KaTeX の CSS を
 * 数式を含む記事だけで読み込む。remark-math の構文拡張はパース時に効くため、プラグイン順に依存しない。
 */
type MdastNode = { type: string; children?: readonly MdastNode[] };
type AstroVFile = { data: { astro?: { frontmatter?: Record<string, unknown> } } };

export function hasMathNode(node: MdastNode): boolean {
  if (node.type === 'math' || node.type === 'inlineMath') return true;
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
