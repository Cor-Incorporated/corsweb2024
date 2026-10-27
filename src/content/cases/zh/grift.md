---
title: "Grift —— 履历可以夸大，证据无法伪造。从git历史中提取可验证事实的OSS"
description: "自研产品Grift能从工程师的git历史中提取可验证的事实（检查值），而非给出主观评分。本文将介绍它从报价辅助Web应用，转型为面向猎头公司与SES的推荐支持及开源CLI的历程与设计架构。"
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "人才中介", "SES", "招聘"]
publishedAt: 2026-06-30
updatedAt: 2026-10-27
summary: "Grift是一款能从工程师的git历史中提取“可验证事实”的自研产品。它不进行打分或排名。由于在度量时不使用AI（LLM），任何人运行都能得到相同的结果，接收方亦可自行验算。其CLI作为采用MIT许可证的OSS公开发布。"
isDraft: false
featured: true
lang: "zh"
translationSourceHash: "243d83e70e58999eaaf5f0fa0c07149254f208dd3d4884fc32eb667b1ca2c839"
translatedAt: "2026-10-27T13:34:59.215Z"
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

人才中介机构和 SES 的销售人员在向企业推荐候选人时，需要说明“为何推荐此人”。然而手头掌握的材料，几乎仅限于简历和面试印象。即使上面写着“Java 5 年”，其究竟是怎样一边验证一边推进哪些修改的，工作细节依然无法传达。

另一方面，像 GitHub 绿墙或提交次数这类“活动量”，借助生成式 AI 或智能体已能轻松膨胀。数量多已难以作为推荐的依据。但如果将其汇总成单一分数，衡量了什么、在何种周期内衡量、以何为基数等信息便会丢失，甚至沦为直接淘汰候选人的工具。无论对于推荐方还是被推荐方，“可供核实的材料”都严重匮乏。

## 方法

Grift 于 2026 年 2 月作为一个支持受托开发估算功能的 Web 应用启动。在探寻估算依据的过程中，我们发现最可靠的材料正是工程师长期积累的 git 历史本身，并于 2026 年 8 月将度量部分抽离为命令行工具。9 月停止了旧版 Web 应用的提供，将方向调整为赋能人才中介机构与 SES 的销售人员。

在设计初期，我们先行确立了 3 项约定：

- 不折算为分数：输出的是检查值，负责判断的是人。不输出综合评分、排名、合格与否及等级，数值必须附带分子与分母
- 每次结果一致：度量过程不使用 AI（LLM）。在相同的代码仓库、相同的版本下，无论由谁执行，得到的数值均一致
- 不发送至任何地方：仅在本地 PC 运行。是否共享、公开哪些代码仓库均由本人决定

同时，制定了“不把缺席视作负面”“不凭单一数值直接淘汰”“未经本人同意不度量他人”等 7 条使用规范，并规定未遵循此规范的使用方式不得冠以该方法之名（TEP: Technical Evidence Pipeline）。

## 实现

Grift CLI 仅从 git 历史中提取如下观测信息：

- 归属区分：通过本人的独立提交、他人的工作、bot、生成及供应商产物、沿袭自 fork 源的历史等 11 类划分，厘清各项工作属于何人
- 测试伴随修改率：修改生产代码的同一次提交中，同时修改测试的比例
- 返工率・修缮重触：近期接触过的文件的返工与重新接触比例（仅作为倾向记录，不用于合格与否的判定）
- 代码仓库背景信息：实际工作天数、参与人数与最多创建者的占比、通过 Review 合入的比例等

v0.6 中新增的 `report-v2` 增加了审视单个工程师工作形态的层级。各项均附带分子与分母，并非对职种或能力的评判。

- 工作领域（`surface_profile`）：涵盖 test / docs / CI/CD / platform / data / observability / frontend / backend / config / 生成与供应商 / 其他等 11 个分类，呈现各领域的修改各有多少件
- 变更节奏（`change_rhythm`）：近 180 天内提交修改的天数，以及提交的间隔（中位数与 90 分位数、2 天内连续提交的比例、间隔 30 天以上的比例）。这并非工作时长或积极性
- 验证形态（`verification_profile`）：涉及测试的提交比例及其类型（unit / integration / e2e / contract / 未知），fix 提交中伴随测试的比例
- 角色的 4 个维度（`role_profile`）：仅包含 domain / work_type / time / process_position 这 4 项，不将其折叠为单一职种。仅在存在已记录本人同意的 identity 时输出

