// 資料請求の来歴（#537）。どのページのどの業種からの申請か、資料の版、フォームを表示するたびのトークン。
// 実メール・実 D1・実 Queue は使わない。D1 の代わりは node:sqlite の in-memory に migrations/*.sql を順に当てたもの。
import { createHmac } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../index';
import { DOCUMENT_REQUEST_ID, DOCUMENT_REQUEST_INDUSTRIES } from '../document-request';
import { resetRateLimits } from '../security';
import { tokyoDayKey } from '../storage';
import { envFor, HMAC, openDatabase, post, row, valid } from './document-test-kit';

afterEach(() => {
  resetRateLimits();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const TOKEN_A = '0f1e2d3c4b5a69788796a5b4c3d2e1f0';
const TOKEN_B = 'ffffffffffffffffffffffffffffffff';
const RECEIPT = /COR-\d{8}-[A-Z0-9]{8}/;

const MIGRATIONS = resolve(__dirname, '../../migrations');

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS).filter((name) => name.endsWith('.sql')).sort();
}

/** last までの migration を当てた DB。それより後は applyMigrationsAfter で足す。 */
function openDatabaseThrough(last: string): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const file of migrationFiles().filter((name) => name <= last)) {
    db.exec(readFileSync(resolve(MIGRATIONS, file), 'utf8'));
  }
  return db;
}

function applyMigrationsAfter(db: DatabaseSync, last: string): void {
  for (const file of migrationFiles().filter((name) => name > last)) {
    db.exec(readFileSync(resolve(MIGRATIONS, file), 'utf8'));
  }
}

/** 旧しい鍵（#510）。メール・資料・東京の日だけ。業種は入っていない。 */
function legacyKey(email: string, documentId: string, day: string): string {
  const digest = createHmac('sha256', HMAC).update(`${email.toLowerCase()}|${documentId}|${day}`).digest('hex');
  return `doc.${digest}`;
}

const formPost = (fields: Record<string, string>, ip: string) =>
  new Request('https://cor-jp.com/api/contact/document-request', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      origin: 'https://cor-jp.com',
      'cf-connecting-ip': ip,
    },
    body: new URLSearchParams(fields),
  });

async function resultOf(response: Response): Promise<{ status: number; receiptId: string; duplicate: boolean }> {
  const body = await response.json() as { receiptId?: string; duplicate?: boolean };
  return { status: response.status, receiptId: body.receiptId ?? '', duplicate: body.duplicate === true };
}

const noTokenFields = {
  name: '山田太郎',
  email: 'taro@example.com',
  company: '',
  industry: '',
  consent: 'yes',
  locale: 'ja',
};

