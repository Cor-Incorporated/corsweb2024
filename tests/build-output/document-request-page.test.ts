import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const dist = resolve(__dirname, '../../dist');

function page(path: string): string {
  return readFileSync(resolve(dist, path), 'utf8');
}

function formScript(html: string): string {
  const match = html.match(/<script[^>]*>[\s\S]*?document-request-result[\s\S]*?<\/script>/);
  expect(match).toBeTruthy();
  return match![0];
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
    expect(html).toContain('資料は送っていません');
    expect(html).not.toContain('送付しました');
    const script = formScript(html);
    expect(script).not.toContain('gtag');
    expect(script).not.toContain('dataLayer');
    expect(script).not.toContain('generateContent');
    expect(script).not.toContain('taro@');
    expect(script).toContain('!1!==n.delivered');
    expect(script).toContain('"stored"!==n.status');
  });

  it('問い合わせページから資料請求へ進める', () => {
    expect(page('contact/index.html')).toContain('href=/contact/materials/');
    expect(page('en/contact/index.html')).toContain('href=/en/contact/materials/');
  });
});
