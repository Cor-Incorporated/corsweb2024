// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { describe, expect, it } from 'vitest';
import { hasMathNode, remarkHasMath } from '../remark-has-math';

// Astro の Markdown パイプラインと同じく remark-parse + remark-math で解析し、プラグインの結果を見る。
function detect(markdown: string): unknown {
  const processor = unified().use(remarkParse).use(remarkMath).use(remarkHasMath);
  const file = { data: { astro: { frontmatter: { title: 'keep' } } } };
  processor.runSync(processor.parse(markdown), file as never);
  return (file.data.astro.frontmatter as Record<string, unknown>).hasMath;
}

describe('remarkHasMath: 真理値表（数式の書き方 × 有無）', () => {
  it.each([
    ['インライン数式 $E = mc^2$ を含む', true],
    ['$$\nx^2 + y^2 = z^2\n$$', true],
    ['- リスト内の $a_i$', true],
    ['数式なしの本文', false],
    ['```js\nconst price = "$5 and $10";\n```', false],
    ['インラインコード `$x$` は数式ではない', false],
    ['', false],
  ])('%j → %s', (markdown, expected) => {
    expect(detect(markdown)).toBe(expected);
  });

  it('keeps the existing frontmatter keys', () => {
    const processor = unified().use(remarkParse).use(remarkMath).use(remarkHasMath);
    const file = { data: { astro: { frontmatter: { title: 'keep' } } } };
    processor.runSync(processor.parse('$x$'), file as never);
    expect(file.data.astro.frontmatter).toEqual({ title: 'keep', hasMath: true });
  });

  it('hasMathNode walks nested children', () => {
    expect(hasMathNode({ type: 'root', children: [{ type: 'paragraph', children: [{ type: 'inlineMath' }] }] })).toBe(true);
    expect(hasMathNode({ type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text' }] }] })).toBe(false);
  });
});

describe('the KaTeX CSS we ship', () => {
  // 描画（rehype-katex が使う katex）と CSS（KatexStyles.astro が読む katex）が同じ版であることを結ぶ。
  // rehype-katex の下に別版の katex が入ると、HTML と CSS の版がずれる（CDN 0.16.9 時代と同じ問題）。
  it('comes from the single katex installation used by rehype-katex', () => {
    expect(existsSync(path.resolve('node_modules/rehype-katex/node_modules/katex'))).toBe(false);
    const katex = JSON.parse(readFileSync(path.resolve('node_modules/katex/package.json'), 'utf8'));
    const rehypeKatex = JSON.parse(readFileSync(path.resolve('node_modules/rehype-katex/package.json'), 'utf8'));
    expect(rehypeKatex.dependencies.katex).toMatch(/^\^0\.16\./);
    expect(katex.version).toMatch(/^0\.16\./);
  });

  it('is imported by KatexStyles.astro and BlogLayout no longer loads it from a CDN', () => {
    const component = readFileSync(path.resolve('src/components/blog/KatexStyles.astro'), 'utf8');
    const layout = readFileSync(path.resolve('src/layouts/BlogLayout.astro'), 'utf8');
    expect(component).toContain("from 'katex/dist/katex.min.css?inline'");
    expect(layout).not.toMatch(/cdn\.jsdelivr\.net\/npm\/katex/);
    expect(layout).toMatch(/\{hasMath && <KatexStyles \/>\}/);
  });
});
