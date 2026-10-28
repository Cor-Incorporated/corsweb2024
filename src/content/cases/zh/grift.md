---
title: "Grift —— 履历可以美化，事实无法伪造。从 git 提交记录中提取可核实事实的开源软件"
description: "介绍自有产品 Grift，它能从工程师的 git 历史中提取可核实的事实（检查值）而非打分。本文分享我们将其从估算支持 Web 应用转向开源 CLI 以及面向人才介绍公司与 SES 的推荐支持工具的过程与设计方案。"
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "人才中介", "SES", "招聘"]
publishedAt: 2026-06-30
updatedAt: 2026-10-28
summary: "Grift 是一款从工程师的 git 提交记录中提取“可核实事实”的自有产品。它不进行打分或排名。由于在衡量过程中不使用 AI（LLM），任何人运行都能得到相同的结果，接收方也可进行验算。其 CLI 工具作为 MIT 许可的开源软件公开发布。"
isDraft: false
featured: true
lang: "zh"
translationSourceHash: "4ca681c34432675973331e8114ce197a04fd07b1460e509367b26bbd93cf1d4e"
translatedAt: "2026-10-28T05:32:38.002Z"
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
2026-10-28: 0.9.1 の公開を「成果」に足した（日付は PyPI に上げた日。#446 の手順で確かめる）。
-->

## 课题

人才中介机构和 SES 的销售人员在向企业推荐候选人时，需要说明“为什么推荐这位人才”。然而手头的材料往往仅限于简历和面试印象。即使上面写着“Java 5 年经验”，候选人究竟是在怎样的修改中、如何进行验证并推进工作的，其工作实质并无法被传达出来。

另一方面，像 GitHub 上的绿墙（活动图）和提交次数这类“活动量”，借助生成式 AI 和 Agent 很容易就能注水膨胀。数量多已很难再作为推荐的依据。话虽如此，如果将其归纳为一个单一的评分，究竟测了什么、在多长时间内测的、基数是多少这些关键信息就会消失，评分反而沦为了简单粗暴的筛选淘汰工具。无论对推荐方还是被推荐方而言，都缺乏“可供验证的客观材料”。

## 方法

Grift 始于 2026 年 2 月，最初是一款支持受托开发估算评估的 Web 应用。在探索估算依据的过程中，我们意识到最可靠的材料正是工程师自己日积月累沉淀下来的 git 历史本身，因此于 2026 年 8 月将度量部分单独剥离出来，做成了一款命令行工具。到了 9 月，我们停止了原 Web 应用的提供，全面调整方向，致力于支持人才中介机构和 SES 销售人员的业务。

在设计之初，我们预先定下了 3 项承诺：

- 不化为分数：输出的是检查值，负责判断的是人。不输出综合评分、排名、合格与否及等级，数值必须附带分子与分母
- 每次结果一致：度量过程不使用 AI（LLM）。只要是同一个代码仓库、同一个版本，无论由谁执行，得到的数值都完全一致
- 绝不向外发送：仅在本地电脑上运行。是否共享、公开哪些代码仓库，完全由本人决定

与此同时，我们还制定了“不得将未记录视为负面”“不得仅凭数值进行筛选淘汰”“未经本人同意不得度量他人”等 7 条使用规范，并约定不遵守这些规范的使用方式不得冠以本方法体系之名（TEP: Technical Evidence Pipeline）。

## 实现

Grift CLI 仅从 git 历史中提取如下维度的观察：

- 归属的区分：通过本人独立提交、他人工作、bot、生成式/供应商产出、自 fork 源继承的历史等 11 类划分，厘清分别属于谁的工作
- 测试伴随修改率：修改生产代码的同一次提交中，测试代码也一并修改的比例
- 返工率・修缮重触：近期修改过的文件发生返工或再次触及的比例（仅用于记录倾向，不用作合格与否的判定）
- 仓库上下文：实际开发天数、参与人数与最高产出者的占比、经由 Review 的比例等

v0.6 中新增的 `report-v2`，增加了观察单名工程师工作形态的层级。所有指标均带有分子与分母，绝非对职位或能力的判定。

- 工作领域（`surface_profile`）：分为 test / docs / CI/CD / platform / data / observability / frontend / backend / config / 生成式及供应商产出 / 其他 11 个分类，统计各领域的修改各有多少件
- 变更节奏（`change_rhythm`）：近 180 天中提交修改的天数，以及提交的时间间隔（中位数与 90 分位数、2 天以内连续提交的比例、间隔 30 天以上的比例）。这并非衡量劳动时间或工作意愿的指标
- 验证形态（`verification_profile`）：触及测试的提交占比及其类型（unit / integration / e2e / contract / 未知），以及 fix 类提交中附带测试的比例
- 角色 4 维度（`role_profile`）：仅由 domain / work_type / time / process_position 这 4 项构成，不归结压缩为单一职种。只有在存在记录了本人同意凭据的 identity 时才会输出

与项目需求的对照匹配同样以不进行排名的方式开展。项目方在 `grift project` 中声明所要求的领域、验证、节奏与输入，`grift align` 则将候选人的观察数据分轴并列。并列对比的结果仅有重叠（overlap）、超出声明范围（outside_declared_range）、0件（observed_zero）、未观察到（not_observed）、无要求（not_declared）这 5 种状态，不计算任何综合得分、排名或合格与否。在通过 `--team` 以团队为单位进行查看时，仅输出满足要求的人数；若少于 3 人，为避免个人身份被识别，将不予统计汇总。

