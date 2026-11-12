// 宣言（wrangler.toml・手順書・migration）と、それを読んで動くコードを結ぶ。片方だけ変えると、両方の値を挙げて落ちる。
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NOTICE_MAX_ATTEMPTS, NOTICE_REQUEUE_AFTER_SECONDS, parseNotifyReleasedAt } from '../document-request';

const root = resolve(__dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('資料請求の通知の設定', () => {
  it('NOTICE_MAX_ATTEMPTS は wrangler.toml の max_retries + 1（本番と preview の両方）', () => {
    const toml = read('wrangler.toml');
    const retries = [...toml.matchAll(/max_retries\s*=\s*(\d+)/g)].map((match) => Number(match[1]));
    expect(retries.length).toBeGreaterThanOrEqual(2);
    for (const value of retries) {
      expect(NOTICE_MAX_ATTEMPTS, `max_retries=${value} observed, NOTICE_MAX_ATTEMPTS=${NOTICE_MAX_ATTEMPTS}`).toBe(value + 1);
    }
  });

  it('live の設定値は wrangler.toml に書かない（人間ゲートで設定するまで hold のまま）', () => {
    const toml = read('wrangler.toml');
    expect(toml).not.toMatch(/^\s*DOCUMENT_REQUEST_NOTIFY_(MODE|RELEASED_AT)\s*=/m);
  });

  it('cron の回収の待ち時間は 15 分で、cron の間隔（*/15）より短くない', () => {
    expect(NOTICE_REQUEUE_AFTER_SECONDS).toBe(900);
    expect(read('wrangler.toml')).toContain('crons = ["*/15 * * * *"]');
  });

  it('解放時刻は 10 桁の unix 秒だけ。ミリ秒・小数・空は拒否する', () => {
    expect(parseNotifyReleasedAt('1788000000')).toBe(1788000000);
    for (const bad of [undefined, '', ' ', '0', '-1', '1.5', 'abc', '1788000000000', '178800000', '1788000000\n1']) {
      expect(parseNotifyReleasedAt(bad), String(bad)).toBeNull();
    }
  });

  it('migration は 0007 まで連番で、0007 は locale 列だけを足す', () => {
    const files = readdirSync(resolve(root, 'migrations')).filter((name) => name.endsWith('.sql')).sort();
    expect(files.at(-1)).toBe('0007_document_locale.sql');
    const code = read('migrations/0007_document_locale.sql').split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
    expect(code.trim()).toBe("ALTER TABLE submission_intake ADD COLUMN locale TEXT NOT NULL DEFAULT '';");
  });
});

describe('手順書', () => {
  const runbook = read('RUNBOOK-document-request-notice.md');

  it('手順書の awk で取り出した SQL は、照会の SQL ブロックと一致し、SELECT だけである', () => {
    const extracted = execFileSync('awk', ['/^```sql/{f=1;next} /^```/{f=0} f', resolve(root, 'RUNBOOK-document-request-notice.md')], { encoding: 'utf8' });
    const blocks = [...runbook.matchAll(/```sql\n([\s\S]*?)```/g)].map((match) => match[1]);
    expect(blocks).toHaveLength(1);
    expect(extracted).toBe(blocks[0]);
  });

  it('手順書は、設定する変数を「現在値 → 設定値」で書き、人間ゲートを明記する', () => {
    for (const name of ['DOCUMENT_REQUEST_NOTIFY_MODE', 'DOCUMENT_REQUEST_NOTIFY_RELEASED_AT']) {
      expect(runbook).toContain(name);
    }
    expect(runbook).toContain('現在値');
    expect(runbook).toMatch(/\|\s*未設定/);
    expect(runbook).toContain('wrangler d1 migrations apply cor-contact-chat-prod --remote');
    expect(runbook).toContain('人間ゲート');
  });
});
