type Element = {
  type: string;
  tagName?: string;
  value?: string;
  properties?: { id?: string };
  children?: Element[];
};

type MarkdownFile = {
  path?: string;
  data: { astro?: { frontmatter?: Record<string, unknown> } };
};

function titleText(value: string) {
  return value.normalize('NFKC')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsId(node: Element, id: string): boolean {
  return node.properties?.id === id || (node.children ?? []).some(child => containsId(child, id));
}

// slug生成後に、冒頭にある単純な題だけを記事のヘッダーに移す。
// 本文中の節、独立したリンク、画像などを書く場合は元の見出しを残す。
export function rehypeBlogTitle() {
  return (tree: Element, file: MarkdownFile) => {
    const metadata = file.data.astro?.frontmatter;
    const filePath = file.path?.replaceAll('\\', '/');
    if (!filePath?.includes('/src/content/blog/') || typeof metadata?.title !== 'string') return;
    const children = tree.children ?? [];
    const index = children.findIndex(node => node.type !== 'text' || Boolean(node.value?.trim()));
    const heading = children[index];
    if (heading?.tagName !== 'h1' || !heading.properties?.id || !heading.children?.length) return;
    if (heading.children.some(child => child.type !== 'text')) return;
    const title = heading.children.map(child => child.value ?? '').join('');
    if (titleText(title) !== titleText(metadata.title)) return;
    if (containsId(tree, heading.properties.id + '--text')) return;
    metadata.articleTitleAnchor = heading.properties.id;
    children.splice(index, 1);
  };
}
