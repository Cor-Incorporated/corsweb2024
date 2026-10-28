#!/usr/bin/env node
/**
 * 記事とニュースの推敲ゲート。
 *
 *   npm run polish -- prepare --file src/content/blog/ja/<slug>.md
 *   npm run polish -- check --file <原文> --final <最終稿>
 *   npm run polish -- instruction --file <ja> --text '<人間の文言>'
 *   npm run polish -- learn --file <ja> --approved --note '<残すこと>'
 *
 * どのエージェントからも同じコマンドを使う。規則の本文は yomiyasu と cor-voice に置く。
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument } from '../i18n/frontmatter.mjs';
import { listCorpus, locateArticle, pickExemplars } from './corpus.mjs';
import {
  clearInstruction,
  listLearned,
  pickLearned,
  readInstruction,
  writeInstruction,
  writeLearned,
} from './memory.mjs';
import { renderPacket } from './packet.mjs';
import { scanGuardrails, scanVoice } from './scan.mjs';
import { PolishError, SCENE_HEADINGS, YOMIYASU_FOR_SCENE, resolveVoice } from './voice.mjs';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function defaultRepo() {
  return fileURLToPath(new URL('../..', import.meta.url));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * @param {string[]} argv
 */
export function parseArgs(argv) {
  const [command, ...rest] = argv;
  /** @type {Record<string, string | boolean | null>} */
  const opts = {
    command: command ?? 'help',
    file: null,
    final: null,
    repo: null,
    out: null,
    text: null,
    textFile: null,
    note: '',
    issue: null,
    date: null,
    json: false,
    approved: false,
    clear: false,
    noYomiyasu: false,
  };
  const take = (name, index) => {
    const value = rest[index + 1];
    if (!value || value.startsWith('--')) {
      throw new PolishError(`${name} には値が必要です`, { exitCode: 2, code: 'USAGE' });
    }
    return value;
  };
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    switch (arg) {
      case '--file':
        opts.file = take(arg, i);
        i += 1;
        break;
      case '--final':
        opts.final = take(arg, i);
        i += 1;
        break;
      case '--repo':
        opts.repo = take(arg, i);
        i += 1;
        break;
      case '--out':
        opts.out = take(arg, i);
        i += 1;
        break;
      case '--text':
        opts.text = take(arg, i);
        i += 1;
        break;
      case '--text-file':
        opts.textFile = take(arg, i);
        i += 1;
        break;
      case '--note':
        opts.note = take(arg, i);
        i += 1;
        break;
      case '--issue':
        opts.issue = take(arg, i);
        i += 1;
        break;
      case '--date':
        opts.date = take(arg, i);
        i += 1;
        break;
      case '--json':
        opts.json = true;
        break;
      case '--approved':
        opts.approved = true;
        break;
      case '--clear':
        opts.clear = true;
        break;
      case '--no-yomiyasu':
        opts.noYomiyasu = true;
        break;
      case '--help':
      case '-h':
        opts.command = 'help';
        break;
      default:
        throw new PolishError(`不明な引数です: ${arg}`, { exitCode: 2, code: 'USAGE' });
    }
  }
  if (opts.date != null && !DATE_RE.test(String(opts.date))) {
    throw new PolishError('--date は YYYY-MM-DD です', { exitCode: 2, code: 'USAGE' });
  }
  return opts;
}

function helpText() {
  return `使い方: npm run polish -- <prepare|check|instruction|learn> [オプション]

  prepare      場面、見本、人間の指示をまとめたパケットを出す
  check        最終稿を、固定した場面と表現ルールで検査する
  instruction  人間の指示文を記録する。場面が変わるのは明示の印があるときだけ
  learn        採用した記事の抜粋を、レビューできる見本として残す

オプション:
  --file <ja.md>       blog か news の ja
  --final <最終稿.md>  check のとき。原文と別のファイル
  --text <文言>        instruction の、人間が書いた文言
  --text-file <path>   その文言をファイルから読む
  --issue <番号>       voice-feedback の Issue 番号（任意）
  --clear              記録した指示を消す（人間が頼んだときだけ）
  --approved           learn に必須
  --note <メモ>        learn で、次も残す書き方
  --date YYYY-MM-DD    記録の日付（省略時は今日）
  --json               機械が読む JSON
  --out <path>         prepare の Markdown を書く
  --no-yomiyasu        yomiyasu の検査を呼ばない（完了にはならない）
  --repo <path>        リポジトリのルート（テスト用）

場面を切り替える印は、指示文の中の次だけです。
  scene: company | founder | technical | story
  会社として書く / 代表の名前で書く / 技術の記事として書く / ストーリーとして書く
`;
}

function requireFile(opts) {
  if (!opts.file) throw new PolishError('--file が必要です', { exitCode: 2, code: 'USAGE' });
  return locateArticle(String(opts.repo), String(opts.file));
}

function loadRaw(abs) {
  return readFileSync(abs, 'utf8');
}

