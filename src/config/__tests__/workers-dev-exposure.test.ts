// @vitest-environment node
/**
 * Cloudflare Worker を workers.dev（<name>.<アカウントのサブドメイン>.workers.dev）で公開するかどうかを、
 * wrangler.toml に明示させる（#362）。
 *
 * routes が空（または無い）環境では、wrangler（3.114・4.135 とも）は workers.dev を既定で有効にする。
 * 2026-10-01、contact-chat の [env.preview]（routes = []）が workers.dev で外から届いていた。
 * しかも Origin ヘッダーの無い POST を通すので、LLM の課金とスタッフ宛てのメールを外から起こせる状態だった。
 * アカウントのサブドメインは CMS の base_url（cms/public/config.yml）として公開されているので、URL は推測できる。
 *
 * - routes が空・無い環境（最上位と [env.*]）は workers_dev を明示する
 * - workers_dev = true は PUBLIC_WORKERS_DEV に載せたものだけ（外から届いてよい理由を書く）
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const WORKERS_DIR = path.join(ROOT, 'workers');

/** workers.dev で公開してよい Worker と環境（"<ディレクトリ>:<環境>"。最上位は top） */
const PUBLIC_WORKERS_DEV: Record<string, string> = {
  // CMS の「GitHub にログイン」を仲介する。cms/public/config.yml の base_url がこの URL を指す（ADR-0018）
  'sveltia-cms-auth:top': 'CMS のログインの仲介（base_url）',
};

type Routes = 'none' | 'empty' | 'set';
type WorkersDev = 'unset' | 'true' | 'false';
type EnvConfig = { routes: Routes; workersDev: WorkersDev };

/** wrangler.toml の最上位と [env.*] ごとに、routes と workers_dev を読む（TOML パーサーは入れない） */
export function readEnvs(text: string): Map<string, EnvConfig> {
  const envs = new Map<string, EnvConfig>([['top', { routes: 'none', workersDev: 'unset' }]]);
  let current: string | null = 'top';
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\s#.*$/, '').replace(/^#.*$/, '').trim();
    const section = /^\[\[?([^\]]+)\]\]?$/.exec(line);
    if (section) {
      // [env.x] 自身のキーだけを読む。[env.x.vars] や [vars]・[[d1_databases]] などの下は対象外
      const env = /^env\.([\w-]+)$/.exec(section[1].trim());
      current = env ? env[1] : null;
      if (env && !envs.has(env[1])) envs.set(env[1], { routes: 'none', workersDev: 'unset' });
      continue;
    }
    const conf = current === null ? undefined : envs.get(current);
    if (!conf) continue;
    const routes = /^routes?\s*=\s*(.*)$/.exec(line);
    if (routes) conf.routes = /^\[\s*\]$/.test(routes[1].trim()) ? 'empty' : 'set';
    const dev = /^workers_dev\s*=\s*(\S+)$/.exec(line);
    if (dev) conf.workersDev = dev[1] === 'true' ? 'true' : dev[1] === 'false' ? 'false' : 'unset';
  }
  return envs;
}

/** 1 つの wrangler.toml について、workers.dev の公開が明示され、公開は許可したものだけかを照合する */
export function checkWorkersDev(worker: string, text: string): string[] {
  const violations: string[] = [];
  for (const [env, conf] of readEnvs(text)) {
    const key = `${worker}:${env}`;
    const exposedByDefault = conf.routes !== 'set';
    if (exposedByDefault && conf.workersDev === 'unset') {
      violations.push(
        `${key}: routes が ${conf.routes === 'empty' ? '空' : '無い'} のに workers_dev を明示していない（wrangler は workers.dev を既定で有効にする）`
      );
    }
    if (conf.workersDev === 'true' && !(key in PUBLIC_WORKERS_DEV)) {
      violations.push(
        `${key}: workers_dev = true だが、公開してよい一覧（PUBLIC_WORKERS_DEV: ${Object.keys(PUBLIC_WORKERS_DEV).join(', ')}）に無い`
      );
    }
  }
  return violations;
}

const workerDirs = () =>
  readdirSync(WORKERS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => existsSync(path.join(WORKERS_DIR, name, 'wrangler.toml')))
    .sort();
const readWrangler = (worker: string) =>
  readFileSync(path.join(WORKERS_DIR, worker, 'wrangler.toml'), 'utf8');

describe('workers.dev の公開は wrangler.toml で明示し、許可したものだけにする（#362）', () => {
  it('対象の Worker がある（照合が空回りしていない）', () => {
    expect(workerDirs()).toEqual(['contact-chat', 'contact-edge', 'sveltia-cms-auth']);
  });

  it.each(workerDirs())('%s', (worker) => {
    expect(checkWorkersDev(worker, readWrangler(worker))).toEqual([]);
  });

  it('PUBLIC_WORKERS_DEV に載せたものは、実際に workers_dev = true にしている（一覧が古くならない）', () => {
    for (const key of Object.keys(PUBLIC_WORKERS_DEV)) {
      const [worker, env] = key.split(':');
      expect(readEnvs(readWrangler(worker)).get(env)?.workersDev, key).toBe('true');
    }
  });
});

describe('F2 変異: workers.dev の公開を暗黙にしたり、許可なく公開したりすると落ちる', () => {
  const mutate = (worker: string, from: string, to: string) => {
    const text = readWrangler(worker);
    const changed = text.replace(from, to);
    expect(changed).not.toBe(text);
    return checkWorkersDev(worker, changed);
  };

  it('contact-chat のプレビューから workers_dev = false を消す（2026-10-01 の状態）', () => {
    expect(mutate('contact-chat', '\nworkers_dev = false\n', '\n')).toEqual([
      'contact-chat:preview: routes が 空 のに workers_dev を明示していない（wrangler は workers.dev を既定で有効にする）',
    ]);
  });

  it('contact-edge のプレビューを workers_dev = true にする', () => {
    expect(mutate('contact-edge', '\nworkers_dev = false\n', '\nworkers_dev = true\n')).toEqual([
      'contact-edge:preview: workers_dev = true だが、公開してよい一覧（PUBLIC_WORKERS_DEV: sveltia-cms-auth:top）に無い',
    ]);
  });

  it('本番の contact-chat から routes を消す', () => {
    expect(
      mutate(
        'contact-chat',
        'routes = [{ pattern = "cor-jp.com/api/contact/*", zone_name = "cor-jp.com" }]\n',
        ''
      )
    ).toEqual([
      'contact-chat:top: routes が 無い のに workers_dev を明示していない（wrangler は workers.dev を既定で有効にする）',
    ]);
  });

  it('[env.preview.vars] の下に書いた workers_dev は、[env.preview] の設定として数えない', () => {
    const text = [
      'name = "x"',
      'routes = [{ pattern = "example.com/*", zone_name = "example.com" }]',
      '[env.preview]',
      'name = "x-preview"',
      'routes = []',
      '[env.preview.vars]',
      'workers_dev = false',
    ].join('\n');
    expect(checkWorkersDev('x', text)).toEqual([
      'x:preview: routes が 空 のに workers_dev を明示していない（wrangler は workers.dev を既定で有効にする）',
    ]);
  });
});
