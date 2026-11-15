// ビルド済み dist の /llms.txt の ISMS の検査（設定: vitest.dist.config.ts。`npm run build` の後に `npm run test:dist`）。
// 公開の /llms.txt に、ISMS の登録前の書き方が残っていないこと。
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const DIST_DIR = path.resolve(process.env.CONTACT_GUARD_DIST_DIR || 'dist');
const LLMS = path.join(DIST_DIR, 'llms.txt');

describe('dist の /llms.txt の ISMS', () => {
  it('/llms.txt がある', () => {
    expect(existsSync(LLMS), `${LLMS} が無い。先に npm run build を実行する`).toBe(true);
  });

  it('登録前の書き方（登録前のため・認証登録の見込み・12月ごろ）が無い', () => {
    const text = readFileSync(LLMS, 'utf8');
    const found = ['登録前のため', '認証登録見込み', '認証登録を見込', '12月ごろ', '「認証取得済み」ではない'].filter((p) => text.includes(p));
    expect({ found, 'ISMS の行': text.split('\n').filter((l) => /ISMS|ISO\/IEC 27001/.test(l)) }).toMatchObject({ found: [] });
  });

  it('Grift の柱の一文に、旧スローガンが無い', () => {
    const text = readFileSync(LLMS, 'utf8');
    expect(text).not.toContain('経歴は盛れる。証拠は盛れない。');
    expect(text.split('\n').find((l) => l.startsWith('1. Grift')) ?? '').toContain('経歴の説明に、確かめられる根拠を。');
  });

  it('登録済みの事実（範囲・登録番号・有効期間と有効の条件）を ISMS の行に持つ', () => {
    const line = readFileSync(LLMS, 'utf8').split('\n').find((l) => l.startsWith('- 情報セキュリティ:')) ?? '';
    expect(line).toContain('「ソフトウエアの受託開発および運用」');
    expect(line).toContain('JP26/00000364');
    expect(line).toContain('2026年11月7日から2029年11月7日');
    expect(line).toContain('有効期間中の維持審査にて登録の継続が認められる限り有効です');
  });
});
