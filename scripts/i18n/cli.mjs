/**
 * コマンドライン: 引数を Zod で検証し、plan → check / write / adopt を実行する。
 * 終了コード: 0 = 問題なし / 1 = 未翻訳・古い翻訳・失敗あり / 2 = 使い方の誤り・致命的エラー
 */
import path from 'node:path';
import { parseArgs } from 'node:util';
import { z } from 'astro/zod';
import { COLLECTION_NAMES, readRuntimeConfig, TARGET_LANGS } from './config.mjs';
import { createGeminiClient } from './gemini.mjs';
import { buildPlan, changedTargets, SLUG_RE } from './plan.mjs';
import { createRateLimiter, withResilience } from './retry.mjs';
import { removeFile, runAdopt, runCheck, runWrite, writeFileAtomic } from './run.mjs';

export const USAGE = `使い方: node scripts/i18n/translate-content.mjs [モード] [オプション]

モード（どれか 1 つ。省略時は --check）
  --check                 未翻訳・古い翻訳を列挙し、1 件でもあれば exit 1（API キー不要）
  --write                 不足・古い翻訳だけを Gemini で翻訳して書き込む（GEMINI_API_KEY が必要）
                          ja が無い翻訳は削除、コピー対象のずれは API なしで同期する
  --adopt                 来歴の無い既存翻訳（untracked）を「現在の ja に対応済み」として採用（API 不要）

オプション
  --collections blog,cases,news   対象コレクション（既定: 全部）
  --langs en,zh,ko,es             対象言語（既定: 全部）
  --only <slug>[,<collection>/<slug>...]  対象記事を絞る
  --since <git-ref>               <git-ref>...HEAD で変更された記事だけに絞る（PR 用。--only と併用不可）
  --retranslate-untracked         --write で untracked も再翻訳する（既定は触らない）
  --dry-run                       --write / --adopt の計画だけ表示（API も書き込みもしない）
  --root <dir>                    リポジトリのルート（既定: カレントディレクトリ）

環境変数
  GEMINI_API_KEY（--write で翻訳するときのみ必須）, GEMINI_MODEL, GEMINI_THINKING_LEVEL,
  I18N_RPM, I18N_CONCURRENCY(1-2), I18N_MAX_API_ATTEMPTS, I18N_MAX_VALIDATION_ATTEMPTS, I18N_REQUEST_TIMEOUT_MS`;

/** "a, b" → ['a', 'b']。未指定・空文字（CI の空入力）は null = 全部。 */
const splitList = (v) =>
  v === undefined || v.trim() === ''
    ? null
    : v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

const listArg = (allowed, flag) =>
  z
    .string()
    .optional()
    .transform(splitList)
    .refine((list) => list === null || list.every((x) => allowed.includes(x)), {
      message: `${flag} には ${allowed.join(', ')} をカンマ区切りで指定してください`,
    });

const ONLY_ENTRY_RE = new RegExp(
  `^(?:(?:${COLLECTION_NAMES.join('|')})/)?${SLUG_RE.source.slice(1, -1)}$`
);
// git に execFile（シェルなし）で渡す。"-" 始まり（オプション注入）と ".."（範囲指定）は拒否。
const GIT_REF_RE = /^(?!-)(?!.*\.\.)[A-Za-z0-9._/~^-]{1,200}$/;

const ArgsSchema = z
  .object({
    check: z.boolean().default(false),
    write: z.boolean().default(false),
    adopt: z.boolean().default(false),
    'dry-run': z.boolean().default(false),
    'retranslate-untracked': z.boolean().default(false),
    help: z.boolean().default(false),
    collections: listArg(COLLECTION_NAMES, '--collections'),
    langs: listArg(TARGET_LANGS, '--langs'),
    only: z
      .string()
      .optional()
      .transform(splitList)
      .refine((list) => list === null || list.every((e) => ONLY_ENTRY_RE.test(e)), {
        message: '--only には slug か collection/slug をカンマ区切りで指定してください',
      }),
    since: z
      .string()
      .optional()
      .transform((v) => (v === undefined || v.trim() === '' ? null : v.trim()))
      .refine((v) => v === null || GIT_REF_RE.test(v), {
        message: '--since は git の ref / SHA を指定してください',
      }),
    root: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    const issue = (message) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    if ([v.check, v.write, v.adopt].filter(Boolean).length > 1)
      issue('--check / --write / --adopt は 1 つだけ指定してください');
    if (v.only && v.since) issue('--only と --since は同時に指定できません');
    if (v['retranslate-untracked'] && !v.write)
      issue('--retranslate-untracked は --write と一緒に指定してください');
    if (v['dry-run'] && !v.write && !v.adopt)
      issue('--dry-run は --write か --adopt と一緒に指定してください');
  });