describe('資料請求の来歴: どのページのどの業種か', () => {
  it.each(DOCUMENT_REQUEST_INDUSTRIES)('業種 %s のページから来た申請は、path（query・hash を除く）と業種と資料の版を保存する', async (slug) => {
    const db = openDatabase();
    const { env } = envFor(db);
    const res = await worker.fetch(post({
      ...valid,
      industry: slug,
      formToken: TOKEN_A,
      pagePath: `/industries/${slug}/?utm_source=x&email=taro@example.com#cta`,
    }, '198.51.100.201'), env);
    expect(res.status).toBe(200);
    expect(row(db, 'SELECT industry, entry_path, document_id, document_version FROM submission_intake')).toEqual({
      industry: slug,
      entry_path: `/industries/${slug}/`,
      document_id: DOCUMENT_REQUEST_ID,
      document_version: '',
    });
  });

  it.each(['', '/en', '/zh', '/ko', '/es'].flatMap((prefix) =>
    ['/company/', ...DOCUMENT_REQUEST_INDUSTRIES.map((slug) => `/industries/${slug}/`)].map((path) => prefix + path)
  ))('公開ページ %s の標準パスを受付に保存する', async (pagePath) => {
    const db = openDatabase();
    const { env } = envFor(db);
    const res = await worker.fetch(post({ ...valid, pagePath, formToken: TOKEN_A }), env);
    expect(res.status).toBe(200);
    expect(row(db, 'SELECT entry_path, document_version FROM submission_intake')).toEqual({
      entry_path: pagePath, document_version: '',
    });
  });

  it('可変資料の新版が登録済みの確定版を更新したり、同じ番号で返したりしない', async () => {
    const db = openDatabase();
    const { env } = envFor(db);
    const first = await resultOf(await worker.fetch(post({ ...valid, pagePath: '/company/' }), env));
    const legacy = legacyKey(valid.email, DOCUMENT_REQUEST_ID, tokyoDayKey(new Date()));
    db.prepare('UPDATE submission_intake SET idempotency_key = ?, document_version = ? WHERE receipt_id = ?')
      .run(legacy, 'fixture-verified-revision', first.receiptId);
    const next = await resultOf(await worker.fetch(post({ ...valid, pagePath: '/company/' }), env));
    expect(next.status).toBe(200);
    expect(next.receiptId).not.toBe(first.receiptId);
    expect(db.prepare('SELECT document_version FROM submission_intake ORDER BY rowid').all())
      .toEqual([{ document_version: 'fixture-verified-revision' }, { document_version: '' }]);
  });

  it.each([
    ['無し', undefined],
    ['空文字', ''],
    ['別 origin の絶対 URL', 'https://example.com/industries/medical/'],
    ['自社 origin でも絶対 URL（保存するのは相対 path だけ）', 'https://cor-jp.com/industries/medical/'],
    ['protocol-relative（別 host）', '//evil.example/industries/medical/'],
    ['メールアドレスを含む', '/users/taro@example.com/'],
    ['電話番号らしき数字の並び', '/tel/09012345678'],
    ['.. を含む', '/industries/../contact/'],
    ['長すぎる', `/${'a'.repeat(300)}`],
    ['ASCII 以外', '/業種/'],
    ['英字の会員風パス（公開起点外）', '/members/fixturemember/'],
    ['ja 付きの非標準パス', '/ja/company/'],
    ['公開業種に無いパス', '/en/industries/notpublished/'],
    ['相対 path でない', 'industries/medical/'],
    ['文字列でない', 42],
  ])('元のページが「%s」のときは捏造せず空（記録なし）で保存する', async (_label, pagePath) => {
    const db = openDatabase();
    const { env } = envFor(db);
    // 対照: 同じ DB に、保存できる形の path の受付を先に 1 件入れる（空が返るのは検査のためで、保存していないためではない）。
    const control = await worker.fetch(
      post({ ...valid, email: 'control@example.com', formToken: TOKEN_B, pagePath: '/industries/medical/?x=1' }, '198.51.100.202'),
      env,
    );
    expect(control.status).toBe(200);
    const res = await worker.fetch(post({ ...valid, formToken: TOKEN_A, pagePath }, '198.51.100.202'), env);
    expect(res.status).toBe(200);
    const paths = (db.prepare('SELECT entry_path FROM submission_intake ORDER BY rowid').all() as Array<{ entry_path: string }>)
      .map((item) => item.entry_path);
    expect(paths).toEqual(['/industries/medical/', '']);
  });

  it('監査の記録に path と版を残し、メールと氏名は書かない', async () => {
    const db = openDatabase();
    const { env } = envFor(db);
    await worker.fetch(post({ ...valid, formToken: TOKEN_A, pagePath: '/company/?utm_source=x#links' }, '198.51.100.203'), env);
    const audit = db.prepare('SELECT metadata_json FROM audit_events').get() as { metadata_json: string };
    expect(JSON.parse(audit.metadata_json)).toEqual({
      documentId: DOCUMENT_REQUEST_ID,
      industry: 'medical',
      consentVersion: 'document-request-1',
      locale: 'ja',
      entryPath: '/company/',
      documentVersion: '',
    });
    expect(audit.metadata_json).not.toContain('taro@example.com');
    expect(audit.metadata_json).not.toContain('山田');
  });
});

