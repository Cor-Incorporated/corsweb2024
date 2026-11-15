// @vitest-environment node
// 記事の本文の問い合わせの link を、build の時にそのページの言語のチャットへ向ける部品（rehype-contact-links.ts）の試験。
// Astro が渡す HTML の木（hast）の形を手で組んで渡し、a の href だけが変わることを見る。
import { describe, expect, it } from 'vitest';
import {
  contactLinkContextOf,
  rehypeContactLinks,
  rewriteContactHref,
  rewriteContactLinksInTree,
  type ContactLinkContext,
} from '../rehype-contact-links';

type Node = { type: string; tagName?: string; properties?: Record<string, unknown>; children?: Node[]; value?: string };
const text = (value: string): Node => ({ type: 'text', value });
const el = (tagName: string, properties: Record<string, unknown>, children: Node[] = []): Node => ({
  type: 'element',
  tagName,
  properties,
  children,
});
const root = (...children: Node[]): Node => ({ type: 'root', children });

const EN: ContactLinkContext = { locale: 'en', source: 'blog/some-post' };
const parse = (href: string) => {
  const url = new URL(href, 'https://example.test');
  return {
    path: url.pathname,
    intent: url.searchParams.get('intent'),
    source: url.searchParams.get('source'),
    locale: url.searchParams.get('locale'),
    keys: [...url.searchParams.keys()].sort(),
  };
};

describe('contactLinkContextOf: content の file の path から、言語と source', () => {
  it.each([
    ['/repo/src/content/blog/ja/some-post.md', { locale: 'ja', source: 'blog/some-post' }],
    ['/repo/src/content/blog/es/some-post.md', { locale: 'es', source: 'blog/some-post' }],
    ['/repo/src/content/cases/zh/grift.md', { locale: 'zh', source: 'works/grift' }],
    ['/repo/src/content/news/ko/2026-11-01-note.mdx', { locale: 'ko', source: 'news/2026-11-01-note' }],
  ])('%s', (filePath, expected) => {
    expect(contactLinkContextOf(filePath)).toEqual(expected);
  });

  it.each([
    ['src/content の外', '/repo/src/pages/about.md'],
    ['知らない collection', '/repo/src/content/drafts/ja/x.md'],
    ['知らない言語', '/repo/src/content/blog/fr/x.md'],
    ['path が無い', undefined],
  ])('%s は null（書き換えない）', (_label, filePath) => {
    expect(contactLinkContextOf(filePath)).toBeNull();
  });
});

describe('rewriteContactHref: 同じ site の問い合わせページだけを、その言語のチャットへ', () => {
  it.each([
    '/contact',
    '/contact/',
    '/contact/index.html',
    '/en/contact',
    '/zh/contact/',
    'https://cor-jp.com/contact',
    '/contact#form',
  ])('%s → チャット（intent なし・source・その記事の言語）', (href) => {
    expect(parse(rewriteContactHref(href, EN) ?? '')).toEqual({
      path: '/contact/chat/',
      intent: null,
      source: 'blog/some-post',
      locale: 'en',
      keys: ['locale', 'source'],
    });
  });

  it('元の intent を保ち、intent のほかの query と hash は運ばない', () => {
    const next = rewriteContactHref('/contact?intent=contract-dev&source=other&utm_source=x#top', EN) ?? '';
    expect(parse(next)).toEqual({
      path: '/contact/chat/',
      intent: 'contract-dev',
      source: 'blog/some-post',
      locale: 'en',
      keys: ['intent', 'locale', 'source'],
    });
    expect(next).not.toContain('#');
  });

  it('言語はその記事の file の言語（ja の記事は ja、訳の記事はその言語）', () => {
    expect(parse(rewriteContactHref('/contact', { locale: 'ja', source: 'blog/x' }) ?? '').locale).toBe('ja');
    expect(parse(rewriteContactHref('/contact', { locale: 'ko', source: 'blog/x' }) ?? '').locale).toBe('ko');
  });

  it.each([
    ['外の site の /contact', 'https://example.com/contact'],
    ['外の site の /contact/（末尾の / つき）', 'https://example.org/contact/'],
    ['似た path', '/contacts'],
    ['似た path（ハイフン）', '/contact-us'],
    ['似た path（下の階層）', '/contact/form'],
    ['ほかのページ', '/about'],
    ['相対の path', 'contact'],
    ['ページの中の場所', '#contact'],
    ['メール', 'mailto:hello@example.com'],
  ])('%s は変えない', (_label, href) => {
    expect(rewriteContactHref(href, EN)).toBeNull();
  });

  it('チャットへの link は、source と locale が無いときだけ足す（在る値は変えない）', () => {
    expect(parse(rewriteContactHref('/contact/chat/?intent=local-llm-poc', EN) ?? '')).toEqual({
      path: '/contact/chat/',
      intent: 'local-llm-poc',
      source: 'blog/some-post',
      locale: 'en',
      keys: ['intent', 'locale', 'source'],
    });
    expect(parse(rewriteContactHref('/contact/chat/?source=keep', EN) ?? '').source).toBe('keep');
    expect(rewriteContactHref('/contact/chat/?source=keep&locale=ja', EN)).toBeNull();
  });
});

