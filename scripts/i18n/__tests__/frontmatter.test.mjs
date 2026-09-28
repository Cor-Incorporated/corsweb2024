// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  composeDocument,
  FrontmatterError,
  parseDocument,
  serializeFrontmatter,
  splitDocument,
} from '../frontmatter.mjs';

describe('frontmatter I/O', () => {
  it('parses dates like Astro (Date objects) and CRLF files', () => {
    const doc = parseDocument('---\r\ntitle: "T"\r\npubDate: 2024-01-15\r\n---\r\n\r\n本文\r\n');
    expect(doc.data.pubDate).toBeInstanceOf(Date);
    expect(doc.body).toBe('\n本文\n');
  });

  it('writes a deterministic, round-trippable frontmatter', () => {
    const data = {
      title: 'He said "hi" \\ # not a comment: yes',
      pubDate: new Date('2024-01-15T00:00:00.000Z'),
      publishedAt: new Date('2026-07-08T10:30:00.000Z'),
      tags: ['a', 'b "c"'],
      image: { url: '/images/テスト.avif', alt: 'alt' },
      featured: true,
      readingTime: 5,
      translatedAt: '2026-09-27T00:00:00.000Z',
    };
    const yaml = serializeFrontmatter(data);
    expect(yaml).toBe(
      [
        'title: "He said \\"hi\\" \\\\ # not a comment: yes"',
        'pubDate: 2024-01-15',
        'publishedAt: 2026-07-08T10:30:00.000Z',
        'tags: ["a", "b \\"c\\""]',
        'image:',
        '  url: "/images/テスト.avif"',
        '  alt: "alt"',
        'featured: true',
        'readingTime: 5',
        'translatedAt: "2026-09-27T00:00:00.000Z"',
        '',
      ].join('\n')
    );
    const reparsed = parseDocument(`---\n${yaml}---\n`).data;
    expect(reparsed).toEqual(data);
    expect(typeof reparsed.translatedAt).toBe('string');
  });

  it('composes a document with one blank line after the frontmatter and a trailing newline', () => {
    expect(composeDocument({ title: 'T' }, '\n\n## H\n\ntext\n\n\n')).toBe(
      '---\ntitle: "T"\n---\n\n## H\n\ntext\n'
    );
    expect(composeDocument({ title: 'T' }, '\n')).toBe('---\ntitle: "T"\n---\n');
  });

  it('refuses values it cannot write faithfully', () => {
    expect(() => serializeFrontmatter({ list: [{ a: 1 }] })).toThrow(FrontmatterError);
    expect(() => serializeFrontmatter({ n: Number.NaN })).toThrow(FrontmatterError);
  });

  it('requires a frontmatter block', () => {
    expect(() => splitDocument('# no frontmatter')).toThrow(FrontmatterError);
    expect(() => parseDocument('---\n- a list\n---\n')).toThrow(/マッピング/);
  });
});
