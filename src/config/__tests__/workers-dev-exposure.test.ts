// @vitest-environment node
/**
 * Cloudflare Worker を workers.dev で公開するかどうかを、wrangler.toml に明示させる（#362）。
 *
 * workers.dev の URL は 2 種類ある。
 * - workers_dev:  https://<name>.<アカウントのサブドメイン>.workers.dev
 * - preview_urls: https://<版の先頭 8 桁>-<name>.<サブドメイン>.workers.dev（版ごとのプレビュー URL）
 *
 * どちらも、書かなければ wrangler が決める。
 * - workers_dev は「[env.*] の値 ?? 最上位の値 ?? 実際の routes が空か」で決まる（[env.*] に routes が無ければ最上位を継ぐ）
 * - preview_urls は、3.114 では既定が true
 * 既定と継承に頼らないよう、すべての環境（最上位と [env.*]）で両方を true / false で明示させる。true は PUBLIC に載せたものだけにする。
 *
 * 2026-10-01、contact-chat の [env.preview]（routes = []）が workers.dev で外から届いていた。Origin ヘッダーの無い POST を
 * 通すので、LLM の課金とスタッフ宛てのメールを外から起こせる状態だった。アカウントのサブドメインは CMS の base_url
 * （cms/public/config.yml）として公開されているので、URL は推測できる。
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const WORKERS_DIR = path.join(ROOT, 'workers');
const KEYS = ['workers_dev', 'preview_urls'] as const;
type Key = (typeof KEYS)[number];
type Setting = Readonly<Partial<Record<Key, boolean>>>;
type Parsed = { envs: ReadonlyMap<string, Setting>; problems: readonly string[]; current: string | null };

/** workers.dev で公開してよいもの（"<ディレクトリ>:<環境>:<キー>"。最上位の環境は top）と、その理由 */
const PUBLIC: Readonly<Record<string, string>> = {
  'sveltia-cms-auth:top:workers_dev':
    'CMS のログインを仲介する。cms/public/config.yml の base_url がこの URL を指す（ADR-0018）',
};

