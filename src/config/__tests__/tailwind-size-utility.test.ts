// Tailwind の size-* ユーティリティ（幅と高さを同時に指定）は 3.4 からの機能。
// このリポジトリの Tailwind が 3.4 より古いあいだは、size-* を書いても CSS が生成されず、何も効かない。
// 2026-10-24: トップと会社概要のエンジニアカフェのロゴの枠（size-28 / size-24）が効かず、枠がロゴの元の
// 大きさまで広がって、福岡100選のエンブレムと大きさがそろわなかった。h-* と w-* を並べて書く。
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../../..');
const SIZE_UTILITY = /(?:^|[\s"'`{])(?:[a-z0-9-]+:)*size-(?:\d+(?:\.\d+)?|px|full|min|max|fit|auto|\[[^\]]+\])(?=[\s"'`}]|$)/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full);
    return /\.(astro|tsx?|mjs|jsx?)$/.test(entry.name) ? [full] : [];
  });
}

function tailwindVersion(): [number, number] {
  const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const raw = String(pkg.devDependencies?.tailwindcss ?? pkg.dependencies?.tailwindcss ?? '');
  const [major, minor] = raw.replace(/^[^\d]*/, '').split('.').map(Number);
  return [major, minor];
}

describe('Tailwind の size-* ユーティリティ', () => {
  const [major, minor] = tailwindVersion();
  const supportsSize = major > 3 || (major === 3 && minor >= 4);

  it.skipIf(supportsSize)(`Tailwind ${major}.${minor} は size-* を生成しないので、src で使っていない`, () => {
    const offenders = sourceFiles(path.join(ROOT, 'src')).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, index) => (SIZE_UTILITY.test(line) ? [`${path.relative(ROOT, file)}:${index + 1}: ${line.trim().slice(0, 100)}`] : [])),
    );
    expect(offenders, 'size-N は h-N w-N に書き換える').toEqual([]);
  });
});
