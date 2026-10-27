---
title: "Grift CLIのレポートの先頭に、面談で確かめたいことを書くようにしました（0.9.0）"
description: "Grift CLIの0.9.0を2026年10月27日に公開しました。本人が名乗ったIDで同意の記録があるときだけ、レポートの先頭に、記録から見える仕事の進め方と、面談で確かめたいことを短い文で書きます。点数・順位・タイプ名はこれまでどおり出しません。"
publishedAt: 2026-10-27
category: "update"
tags: ["Grift", "OSS", "プロダクト"]
source: "Grift"
isDraft: false
featured: false
lang: "ja"
---

## 0.9.0で変わったこと

Cor.株式会社は2026年10月27日に、Grift CLIの[0.9.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.0)を公開しました。点数・順位・タイプ名はこれまでどおり出しません。

`grift actor`・`grift project`・`grift align`のMarkdownの先頭に、記録から見える仕事の進め方を短い文で書きます。変えた部分の区分、変更のペース、テストの付け方、関わり方について、件数と期間を添えて書き、続けて、この記録では見えないことを書き、面談で確かめたいことを問いの形で並べます。文は公開した[決定表](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.0/docs/trait-profile.md)で数字から選びます。AIは使わず、JSONには入れません。

人についての文と問いは、本人が名乗ったIDで、同意の記録があるときだけ出します。それ以外は、出していない理由を1文で書きます。面談の問いは候補者本人に聞くことを具体にするための材料です。合否や順位を決めるためのものではありません。

傾向の「強さ」の行と、照らし合わせの「向き」の行は、Markdownから外しました。2つのレポートを並べると、強い人・弱い人、合う人・合わない人に読めるためです。あわせて、人について事実と違う数が出うる箇所を4つ直しました。直した箇所は[リリースノート](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.0)にあります。

## 更新の前に

0.8.0で保存したレポート（`analyze`・`actor`・`repo`）と照らし合わせは、定義の版が変わったため、0.9.0の`grift verify`では「確かめられない（`CANNOT_VERIFY`）」になります。projectのレポートは「不一致（`MISMATCH`）」になります。0.9.0で作り直してください。詳しくは[移行の注意](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.0/docs/migration-v090.md)にあります。

```bash
pipx upgrade grift-cli
```

Griftの考え方と開発の経緯は、[Griftの事例ページ](/works/grift)にまとめています。
