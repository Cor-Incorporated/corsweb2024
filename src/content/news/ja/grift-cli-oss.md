---
title: "git履歴から確かめられる事実を取り出す「Grift CLI」をOSSとして公開しています"
description: "自社プロダクトGriftのコマンドラインツール「Grift CLI」を、MITライセンスのOSSとしてPyPIとGitHubで公開しています。点数や順位はつけず、誰が実行しても同じ結果になります。"
publishedAt: 2026-10-20
category: "update"
tags: ["Grift", "OSS", "プロダクト"]
source: "Grift"
isDraft: false
featured: true
lang: "ja"
---

## Grift CLI の公開

Cor.株式会社は自社プロダクト「Grift」のコマンドラインツール「Grift CLI」を、MITライセンスのOSSとして公開しています。2026年9月8日に PyPI で v0.7.2 を公開しました。

Grift CLI はエンジニアのgit履歴から「確かめられる事実（検査値）」を取り出すツールです。キャッチコピーは「経歴は盛れる。証拠は盛れない。」です。

## 3つの約束

- 点数にしない: 合成スコア・順位・合否は出しません。数値には必ず分子と分母を付けます
- 毎回同じ結果: 計測にAI（LLM）を使わないため、同じリポジトリ・同じバージョンなら誰が実行しても同じ数値になります。保存したレポートは `grift verify` で再計算して検算できます
- どこにも送らない: 手元のPCだけで動きます。共有するかどうかは本人が決めます

## 使い方

Python 3.11以上の環境で、次のコマンドから始められます。

```bash
pipx install grift-cli
cd your-repo
grift report
grift verify
```

- GitHub: [github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- PyPI: [pypi.org/project/grift-cli](https://pypi.org/project/grift-cli/)

## 方針の変更

Griftは2026年2月に受託開発の見積を支えるWebアプリとして始まりました。2026年8月に計測の部分をCLIとして切り出し、9月に旧Webアプリの提供を終了しています。以前ご案内していた Team Beta などのプランは、2026年10月に取り下げました。

いまは、人材紹介会社・SESの営業が推薦の理由を根拠とともに伝えるための、テスト導入（PoC）のご相談を受け付けています。詳しくは [Griftの事例ページ](/works/grift) をご覧ください。
