import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  buildBody,
  buildReceiptBody,
  buildSubject,
  getEmailProvider,
  getConversationExcerptText,
  getInternalCcRecipients,
  getReceiptSummaryText,
  sendInquiryEmail,
  sendReceiptEmail,
} from '../email';
import type { Env, NormalizedInquiry } from '../types';

afterEach(() => vi.restoreAllMocks());

const inquiry: NormalizedInquiry = {
  name: '山田太郎',
  email: 'taro@example.com',
  company: 'Example Inc',
  message: '新規Webアプリを作りたいです',
  conversationSummary: 'プロジェクト種別: 新規開発 / 目標: 受発注の効率化',
  classification: 'genuine',
  intent: 'contract-dev',
  source: 'live-verify',
  structuredLead: {
    purpose: '受託で業務システム開発',
    industryRole: '製造 / 情シス',
    dataSensitivity: 'internal',
    stage: 'exploring',
    timingBudget: '3ヶ月以内 / 未定',
    discoverySource: '検索',
    contactReason: '業務改善の相談',
  },
  utm: { utm_source: 'cor' },
};

describe('buildSubject', () => {
  it('分類タグと名前を含む', () => {
    expect(buildSubject(inquiry)).toBe('[genuine][contract-dev] お問い合わせ: 山田太郎');
  });
  it('未分類なら分類タグなし', () => {
    expect(buildSubject({ ...inquiry, classification: '', intent: '' })).toBe('お問い合わせ: 山田太郎');
    expect(buildSubject({ ...inquiry, classification: '' })).toBe('[contract-dev] お問い合わせ: 山田太郎');
  });
});

describe('buildBody — 構造化本文（PIIはここにのみ載る）', () => {
  const body = buildBody(inquiry);
  it('PII（name/email/company/message）を含む', () => {
    expect(body).toContain('山田太郎');
    expect(body).toContain('taro@example.com');
    expect(body).toContain('Example Inc');
    expect(body).toContain('新規Webアプリを作りたいです');
  });
  it('会話サマリと分類メモを含む', () => {
    expect(body).toContain('AIチャットの会話サマリ');
    expect(body).toContain('受発注の効率化');
    expect(body).toContain('genuine');
    expect(body).toContain('流入経路: 検索');
    expect(body).toContain('連絡理由: 業務改善の相談');
  });
  it('company 未記入なら (未記入) と表示', () => {
    expect(buildBody({ ...inquiry, company: '' })).toContain('(未記入)');
  });
  it('会話サマリが無ければ決定的fallbackを使う', () => {
    expect(buildBody({ ...inquiry, conversationSummary: '', summaryText: '' })).toContain('要約未生成');
  });
  it('旧クライアントの全文トランスクリプトは本文へ出さない', () => {
    const body = buildBody({
      ...inquiry,
      conversationSummary: 'User: 秘密の会話\n続きの本文',
      summaryText: '',
    });
    expect(body).not.toContain('秘密の会話');
    expect(body).not.toContain('続きの本文');
  });
  it('要約にPIIが混入してもメール要約へ再出力しない', () => {
    const body = buildBody({ ...inquiry, conversationSummary: 'user@example.comへ連絡', summaryText: '' });
    expect(body).not.toContain('user@example.com');
  });
  it('社内通知だけに安全化会話抜粋を含め、PIIは再度マスクする', () => {
    const withExcerpt = {
      ...inquiry,
      conversationExcerpt: '訪問者: 相談です user@example.com\nCloudia: 確認しました',
    };
    const body = buildBody(withExcerpt);
    expect(body).toContain('安全化会話抜粋（社内通知のみ）');
    expect(body).toContain('訪問者: 相談です [redacted-email]');
    expect(body).not.toContain('訪問者: 相談です user@example.com');
    expect(getConversationExcerptText(withExcerpt)).not.toContain('user@example.com');
    expect(buildReceiptBody(withExcerpt, 'COR-20260713-ABCD1234')).not.toContain('安全化会話抜粋');
    expect(buildReceiptBody(withExcerpt, 'COR-20260713-ABCD1234')).not.toContain('相談です [redacted-email]');
  });
});