describe('資料請求の来歴: トークンと受付の単位', () => {
  it('事前スパイク: トークンが無くても、同じ日・同じメールで業種が違えば別の受付にする', async () => {
    const db = openDatabase();
    const { env } = envFor(db);
    const first = await resultOf(await worker.fetch(post({ ...valid, industry: 'medical' }, '198.51.100.210'), env));
    const second = await resultOf(await worker.fetch(post({ ...valid, industry: 'construction' }, '198.51.100.210'), env));
    expect(first).toMatchObject({ status: 200, duplicate: false });
    expect(second).toMatchObject({ status: 200, duplicate: false });
    expect(second.receiptId).not.toBe(first.receiptId);
    const industries = (db.prepare('SELECT industry FROM submission_intake ORDER BY rowid').all() as Array<{ industry: string }>)
      .map((item) => item.industry);
    expect(industries).toEqual(['medical', 'construction']);
  });

  it('同じトークンと同じ内容の再送は 1 件で、同じ受付番号を返す', async () => {
    const db = openDatabase();
    const { env } = envFor(db);
    const first = await resultOf(await worker.fetch(post({ ...valid, formToken: TOKEN_A }, '198.51.100.211'), env));
    const retry = await resultOf(await worker.fetch(post({ ...valid, formToken: TOKEN_A }, '198.51.100.211'), env));
    expect(first).toMatchObject({ status: 200, duplicate: false });
    expect(retry).toMatchObject({ status: 202, duplicate: true });
    expect(retry.receiptId).toBe(first.receiptId);
    expect(row(db, 'SELECT COUNT(*) AS n FROM submission_intake')).toEqual({ n: 1 });
  });

  it('別のトークンなら、同じ日・メール・業種・資料・版でも 2 件', async () => {
    const db = openDatabase();
    const { env } = envFor(db);
    const first = await resultOf(await worker.fetch(post({ ...valid, formToken: TOKEN_A }, '198.51.100.212'), env));
    const second = await resultOf(await worker.fetch(post({ ...valid, formToken: TOKEN_B }, '198.51.100.212'), env));
    expect(first).toMatchObject({ status: 200, duplicate: false });
    expect(second).toMatchObject({ status: 200, duplicate: false });
    expect(second.receiptId).not.toBe(first.receiptId);
    expect(row(db, 'SELECT COUNT(*) AS n FROM submission_intake')).toEqual({ n: 2 });
  });

  it('同じトークンでも内容が違えば別の受付にして、先の申込者の受付番号は返さない（JSON）', async () => {
    const db = openDatabase();
    const { env } = envFor(db);
    const first = await worker.fetch(post({ ...valid, formToken: TOKEN_A }, '198.51.100.213'), env);
    const firstText = await first.text();
    expect(JSON.parse(firstText)).toMatchObject({ ok: true, status: 'stored', duplicate: false });
    const firstReceipt = (JSON.parse(firstText) as { receiptId: string }).receiptId;

    const other = await worker.fetch(
      post(
        { ...valid, name: '鈴木次郎', email: 'jiro@example.com', formToken: TOKEN_A },
        '198.51.100.214',
      ),
      env,
    );
    const otherText = await other.text();
    expect(other.status).toBe(200);
    const parsed = JSON.parse(otherText) as { receiptId: string; duplicate: boolean };
    expect(parsed.duplicate).toBe(false);
    expect(parsed.receiptId).toMatch(RECEIPT);
    expect(otherText).not.toContain(firstReceipt);
    expect(row(db, 'SELECT COUNT(*) AS n FROM submission_intake')).toEqual({ n: 2 });
  });

  it('同じトークンでも内容が違えば別の受付にして、先の申込者の受付番号は返さない（JS 無しの HTML）', async () => {
    const db = openDatabase();
    const { env } = envFor(db);
    const firstHtml = await (await worker.fetch(formPost({ ...noTokenFields, email: 'saburo@example.com', formToken: TOKEN_A }, '198.51.100.215'), env)).text();
    const firstReceipt = firstHtml.match(RECEIPT)?.[0] ?? '';
    expect(firstReceipt).not.toBe('');

    const other = await worker.fetch(formPost({ ...noTokenFields, email: 'siro@example.com', formToken: TOKEN_A }, '198.51.100.216'), env);
    const otherHtml = await other.text();
    expect(other.status).toBe(200);
    const otherReceipt = otherHtml.match(RECEIPT)?.[0] ?? '';
    expect(otherReceipt).not.toBe('');
    expect(otherReceipt).not.toBe(firstReceipt);
    expect(otherHtml).not.toContain(firstReceipt);
    expect(row(db, 'SELECT COUNT(*) AS n FROM submission_intake')).toEqual({ n: 2 });
  });

  it('同じトークンでも内容が違えば別の受付にする（同じメールで氏名だけ違う場合も）', async () => {
    const db = openDatabase();
    const { env } = envFor(db);
    const first = await resultOf(await worker.fetch(post({ ...valid, formToken: TOKEN_A }, '198.51.100.218'), env));
    const edited = await resultOf(await worker.fetch(
      post({ ...valid, company: '別の会社', discoverySource: 'search', formToken: TOKEN_A }, '198.51.100.218'),
      env,
    ));
    expect(first).toMatchObject({ status: 200, duplicate: false });
    expect(edited).toMatchObject({ status: 200, duplicate: false });
    expect(edited.receiptId).not.toBe(first.receiptId);
    const companies = (db.prepare('SELECT company_ciphertext FROM submission_intake ORDER BY rowid').all() as Array<{ company_ciphertext: string }>)
      .map((item) => item.company_ciphertext);
    expect(companies).toHaveLength(2);
    expect(companies[0]).not.toBe(companies[1]);
  });

  it('会社名の大文字と小文字の違いを再送としてまとめない', async () => {
    const db = openDatabase();
    const { env } = envFor(db);
    const request = { ...valid, company: 'Example Labs', formToken: TOKEN_A };
    const first = await resultOf(await worker.fetch(post(request, '198.51.100.219'), env));
    const edited = await resultOf(await worker.fetch(post({ ...request, company: 'EXAMPLE LABS' }, '198.51.100.219'), env));
    expect(first).toMatchObject({ status: 200, duplicate: false });
    expect(edited).toMatchObject({ status: 200, duplicate: false });
    expect(edited.receiptId).not.toBe(first.receiptId);
  });

  it('同時の再送が鍵の競合に勝ったときは、その行の受付番号を返して 2 件にしない', async () => {
    const db = openDatabase();
    const { env } = envFor(db);
    const d1 = env.DB as unknown as { batch: (statements: Array<{ sql: string; bindings: SQLInputValue[] }>) => Promise<unknown> };
    const original = d1.batch;
    let raced = false;
    d1.batch = async (statements) => {
      if (!raced) {
        // 保存の直前に、同じ内容の再送が先に保存されたことにする。
        raced = true;
        db.exec('BEGIN');
        try {
          for (const statement of statements) db.prepare(statement.sql).run(...statement.bindings);
          db.exec('COMMIT');
        } catch (error) {
          db.exec('ROLLBACK');
          throw error;
        }
      }
      // 本来の INSERT は idempotency_key の UNIQUE で失敗する。
      return original(statements);
    };
    const res = await resultOf(await worker.fetch(post({ ...valid, formToken: TOKEN_A }, '198.51.100.250'), env));
    expect(raced).toBe(true);
    expect(res).toMatchObject({ status: 202, duplicate: true });
    expect(res.receiptId).toMatch(RECEIPT);
    expect(row(db, 'SELECT COUNT(*) AS n FROM submission_intake')).toEqual({ n: 1 });
  });

  it.each([
    ['短い', 'abc'],
    ['大文字', TOKEN_A.toUpperCase()],
    ['hex 以外', 'g'.repeat(32)],
    ['長い', 'a'.repeat(33)],
  ])('トークンの形が違う送信（%s）は 400 invalid で保存しない', async (_label, formToken) => {
    const db = openDatabase();
    const { env, queue } = envFor(db);
    const res = await worker.fetch(post({ ...valid, formToken }, '198.51.100.220'), env);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid' });
    expect(row(db, 'SELECT COUNT(*) AS n FROM submission_intake')).toEqual({ n: 0 });
    expect(queue.sent).toHaveLength(0);
  });

  it('JS 無しのフォーム送信はトークンを持たない。同じ日・メール・業種・資料は従来どおり 1 件で、業種が違えば別の受付にする', async () => {
    const db = openDatabase();
    const { env } = envFor(db);
    const first = await worker.fetch(formPost({ ...noTokenFields, industry: '' }, '198.51.100.230'), env);
    expect(first.status).toBe(200);
    const firstReceipt = (await first.text()).match(RECEIPT)?.[0] ?? '';
    expect(firstReceipt).not.toBe('');

    const again = await worker.fetch(formPost({ ...noTokenFields, industry: '' }, '198.51.100.230'), env);
    expect(again.status).toBe(202);
    expect(await again.text()).toContain(firstReceipt);

    const other = await worker.fetch(formPost({ ...noTokenFields, industry: 'medical' }, '198.51.100.231'), env);
    expect(other.status).toBe(200);
    expect(row(db, 'SELECT COUNT(*) AS n FROM submission_intake')).toEqual({ n: 2 });
  });

  it('JS 無しのフォーム送信にトークンがあれば、トークンの規則で 1 件にまとめる', async () => {
    const db = openDatabase();
    const { env } = envFor(db);
    const first = await worker.fetch(formPost({ ...noTokenFields, formToken: TOKEN_A }, '198.51.100.232'), env);
    const again = await worker.fetch(formPost({ ...noTokenFields, formToken: TOKEN_A }, '198.51.100.232'), env);
    expect(first.status).toBe(200);
    expect(again.status).toBe(202);
    expect(row(db, 'SELECT COUNT(*) AS n FROM submission_intake')).toEqual({ n: 1 });
  });
});

