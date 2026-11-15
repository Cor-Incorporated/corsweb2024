// @vitest-environment node
/**
 * /llms.txt（回答エンジン・取引先が読む入口）の ISMS の行が、会社概要と同じ登録済みの事実であること。
 * ISMS の登録前の書き方（「登録前のため取得済みではない」「2026年12月ごろの認証登録見込み」）が戻ると落ちる。
 * 独立査読（PR #527 の head d4382a7）の HIGH-1: llms.txt だけが登録前の表記のまま残っていた。
 * ビルドした出力の検査は tests/build-output/llms-isms.test.ts。
 */
import { describe, expect, it } from 'vitest';
import { GET } from '../../pages/llms.txt';
import { getJaTranslations } from '../../utils/i18n';

async function llmsText(): Promise<string> {
  const response = await GET({} as Parameters<typeof GET>[0]);
  return response.text();
}

const BEFORE_REGISTRATION = [
  '登録前のため',
  '認証登録見込み',
  '認証登録を見込',
  '12月ごろ',
  '第2段階審査を終了',
  '「認証取得済み」ではない',
];

describe('llms.txt の ISMS の行', () => {
  it('会社概要と同じ文（ja.json の companyPage.securityBody）で書いている', async () => {
    const text = await llmsText();
    const body = getJaTranslations().companyPage.securityBody;
    expect(text).toContain(`- 情報セキュリティ: ${body}`);
  });

  it('登録済みの事実（範囲・登録番号・有効期間）を同じ行に持つ', async () => {
    const line = (await llmsText()).split('\n').find((l) => l.startsWith('- 情報セキュリティ:')) ?? '';
    expect({ line, scope: line.includes('「ソフトウエアの受託開発および運用」') }).toMatchObject({ scope: true });
    expect(line).toContain('JP26/00000364');
    expect(line).toContain('2026年11月7日から2029年11月7日');
  });

  it('登録前の書き方が無い（直す前は落ちる）', async () => {
    const text = await llmsText();
    const found = BEFORE_REGISTRATION.filter((phrase) => text.includes(phrase));
    expect({ found, 'ISMS の行': text.split('\n').filter((l) => /ISMS|ISO\/IEC 27001/.test(l)) }).toMatchObject({ found: [] });
  });

  it('Grift の柱の一文は、旧スローガンでなく、ページと同じ文（ja.json の griftBridge.title）で書く', async () => {
    const text = await llmsText();
    const line = text.split('\n').find((l) => l.startsWith('1. Grift')) ?? '';
    expect({ line, oldSlogan: text.includes('経歴は盛れる。証拠は盛れない。') }).toMatchObject({ oldSlogan: false });
    expect(line).toContain(getJaTranslations().griftBridge.title);
  });

  it('更新日 CONTENT_AS_OF が、登録後の日付になっている（2026-11-07 以後）', async () => {
    const asOf = (await llmsText()).match(/情報は(\d{4}-\d{2}-\d{2})時点/)?.[1] ?? '';
    expect(asOf >= '2026-11-07').toBe(true);
  });
});
