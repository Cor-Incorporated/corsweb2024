---
title: "Grift —— 履历可以夸大，证据无法伪造。从 git 历史中提取可验证事实的开源软件"
description: "自研产品 Grift 从工程师的 git 历史中提取可验证的事实（检查值）而非评分。本文将介绍它从估算支持 Web 应用转变为开源 CLI 以及面向猎头公司与 SES 企业的推荐支持工具的演进过程与架构设计。"
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "人才中介", "SES", "招聘"]
publishedAt: 2026-06-30
updatedAt: 2026-10-26
summary: "Grift 是一款从工程师的 git 历史中提取“可验证事实”的自研产品。它不进行打分或排名。由于不使用 AI（LLM）进行测算，任何人运行都能得到相同的结果，接收方亦可复核验证。CLI 以 MIT 协议作为开源软件公开发布。"
isDraft: false
featured: true
lang: "zh"
translationSourceHash: "ef5d17e64309f955e1b45bcd0e7d4a45aa3817cb440d60525b4d6d2093965a57"
translatedAt: "2026-10-26T13:33:01.113Z"
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
-->

## 课题

人才中介机构和 SES 的销售人员在向企业推荐候选人时，需要说明“为何推荐此人”。然而手头掌握的材料，几乎仅限于简历和面试印象。即使上面写着“Java 5 年”，其究竟做过怎样的变更、如何一边验证一边推进工作，具体的工作实质往往无法传达。

另一方面，像 GitHub 绿墙或提交次数这类“活动量”，借助生成式 AI 和 Agent 很容易就能注水膨胀。数量的多寡已难以作为推荐的依据。但如果将其归纳为一个分数，又会丢失究竟测了什么、跨度多久、分母为何等信息，沦为一刀切筛选的工具。无论对于推荐方还是被推荐方，“可验证的材料”都曾严重匮乏。

## 解决途径

Grift 于 2026 年 2 月作为一个支持受托开发估算的 Web 应用起步。在探寻估算依据的过程中，我们意识到最可靠的材料正是工程师日积月累的 git 历史本身，遂于 2026 年 8 月将度量部分抽离为命令行工具。9 月停止了旧版 Web 应用的提供，转向全力支持人才中介机构与 SES 销售人员的方向。

在设计上，我们预先确立了三项承诺：

- 不打分：输出的是检查值，做判断的是人。不输出综合评分、排名、合格与否及等级，数值必须附带分子和分母
- 每次结果一致：度量中不使用 AI（LLM）。在相同的代码仓库、相同的版本下，任何人执行都会得到完全相同的数值
- 不向任何地方发送：仅在本地 PC 运行。是否共享、公开哪个代码仓库均由本人决定

与此同时，我们制定了包括“不把缺失解读为负面”“不凭数值单向筛选”“未经本人同意不度量他人”等在内的 7 条使用规范，并规定不遵守规范的用法不得冠以该方法论的名称（TEP: Technical Evidence Pipeline）。

## 实现

Grift CLI 仅从 git 历史中提取如下观测数据：

- 归属区分：通过本人独立提交、他人工作、bot、生成及供应商产物、沿袭自 fork 源的历史等 11 类划分，厘清是谁的工作
- 测试伴随修改率：在变更生产代码的同一提交中，测试代码也一并变更的比例
- 返工率・修缮重触：对近期修改过的文件进行返工或重新修改的比例（仅作倾向记录，不用于评判优劣）
- 代码仓库上下文：实际工作天数、参与人数与最高产出者的占比、经由审查的比例等

在 v0.6 中加入的 `report-v2` 增加了观察单个工程师工作形态的层级。各项指标均附带分子和分母，并非对职能或能力的裁定。

