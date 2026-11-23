import { readFileSync } from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { expect, it } from 'vitest';

const dist = path.resolve(process.env.CONTACT_GUARD_DIST_DIR || 'dist');
const address = 'company@cor-jp.com';

it.each(['', 'en', 'zh', 'ko', 'es'])('%s 開示窓口をメール復号スクリプトなしでも読める', (locale) => {
  const html = readFileSync(path.join(dist, locale, 'privacy/index.html'), 'utf8');
  const document = new JSDOM(html).window.document;
  const fallback = Array.from(document.querySelectorAll('main table td noscript'))
    .filter((element) => element.textContent === address);
  expect(fallback).toHaveLength(1);
  const cell = fallback[0].closest('td')!;
  expect(cell.querySelector('.privacy-decoded-address')?.textContent).toBe(address);
  const messages = JSON.parse(readFileSync(path.resolve('src/i18n/locales', (locale || 'ja') + '.json'), 'utf8'));
  const copy = messages.privacy.inquiryTable.find((row: { value: string }) => row.value.includes(address)).value;
  fallback[0].remove();
  expect(cell.textContent?.trim()).toBe(copy);
});
