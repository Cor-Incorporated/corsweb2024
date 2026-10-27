---
title: "Grift —— 履历可以夸大，证据无法伪造。从 git 提交记录中提取可证实事实的开源软件"
description: "自研产品 Grift 可从工程师的 git 提交记录中提取可证实的事实（检查值），而非给出主观评分。本文将介绍该产品从估价辅助 Web 应用转变为面向猎头及 SES 企业的推荐辅助开源 CLI 工具的历程与设计理念。"
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "人才中介", "SES", "招聘"]
publishedAt: 2026-06-30
updatedAt: 2026-10-27
summary: "Grift 是一款能够从工程师的 git 提交记录中提取“可证实事实”的自研产品。它不打分也不排名。由于在衡量过程中不使用 AI（LLM），任何人运行都能得到相同的结果，接收方也可进行验算。该 CLI 工具已作为遵循 MIT 许可证的开源软件公开。"
isDraft: false
featured: true
lang: "zh"
translationSourceHash: "2d0234e5c92330288c63b5013c89e63f3ced54357eaa2a69eb5d59ba4b7873bc"
translatedAt: "2026-10-27T13:43:12.719Z"
translationModel: "gemini-3.8-flash"
---

<!--
執筆ガイドライン（terisuke向け）:
本文は以下の4見出しで構成してください。各 ## はそのまま記事内に表示されます。
  ## 課題      — 顧客が抱えていた問題・背景
  ## アプローチ — どう考え、どんな方針で臨んだか
  ## 実装      — 実際に作ったもの・技術的なポイント
  ## 成果      — 結果・効果（数値があれば具体的に。NDA案件は抽象化し securityNote を設定）
NDA・機密案件では具体名や数値をぼかし、frontmatter の securityNote を有効化してください。
2026-10-20: 見積支援Webアプリ時代の本文を、CLI への方針転換後の内容に書き換えた（ADR-0022）。
2026-10-25: 観測の層を report-v2（作業領域・変更リズム・検証の形・役割）と grift project / align まで広げ、サイトの訳語と CLI の語の対応表を置いた。
2026-10-26: 「実装」に TEP の 4 つの段階の平易な説明と、griftai.org の TEP ページへのリンクを足した。
2026-10-27: 0.9.0 のレポートの形（先頭の進め方の文と面談の問い、本人の同意の条件、観点の呼び名）と、0.9.0 の公開を足した。
-->

## 课题

人才中介机构和 SES 的销售人员在向企业推荐候选人时，需要说明“为何推荐此人”。然而，手头可用的材料几乎仅有履历书和面试时的印象。即便上面写着“5 年 Java 经验”，究竟在工作中做过何种变更、又是如何边确认边推进的，具体的工作实质依然无从了解。

另一方面，像 GitHub 绿墙或提交次数这类“活动量”，如今通过生成式 AI 或 Agent 就能轻易做大。数量的多寡已难以成为推荐的有力依据。但如果将其归纳为一个单独的分数，测量的对象、时间跨度和测量基数就会被抹去，从而沦为简单初筛一刀切的工具。无论是推荐方还是被推荐方，都缺少“经得起验证的材料”。

## 应对方式

Grift 于 2026 年 2 月作为一款支持受托开发估算服务的 Web 应用起步。在探寻估算依据的过程中，我们发现最确凿的材料莫过于工程师日积月累的 git 历史本身，因此于 2026 年 8 月将测量部分独立拆分为命令行工具。9 月停止了旧 Web 应用的提供，并将方向调整为支持人才中介机构与 SES 的销售人员。

在设计上，我们预先确立了 3 项约定：

- 不折算为分数：输出的是检查值，负责判断的是人。不输出综合评分、排名、合格与否及等级，数值必须附带分子与分母
- 每次结果一致：测量不使用 AI（LLM）。只要是同一个代码仓库、同一个版本，无论由谁执行，得出的数值都一致
- 不向任何地方发送：仅在本地 PC 上运行。是否共享、公开哪些仓库，均由本人决定

与此同时，我们还制定了包括“不把未出现理解为负面表现”、“不单纯依据数值进行初筛淘汰”、“未经本人同意不对他人进行测量”等在内的 7 条使用规范，并规定不遵守规范的使用方式不得称为该方法的名称（TEP：Technical Evidence Pipeline）。

## 实现

Grift CLI 仅从 git 历史中提取如下观测数据：

- 归属区分：通过本人独立提交、他人工作、bot、生成/供应商产物、沿袭自 fork 源的历史等 11 类划分，厘清各项工作出自谁手
- 测试伴随修改率：在与生产代码变更相同的提交中，同时修改了测试的比例
- 返工率与修缮重触：近期处理过的文件的返工与重触比例（仅为倾向记录，不用于判定合格与否）
- 仓库上下文：实际工作天数、参与人数与最高产作者的占比、经由审查合并的比例等

在 v0.6 中新增的 `report-v2` 中，增加了用于观察单一工程师工作方式的层面。各项均附带分子和分母，并非对职种或能力的评定。