const HEADER = /^\[\[?([^\]]*)\]\]?\s*(?:#.*)?$/;
/** [env.<名前>] と [env.<名前>.vars] などだけを読める形とする（[env . x]・[env."x"]・[env] は読めない） */
const ENV_HEADER = /^env\.([A-Za-z0-9_-]+)(\..+)?$/;
const KEY_LINE = /^["']?(workers_dev|preview_urls)["']?\s*=/;
const KEY_VALUE = /^(workers_dev|preview_urls)\s*=\s*(true|false)\s*(?:#.*)?$/;

const withEnv = (envs: ReadonlyMap<string, Setting>, env: string, setting: Setting = {}) =>
  new Map(envs).set(env, { ...(envs.get(env) ?? {}), ...setting });

/** 1 行を読んで状態を進める（見出し・キー・それ以外）。状態は書き換えずに新しく作る */
function readLine(state: Parsed, raw: string): Parsed {
  const line = raw.trim();
  if (line === '' || line.startsWith('#')) return state;
  if (line.startsWith('[')) {
    const header = HEADER.exec(line)?.[1].trim();
    if (header === undefined) return { ...state, current: null, problems: [...state.problems, `読めない見出し: ${line}`] };
    if (!/^env\b/.test(header)) return { ...state, current: null };
    const env = ENV_HEADER.exec(header);
    if (!env) return { ...state, current: null, problems: [...state.problems, `読めない [env] の見出し: ${line}`] };
    // [env.x.vars] などの下のキーは、その環境の設定として数えない（環境だけは照合の対象にする）
    return { ...state, envs: withEnv(state.envs, env[1]), current: env[2] ? null : env[1] };
  }
  if (state.current === 'top' && /^env\s*=/.test(line)) {
    return { ...state, problems: [...state.problems, `env をインラインテーブルで書いている（読めない）: ${line}`] };
  }
  if (state.current === null || !KEY_LINE.test(line)) return state;
  const kv = KEY_VALUE.exec(line);
  if (!kv) return { ...state, problems: [...state.problems, `読めない値: ${line}`] };
  return { ...state, envs: withEnv(state.envs, state.current, { [kv[1]]: kv[2] === 'true' }) };
}

/** wrangler.toml を行で読み、最上位と [env.*] ごとの workers_dev・preview_urls と、読めなかった行を返す（TOML パーサーは入れない） */
function parseWrangler(text: string): Parsed {
  const initial: Parsed = { envs: new Map([['top', {}]]), problems: [], current: 'top' };
  return text.split(/\r?\n/).reduce(readLine, initial);
}

/** 1 つの Worker のディレクトリについて、workers.dev の公開が明示され、公開は許可したものだけかを照合する */
function checkWorker(worker: string, files: readonly string[], text: string | null): string[] {
  const configProblems = [
    ...files.filter((f) => /^wrangler\.jsonc?$/.test(f)).map((f) => `${worker}: ${f} は照合できない（wrangler.toml にする）`),
    ...(text === null ? [`${worker}: wrangler.toml が無い`] : []),
  ];
  if (text === null) return configProblems;
  const parsed = parseWrangler(text);
  const settingProblems = [...parsed.envs].flatMap(([env, setting]) =>
    KEYS.flatMap((key) => {
      const value = setting[key];
      if (value === undefined) return [`${worker}:${env}: ${key} を true / false で明示していない`];
      if (value && !(`${worker}:${env}:${key}` in PUBLIC))
        return [`${worker}:${env}: ${key} = true だが、公開してよい一覧（PUBLIC）に無い`];
      return [];
    })
  );
  return [...configProblems, ...parsed.problems.map((p) => `${worker}: ${p}`), ...settingProblems];
}

const workerDirs = () =>
  readdirSync(WORKERS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
const filesOf = (worker: string) => readdirSync(path.join(WORKERS_DIR, worker));
const readWrangler = (worker: string) =>
  filesOf(worker).includes('wrangler.toml')
    ? readFileSync(path.join(WORKERS_DIR, worker, 'wrangler.toml'), 'utf8')
    : null;
const checkReal = (worker: string) => checkWorker(worker, filesOf(worker), readWrangler(worker));

describe('workers.dev とプレビュー URL の公開は wrangler.toml で明示し、許可したものだけにする（#362）', () => {
  it('対象の Worker がある（照合が空回りしていない）', () => {
    expect(workerDirs()).toEqual(['contact-chat', 'contact-edge', 'sveltia-cms-auth']);
  });

  it.each(workerDirs())('%s', (worker) => {
    expect(checkReal(worker)).toEqual([]);
  });

  it('PUBLIC に載せたものは、実際に true にしている（一覧が古くならない）', () => {
    for (const key of Object.keys(PUBLIC)) {
      const [worker, env, name] = key.split(':') as [string, string, Key];
      expect(parseWrangler(readWrangler(worker) ?? '').envs.get(env)?.[name], key).toBe(true);
    }
  });
});

describe('F2 変異: 公開を暗黙にしたり、許可なく公開したり、読めない書き方で照合をすり抜けたりすると落ちる', () => {
  const text = (worker: string) => readWrangler(worker) ?? '';
  const replaceLast = (s: string, from: string, to: string) => {
    const i = s.lastIndexOf(from);
    expect(i).toBeGreaterThanOrEqual(0);
    return s.slice(0, i) + to + s.slice(i + from.length);
  };
  const replaceFirst = (s: string, from: string, to: string) => {
    expect(s.includes(from)).toBe(true);
    return s.replace(from, to);
  };
  const check = (worker: string, changed: string) => checkWorker(worker, filesOf(worker), changed);

  it('contact-chat のプレビューから workers_dev を消す（2026-10-01 の状態）', () => {
    const changed = replaceLast(text('contact-chat'), '\nworkers_dev = false\n', '\n');
    expect(check('contact-chat', changed)).toEqual([
      'contact-chat:preview: workers_dev を true / false で明示していない',
    ]);
  });

  it('contact-edge の最上位から preview_urls を消す', () => {
    const changed = replaceFirst(text('contact-edge'), '\npreview_urls = false\n', '\n');
    expect(check('contact-edge', changed)).toEqual([
      'contact-edge:top: preview_urls を true / false で明示していない',
    ]);
  });

  it.each([
    ['contact-edge', 'workers_dev', 'contact-edge:preview: workers_dev = true だが、公開してよい一覧（PUBLIC）に無い'],
    ['contact-chat', 'preview_urls', 'contact-chat:preview: preview_urls = true だが、公開してよい一覧（PUBLIC）に無い'],
  ])('%s のプレビューの %s を true にする', (worker, key, message) => {
    const changed = replaceLast(text(worker), `\n${key} = false\n`, `\n${key} = true\n`);
    expect(check(worker, changed)).toEqual([message]);
  });

  it('CMS の認証 Worker の preview_urls を true にする（workers_dev は許可済みだが、プレビュー URL は許可していない）', () => {
    const changed = replaceFirst(text('sveltia-cms-auth'), '\npreview_urls = false\n', '\npreview_urls = true\n');
    expect(check('sveltia-cms-auth', changed)).toEqual([
      'sveltia-cms-auth:top: preview_urls = true だが、公開してよい一覧（PUBLIC）に無い',
    ]);
  });

  it.each([
    ['true / false 以外の値', '\nworkers_dev = false\n', '\nworkers_dev = maybe\n', 'contact-chat: 読めない値: workers_dev = maybe'],
    ['引用符付きのキー', '\nworkers_dev = false\n', '\n"workers_dev" = false\n', 'contact-chat: 読めない値: "workers_dev" = false'],
    ['空白の入った [env] の見出し', '[env.preview]\n', '[env . preview]\n', 'contact-chat: 読めない [env] の見出し: [env . preview]'],
  ])('contact-chat のプレビューに%sを書く', (_, from, to, message) => {
    const changed = replaceLast(text('contact-chat'), from, to);
    expect(check('contact-chat', changed)).toContain(message);
  });

  it('[env.x.vars] だけで書いた環境も、明示を求める（vars の下の workers_dev は数えない）', () => {
    const changed = `${text('contact-chat')}\n[env.staging.vars]\nworkers_dev = false\n`;
    expect(check('contact-chat', changed)).toEqual([
      'contact-chat:staging: workers_dev を true / false で明示していない',
      'contact-chat:staging: preview_urls を true / false で明示していない',
    ]);
  });

  it('最上位で env をインラインテーブルで書く', () => {
    const changed = `env = { staging = { workers_dev = false } }\n${text('contact-edge')}`;
    expect(check('contact-edge', changed)).toContain(
      'contact-edge: env をインラインテーブルで書いている（読めない）: env = { staging = { workers_dev = false } }'
    );
  });

  it('コメントの中の workers_dev は数えない', () => {
    const changed = replaceLast(text('contact-chat'), '\nworkers_dev = false\n', '\n# workers_dev = false\n');
    expect(check('contact-chat', changed)).toEqual([
      'contact-chat:preview: workers_dev を true / false で明示していない',
    ]);
  });

  it('改行が CRLF でも同じように読む', () => {
    const crlf = text('contact-chat').replace(/\n/g, '\r\n');
    expect(check('contact-chat', crlf)).toEqual([]);
    const missing = replaceLast(crlf, '\r\nworkers_dev = false\r\n', '\r\n');
    expect(check('contact-chat', missing)).toEqual([
      'contact-chat:preview: workers_dev を true / false で明示していない',
    ]);
  });

  it('wrangler.json / wrangler.jsonc で書いた Worker は照合できないので落とす', () => {
    expect(checkWorker('new-worker', ['wrangler.jsonc', 'src'], null)).toEqual([
      'new-worker: wrangler.jsonc は照合できない（wrangler.toml にする）',
      'new-worker: wrangler.toml が無い',
    ]);
  });
});
