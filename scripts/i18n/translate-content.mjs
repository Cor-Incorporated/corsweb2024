#!/usr/bin/env node
/**
 * ja を正本に en/zh/ko/es の翻訳を検査・生成する（ADR-0019 / docs/i18n-translation.md）。
 *
 *   npm run i18n:check                       # 検査のみ（API キー不要）
 *   npm run i18n:translate                   # 不足・古い翻訳を翻訳して書き込む
 *   npm run i18n:translate -- --dry-run      # 何をするかだけ表示
 */
import { main } from './cli.mjs';

// `| head` などで出力先が先に閉じられても異常終了しない（終了コードは処理結果のまま）。
for (const stream of [process.stdout, process.stderr]) {
  stream.on('error', (err) => {
    if (err.code !== 'EPIPE') throw err;
  });
}

process.exitCode = await main(process.argv.slice(2));