- 工作领域（`surface_profile`）：按 test / docs / CI/CD / platform / data / observability / frontend / backend / config / 生成及供应商 / 其他共 11 个分类，展示各领域的变更件数
- 变更节奏（`change_rhythm`）：近 180 天内提交过变更的天数，以及提交的间隔（中位数与 90 分位数、2 天内连续提交的比例、间隔 30 天以上的比例）。这并非劳动时间或工作积极性
- 验证形态（`verification_profile`）：涉及测试的提交比例及其类型（unit / integration / e2e / contract / 未知），以及 fix 提交伴随测试的比例
- 角色的 4 个维度（`role_profile`）：仅包含 domain / work_type / time / process_position 这 4 项，不合并归纳为单一职种。仅在存在记录了本人同意的 identity 时输出

与项目需求的对照匹配也以不进行排名的方式开展。项目方通过 `grift project` 声明所需的领域、验证、节奏与输入，`grift align` 将候选人的观测数据按维度并列呈现。并列状态仅有重叠（overlap）、超出声明范围（outside_declared_range）、0 件（observed_zero）、未观测到（not_observed）、未声明要求（not_declared）这 5 种，不计算综合得分、排名或合格与否。通过 `--team` 按团队维度查看时，仅输出满足要求的人数，不足 3 人时不进行统计汇总，以防识别到个人身份。

当基数小于 20 时不输出比例而仅显示件数，对于无法观测到的内容，不归为“无实际成果”，而是作为附带原因的“未观测到”输出。`grift verify` 会在相同条件下重新计算已保存的报告，并返回一致、不一致或无法验证，以便接收方确认是否存在篡改或出入。

自 0.9.0 起，在 `grift actor`、`grift project`、`grift align` 的 Markdown 开头，会用简短的语句写明从记录中呈现的工作推进方式。关于修改部分的划分、变更节奏、测试添加方式以及参与方式，附上件数和时间跨度予以陈述，随后写明通过此记录无法看出的内容，并以问题的形式罗列出希望在面试中予以确认的事项。文句根据已公开的[判定表](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.0/docs/trait-profile.md)由数值选取生成。不使用 AI，亦不计入 JSON。

关于个人的文句和问题，仅在为本人自报的 ID 且存在同意记录时输出。其余情况下，用一句话写明未输出的理由。汇总输出多个人员时（`--all`、`--top`），不输出此类文句。

该方法的名称为 TEP（Technical Evidence Pipeline，技术证据提取链路）。由读取 git 记录、按既定规则计数、为计数所得数值附带分母及无法计数的事项的理由、使任何人都能按相同步骤重新计数这 4 个阶段构成。详细说明请参阅 Grift 网站的 [TEP 页面](https://griftai.org/tep)。

本页面及 griftai.org 中使用的表述与 CLI 在输出中所用的词汇对应如下：

| 网站表述 | CLI 词汇 |
|---|---|
| 检查值 | observed value（`kind: observed`。附带数值、单位与分母） |
| 测试伴随修改率 | test co-change |
| 返工率 | corrective rework |
| 修缮重触 | path retouch |
| Code recency | survival（仅在指定 `--survival` 时） |
| 仓库上下文 | context profile |
| 工作领域、变更节奏、验证形态 | surface_profile / change_rhythm / verification_profile |

自 0.9.0 起，CLI 的 Markdown 也将修改部分的分类（工作领域）、变更节奏（变更节奏）、测试添加方式（验证形态）、参与方式这 4 个视角，采用与 griftai.org 相同的名称进行编写。JSON 的键名保持不变。

- 代码仓库：[github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- 分发方式：PyPI “grift-cli”（`pipx install grift-cli`，Python 3.11 及以上）
- 许可证：MIT
- 发布说明：[github.com/Cor-Incorporated/grift-cli/releases](https://github.com/Cor-Incorporated/grift-cli/releases)（各版本的变更点）

## 成果

2026 年 9 月 8 日，在 PyPI 上发布了 [v0.7.2](https://pypi.org/project/grift-cli/0.7.2/)。各项指标在公开的 117 个代码仓库中进行了验证，能够区分的对比和尚无法区分的对比均已在 GitHub 上公开（为公司内部测定，未接受第三方审计）。

2026 年 10 月 25 日，将网站文本与 CLI 输出逐行进行了核对。多人列表（`actor-index`）中虽在注释中写明“非排名”，但此前是按提交次数由多到少的顺序排列的，因此在 2026 年 10 月 26 日发布的 [0.8.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0) 中，将排序调整为了 ID 的字典序。提交次数的数值予以保留。相关原委及对 0.8 系列设定的 5 项验收条件已在[博客文章](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/)中阐述。

在 2026 年 10 月 27 日发布的 [0.9.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.0) 中，增加了上述报告开头的文句及面试问题。同时，从 Markdown 中移除了倾向的“强弱”行以及对照匹配的“适合倾向”行。这是因为两份报告并列排布时，容易被解读为能力强的人/能力弱的人、合适的人/不合适的人。此外，还修复了 4 处可能输出与个人实际事实不符的数值的问题。

目前，我们正与中介机构及 SES 企业推进概念验证（PoC）准备工作，旨在依据候选人本人在本地执行的记录，使推荐理由更具体化。对于自研企业的招聘负责人，我们也接受关于通过候选人本人共享的记录来确认其具体工作内容的测试导入（PoC）咨询。关于正式版本，计划结合测试导入的结果，以 2027 年开始提供为目标推进。Grift 也在 [griftai.org](https://griftai.org) 进行了介绍。

Grift 的设计思想也在 [Qiita](https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1) 与 [note](https://note.com/cor_instrument/n/nd58ba0955317) 的文章中进行了介绍。