- 工作领域（`surface_profile`）：按 test / docs / CI/CD / platform / data / observability / frontend / backend / config / 生成及供应商 / 其他等 11 个分类，统计各领域发生了多少项变更
- 变更节奏（`change_rhythm`）：最近 180 天内提交过变更的天数以及提交间隔（中位数和 90 分位数、2 天内连续提交的比例、间隔 30 天以上的比例）。这并非工作时长或积极性
- 验证形态（`verification_profile`）：修改了测试的提交比例及其类型（unit / integration / e2e / contract / 未知），以及 fix 提交伴随测试的比例
- 角色的 4 个维度（`role_profile`）：仅包含 domain / work_type / time / process_position 这 4 项，不归纳为单一职种。仅在存在已记录本人同意的 identity 时输出

与项目需求的对照也以不评定排名的方式进行。项目方通过 `grift project` 声明所需的领域、验证、节奏与输入，`grift align` 将候选人的观测值按维度逐一并列。对照状态仅有重叠（overlap）、超出范围（outside_declared_range）、0 件（observed_zero）、未观测到（not_observed）、未要求（not_declared）这 5 种，不计算总分、排名及合格与否。通过 `--team` 按团队维度查看时，仅输出满足要求的人数，不满 3 人时因涉及个人身份识别而不进行汇总统计。

当分母小于 20 时不输出比率仅显示件数，未能观测到的内容不列为“无实绩”，而是附带理由标示为“未观测到”。`grift verify` 能够在相同条件下对保存的报告重新计算，并返回一致、不一致或无法验证的结果，以便接收方核实是否存在篡改或分歧。

该方法论名为 TEP（Technical Evidence Pipeline，技术证据提取管线）。它由 4 个阶段构成：读取 git 记录、按既定规则计数、为计数值附加分母及无法计数之原因、使任何人都能以相同步骤重新计数。详细说明请参阅 Grift 网站的 [TEP 页面](https://griftai.org/tep)。

本页面及 griftai.org 中使用的表述与 CLI 输出中的用语对应如下：

| 网站表述 | CLI 用语 |
|---|---|
| 检查值 | observed value（`kind: observed`。附带数值、单位和分母） |
| 测试伴随修改率 | test co-change |
| 返工率 | corrective rework |
| 修缮重触 | path retouch |
| Code recency | survival（仅在指定 `--survival` 时） |
| 代码仓库上下文 | context profile |
| 工作领域・变更节奏・验证形态 | surface_profile / change_rhythm / verification_profile |

- 代码仓库：[github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- 分发渠道：PyPI "grift-cli"（`pipx install grift-cli`，要求 Python 3.11 及以上）
- 许可证：MIT
- 发布说明：[github.com/Cor-Incorporated/grift-cli/releases](https://github.com/Cor-Incorporated/grift-cli/releases)（各版本变更点）

## 成果

2026 年 9 月 8 日，在 PyPI 上发布了 [v0.7.2](https://pypi.org/project/grift-cli/0.7.2/)。各项指标在 117 个公开代码仓库上进行了验证，在 GitHub 上同时公开了能够区分的对比和尚无法区分的对比（均为公司内部测定，未接受第三方审计）。

2026 年 10 月 25 日，我们对网站文案与 CLI 输出进行了逐行核对。由于多人列表（`actor-index`）在注释中虽注明“并非排名”，但实际上是按提交次数降序排列的，因此在 2026 年 10 月 26 日发布的 [0.8.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0) 中，排序已更改为 ID 的字典序。提交次数的数值予以保留。相关经过以及对 0.8 系列设定的 5 项验收条件已记录在[博客文章](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/)中。

目前，我们正与中介公司及 SES 企业推进概念验证（PoC）准备，旨在依据候选人本人在本地执行的记录，让推荐理由更加具体。同时也面向自主研发企业的招聘负责人，受理基于候选人本人共享的记录来核实其具体工作内容的试导入（PoC）咨询。关于正式版，我们计划结合试导入的结果，争取在 2027 年开始提供。Grift 也在 [griftai.org](https://griftai.org) 进行了介绍。

关于 Grift 的理念，在 [Qiita](https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1) 和 [note](https://note.com/cor_instrument/n/nd58ba0955317) 的文章中亦有介绍。