当母数小于 20 时，不显示百分比，仅展示件数；无法观察到的项目不写作“无业绩”，而是附带理由作为“未观察到”输出。`grift verify` 会在相同条件下重新计算已保存的报告，并返回一致、不一致或无法验证的结果，以便接收方核实是否存在篡改或出入。

从 0.9.0 开始，在 `grift actor` 的 Markdown 开头，会用简短语句描述从记录中反映出的工作推进方式。围绕所修改部分的分类、修改节奏、测试补充方式以及参与模式，附带件数和时间范围进行描述；紧接着写明本记录中无法观察到的事项，并以问题的形式列出建议在面试中确认的要点。`grift project` 按相同规则描述项目代码仓库的推进方式，不输出具体到个人的数字和参与模式。`grift align` 在要求与记录的对照并列中，以问题的形式附上建议在面试中确认的要点。语句和问题完全依据公开的[判定表](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.0/docs/trait-profile.md)根据数字选取，不使用 AI。由于未写入 JSON，因此可通过 `grift verify` 进行验算的是作为语句来源的那些数字本身。

针对个人的描述语句和问题，只有在属于本人声明的 ID 且存在同意记录时才会输出。其他情况下，会输出一行未予显示的理由。在集中输出多人的场景下（`--all`、`--top`），不输出此类语句。

该方法体系名为 TEP（Technical Evidence Pipeline，技术证据提取管线）。它由 4 个阶段构成：读取 git 记录、按固定规则计数、为计数值附带分母及未计入原因、使任何人都能按相同步骤重新核算。详细说明请参阅 Grift 网站的 [TEP 页面](https://griftai.org/tep)。

本页面及 griftai.org 中使用的表述与 CLI 输出中所用术语的对应关系如下：

| 网站表述 | CLI 术语 |
|---|---|
| 检查值 | observed value（`kind: observed`。附带数值、单位和分母） |
| 测试伴随修改率 | test co-change |
| 返工率 | corrective rework |
| 修缮重触 | path retouch |
| Code recency | survival（仅在指定 `--survival` 时） |
| 仓库上下文 | context profile |
| 工作领域・变更节奏・验证形态 | surface_profile / change_rhythm / verification_profile |

从 0.9.0 开始，CLI 的 Markdown 也将所修改部分的分类（工作领域）、修改节奏（变更节奏）、测试补充方式（验证形态）、参与模式这 4 个视角的称谓与 griftai.org 保持一致。JSON 中的键名保持不变。

- 仓库: [github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- 分发: PyPI "grift-cli"（`pipx install grift-cli`，Python 3.11 及以上）
- 许可证: MIT
- 发行说明: [github.com/Cor-Incorporated/grift-cli/releases](https://github.com/Cor-Incorporated/grift-cli/releases)（各版本变更点）

## 成果

2026 年 9 月 8 日，我们在 PyPI 上发布了 [v0.7.2](https://pypi.org/project/grift-cli/0.7.2/)。各项指标在公开的 117 个代码仓库中进行了验证，能够区分的对比和尚无法区分的对比均已在 GitHub 上公开（为公司内部测定，未接受第三方审计）。

2026 年 10 月 25 日，我们对网站文案和 CLI 输出进行了逐行核对。发现多人一览（`actor-index`）中，虽然批注中写着“并非排名”，但实际上却是按照提交次数从多到少的顺序排列的，因此在 2026 年 10 月 26 日发布的 [0.8.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0) 中，已将排序调整为 ID 的字典序。提交次数的数值依然保留。详细经过以及对 0.8 系列设定的 5 项验收条件已发布在[博客文章](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/)中。

在 2026 年 10 月 27 日发布的 [0.9.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.0) 中，加入了前述报告开头的描述语句与面试确认问题。同时，从 Markdown 中移除了倾向的“强度”行以及对照匹配的“匹配方向”行。这是因为两份报告并列时，极易被解读为“谁强谁弱”或“合适与不合适”。此外，我们还修正了 4 处可能针对个人输出与事实不符的数字的地方。

在 2026 年 10 月 28 日发布的 [0.9.1](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.1) 中，修复了 0.9.0 发布后发现的针对个人或项目可能输出与事实不符数字的问题。未引入新命令，不输出分数、排名和类型名称的原则也保持不变。由于定义版本发生了变更，使用 0.9.0 保存的报告和对照匹配将无法使用 0.9.1 的 `grift verify` 进行验算（仅由要求生成的项目报告等例外情况，请参阅[迁移注意事项](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.1/docs/migration-v091.md)）。

目前，我们正与中介公司及 SES 企业共同筹备试点引入（PoC），旨在基于候选人本人在本地执行生成的记录，让推荐理由更加具体明确。对于自研企业的招聘负责人，我们也接受关于通过候选人本人共享的记录来验证其实际工作情况的试点引入（PoC）咨询。正式版计划结合试点引入的结果，争取于 2027 年开始提供。有关 Grift 的更多介绍，亦可在 [griftai.org](https://griftai.org) 上查阅。

关于 Grift 的设计理念，亦可在 [Qiita](https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1) 和 [note](https://note.com/cor_instrument/n/nd58ba0955317) 的文章中了解。