function partsOf(raw) {
  const parsed = parseDocument(raw);
  const category = typeof parsed.data.category === 'string' ? parsed.data.category : undefined;
  return {
    data: parsed.data,
    category,
    fields: {
      title: typeof parsed.data.title === 'string' ? parsed.data.title : '',
      description: typeof parsed.data.description === 'string' ? parsed.data.description : '',
      summary: typeof parsed.data.summary === 'string' ? parsed.data.summary : '',
    },
    body: parsed.body,
  };
}

function voiceFor(repo, article, parts) {
  const instruction = readInstruction(repo, article.collection, article.slug);
  const voice = resolveVoice({
    collection: article.collection,
    category: parts.category,
    instructionText: instruction?.text ?? '',
  });
  return { instruction, voice };
}

/**
 * @param {Record<string, string | boolean | null>} opts
 */
export function prepare(opts) {
  const repo = String(opts.repo);
  const article = requireFile(opts);
  const raw = loadRaw(article.abs);
  const parts = partsOf(raw);
  const { instruction, voice } = voiceFor(repo, article, parts);
  const learnedAll = listLearned(repo);
  const learned = pickLearned(learnedAll, voice.scene);
  const learnedSources = new Set(learned.map((item) => item.source));
  const exemplars = pickExemplars({
    corpus: listCorpus(repo).filter((item) => !learnedSources.has(item.rel)),
    targetRel: article.rel,
    scene: voice.scene,
    category: parts.category,
  });
  const packet = {
    file: article.rel,
    scene: voice.scene,
    sceneSource: voice.sceneSource,
    voiceSwitched: voice.voiceSwitched,
    instructionEffect: voice.instructionEffect,
    heading: SCENE_HEADINGS[voice.scene],
    yomiyasu: YOMIYASU_FOR_SCENE[voice.scene],
    instruction: instruction
      ? { rel: instruction.rel, issue: instruction.issue, text: instruction.text }
      : null,
    learned: learned.map((item) => ({
      rel: item.rel,
      source: item.source,
      learnedAt: item.learnedAt,
      note: item.note,
    })),
    unreadableLearned: learnedAll.filter((item) => item.unreadable).map((item) => item.rel),
    exemplars: exemplars
      .filter((item) => !learnedSources.has(item.rel))
      .map((item) => ({
        rel: item.rel,
        title: item.title,
        date: item.date,
        opening: item.opening,
        closing: item.closing,
      })),
    findings: [
      ...scanGuardrails(raw),
      ...scanVoice({ scene: voice.scene, fields: parts.fields, body: parts.body }),
    ],
  };
  const markdown = renderPacket(packet);
  if (opts.out) writeFileSync(path.resolve(repo, String(opts.out)), markdown);
  return { packet, markdown };
}

function runYomiyasu(repo, sourceAbs, finalAbs, scene) {
  const script = path.join(repo, '.claude/skills/yomiyasu/scripts/yomiyasu_check.py');
  const spec = YOMIYASU_FOR_SCENE[scene];
  const args = [
    '-B',
    '-I',
    script,
    'run',
    '--source',
    sourceAbs,
    '--final',
    finalAbs,
    '--doc-type',
    spec.docType,
    '--reader',
    spec.reader,
    '--fact-gaps',
  ];
  if (spec.stance) args.push('--stance', spec.stance);
  const run = spawnSync('python3', args, { cwd: repo, encoding: 'utf8' });
  if (run.error && run.error.code === 'ENOENT') {
    throw new PolishError('python3 が無いため、yomiyasu の検査を実行できません', {
      exitCode: 3,
      code: 'NO_PYTHON',
    });
  }
  if (run.status !== 0) {
    throw new PolishError(
      `yomiyasu の検査が終了コード ${run.status} で終わりました\n${run.stdout ?? ''}\n${run.stderr ?? ''}`,
      { exitCode: run.status === 2 ? 2 : 3, code: 'YOMIYASU' },
    );
  }
  const verify = spawnSync('python3', ['-B', '-I', script, 'verify', '--final', finalAbs], {
    cwd: repo,
    encoding: 'utf8',
  });
  if (verify.status !== 0) {
    throw new PolishError(
      `yomiyasu の最終稿の照合が終了コード ${verify.status} で終わりました\n${verify.stdout ?? ''}\n${verify.stderr ?? ''}`,
      { exitCode: 3, code: 'YOMIYASU_VERIFY' },
    );
  }
  return {
    status: 'ran',
    runStatusLine: (run.stdout ?? '').split('\n').find((line) => line.startsWith('yomiyasu-check:')) ?? '',
    verifyStatusLine: (verify.stdout ?? '').split('\n').find((line) => line.startsWith('yomiyasu-check:')) ?? '',
  };
}

/**
 * @param {Record<string, string | boolean | null>} opts
 */
