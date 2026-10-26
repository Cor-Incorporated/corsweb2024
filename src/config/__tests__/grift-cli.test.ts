// @vitest-environment node
/**
 * Grift CLI の版の正本（src/config/grift-cli-release.json、ADR-0023）を、サイトの側（src/config/grift-cli.ts、Zod）と
 * スクリプトの側（scripts/lib/grift-cli-release.mjs、照合の workflow が Node の組み込みだけで読む）の両方が、
 * 同じように受け付け、同じように拒むことを照合する。片方だけ形を変えると、両方の結果を出して落ちる。
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GRIFT_CLI_RELEASE, griftCliReleaseSchema } from '../grift-cli';
import { GRIFT_CLI_GITHUB_URL } from '../site';
import { readRelease, releaseNotesUrl, validateRelease } from '../../../scripts/lib/grift-cli-release.mjs';

const ROOT = process.cwd();
const json = JSON.parse(readFileSync(path.join(ROOT, 'src/config/grift-cli-release.json'), 'utf8'));

const accepts = (value: unknown) => ({
  site: griftCliReleaseSchema.safeParse(value).success,
  script: (() => {
    try {
      validateRelease(value);
      return true;
    } catch {
      return false;
    }
  })(),
});

describe('Grift CLI の版の正本', () => {
  it('サイトとスクリプトが同じ JSON から同じ値を読む', () => {
    expect(GRIFT_CLI_RELEASE.version).toBe(json.version);
    expect(GRIFT_CLI_RELEASE.releasedOn).toBe(json.releasedOn);
    expect(readRelease(ROOT)).toEqual({ version: json.version, releasedOn: json.releasedOn });
  });

  it('リリースノートの URL を両側で同じに作る', () => {
    expect(GRIFT_CLI_RELEASE.releaseNotesUrl).toBe(releaseNotesUrl(json.version));
    expect(GRIFT_CLI_RELEASE.releaseNotesUrl).toBe(`${GRIFT_CLI_GITHUB_URL}/releases/tag/v${json.version}`);
  });

  it.each([
    [{ version: '0.8.0', releasedOn: '2026-10-26' }, true],
    [{ version: '0.10.12', releasedOn: '2027-01-05' }, true],
    [{ version: 'v0.8.0', releasedOn: '2026-10-26' }, false],
    [{ version: '0.8', releasedOn: '2026-10-26' }, false],
    [{ version: '0.08.0', releasedOn: '2026-10-26' }, false],
    [{ version: '0.8.0', releasedOn: '2026/10/26' }, false],
    [{ version: '0.8.0' }, false],
    [{ version: '0.8.0', releasedOn: '2026-10-26', note: 'x' }, false],
  ])('%j を受け付けるかは両側で同じ（%s）', (value, expected) => {
    expect(accepts(value)).toEqual({ site: expected, script: expected });
  });
});