describe('getEmailProvider — fail closed', () => {
  it('RESEND_API_KEY 未設定なら 503（握り潰さない）', () => {
    const r = getEmailProvider({ RESEND_API_KEY: '' } as unknown as Env);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(503);
  });
  it('RESEND_API_KEY ありなら provider を返す', () => {
    const r = getEmailProvider({ RESEND_API_KEY: 're_test' } as unknown as Env);
    expect(r.ok).toBe(true);
  });
});

describe('sendInquiryEmail — Resend 呼び出し（fetchモック）', () => {
  const env = {
    RESEND_API_KEY: 're_test',
    CONTACT_TO_EMAIL: 'info@cor-jp.com',
    CONTACT_CC_EMAILS: 'company@cor-jp.com,k.isayama@cor-jp.com,nagisa.terada@cor-jp.com',
    CONTACT_FROM_EMAIL: 'noreply@cor-jp.com',
  } as unknown as Env;

  it('to/from と本文を正しく送る', async () => {
    const fetchMock = vi.fn(async () => new Response('{"id":"re_msg_123"}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const r = getEmailProvider(env);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    await expect(sendInquiryEmail(env, r.provider, inquiry)).resolves.toEqual({
      messageId: 're_msg_123',
      deliveryStatus: 'accepted',
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const payload = JSON.parse(init.body as string);
    expect(payload.to).toBe('info@cor-jp.com');
    expect(payload.from).toBe('noreply@cor-jp.com');
    expect(payload.cc).toEqual(['company@cor-jp.com', 'k.isayama@cor-jp.com', 'nagisa.terada@cor-jp.com']);
    expect(payload.text).toContain('taro@example.com');
    // reply_to に問い合わせ者のメールが入る（担当者の返信が顧客へ届く）
    expect(payload.reply_to).toBe('taro@example.com');
    // セキュリティ: html は絶対に送らない（staff webmail の stored-XSS 防止）。text のみ。
    expect(payload.html).toBeUndefined();
    expect('html' in payload).toBe(false);
    expect(typeof payload.text).toBe('string');
    // Authorization に鍵が載るが、レスポンス/ログには出さない設計（ここでは送信ヘッダのみ確認）
    expect((init.headers as Record<string, string>).authorization).toContain('re_test');
  });

  it('Resend が非2xxなら例外（status のみ・鍵を漏らさない）', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('err', { status: 500 })));
    const r = getEmailProvider(env);
    if (!r.ok) throw new Error('provider should be ok');
    await expect(sendInquiryEmail(env, r.provider, inquiry)).rejects.toThrow(/500/);
  });

  it('Resend応答にIDがなければ送信成功扱いにしない', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"id":""}', { status: 200 })));
    const r = getEmailProvider(env);
    if (!r.ok) throw new Error('provider should be ok');
    await expect(sendInquiryEmail(env, r.provider, inquiry)).rejects.toThrow(/受付応答/);
  });
  it('Resend IDにメールアドレス等が混入したら保存しない', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"id":"user@example.com"}', { status: 200 })));
    const r = getEmailProvider(env);
    if (!r.ok) throw new Error('provider should be ok');
    await expect(sendInquiryEmail(env, r.provider, inquiry)).rejects.toThrow(/受付応答/);
  });

  it('本人向け受付確認は社内CC・reply_to・分類を含めない', async () => {
    const fetchMock = vi.fn(async () => new Response('{"id":"re_receipt_1"}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const r = getEmailProvider(env);
    if (!r.ok) throw new Error('provider should be ok');
    await expect(sendReceiptEmail(env, r.provider, inquiry, 'COR-20260713-ABCD1234')).resolves.toEqual({
      messageId: 're_receipt_1',
      deliveryStatus: 'accepted',
    });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const payload = JSON.parse(init.body as string);
    expect(payload.to).toBe('taro@example.com');
    expect(payload.cc).toBeUndefined();
    expect(payload.reply_to).toBeUndefined();
    expect(payload.text).toContain('COR-20260713-ABCD1234');
    expect(payload.text).not.toContain('genuine');
    expect(payload.text).not.toContain('company@cor-jp.com');
  });

  it('CC設定は重複・不正値を除去し、旧単一値にも対応する', () => {
    expect(getInternalCcRecipients({
      CONTACT_CC_EMAILS: 'Company@cor-jp.com, bad, company@cor-jp.com, k.isayama@cor-jp.com',
    } as unknown as Env)).toEqual(['company@cor-jp.com', 'k.isayama@cor-jp.com']);
    expect(getInternalCcRecipients({ CONTACT_CC_EMAIL: 'company@cor-jp.com' } as unknown as Env)).toEqual(['company@cor-jp.com']);
    expect(getInternalCcRecipients({} as unknown as Env)).toEqual([
      'company@cor-jp.com',
      'k.isayama@cor-jp.com',
      'nagisa.terada@cor-jp.com',
    ]);
  });

  it('受付確認本文は要約・補足・受付番号・返信目安を含む', () => {
    const body = buildReceiptBody(inquiry, 'COR-20260713-ABCD1234');
    expect(body).toContain('ご相談の要約');
    expect(body).toContain('ご入力の補足');
    expect(body).toContain(inquiry.message);
    expect(body).toContain('返信目安: 2営業日以内');
    expect(body).toContain('COR-20260713-ABCD1234');
  });

  it('本人向け要約から社内分類・intentを除外する', () => {
    const body = buildReceiptBody({
      ...inquiry,
      summaryText: 'classification: genuine / intent: contract-dev',
      conversationSummary: '',
    }, 'COR-20260713-ABCD1234');
    expect(body).not.toContain('classification');
    expect(body).not.toContain('genuine');
    expect(body).not.toContain('contract-dev');
    expect(body).toContain('受託で業務システム開発');
  });

  it('画面で確認済みの要約は内部風の単語を含んでも本人receiptで同一文面を保つ', () => {
    const confirmed = '相談目的: intent 設計を含む業務フローの改善';
    expect(getReceiptSummaryText({
      ...inquiry,
      summaryText: confirmed,
      conversationSummary: confirmed,
      summaryConfirmed: true,
    })).toBe(confirmed);
  });

  it('本人向け受付確認は流入経路・連絡理由を表示できるが内部タグは含めない', () => {
    const body = buildReceiptBody({
      ...inquiry,
      summaryText: 'classification: genuine / source: internal / intent: contract-dev',
      conversationSummary: '',
    }, 'COR-20260713-ABCD1234');
    expect(body).toContain('業務改善の相談');
    expect(body).toContain('検索');
    expect(body).not.toContain('classification');
    expect(body).not.toContain('genuine');
    expect(body).not.toContain('source: internal');
    expect(body).not.toContain('contract-dev');
  });
});

describe('buildBody / buildSubject — intent 拡張 (#250)', () => {
  it('件名に intent タグを含む', () => {
    expect(buildSubject(inquiry)).toContain('[contract-dev]');
  });
  it('本文に intent / source / 構造化リード / UTM を含む', () => {
    const body = buildBody(inquiry);
    expect(body).toContain('intent　: contract-dev');
    expect(body).toContain('source　: live-verify');
    expect(body).toContain('受託で業務システム開発');
    expect(body).toContain('utm_source: cor');
  });
  it('intent 未指定でも件名は classification のみ', () => {
    expect(buildSubject({ ...inquiry, intent: '', classification: 'sales' })).toBe(
      '[sales] お問い合わせ: 山田太郎',
    );
  });
});
