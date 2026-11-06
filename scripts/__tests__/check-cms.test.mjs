// @vitest-environment node
/**
 * npm run check:cms と同じ照合。config.yml を片側だけ変えると、契約の値と並べて落ちる。
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { collectCmsDrift, configDrift, loadCmsContract } from '../check-cms.mjs';

const configPath = path.join(process.cwd(), 'cms/public/config.yml');

describe('CMS 契約（scripts/check-cms.mjs）', () => {
  it('config.yml・認証 Worker・版の固定が cms-contract と一致する', async () => {
    expect(await collectCmsDrift()).toEqual([]);
  });

  it('Node 20 と同じ transpile 経路でも一致する', async () => {
    process.env.CMS_CONTRACT_TRANSPILE = '1';
    try {
      expect(await collectCmsDrift()).toEqual([]);
    } finally {
      delete process.env.CMS_CONTRACT_TRANSPILE;
    }
  });

  it('タイトルの表示名だけ変えると、両側の値が出る', async () => {
    const contract = await loadCmsContract();
    const config = structuredClone(yaml.load(readFileSync(configPath, 'utf8')));
    config.collections[0].fields[0].label = '題名';
    const message = configDrift(config, contract).join('\n');
    expect(message).toContain('題名');
    expect(message).toContain('タイトル');
    expect(message).toContain('cms-contract');
  });

  it('ブログの delete を false にすると落ちる', async () => {
    const contract = await loadCmsContract();
    const config = structuredClone(yaml.load(readFileSync(configPath, 'utf8')));
    config.collections[0].delete = false;
    const message = configDrift(config, contract).join('\n');
    expect(message).toContain('delete');
    expect(message).toContain('false');
    expect(message).toContain('true');
  });
});