describe('資料請求の来歴: schema migration と既存の行', () => {
  it("0011 は document_version を NOT NULL DEFAULT '' で足すだけ。既存の行は空のまま残る", () => {
    const db = openDatabaseThrough('0010_document_locale.sql');
    const before = db.prepare("SELECT name FROM pragma_table_info('submission_intake')").all() as Array<{ name: string }>;
    expect(before.map((column) => column.name)).not.toContain('document_version');

    applyMigrationsAfter(db, '0010_document_locale.sql');

    const columns = db.prepare("SELECT name, type, \"notnull\", dflt_value FROM pragma_table_info('submission_intake')").all() as Array<{
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
    }>;
    expect(columns.filter((column) => column.name === 'document_version')).toEqual([
      { name: 'document_version', type: 'TEXT', notnull: 1, dflt_value: "''" },
    ]);
    // 同じ表に同じ列は 1 回しか足されていない（migration-columns.test.ts と同じ規則）。
    const names = columns.map((column) => column.name);
    expect(new Set(names).size).toBe(names.length);
    expect(migrationFiles().filter((name) => name > '0010_document_locale.sql')).toEqual(['0011_document_version.sql']);
  });

  it('旧しい鍵の既存の行は、同じ業種の再送なら同じ受付番号を返し、別の業種なら別の受付にする', async () => {
    const db = openDatabaseThrough('0010_document_locale.sql');
    const { env } = envFor(db);
    // 0011 の前に、旧しい鍵で保存された行を作る。
    const first = await resultOf(await worker.fetch(post({ ...valid, industry: 'medical' }, '198.51.100.240'), env));
    expect(first.status).toBe(200);
    db.prepare('UPDATE submission_intake SET idempotency_key = ?').run(legacyKey(valid.email, DOCUMENT_REQUEST_ID, tokyoDayKey(new Date())));
    applyMigrationsAfter(db, '0010_document_locale.sql');
    expect(row(db, 'SELECT document_version, entry_path FROM submission_intake')).toEqual({ document_version: '', entry_path: '' });

    const same = await resultOf(await worker.fetch(post({ ...valid, industry: 'medical' }, '198.51.100.241'), env));
    expect(same).toEqual({ status: 202, receiptId: first.receiptId, duplicate: true });
    const other = await resultOf(await worker.fetch(post({ ...valid, industry: 'education' }, '198.51.100.242'), env));
    expect(other.status).toBe(200);
    expect(other.duplicate).toBe(false);
    expect(other.receiptId).not.toBe(first.receiptId);
    expect(row(db, 'SELECT COUNT(*) AS n FROM submission_intake')).toEqual({ n: 2 });
  });

  it('0011 が未適用の D1 でも受付は止まらない。版は記録なしのまま', async () => {
    const db = openDatabaseThrough('0010_document_locale.sql');
    const { env, queue } = envFor(db);
    const res = await worker.fetch(post({ ...valid, formToken: TOKEN_A, pagePath: '/company/' }, '198.51.100.243'), env);
    expect(res.status).toBe(200);
    expect(row(db, 'SELECT industry, entry_path, status FROM submission_intake')).toEqual({
      industry: 'medical',
      entry_path: '/company/',
      status: 'stored',
    });
    expect(queue.sent).toHaveLength(1);
    applyMigrationsAfter(db, '0010_document_locale.sql');
    expect(row(db, 'SELECT document_version FROM submission_intake')).toEqual({ document_version: '' });
  });
});
