// 業種の提案ページの本文の形（#525）。locale の industry<Name> をここで検証してから描く。
// 本文の文字は #525 のまま locale に置き、Markdown の記号は使わない（見出し・強調・表・リンクは形で持つ）。
// 形が崩れたら build を止める（parse が投げる）。
import { z } from 'astro/zod';
import type { ProposalLinks } from './proposal-links';

const text = z.string().min(1);

/** 文の中のリンク。link は proposal-links.ts の inline の名前。 */
const inlineSchema = z.union([text, z.object({ link: text, text }).strict()]);
const richSchema = z.union([text, z.array(inlineSchema).min(1)]);

export type Inline = z.infer<typeof inlineSchema>;
export type Rich = z.infer<typeof richSchema>;

export type Block =
  | { h2: string }
  | { h3: string }
  | { p: Rich; cite?: number[] }
  | { strong: string }
  | { ul: string[] }
  | { table: { head: string[]; rows: string[][] } }
  | { sourceLink: number; text: string }
  | { note: { title: string; body: Block[] } }
  | {
      founder: {
        h2?: string;
        h3?: string;
        byline: string;
        bylineAt: 'top' | 'bottom';
        body: Block[];
      };
    };

const citeSchema = z.array(z.number().int().positive()).min(1);

// tsconfig は strict でないため、zod が推論する型はキーが省略可能になり Block と合わない。
// 形は下の union が検証するので、型だけ Block として扱う。
export const blockSchema = z.lazy((): z.ZodTypeAny =>
  z.union([
    z.object({ h2: text }).strict(),
    z.object({ h3: text }).strict(),
    z.object({ p: richSchema, cite: citeSchema.optional() }).strict(),
    z.object({ strong: text }).strict(),
    z.object({ ul: z.array(text).min(1) }).strict(),
    z
      .object({ table: z.object({ head: z.array(text).min(2), rows: z.array(z.array(text)).min(1) }).strict() })
      .strict(),
    z.object({ sourceLink: z.number().int().positive(), text }).strict(),
    z.object({ note: z.object({ title: text, body: z.array(blockSchema).min(1) }).strict() }).strict(),
    z
      .object({
        founder: z
          .object({
            h2: text.optional(),
            h3: text.optional(),
            byline: text,
            bylineAt: z.enum(['top', 'bottom']),
            body: z.array(blockSchema).min(1),
          })
          .strict(),
      })
      .strict(),
  ]),
) as unknown as z.ZodType<Block>;

export const proposalPageSchema = z
  .object({
    eyebrow: text,
    title: text,
    lead: z.array(blockSchema).min(1),
    sections: z.array(blockSchema).min(1),
    cta: z.object({ title: text, body: z.array(blockSchema).min(1), primary: text }).strict(),
    sourcesTitle: text,
    sources: z.array(z.object({ title: text, note: richSchema }).strict()),
  })
  .strict();

export type ProposalPage = z.infer<typeof proposalPageSchema>;

function walk(blocks: readonly Block[], visit: (block: Block) => void): void {
  for (const block of blocks) {
    visit(block);
    if ('note' in block) walk(block.note.body, visit);
    if ('founder' in block) walk(block.founder.body, visit);
  }
}

function inlineLinkNames(value: Rich): string[] {
  if (typeof value === 'string') return [];
  return value.flatMap((part) => (typeof part === 'string' ? [] : [part.link]));
}

/**
 * 本文の参照とリンク先の表がそろっているかを確かめる。そろっていなければ、何が食い違うかを並べて投げる。
 * - 参考資料の欄があれば、項目の数はリンク先の数と同じ
 * - [n] と sourceLink の n は、リンク先の範囲の中
 * - 文の中のリンクの名前は inline に在る
 * - 署名の区画は 1 つ
 */
export function assertProposalLinks(page: ProposalPage, links: ProposalLinks, label: string): void {
  const problems: string[] = [];
  const count = links.sources.length;
  if (page.sources.length > 0 && page.sources.length !== count) {
    problems.push(`参考資料の項目 ${page.sources.length} 件、リンク先 ${count} 件`);
  }
  const names: string[] = page.sources.flatMap((source) => inlineLinkNames(source.note));
  let founders = 0;
  const all = [...page.lead, ...page.sections, ...page.cta.body];
  walk(all, (block) => {
    if ('p' in block) {
      names.push(...inlineLinkNames(block.p));
      for (const n of block.cite ?? []) if (n > count) problems.push(`[${n}] はリンク先 ${count} 件の外`);
    }
    if ('sourceLink' in block && block.sourceLink > count) {
      problems.push(`sourceLink ${block.sourceLink} はリンク先 ${count} 件の外`);
    }
    if ('founder' in block) founders += 1;
  });
  for (const name of names) if (!(name in links.inline)) problems.push(`リンク「${name}」の行き先が無い`);
  if (founders !== 1) problems.push(`署名の区画が ${founders} 個（1 個のはず）`);
  if (problems.length > 0) throw new Error(`${label}: ${problems.join(' / ')}`);
}
