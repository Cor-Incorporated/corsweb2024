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

// gtag( の呼び出しを、文字列の中の括弧を数えずに括弧の対応で切り出す。
// minify 後の 1 行スクリプトでも引数の全体を見るため。
function gtagCallArguments(script: string): string[] {
  const calls: string[] = [];
  const opener = /\bgtag\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = opener.exec(script)) !== null) {
    let depth = 1;
    let quote = '';
    let index = match.index + match[0].length;
    for (; index < script.length; index += 1) {
      const char = script[index];
      if (quote) {
        if (char === '\\') index += 1;
        else if (char === quote) quote = '';
        continue;
      }
      if (char === '"' || char === "'" || char === '`') {
        quote = char;
        continue;
      }
      if (char === '(') depth += 1;
      else if (char === ')') {
        depth -= 1;
        if (depth === 0) {
          calls.push(script.slice(match.index + match[0].length, index));
          break;
        }
      }
    }
  }
  return calls;
}

const FORM_TOKENS = [
  // 欄の name
  'document_id',
  'industry',
  'entry_surface',
  'name',
  'email',
  'company',
  'phone',
  'discoverySource',
  'discoveryOther',
  'consent',
  'website',
  'locale',
  // 欄の値・固定値
  'company-deck',
  'materials',
  'medical',
  '山田',
  'taro@',
  '株式会社',
];

describe('資料請求のページ', () => {
  it('日本語ページはフォームを送り、スクリプトは計測にも LLM にも入力を渡さない', () => {
    const html = page('contact/materials/index.html');
    expect(html).toContain('action=/api/contact/document-request');
    expect(html).toContain('method=post');
    for (const slug of ['medical', 'shigyo', 'construction', 'manufacturing', 'education']) {
      expect(html).toContain(`value=${slug}`);
    }
    expect(html).toContain('data-clarity-mask=true');
    // 計測用の属性はページに置かない（フォームの値も固定の文字列も送らない）。
    expect(html).not.toContain('data-document-id');
    expect(html).not.toContain('data-entry-surface');
    expect(html).not.toContain('data-industries');
    // #537: トークンと元のページの path の欄は、ビルドした HTML では空。値はフォームを表示したときに画面が入れる
    // （ビルドした瞬間に全員共通のトークンは置かない）。script は乱数を画面で作る。
    const tokenInputs = [...html.matchAll(/<input(?=[^>]*\bname="?formToken"?)[^>]*>/g)].map((match) => match[0]);
    expect(tokenInputs).toHaveLength(1);
    expect(tokenInputs[0]).toMatch(/\bvalue=""/);
    expect(tokenInputs[0]).not.toMatch(/\bvalue=(?!"")\S/);
    expect(html).toContain('name=discoverySource');
    for (const slug of ['x', 'linkedin', 'note', 'qiita', 'search', 'referral', 'event', 'other']) {
      expect(html).toContain(`value=${slug}`);
    }
    expect(html).toContain('name=discoveryOther');
    expect(html).toContain('maxlength=100');
    expect(html).toContain('data-discovery-other-field');
    expect(html).toContain('data-msg-error-discovery');
    expect(html).toContain('資料は送っていません');
    expect(html).not.toContain('送付しました');
    const script = formScript(html);
    // トークンは画面が乱数で作る（Math.random ではない）。
    expect(script).toContain('getRandomValues');

    // (a) 計測の gtag 呼び出しはページにちょうど 1 つ、イベント名は完了イベント。
    const calls = gtagCallArguments(script);
    expect(calls).toHaveLength(1);
    expect(calls[0].replace(/\s+/g, '')).toBe('"event","document_request_submit_success"');

    // (b) その呼び出しに、フォームの欄の name も値も入っていない（引数はイベント名だけ）。
    for (const token of FORM_TOKENS) {
      expect(calls[0]).not.toContain(token);
    }

    expect(script).not.toContain('dataLayer');
    expect(script).not.toContain('generateContent');
    expect(script).not.toContain('taro@');
    expect(script).toContain('"stored"');
    expect(script).toContain('.delivered');
  });

  it.each(['', 'en/', 'zh/', 'ko/', 'es/'])('%s会社概要から資料請求へ進める', (prefix) => {
    expect(page(`${prefix}company/index.html`)).toContain(`href=/${prefix}contact/materials/`);
  });
});
