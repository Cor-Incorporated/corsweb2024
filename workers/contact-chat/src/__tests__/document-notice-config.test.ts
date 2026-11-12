// 宣言（wrangler.toml・手順書・migration）と、それを読んで動くコードを結ぶ。片方だけ変えると、両方の値を挙げて落ちる。
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NOTICE_MAX_ATTEMPTS, NOTICE_REQUEUE_AFTER_SECONDS, parseNotifyReleasedAt } from '../document-request';

const root = resolve(__dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

const MODE = 'DOCUMENT_REQUEST_NOTIFY_MODE';
const RELEASED_AT = 'DOCUMENT_REQUEST_NOTIFY_RELEASED_AT';

/** toml の節（[vars]、[env.preview.vars] など）の `KEY = "value"` だけを読む。節が無ければ null。 */
function varsOf(toml: string, header: string): Record<string, string> | null {
  const lines = toml.split('\n');
  const start = lines.findIndex((line) => line.trim() === `[${header}]`);
  if (start < 0) return null;
  const vars: Record<string, string> = {};
  for (const line of lines.slice(start + 1)) {
    if (line.trim().startsWith('[')) break;
    const match = /^\s*([A-Z0-9_]+)\s*=\s*"([^"]*)"/.exec(line);
    if (match) vars[match[1]!] = match[2]!;
  }
  return vars;
}

const show = (vars: Record<string, string>): string =>
  `mode=${vars[MODE] === undefined ? '<unset>' : `"${vars[MODE]}"`} releasedAt=${vars[RELEASED_AT] === undefined ? '<unset>' : `"${vars[RELEASED_AT]}"`}`;

/**
 * live の宣言（wrangler.toml）と、それを読んで送るコード（parseNotifyReleasedAt・documentNotifyMode）を結ぶ。
 * 本番の [vars] で mode と解放時刻は対。preview など本番以外には live を書かない。観測した値を両方挙げる。
 */
function liveDeclarationProblems(toml: string): string[] {
  const problems: string[] = [];
  for (const header of [...toml.matchAll(/^\[(env\.[^.\]]+\.vars)\]/gm)].map((match) => match[1]!)) {
    const vars = varsOf(toml, header) ?? {};
    if (vars[MODE] === 'live') problems.push(`[${header}] に live がある（本番以外に live は書かない）: ${show(vars)}`);
  }
  const prod = varsOf(toml, 'vars') ?? {};
  const mode = prod[MODE];
  const released = prod[RELEASED_AT];
  if (mode !== undefined && mode !== 'live' && mode !== 'hold') {
    problems.push(`[vars] の mode は live か hold だけ: ${show(prod)}`);
  }
  if (mode === 'live' && released === undefined) {
    problems.push(`[vars] で live なのに解放時刻が無い（片方だけ）: ${show(prod)}`);
  } else if (mode === 'live' && (parseNotifyReleasedAt(released) === null || !/^[1-9]\d{9}$/.test(released ?? ''))) {
    problems.push(`[vars] の解放時刻が 10 桁の unix 秒ではない: ${show(prod)}`);
  } else if (mode !== 'live' && released !== undefined) {
    problems.push(`[vars] に解放時刻だけがある（片方だけ）: ${show(prod)}`);
  }
  return problems;
}

describe('資料請求の通知の設定', () => {
  it('NOTICE_MAX_ATTEMPTS は wrangler.toml の max_retries + 1（本番と preview の両方）', () => {
    const toml = read('wrangler.toml');
    const retries = [...toml.matchAll(/max_retries\s*=\s*(\d+)/g)].map((match) => Number(match[1]));
    expect(retries.length).toBeGreaterThanOrEqual(2);
    for (const value of retries) {
      expect(NOTICE_MAX_ATTEMPTS, `max_retries=${value} observed, NOTICE_MAX_ATTEMPTS=${NOTICE_MAX_ATTEMPTS}`).toBe(value + 1);
    }
  });

  it('live の宣言は、本番の [vars] に mode と解放時刻が対でそろうか、どちらも無いか、のどちらかだけ', () => {
    const problems = liveDeclarationProblems(read('wrangler.toml'));
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('宣言の検査器は、片方だけ・preview の live・解放時刻の形違いを、観測した値つきで落とす', () => {
    const toml = (prod: string, preview = '') => `[vars]\nCONTACT_TO_EMAIL = "a@example.com"\n${prod}\n[env.preview.vars]\n${preview}\n`;
    const both = 'DOCUMENT_REQUEST_NOTIFY_MODE = "live"\nDOCUMENT_REQUEST_NOTIFY_RELEASED_AT = "1788000000"';
    expect(liveDeclarationProblems(toml(both))).toEqual([]);
    expect(liveDeclarationProblems(toml(''))).toEqual([]);
    expect(liveDeclarationProblems(toml('DOCUMENT_REQUEST_NOTIFY_MODE = "hold"'))).toEqual([]);

    const modeOnly = liveDeclarationProblems(toml('DOCUMENT_REQUEST_NOTIFY_MODE = "live"'));
    expect(modeOnly.join('\n')).toContain('mode="live"');
    expect(modeOnly.join('\n')).toContain('releasedAt=<unset>');

    const releasedOnly = liveDeclarationProblems(toml('DOCUMENT_REQUEST_NOTIFY_RELEASED_AT = "1788000000"'));
    expect(releasedOnly.join('\n')).toContain('mode=<unset>');
    expect(releasedOnly.join('\n')).toContain('releasedAt="1788000000"');

    const millis = liveDeclarationProblems(toml('DOCUMENT_REQUEST_NOTIFY_MODE = "live"\nDOCUMENT_REQUEST_NOTIFY_RELEASED_AT = "1788000000000"'));
    expect(millis.join('\n')).toContain('releasedAt="1788000000000"');

    const previewLive = liveDeclarationProblems(toml('', 'DOCUMENT_REQUEST_NOTIFY_MODE = "live"'));
    expect(previewLive.join('\n')).toContain('env.preview.vars');
    expect(previewLive.join('\n')).toContain('mode="live"');

    const upper = liveDeclarationProblems(toml('DOCUMENT_REQUEST_NOTIFY_MODE = "LIVE"\nDOCUMENT_REQUEST_NOTIFY_RELEASED_AT = "1788000000"'));
    expect(upper.join('\n')).toContain('mode="LIVE"');
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
    const extracted = execFileSync('awk', ['/^```sql$/{f=1;next} /^```/{f=0} f', resolve(root, 'RUNBOOK-document-request-notice.md')], { encoding: 'utf8' });
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