/** argv を検証済みのオプションにする。不正なら例外。 */
export function parseCliArgs(argv) {
  const { values } = parseArgs({
    args: argv,
    strict: true,
    allowPositionals: false,
    options: {
      check: { type: 'boolean' },
      write: { type: 'boolean' },
      adopt: { type: 'boolean' },
      'dry-run': { type: 'boolean' },
      'retranslate-untracked': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
      collections: { type: 'string' },
      langs: { type: 'string' },
      only: { type: 'string' },
      since: { type: 'string' },
      root: { type: 'string' },
    },
  });
  const parsed = ArgsSchema.safeParse(values);
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join('\n'));
  return parsed.data;
}

const consoleOut = Object.freeze({
  info: (line) => process.stdout.write(`${line}\n`),
  error: (line) => process.stderr.write(`${line}\n`),
});

function defaultClientFactory(config, env, out) {
  return async () =>
    withResilience(
      await createGeminiClient({
        apiKey: env.GEMINI_API_KEY,
        model: config.model,
        thinkingLevel: config.thinkingLevel,
        timeoutMs: config.requestTimeoutMs,
      }),
      {
        limiter: createRateLimiter({ rpm: config.rpm }),
        retry: {
          maxAttempts: config.maxApiAttempts,
          baseDelayMs: config.baseDelayMs,
          maxDelayMs: config.maxDelayMs,
          onRetry: ({ attempt, delay, error }) =>
            out.info(
              `  … API 再試行 ${attempt}（${Math.round(delay / 1000)} 秒後）: ${redactWith(env)(
                error.message
              )}`
            ),
        },
      }
    );
}

const redactWith = (env) => (text) =>
  env.GEMINI_API_KEY ? String(text).split(env.GEMINI_API_KEY).join('***') : String(text);

async function resolveScope(args, root, deps, out) {
  if (!args.since) return args.only ? new Set(args.only) : null;
  const targets = changedTargets({ root, since: args.since, runGit: deps.runGit });
  out.info(
    `--since ${args.since}: 変更のあった記事 ${targets.size} 件に限定（${
      [...targets].join(', ') || 'なし'
    }）`
  );
  return targets;
}

/** --only の打ち間違い（どの記事にも当たらない）を「対象なし＝成功」にしない。 */
function assertOnlyMatched(only, items) {
  if (!only) return;
  const matched = new Set(items.flatMap((i) => [`${i.collection}/${i.slug}`, i.slug]));
  const unmatched = only.filter((entry) => !matched.has(entry));
  if (unmatched.length > 0) {
    throw new Error(`--only に該当する記事がありません: ${unmatched.join(', ')}`);
  }
}

/**
 * @param {string[]} argv
 * @param {{ out?: object, env?: object, root?: string, now?: () => Date, createClient?: () => Promise<object>,
 *           runGit?: Function, writeFile?: Function, removeFile?: Function }} deps
 * @returns {Promise<number>} 終了コード
 */
export async function main(argv, deps = {}) {
  const out = deps.out ?? consoleOut;
  const env = deps.env ?? process.env;
  try {
    const args = parseCliArgs(argv);
    if (args.help) {
      out.info(USAGE);
      return 0;
    }
    const config = readRuntimeConfig(env);
    const root = path.resolve(args.root ?? deps.root ?? process.cwd());
    const only = await resolveScope(args, root, deps, out);
    const plan = await buildPlan({
      root,
      collections: args.collections ?? [...COLLECTION_NAMES],
      langs: args.langs ?? [...TARGET_LANGS],
      only,
    });
    assertOnlyMatched(args.only, plan.items);
    const ctx = {
      dryRun: args['dry-run'],
      out,
      config,
      now: deps.now ?? (() => new Date()),
      redact: redactWith(env),
      createClient: deps.createClient ?? defaultClientFactory(config, env, out),
      writeFile: deps.writeFile ?? writeFileAtomic,
      removeFile: deps.removeFile ?? removeFile,
    };
    if (args.write)
      return await runWrite({ plan, retranslateUntracked: args['retranslate-untracked'], ctx });
    if (args.adopt) return await runAdopt({ plan, ctx });
    return runCheck({ plan, out });
  } catch (err) {
    out.error(`エラー: ${redactWith(env)(err.message)}`);
    return 2;
  }
}
