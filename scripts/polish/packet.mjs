/**
 * エージェントに渡す推敲パケット。規則の本文は含めない。
 */

import { SCENE_HEADINGS, YOMIYASU_FOR_SCENE } from './voice.mjs';

/**
 * @param {object} packet
 */
export function renderPacket(packet) {
  const yomi = YOMIYASU_FOR_SCENE[packet.scene];
  const lines = [
    '# 推敲パケット',
    '',
    `- file: ${packet.file}`,
    `- locked_scene: ${packet.scene}`,
    `- scene_source: ${packet.sceneSource}`,
    `- voice_switched: ${packet.voiceSwitched ? 'true' : 'false'}`,
    `- instruction_effect: ${packet.instructionEffect}`,
    '- do_not_switch_voice: true',
    '',
    '規則の本文は次のファイルを読む。このパケットには写さない。',
    '',
    '- yomiyasu: `.claude/skills/yomiyasu/SKILL.md`',
    `- cor-voice: \`.claude/skills/cor-voice/SKILL.md\`（見出し: ${SCENE_HEADINGS[packet.scene]}）`,
    '- 手順: `skills/article-polish/SKILL.md`',
    '',
    '## yomiyasu に渡す値',
    '',
    `- doc-type: ${yomi.docType}`,
    `- reader: ${yomi.reader}`,
    `- stance: ${yomi.stance ?? '（指定しない）'}`,
    '',
    '## 人間の指示',
    '',
  ];
  if (!packet.instruction) {
    lines.push('なし。場面は既定のままにする。');
  } else {
    lines.push(`記録: \`${packet.instruction.rel}\``);
    if (packet.instruction.issue) lines.push(`issue: ${packet.instruction.issue}`);
    lines.push('');
    lines.push(packet.instruction.text);
  }
  lines.push('', '## 学習した見本', '');
  if (packet.learned.length === 0) {
    lines.push('なし。公開済みの記事が、次の見本になる。');
  } else {
    lines.push('採用済みの抜粋です。事実と数値は写さない。');
    for (const item of packet.learned) {
      lines.push('', `### ${item.rel}`, '', `出典: ${item.source}`, '', item.note || '（メモなし）');
    }
  }
  if (packet.unreadableLearned.length > 0) {
    lines.push('', `読めなかった学習ファイル: ${packet.unreadableLearned.join(', ')}`);
  }
  lines.push('', '## 公開記事の見本', '', '文体だけを見る。見本の事実・数値・固有名詞は、新しい記事に写さない。', '');
  if (packet.exemplars.length === 0) {
    lines.push('同じ場面の公開記事は、まだ見本にできるものがありません。');
  } else {
    for (const item of packet.exemplars) {
      lines.push(`### ${item.rel}`, '', `- title: ${item.title}`, `- date: ${item.date}`, '', item.opening);
      if (item.closing) lines.push('', item.closing);
      lines.push('');
    }
  }
  lines.push('## 原稿の機械検査', '');
  if (packet.findings.length === 0) {
    lines.push('指摘なし。この結果は、推敲が終わったことを意味しません。');
  } else {
    for (const finding of packet.findings) {
      lines.push(`- ${finding.severity} ${finding.rule} ${finding.where}: ${finding.match} — ${finding.detail}`);
    }
  }
  lines.push(
    '',
    '## 次に実行すること',
    '',
    '1. yomiyasu の手順で推敲し、上の locked_scene の cor-voice を当てる。',
    '2. 最終稿をファイルに書く。原文は、人間が置き換えを頼むまで残す。',
    `3. \`npm run polish -- check --file ${packet.file} --final <最終稿>\` を実行する。`,
    '4. 終了コードが 0 で、complete が true になるまで、推敲が終わったと書かない。',
    '',
  );
  return lines.join('\n');
}
