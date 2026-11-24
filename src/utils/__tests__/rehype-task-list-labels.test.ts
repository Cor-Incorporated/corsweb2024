// @vitest-environment node
// GFM のタスクリストの checkbox に、その項目の文を読み上げ名として付ける部品（rehype-task-list-labels.ts）の試験。
// 手で組んだ hast に加えて、remark-gfm から実際に作った HTML でも、名前だけが増え、文字・checked・
// disabled・link・入れ子・通常の input・既存の aria が変わらないことを見る。
import { describe, expect, it } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { labelTaskListCheckboxes, rehypeTaskListLabels } from '../rehype-task-list-labels';

type Node = { type: string; tagName?: string; properties?: Record<string, unknown>; children?: Node[]; value?: string };
const text = (value: string): Node => ({ type: 'text', value });
const el = (tagName: string, properties: Record<string, unknown> = {}, children: Node[] = []): Node => ({
  type: 'element',
  tagName,
  properties,
  children,
});
const root = (...children: Node[]): Node => ({ type: 'root', children });
const item = (checked: boolean, ...children: Node[]): Node =>
  el('li', { className: ['task-list-item'] }, [el('input', { type: 'checkbox', disabled: true, checked }), ...children]);

const render = (markdown: string): string =>
  String(
    unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype)
      .use(rehypeTaskListLabels)
      .use(rehypeStringify)
      .processSync(markdown),
  );

