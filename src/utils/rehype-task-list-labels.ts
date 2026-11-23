/**
 * GFM のタスクリスト（`- [ ]` / `- [x]`）の checkbox に、その項目の文を読み上げ名として付ける rehype の部品。
 *
 * remark-gfm は `<li class="task-list-item"><input type="checkbox" disabled> 項目の文</li>` を出す。
 * checkbox には label も aria-label も無いため、支援技術にはどれも「チェックボックス」としか読まれない
 * （本番 0f4b2753 の Chromium と axe の label の指摘）。項目の文を aria-label にすれば、内容・checked・
 * disabled をそのままに、どの項目かが一意に分かる。
 *
 * 変えない物: 項目の文字（link・em・code・画像の alt を含む）、入れ子の list、checkbox の checked と
 * disabled、task list の外の checkbox、書き手が既に付けた aria-label / aria-labelledby。文字は 1 字も変えない。
 * 入れ子の項目は親の名前に含めない（親と子で名前が重ならないように）。緩い list では checkbox が
 * 最初の paragraph の中にあるため、そこも見る。
 */
type HastNode = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
  value?: string;
};

function classesOf(node: HastNode): string[] {
  const value = node.properties?.className;
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') return value.split(/\s+/).filter(Boolean);
  return [];
}

function isElement(node: HastNode, tagName?: string): boolean {
  return node.type === 'element' && (tagName === undefined || node.tagName === tagName);
}

/** 画像は alt を文字として読む（読み上げ名に画像の意味を残す） */
function textOf(node: HastNode): string {
  if (node.type === 'text') return node.value ?? '';
  if (isElement(node, 'br')) return ' ';
  if (isElement(node, 'img')) {
    const alt = node.properties?.alt;
    return typeof alt === 'string' ? alt : '';
  }
  return (node.children ?? []).map(textOf).join('');
}

function isDisabledCheckbox(node: HastNode): boolean {
  return isElement(node, 'input')
    && node.properties?.type === 'checkbox'
    && node.properties.disabled === true;
}

function hasName(node: HastNode): boolean {
  for (const key of ['ariaLabel', 'ariaLabelledBy']) {
    const value = node.properties?.[key];
    const names = Array.isArray(value) ? value : [value];
    if (names.some((name) => typeof name === 'string' && name.trim() !== '')) return true;
  }
  return false;
}

// Tight list の先頭段落には p 要素がない。次のブロックが段落の終端になる。
const markdownBlocks = new Set([
  'blockquote', 'div', 'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr',
  'ol', 'p', 'pre', 'section', 'table', 'ul',
]);

function firstContentIndex(children: HastNode[]): number {
  return children.findIndex((child) => child.type !== 'comment'
    && !(child.type === 'text' && !child.value?.trim()));
}

function labelTaskItem(item: HastNode): number {
  let content = item.children ?? [];
  let start = firstContentIndex(content);
  if (start < 0) return 0;
  if (isElement(content[start], 'p')) {
    content = content[start].children ?? [];
    start = firstContentIndex(content);
  }
  const checkbox = content[start];
  if (!checkbox || !isDisabledCheckbox(checkbox) || hasName(checkbox)) return 0;

  let text = '';
  for (const child of content.slice(start + 1)) {
    if (child.tagName && markdownBlocks.has(child.tagName)) break;
    text += textOf(child);
  }
  const label = text.replace(/\s+/g, ' ').trim();
  if (!label) return 0;
  checkbox.properties!.ariaLabel = label;
  return 1;
}

/**
 * task list の checkbox に、その項目の文を aria-label として付ける。付けた数を返す（木はその場で変える）。
 * 空の項目や、既に名前（aria-label / aria-labelledby）がある checkbox は変えない。
 */
export function labelTaskListCheckboxes(node: HastNode): number {
  let changed = 0;
  if (isElement(node, 'li') && classesOf(node).includes('task-list-item')) {
    changed = labelTaskItem(node);
  }
  for (const child of node.children ?? []) changed += labelTaskListCheckboxes(child);
  return changed;
}

/** unified の Transformer に代入できるよう引数は unknown で受ける（hast / vfile の型に依存しない） */
export function rehypeTaskListLabels() {
  return (tree: unknown): void => {
    labelTaskListCheckboxes(tree as HastNode);
  };
}
