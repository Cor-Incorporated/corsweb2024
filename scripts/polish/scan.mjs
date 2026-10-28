/**
 * 場面に対する機械的な検査。意味の推敲は yomiyasu に任せ、ここでは
 * 表現ルールと、場面をまたぐ一人称・感嘆符だけを見る。
 */

import { scanForViolations } from '../blog-guardrails.mjs';
import { stripCode, stripUrls } from './corpus.mjs';

/**
 * @typedef {{ rule: string, severity: 'fail' | 'warn', where: string, match: string, detail: string }} Finding
 */

const FIRST_PERSON = /(僕|私)(は|が|の|も|って|です)/g;
const EXCLAIM = /[！!]/g;
const TRIAL = /試行(?!錯誤)/g;
const GUARANTEE = /確実に|絶対(?:に)?|必ず(?!しも)/g;
const BAD_NAME = /Cor株式会社|Cor\.inc(?!orporated)/gi;

function reset(re) {
  re.lastIndex = 0;
  return re;
}

/**
 * @param {string} text
 * @param {RegExp} re
 * @returns {string[]}
 */
export function matchesOf(text, re) {
  return [...text.matchAll(reset(re))].map((match) => match[0]);
}

/** 検査にかける公開文。コードと URL は除く。 */
export function visibleProse(rawBody) {
  return stripUrls(stripCode(rawBody));
}

/**
 * @param {string} prose
 * @param {string} where
 * @param {RegExp} re
 * @param {Omit<Finding, 'where' | 'match'>} meta
 * @returns {Finding[]}
 */
function findingsIn(prose, where, re, meta) {
  return matchesOf(prose, re).map((match) => ({ ...meta, where, match }));
}

/**
 * @param {{ scene: string, fields: Record<string, string>, body: string, sourceFields?: Record<string, string> | null, sourceBody?: string | null }} input
 * @returns {Finding[]}
 */
export function scanVoice(input) {
  /** @type {Finding[]} */
  const findings = [];
  const parts = [
    ['title', input.fields.title ?? ''],
    ['description', input.fields.description ?? ''],
    ['summary', input.fields.summary ?? ''],
    ['body', input.body],
  ];
  const sourceParts = input.sourceBody == null
    ? null
    : [
        ['title', input.sourceFields?.title ?? ''],
        ['description', input.sourceFields?.description ?? ''],
        ['summary', input.sourceFields?.summary ?? ''],
        ['body', input.sourceBody],
      ];

  const sourceProse = sourceParts
    ? sourceParts.map(([, text]) => visibleProse(text)).join('\n')
    : null;
  const finalProse = parts.map(([, text]) => visibleProse(text)).join('\n');

  for (const [where, text] of parts) {
    const prose = visibleProse(text);
    if (input.scene !== 'story') {
      findings.push(
        ...findingsIn(prose, where, EXCLAIM, {
          rule: 'exclamation',
          severity: 'fail',
          detail: '感嘆符は会社の文章にも代表の名前の文章にも入れません',
        }),
      );
    }
    if (input.scene === 'company' || input.scene === 'technical') {
      findings.push(
        ...findingsIn(prose, where, FIRST_PERSON, {
          rule: 'first-person',
          severity: 'fail',
          detail: 'この場面の主語は会社か製品です。僕・私は使いません',
        }),
      );
    }
    findings.push(
      ...findingsIn(prose, where, TRIAL, {
        rule: 'trial-word',
        severity: 'fail',
        detail: '取り組みの呼び方は「テスト導入（PoC）」です。試行とは書きません',
      }),
    );
    findings.push(
      ...findingsIn(prose, where, BAD_NAME, {
        rule: 'company-name',
        severity: 'fail',
        detail: '社名は「Cor.株式会社」です',
      }),
    );
  }

  if (input.scene === 'founder') {
    const hasBoku = matchesOf(finalProse, FIRST_PERSON).some((match) => match.startsWith('僕'));
    const hasWatashi = matchesOf(finalProse, FIRST_PERSON).some((match) => match.startsWith('私'));
    if (hasBoku && hasWatashi) {
      findings.push({
        rule: 'mixed-person',
        severity: 'fail',
        where: 'prose',
        match: '僕 / 私',
        detail: '一つの文章で僕と私を混ぜません',
      });
    }
  }

  const guaranteeFinal = matchesOf(finalProse, GUARANTEE);
  const guaranteeSource = sourceProse == null ? [] : matchesOf(sourceProse, GUARANTEE);
  const extra = guaranteeFinal.length - guaranteeSource.length;
  if (extra > 0) {
    findings.push({
      rule: 'guarantee',
      severity: 'fail',
      where: 'prose',
      match: guaranteeFinal.slice(guaranteeSource.length).join(', ') || guaranteeFinal.join(', '),
      detail: '確実に・必ず・絶対は、原文に無かったものを足しません',
    });
  } else if (guaranteeFinal.length > 0 && sourceProse == null) {
    findings.push({
      rule: 'guarantee',
      severity: 'warn',
      where: 'prose',
      match: [...new Set(guaranteeFinal)].join(', '),
      detail: '確実に・必ず・絶対があります。原文に元からある場合は、推敲で増やさないでください',
    });
  }

  return findings;
}

/**
 * blog-guardrails は記事全体（frontmatter を含む）を見る。
 * @param {string} markdown
 * @returns {Finding[]}
 */
export function scanGuardrails(markdown) {
  return scanForViolations(markdown).map((item) => ({
    rule: `guardrail:${item.name}`,
    severity: 'fail',
    where: `L${item.line}`,
    match: item.match,
    detail: item.reason,
  }));
}