describe('labelTaskListCheckboxes: 各 checkbox にその項目の文を名前として付ける', () => {
  it('文字・checked・disabled・link をそのままに、項目ごとの名前にする', () => {
    const done = item(true, text(' 完了したタスク'));
    const todo = item(
      false,
      text(' 未完了の '),
      el('em', {}, [text('タスク')]),
      text(' と '),
      el('a', { href: '/guide' }, [text('リンク')]),
    );
    const tree = root(el('ul', { className: ['contains-task-list'] }, [done, todo]));
    const before = JSON.parse(JSON.stringify(tree)) as Node;

    expect(labelTaskListCheckboxes(tree)).toBe(2);

    const inputs = tree.children?.[0].children?.map((node) => node.children?.[0]);
    expect(inputs?.map((input) => input?.properties?.ariaLabel)).toEqual(['完了したタスク', '未完了の タスク と リンク']);
    // checkbox 自身の checked・disabled と、項目の文字・入れ子の link は変えない
    expect(inputs?.map((input) => [input?.properties?.checked, input?.properties?.disabled])).toEqual([
      [true, true],
      [false, true],
    ]);
    expect(tree.children?.[0].children?.[1].children?.slice(1)).toEqual(before.children?.[0].children?.[1].children?.slice(1));
  });

  it('入れ子の項目は親の名前に混ぜず、子にも自分の名前を付ける', () => {
    const tree = root(
      el('ul', {}, [item(false, text(' 親の項目'), el('ul', {}, [item(false, text(' 子の項目'))]))]),
    );
    expect(labelTaskListCheckboxes(tree)).toBe(2);
    const parent = tree.children?.[0].children?.[0];
    const child = parent?.children?.find((node) => node.tagName === 'ul')?.children?.[0];
    expect(parent?.children?.[0].properties?.ariaLabel).toBe('親の項目');
    expect(child?.children?.[0].properties?.ariaLabel).toBe('子の項目');
  });

  it('緩い list の checkbox（最初の paragraph の中）にも付ける', () => {
    const paragraph = el('p', {}, [el('input', { type: 'checkbox', disabled: true, checked: false }), text(' 緩い項目')]);
    const tree = root(el('ul', {}, [el('li', { className: ['task-list-item'] }, [paragraph])]));
    expect(labelTaskListCheckboxes(tree)).toBe(1);
    expect(paragraph.children?.[0].properties?.ariaLabel).toBe('緩い項目');
  });

  it('複数段落では最初の段落だけを名前にする', () => {
    const first = el('p', {}, [el('input', { type: 'checkbox', disabled: true }), text(' 最初の段落')]);
    const second = el('p', {}, [text('後の段落は名前にしない')]);
    const tree = root(el('ul', {}, [el('li', { className: ['task-list-item'] }, [first, second])]));
    expect(labelTaskListCheckboxes(tree)).toBe(1);
    expect(first.children?.[0].properties?.ariaLabel).toBe('最初の段落');
    expect(second.children?.[0].properties?.ariaLabel).toBeUndefined();
  });

  it('task list の外の checkbox と、既にある aria-label / aria-labelledby は変えない', () => {
    const tree = root(
      el('li', {}, [el('input', { type: 'checkbox' })]),
      el('li', { className: ['task-list-item'] }, [el('input', { type: 'checkbox', ariaLabel: '手で付けた名前' }), text(' 項目')]),
      el('li', { className: ['task-list-item'] }, [
        el('input', { type: 'checkbox', ariaLabelledBy: 'other' }),
        text(' 別の項目'),
      ]),
    );
    expect(labelTaskListCheckboxes(tree)).toBe(0);
    expect(tree.children?.[1].children?.[0].properties?.ariaLabel).toBe('手で付けた名前');
    expect(tree.children?.[2].children?.[0].properties?.ariaLabel).toBeUndefined();
  });

  it('keeps enabled inputs and existing ID references and separates text at line breaks', () => {
    const enabled = el('input', { type: 'checkbox' });
    const referenced = el('input', { type: 'checkbox', disabled: true, ariaLabelledBy: ['existing'] });
    const wrapped = item(false, text('First'), el('br'), text('second'));
    const tree = root(
      el('li', { className: ['task-list-item'] }, [enabled, text('Existing interactive input')]),
      el('li', { className: ['task-list-item'] }, [referenced, text('Existing visible label')]),
      wrapped,
    );
    expect(labelTaskListCheckboxes(tree)).toBe(1);
    expect(enabled.properties?.ariaLabel).toBeUndefined();
    expect(referenced.properties?.ariaLabel).toBeUndefined();
    expect(wrapped.children?.[0].properties?.ariaLabel).toBe('First second');
  });

  it('先頭の段落以外に置かれた別の checkbox は変更しない', () => {
    const later = el('input', { type: 'checkbox', disabled: true });
    const tree = root(el('li', { className: ['task-list-item'] }, [
      el('p', {}, [text('導入')]),
      el('p', {}, [later, text(' 別の入力')]),
    ]));
    expect(labelTaskListCheckboxes(tree)).toBe(0);
    expect(later.properties?.ariaLabel).toBeUndefined();
  });

  it('タスクの下の引用・コード・リストを項目名に含めない', () => {
    const quote = render('- [ ] 手順を確認\n  > 補足の引用文');
    const code = render('- [x] 設定を確認\n  ```txt\n  例示の値\n  ```');
    expect(quote).toContain('aria-label="手順を確認"');
    expect(code).toContain('aria-label="設定を確認"');
    expect(quote).toContain('補足の引用文');
    expect(code).toContain('例示の値');
  });

  it('rehype の部品として、木を受け取って同じように付ける', () => {
    const tree = root(el('ul', {}, [item(false, text(' 項目'))]));
    rehypeTaskListLabels()(tree);
    expect(tree.children?.[0].children?.[0].children?.[0].properties?.ariaLabel).toBe('項目');
  });
});

describe('remark-gfm から作った実際の HTML で、名前だけが増える', () => {
  it('緩い list・入れ子・inline・複数段落・通常の input・既存 aria を混ぜても壊さない', () => {
    const markdown = [
      '- [x] **太字** と `code` と [リンク](https://example.com/)',
      '- [ ] 親の項目',
      '  - [ ] 子の項目',
      '',
      '- [ ] 緩い項目の最初の段落',
      '',
      '  後の段落',
      '',
      '通常の段落',
    ].join('\n');
    const html = render(markdown);
    // 名前は項目の文（入れ子の子は親に混ぜない）
    expect(html).toContain('aria-label="太字 と code と リンク"');
    expect(html).toContain('aria-label="親の項目"');
    expect(html).toContain('aria-label="子の項目"');
    expect(html).toContain('aria-label="緩い項目の最初の段落"');
    // 表示文字・link・checked・disabled は変えない
    expect(html).toContain('<strong>太字</strong>');
    expect(html).toContain('<code>code</code>');
    expect(html).toContain('<a href="https://example.com/">リンク</a>');
    expect(html).toContain('checked disabled');
    expect(html).toContain('後の段落');
    // 入れ子の子の名前を親に混ぜない
    expect(html).not.toContain('aria-label="親の項目 子の項目"');
  });
});
