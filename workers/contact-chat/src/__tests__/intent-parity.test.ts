import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AUTO_HANDOFF_INTENTS, CONTACT_INTENTS } from '../types';

/**
 * Worker の CONTACT_INTENTS がサイト側 src/config/site.ts と同値であること。
 * monorepo 共有 import を避けているため、静的パリティでドリフトを防ぐ（ADR-0014 / #250）。
 */
describe('CONTACT_INTENTS parity with src/config/site.ts', () => {
  it('配列が site.ts の CONTACT_INTENTS と一致する', () => {
    const sitePath = resolve(__dirname, '../../../../src/config/site.ts');
    const src = readFileSync(sitePath, 'utf8');
    const m = src.match(/export const CONTACT_INTENTS = \[([\s\S]*?)\] as const/);
    expect(m).toBeTruthy();
    const keys = [...m![1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    expect(keys).toEqual([...CONTACT_INTENTS]);
  });

  it('AUTO_HANDOFF_INTENTS は横断契約の4 intent', () => {
    expect([...AUTO_HANDOFF_INTENTS]).toEqual([
      'contract-dev',
      'grift-team-beta',
      'grift-paid-trial',
      'estimate-audit',
    ]);
  });
});