export function check(opts) {
  const repo = String(opts.repo);
  const article = requireFile(opts);
  const sourceRaw = loadRaw(article.abs);
  const sourceParts = partsOf(sourceRaw);
  const { voice } = voiceFor(repo, article, sourceParts);
  const targetRaw = opts.final ? loadRaw(path.resolve(repo, String(opts.final))) : sourceRaw;
  let targetParts;
  try {
    targetParts = partsOf(targetRaw);
  } catch (error) {
    throw new PolishError(`最終稿の frontmatter を読めません: ${error.message}`, {
      exitCode: 2,
      code: 'FINAL',
    });
  }
  const findings = [
    ...scanGuardrails(targetRaw),
    ...scanVoice({
      scene: voice.scene,
      fields: targetParts.fields,
      body: targetParts.body,
      sourceFields: opts.final ? sourceParts.fields : null,
      sourceBody: opts.final ? sourceParts.body : null,
    }),
  ];
  /** @type {{ status: string, runStatusLine?: string, verifyStatusLine?: string, reason?: string }} */
  let yomiyasu;
  if (!opts.final) {
    yomiyasu = { status: 'not_run', reason: 'no_final' };
  } else if (opts.noYomiyasu) {
    yomiyasu = { status: 'not_run', reason: 'disabled' };
    findings.push({
      rule: 'yomiyasu-skipped',
      severity: 'warn',
      where: 'check',
      match: '--no-yomiyasu',
      detail: 'yomiyasu を呼んでいないので、この検査は完了になりません',
    });
  } else {
    yomiyasu = runYomiyasu(repo, article.abs, path.resolve(repo, String(opts.final)), voice.scene);
  }
  const fails = findings.filter((item) => item.severity === 'fail');
  const result = {
    file: article.rel,
    scene: voice.scene,
    sceneSource: voice.sceneSource,
    voiceSwitched: voice.voiceSwitched,
    complete: Boolean(opts.final) && !opts.noYomiyasu && fails.length === 0 && yomiyasu.status === 'ran',
    findings,
    yomiyasu,
  };
  if (fails.length > 0) {
    const error = new PolishError(
      fails.map((item) => `${item.rule} ${item.where}: ${item.match}`).join('\n'),
      { exitCode: 1, code: 'CHECK' },
    );
    error.result = result;
    throw error;
  }
  return result;
}

/**
 * @param {Record<string, string | boolean | null>} opts
 */
export function instruction(opts) {
  const repo = String(opts.repo);
  const article = requireFile(opts);
  const recordedAt = String(opts.date ?? today());
  if (opts.clear) {
    const removed = clearInstruction(repo, article.collection, article.slug);
    return { cleared: removed, file: article.rel };
  }
  let text = opts.text == null ? '' : String(opts.text);
  if (opts.textFile) text = readFileSync(path.resolve(repo, String(opts.textFile)), 'utf8');
  const rel = writeInstruction({
    repo,
    collection: article.collection,
    slug: article.slug,
    text,
    issue: opts.issue ? String(opts.issue) : null,
    recordedAt,
  });
  const parts = partsOf(loadRaw(article.abs));
  const voice = resolveVoice({
    collection: article.collection,
    category: parts.category,
    instructionText: text,
  });
  return {
    rel,
    scene: voice.scene,
    sceneSource: voice.sceneSource,
    voiceSwitched: voice.voiceSwitched,
    instructionEffect: voice.instructionEffect,
  };
}

/**
 * @param {Record<string, string | boolean | null>} opts
 */
export function learn(opts) {
  const repo = String(opts.repo);
  const article = requireFile(opts);
  const raw = loadRaw(article.abs);
  const parts = partsOf(raw);
  const { voice } = voiceFor(repo, article, parts);
  const rel = writeLearned({
    repo,
    article,
    scene: voice.scene,
    raw,
    note: String(opts.note ?? ''),
    learnedAt: String(opts.date ?? today()),
    approved: Boolean(opts.approved),
  });
  return { rel, scene: voice.scene, source: article.rel };
}

function printResult(opts, value, markdown) {
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
    return;
  }
  if (markdown) {
    process.stdout.write(markdown.endsWith('\n') ? markdown : `${markdown}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function main(argv = process.argv.slice(2)) {
  try {
    const opts = parseArgs(argv);
    if (!opts.repo) opts.repo = defaultRepo();
    switch (opts.command) {
      case 'help':
      case '--help':
      case '-h':
        process.stdout.write(helpText());
        return 0;
      case 'prepare': {
        const { packet, markdown } = prepare(opts);
        printResult(opts, packet, opts.json ? null : markdown);
        return 0;
      }
      case 'check': {
        const result = check(opts);
        printResult(opts, result, null);
        return 0;
      }
      case 'instruction': {
        const result = instruction(opts);
        printResult(opts, result, null);
        return 0;
      }
      case 'learn': {
        const result = learn(opts);
        printResult(opts, result, null);
        return 0;
      }
      default:
        throw new PolishError(`不明なコマンドです: ${opts.command}\n${helpText()}`, {
          exitCode: 2,
          code: 'USAGE',
        });
    }
  } catch (error) {
    if (error instanceof PolishError) {
      process.stderr.write(`${error.message}\n`);
      if (error.result) process.stdout.write(`${JSON.stringify(error.result, null, 2)}\n`);
      return error.exitCode;
    }
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    return 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  process.exit(main());
}
