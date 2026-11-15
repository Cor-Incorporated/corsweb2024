// 演出（data-reveal）の「隠れている間のずれと縮み」は、src/layouts/Layout.astro の CSS と script の 2 か所にある。
// CSS は見た目を決め、script は「窓の中」の判定をその分だけ下へ広げる。片方だけ変えると、窓の中に在るのに
// 透明のまま残る要素が出るので、両方を読んで照らす。
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const LAYOUT = path.resolve('src/layouts/Layout.astro');

function readHiddenTransform(source: string) {
  const rule = source.match(/html\.js \[data-reveal\]\.reveal-ready\s*\{([^}]*)\}/);
  expect(rule, 'CSS に html.js [data-reveal].reveal-ready の規則が無い').not.toBeNull();
  const transform = rule![1].match(/transform:\s*translateY\(([\d.]+)rem\)\s*scale\(([\d.]+)\)/);
  expect(transform, `reveal-ready の transform が translateY(…rem) scale(…) の形でない: ${rule![1].trim()}`).not.toBeNull();
  return { shiftRem: Number(transform![1]), scale: Number(transform![2]) };
}

function readScriptConstants(source: string) {
  const shift = source.match(/const REVEAL_SHIFT_REM = ([\d.]+);/);
  const scale = source.match(/const REVEAL_SCALE = ([\d.]+);/);
  expect(shift, 'script に REVEAL_SHIFT_REM が無い').not.toBeNull();
  expect(scale, 'script に REVEAL_SCALE が無い').not.toBeNull();
  return { shiftRem: Number(shift![1]), scale: Number(scale![1]) };
}

describe('Layout.astro の演出: 隠れている間のずれと縮み', () => {
  it('CSS の transform と、script の判定に使う値が同じ', () => {
    const source = readFileSync(LAYOUT, 'utf8');
    const css = readHiddenTransform(source);
    const script = readScriptConstants(source);
    expect(
      script,
      `CSS は translateY(${css.shiftRem}rem) scale(${css.scale})、script は REVEAL_SHIFT_REM=${script.shiftRem}・REVEAL_SCALE=${script.scale}`,
    ).toEqual(css);
  });
});