与项目需求的对照也采取不排定名次的形式。项目侧通过 `grift project` 声明所要求的领域、验证、节奏及输入，`grift align` 则将候选人的观测结果按各个轴向排列。排列状态仅有重叠（overlap）、超出范围（outside_declared_range）、0件（observed_zero）、未观测到（not_observed）、未作要求（not_declared）这 5 种，不计算综合得分、排名或合格与否。通过 `--team` 按团队维度查看时，仅输出满足要求的人数；不足 3 人时，因可能识别到个人而不予统计。

基数不足 20 时不输出比率，仅展示件数；未能观测到的项不标为“无业绩”，而是附带理由作为“未观测到”输出。`grift verify` 能够在相同条件下对已保存的报告重新计算，并返回一致、不一致或无法验证，以便接收方核实是否存在篡改或分歧。

自 0.9.0 起，在 `grift actor`、`grift project`、`grift align` 的 Markdown 开头，会用简短语句描述从记录中反映出的工作推进方式。围绕修改部位的分类、修改节奏、测试补充方式、参与方式，附上件数与周期进行陈述，随后以问句形式列出该记录中无法体现的事项以及希望在面试中确认的问题。语句由公开的[判定表](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.0/docs/trait-profile.md)根据数值选出。不使用 AI，亦不计入 JSON。

关于个人的陈述与提问，仅在属于本人声明的 ID 且留有同意记录时输出。其他情况下，将用一句话说明未输出的理由。批量导出多人时（`--all`、`--top`），不输出此类语句。

该方法的名称为 TEP（Technical Evidence Pipeline，技术证据提取管线）。由读取 git 记录、按既定规则计数、为计数值附加分母及无法计数之理由、确保任何人均可按相同步骤重新计数这 4 个阶段构成。详细说明请参阅 Grift 网站的 [TEP 页面](https://griftai.org/tep)。

本页面及 griftai.org 所使用的表述与 CLI 在输出中所用的术语对应如下：

| 网站表述 | CLI 术语 |
|---|---|
| 检查值 | observed value（`kind: observed`。附带数值、单位与分母） |
| 测试伴随修改率 | test co-change |
| 返工率 | corrective rework |
| 修缮重触 | path retouch |
| Code recency | survival（仅在指定 `--survival` 时） |
| 代码仓库背景信息 | context profile |
| 工作领域・变更节奏・验证形态 | surface_profile / change_rhythm / verification_profile |

自 0.9.0 起，CLI 的 Markdown 也将修改部位的分类（工作领域）、修改节奏（变更节奏）、测试补充方式（验证形态）、参与方式这 4 个视角，统一采用与 griftai.org 相同的称谓。JSON 的键名保持不变。

- 代码仓库：[github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- 分发方式：PyPI“grift-cli”（`pipx install grift-cli`，Python 3.11 以上）
- 许可证：MIT
- 发布说明：[github.com/Cor-Incorporated/grift-cli/releases](https://github.com/Cor-Incorporated/grift-cli/releases)（各版本变更点）

## 成果

2026 年 9 月 8 日，在 PyPI 上发布了 [v0.7.2](https://pypi.org/project/grift-cli/0.7.2/)。各项指标在公开的 117 个代码仓库中进行了验证，能够区分的对比和尚无法区分的对比均已在 GitHub 上公开（为公司内部测定，未接受第三方审计）。

2026 年 10 月 25 日，将网站文案与 CLI 输出进行了逐行对照。针对多人列表（`actor-index`）在附注中虽注明“并非排名”却按提交数降序排列的问题，在 2026 年 10 月 26 日发布的 [0.8.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0) 中，将排列顺序调整为 ID 的字典顺序。提交数的数值予以保留。具体原委以及对 0.8 系列设定的 5 项验收条件，已记录于[博文](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/)中。

在 2026 年 10 月 27 日发布的 [0.9.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.0) 中，补充了上述报告开头的陈述语句和面试提问。同时，从 Markdown 中移除了倾向的“强弱”行和需求对照的“适应方向”行。这是因为两份报告并列时，容易被解读为强弱之分或合适与否。此外，还修复了 4 处可能输出与事实不符的个人数值的问题。

目前，我们正与中介公司及 SES 企业推进试导入（PoC）准备工作，旨在基于候选人本人在本地执行的记录，让推荐理由更加具体。同时也面向自研企业的招聘负责人，受理关于通过候选人本人共享的记录来核实其过往工作细节的试导入（PoC）咨询。正式版本计划根据试导入的结果，于 2027 年开始提供。Grift 在 [griftai.org](https://griftai.org) 上也有介绍。

Grift 的设计理念在 [Qiita](https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1) 和 [note](https://note.com/cor_instrument/n/nd58ba0955317) 的文章中亦有阐述。