describe('rewriteContactLinksInTree: a の href だけを変える', () => {
  it('段落の中の a を書き換え、code の中の文字・画像の src・外の link は変えない', () => {
    const tree = root(
      el('p', {}, [text('相談は'), el('a', { href: '/contact?intent=contract-dev' }, [text('お問い合わせ')]), text('から。')]),
      el('pre', {}, [el('code', { className: ['language-markdown'] }, [text('[お問い合わせ](/contact)')])]),
      el('p', {}, [el('code', {}, [text('/contact')])]),
      el('p', {}, [el('img', { src: '/contact', alt: '' })]),
      el('p', {}, [el('a', { href: 'https://example.com/contact' }, [text('外')])]),
      el('h2', { id: 'contact' }, [text('見出し'), el('a', { href: '#contact', className: ['heading-link'] }, [])]),
    );
    const before = JSON.parse(JSON.stringify(tree)) as Node;
    expect(rewriteContactLinksInTree(tree, EN)).toBe(1);
    const children = tree.children ?? [];
    const link = children[0].children?.[1];
    expect(parse(String(link?.properties?.href))).toMatchObject({ path: '/contact/chat/', intent: 'contract-dev', locale: 'en' });
    // 書き換えた a のほかは、木の全体が前と同じ
    expect(children.slice(1)).toEqual((before.children ?? []).slice(1));
    expect(children[0].children?.[0]).toEqual(before.children?.[0].children?.[0]);
  });

  it('入れ子（list・table・画像を包む link）の中の a も見る', () => {
    const tree = root(
      el('ul', {}, [el('li', {}, [el('a', { href: '/en/contact/' }, [text('a')])])]),
      el('table', {}, [el('tbody', {}, [el('tr', {}, [el('td', {}, [el('a', { href: '/contact' }, [text('b')])])])])]),
      el('p', {}, [el('a', { href: '/contact' }, [el('img', { src: '/images/x.png', alt: '' })])]),
    );
    expect(rewriteContactLinksInTree(tree, EN)).toBe(3);
  });
});

describe('rehypeContactLinks: file の path で言語を決める', () => {
  const tree = () => root(el('p', {}, [el('a', { href: '/contact' }, [text('x')])]));
  const hrefOf = (node: Node) => String(node.children?.[0].children?.[0].properties?.href);

  it('訳の記事は、その言語で書き換える', () => {
    const node = tree();
    rehypeContactLinks()(node, { path: '/repo/src/content/blog/zh/some-post.md' });
    expect(parse(hrefOf(node))).toMatchObject({ path: '/contact/chat/', source: 'blog/some-post', locale: 'zh' });
  });

  it('path が history にしか無くても読む', () => {
    const node = tree();
    rehypeContactLinks()(node, { history: ['/repo/src/content/blog/es/some-post.md'] });
    expect(parse(hrefOf(node)).locale).toBe('es');
  });

  it('src/content の外の file は変えない', () => {
    const node = tree();
    rehypeContactLinks()(node, { path: '/repo/src/pages/x.md' });
    expect(hrefOf(node)).toBe('/contact');
  });
});
