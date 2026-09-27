import { afterEach, describe, expect, it } from 'vitest';
import worker from '../index';
import { resetRateLimits } from '../security';
import type { Env } from '../types';

afterEach(() => resetRateLimits());

const env = {
  LLM_PROVIDER: 'vertex-gemini',
  ANTHROPIC_API_KEY: '',
  RESEND_API_KEY: '',
  TURNSTILE_SECRET: '',
  CONTACT_SITE_ENV: 'production',
  CONTACT_TO_EMAIL: 'cloudia@cor-jp.com',
  CONTACT_FROM_EMAIL: 'noreply@cor-jp.com',
} as unknown as Env;

describe('chat start contract', () => {
  it('intent_selected starts a session without an empty LLM request', async () => {
    const response = await worker.fetch(new Request('https://cor-jp.com/api/contact/chat/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event: 'intent_selected', intent: 'contract-dev', locale: 'ja' }),
    }), env);
    expect(response.status).toBe(200);
    const body = await response.json() as Record<string, unknown>;
    expect(body.intent).toBe('contract-dev');
    expect(body.reply).toContain('まず');
    expect(body.sessionId).toEqual(expect.any(String));
    expect(body.missingFields).toEqual(['purpose']);
  });

  it('ambassador start uses a conversational company-information greeting', async () => {
    const response = await worker.fetch(new Request('https://cor-jp.com/api/contact/chat/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ start: true, mode: 'ambassador', locale: 'ja' }),
    }), env);
    expect(response.status).toBe(200);
    const body = await response.json() as Record<string, unknown>;
    expect(body.reply).toContain('Cor.株式会社');
    expect(body.reply).not.toContain('コー株式会社');
    expect(body.reply).not.toContain('Cor.inc');
    expect(body.reply).toContain('ご質問があればお聞かせください');
    expect(body.reply).not.toContain('おっす');
    expect(body.reply).not.toContain('全部知っとう');
    expect(body.missingFields).toEqual(['purpose']);
  });

  it.each([
    ['ja', '取材・登壇・その他', '取材・記事、登壇、イベント参加'],
    ['en', 'press, speaking, or other', 'interview, article, speaking'],
  ] as const)('%s press intent starts with an outreach-specific question', async (locale, intentLabel, typeLabel) => {
    const response = await worker.fetch(new Request('https://cor-jp.com/api/contact/chat/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ start: true, mode: 'intake', locale, intent: 'press-speaking-other' }),
    }), env);
    expect(response.status).toBe(200);
    const body = await response.json() as Record<string, unknown>;
    expect(body.reply).toContain(intentLabel);
    expect(body.reply).toContain(typeLabel);
    expect(body.intent).toBe('press-speaking-other');
    expect(body.readyForContact).toBe(false);
    expect(body.missingFields).toEqual(['purpose']);
  });
});
