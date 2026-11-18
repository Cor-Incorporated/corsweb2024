import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const dist = resolve(__dirname, '../../dist');

function page(path: string): string {
  return readFileSync(resolve(dist, path), 'utf8');
}

function formScript(html: string): string {
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
  const script = scripts.find((body) => body.includes('document-request-result'));
  expect(script).toBeTruthy();
  return script!;
}

describe('資料請求のページ', () => {
  it('日本語ページはフォームを送り、スクリプトは計測にも LLM にも入力を渡さない', () => {
    const html = page('contact/materials/index.html');
    expect(html).toContain('action=/api/contact/document-request');
    expect(html).toContain('method=post');
    for (const slug of ['medical', 'shigyo', 'construction', 'manufacturing', 'education']) {
      expect(html).toContain(`value=${slug}`);
    }
    expect(html).toContain('data-clarity-mask=true');
    expect(html).toContain('data-document-id=company-deck');
    expect(html).toContain('data-entry-surface=materials');
    expect(html).toContain('data-industries=medical,shigyo,construction,manufacturing,education');
    expect(html).toContain('資料は送っていません');
    expect(html).not.toContain('送付しました');
    const script = formScript(html);
    expect(script).toContain('gtag');
    expect(script).toContain('document_request_submit_success');
    expect(script).toContain('entry_surface');
    expect(script).not.toContain('dataLayer');
    expect(script).not.toContain('generateContent');
    expect(script).not.toContain('taro@');
    expect(script).toContain('"stored"');
    expect(script).toContain('.delivered');
  });

  it('問い合わせページから資料請求へ進める', () => {
    expect(page('contact/index.html')).toContain('href=/contact/materials/');
    expect(page('en/contact/index.html')).toContain('href=/en/contact/materials/');
  });
});
