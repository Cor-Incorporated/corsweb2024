import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { INDUSTRY_SLUGS } from '../industry-context';
import worker from '../index';
import { resetRateLimits } from '../security';
import type { Env } from '../types';

// 文の関門に出す下書きは、この fixture そのもの。Worker の start が実際に組み立てる最初の返事（業種 5 × 目的 7）と
// 1 文字でも違えば落ちる。文を変えたら、この fixture を作り直してから関門を流し直す。
const FIXTURE = resolve(__dirname, 'fixtures/industry-first-replies.ja.txt');
const INTENTS = ['', 'confidential-ai-assessment', 'local-llm-poc', 'contract-dev', 'grift-team-beta', 'estimate-audit', 'press-speaking-other'] as const;

afterEach(() => resetRateLimits());

async function startReply(source: string, intent: string, index: number): Promise<string> {
  const response = await worker.fetch(new Request('https://cor-jp.com/api/contact/chat/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://cor-jp.com', 'cf-connecting-ip': `203.0.113.${index}` },
    body: JSON.stringify({ start: true, intent, source, locale: 'ja' }),
  }), { LLM_PROVIDER: 'vertex-gemini', ANTHROPIC_API_KEY: '', RESEND_API_KEY: '', TURNSTILE_SECRET: '' } as unknown as Env);
  expect(response.status).toBe(200);
  return (await response.json() as { reply: string }).reply;
}

async function composeAll(): Promise<string> {
  const replies: string[] = [];
  let index = 1;
  for (const slug of INDUSTRY_SLUGS) {
    for (const intent of INTENTS) replies.push(await startReply(`industry-${slug}`, intent, index++));
  }
  return `${replies.join('\n\n')}\n`;
}

describe('業種の最初の返事（ja）', () => {
  it('Worker の start が組み立てる 35 本は、関門に出した下書き（fixture）と同じ', async () => {
    const composed = await composeAll();
    if (process.env.WRITE_FIRST_REPLIES === '1') writeFileSync(FIXTURE, composed);
    expect(composed).toBe(readFileSync(FIXTURE, 'utf8'));
  });

  it('取材・登壇の目的でも、業種の入口の最初の返事の問いは 1 つ', async () => {
    const reply = await startReply('industry-medical', 'press-speaking-other', 99);
    expect(reply).not.toContain('取材・登壇・その他の対外相談ですね');
    expect(reply.split('\n')).toHaveLength(2);
    expect(reply.split('\n')[1]).toBe('取材や登壇のテーマを教えてください。患者さんの実例は不要です。');
  });
});
