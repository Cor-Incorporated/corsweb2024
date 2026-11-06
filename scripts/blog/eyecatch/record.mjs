/**
 * 生成の記録（public/images/blog/<slug>.eyecatch.json）。生成した候補はボツ案も含めて全部残し、
 * 記事に使った 1 枚は picked に、出力した AVIF の sha256 と一緒に書く。
 * 読者に公開されるファイルなので、鍵・社内のパス・個人名は入れない（入るのはモデル id とプロンプトと数値だけ）。
 */
import { readFile, rename, rm, writeFile } from 'node:fs/promises';

/** 記録の形を変えたら上げる。 */
export const RECORD_VERSION = 1;

/**
 * @param {string} file
 * @param {{ slug: string, source: string }} identity
 */
export async function loadRecord(file, { slug, source }) {
  try {
    const record = JSON.parse(await readFile(file, 'utf8'));
    if (record.slug !== slug) {
      throw new Error(`記録の slug が違います（記録: ${record.slug} / 記事: ${slug}）`);
    }
    return record;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return { recordVersion: RECORD_VERSION, slug, source, candidates: [], picked: null };
  }
}

/** 次の候補番号。ボツ案を消しても番号を使い回さない（記録と生成物の対応が崩れないように）。 */
export function nextCandidateId(record) {
  return record.candidates.reduce((max, c) => Math.max(max, c.id), 0) + 1;
}

/** 一時ファイルに書いてから置き換える。途中で落ちても、前の中身か新しい中身のどちらかが残る。 */
export async function writeFileAtomic(file, data) {
  const tmp = `${file}.tmp-${process.pid}`;
  await writeFile(tmp, data);
  await rename(tmp, file);
}

/**
 * 複数のファイルをまとめて置き換える。先に全部を一時ファイルに書き、1 つでも書けなければ一時ファイルを消して
 * 何も置き換えない（--pick で、画像だけ新しくなって記事と記録が古いまま、にしない）。
 * @param {Array<[string, string | Buffer]>} entries [書き先, 中身] の並び
 */
export async function writeFilesAtomic(entries) {
  const staged = entries.map(([file, data]) => ({ tmp: `${file}.tmp-${process.pid}`, file, data }));
  // 書きかけ（ディスクがいっぱいなど）や、置き換えの途中で止まった残りの一時ファイルも消す。
  const cleanup = (items) => Promise.all(items.map(({ tmp }) => rm(tmp, { force: true })));
  try {
    for (const { tmp, data } of staged) await writeFile(tmp, data);
  } catch (error) {
    await cleanup(staged);
    throw error;
  }
  for (const [index, { tmp, file }] of staged.entries()) {
    try {
      await rename(tmp, file);
    } catch (error) {
      await cleanup(staged.slice(index));
      throw error;
    }
  }
}

export const recordText = (record) => `${JSON.stringify(record, null, 2)}\n`;

export async function saveRecord(file, record) {
  await writeFileAtomic(file, recordText(record));
}
