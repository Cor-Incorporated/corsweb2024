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

/**
 * 項目自身の checkbox。緩い list では最初の paragraph の中にある。
 * 入れ子の list の中の checkbox は拾わない（子の項目は子で名付ける）。
 */
function ownCheckboxOf(item: HastNode): HastNode | undefined {
  for (const child of item.children ?? []) {
    if (isDisabledCheckbox(child)) return child;
    if (isElement(child, 'p')) {
      const checkbox = (child.children ?? []).find(isDisabledCheckbox);
      if (checkbox) return checkbox;
    }
  }
  return undefined;
}

/** 項目自身の文。入れ子の list と checkbox は除く（子の項目名を親に混ぜない） */
function itemTextOf(item: HastNode): string {
  const firstParagraph = (item.children ?? []).find((child) => isElement(child, 'p'));
  if (firstParagraph) return textOf(firstParagraph).replace(/\s+/g, ' ').trim();

  let text = '';
  for (const child of item.children ?? []) {
    if (isElement(child, 'input')) continue;
    if (isElement(child, 'ul') || isElement(child, 'ol')) continue;
    text += textOf(child);
  }
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * task list の checkbox に、その項目の文を aria-label として付ける。付けた数を返す（木はその場で変える）。
 * 空の項目や、既に名前（aria-label / aria-labelledby）がある checkbox は変えない。
 */
export function labelTaskListCheckboxes(node: HastNode): number {
  let changed = 0;
  if (isElement(node, 'li') && classesOf(node).includes('task-list-item')) {
    const checkbox = ownCheckboxOf(node);
    const label = itemTextOf(node);
    if (checkbox && label !== '' && !hasName(checkbox)) {
      checkbox.properties = checkbox.properties ?? {};
      checkbox.properties.ariaLabel = label;
      changed += 1;
    }
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
