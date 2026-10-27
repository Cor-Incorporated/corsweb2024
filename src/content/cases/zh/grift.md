---
title: "Grift —— 履历可以夸大，证据无法伪造。从git历史中提取可验证事实的开源软件（OSS）"
description: "自研产品Grift能从工程师的git历史中提取可验证的事实（检查值）而非抽象分数。本文将介绍它如何从最初的估算支持Web应用转型为面向猎头与SES的推荐支持工具及开源CLI的历程与设计理念。"
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "人才中介", "SES", "招聘"]
publishedAt: 2026-06-30
updatedAt: 2026-10-27
summary: "Grift是一款从工程师的git历史中提取“可验证事实”的自研产品。它不打分、不排名。由于在评估中不使用AI（LLM），任何人运行都能得出相同的结果，接收方亦可复核验算。该CLI基于MIT许可证作为开源软件（OSS）发布。"
isDraft: false
featured: true
lang: "zh"
translationSourceHash: "da19a3405dd6186a0445998301689944702384c944e88e2a060326cfa32ee36d"
translatedAt: "2026-10-27T13:51:40.603Z"
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

人才中介机构和 SES 的销售人员在向企业推荐候选人时，需要说明“为何推荐此人”。然而，手头可用的材料往往仅限于简历和面试印象。即使上面写着“Java 5 年”，其究竟做过怎样的变更、又是如何一边验证一边推进工作的——具体的工作内容却无法传达。

另一方面，像 GitHub 上的绿墙（Contributions）和提交次数这类“活动量”，如今只要借助生成式 AI 或 Agent 便能轻易膨胀。单纯的量大已经很难再作为推荐的依据。但如果将其汇总成单一的分数，度量了什么、度量了哪个周期、以什么为基数都会消失殆尽，反而会沦为一刀切筛选淘汰的工具。无论对于推荐方还是被推荐方，“可供核实的事实依据”都严重不足。

## 方案路径

Grift 始于 2026 年 2 月，最初是一款用于支持受托开发项目估算的 Web 应用。在探索估算依据的过程中，我们意识到最确凿的依据正是工程师亲手积累起来的 git 历史记录本身，并于 2026 年 8 月将度量部分单独抽离为命令行工具。9 月停止了旧版 Web 应用的提供，将方向转为支持人才中介机构及 SES 的销售业务。

在设计上，我们预先确立了 3 项约定：

- 不打分：仅输出检查值，由人来进行判断。不输出综合评分、排名、合格与否及评级，数值必须附带分子和分母
- 每次结果一致：度量过程不使用 AI（LLM）。只要是相同的代码仓库和相同的版本，任何人运行都会得出相同的数值
- 不向外传输：仅在本地 PC 运行。是否共享、出示哪些代码仓库均由本人自行决定

与此同时，我们还制定了“不得将缺席解读为负面表现”、“不得仅凭数值一刀切淘汰”、“未经本人同意不得度量他人”等 7 条使用规范，并规定不遵守规范的使用方式不得冠以该方法论的名称（TEP：Technical Evidence Pipeline）。

## 实现

Grift CLI 仅从 git 历史记录中提取如下观察结果：

- 归属的区分：通过本人独立提交、他人工作、bot、生成及供应商产物、沿袭自 fork 源的历史等 11 类划分，厘清各项工作出自谁手
- 测试伴随修改率：在与生产代码变更相同的提交中，同时修改了测试的比例
- 返工率与修缮重触：近期触及过的文件发生返工或再次接触的比例（作为倾向的记录，不用于评判合格与否）
- 代码仓库的上下文：实际工作天数、参与人数与最多创建者的占比、经由审查合并的比例等

在 v0.6 中新增的 `report-v2` 增加了观察单个工程师工作形态的层级。所有指标均带有分子和分母，并非对职能或能力的判定。

- 工作领域（`surface_profile`）：按 test / docs / CI/CD / platform / data / observability / frontend / backend / config / 生成及供应商 / 其他等 11 类划分，统计各个领域的变更各有几件
- 变更节奏（`change_rhythm`）：最近 180 天内提交了变更的天数，以及提交的间隔（中位数与 90 百分位数、在 2 天内连续提交的比例、相隔 30 天以上的比例）。这并非工作时长或积极性
- 验证形态（`verification_profile`）：触及测试的提交比例及其类型（unit / integration / e2e / contract / 未知），fix 提交中伴随测试的比例
- 角色的 4 个维度（`role_profile`）：仅包含 domain / work_type / time / process_position 这 4 项，不压缩收拢为单一职能。仅在存在记录了本人同意信息的 identity 时输出

与项目需求的对照比对也以不排名的方式进行。项目方通过 `grift project` 声明所要求的领域、验证、节奏与输入，`grift align` 则将候选人的观察结果按各个维度进行并列呈现。并列状态仅有重叠（overlap）、超出声明范围（outside_declared_range）、0 件（observed_zero）、未观察到（not_observed）、无要求（not_declared）这 5 种，不计算综合分、排名或合格与否。通过 `--team` 按团队维度查看时，仅输出满足要求的人数；不足 3 人时由于会识别到个人，故不予统计。

基数不足 20 时不输出比率，仅显示件数；未能观察到的内容不记为“无业绩”，而是附带理由作为“未观察到”输出。`grift verify` 会以相同条件对保存的报告重新计算，并返回一致、不一致或无法验证，以便接收方核实是否存在篡改或分歧。

从 0.9.0 开始，在 `grift actor` 的 Markdown 开头，会用简短的语句描述从记录中看出其推进工作的方式。针对修改部分的划分、变更的节奏、测试的编写方式、参与方式，附上件数与周期加以描述；紧接着写明从本记录中无法看出的事项，并以问题的形式列出希望在面试中核实的内容。`grift project` 按相同规则描述项目代码仓库的推进方式，不输出具体到个人的数值和参与方式。`grift align` 在要求与记录的并列对照之外，以问题的形式附上希望在面试中核实的内容。语句和问题均根据公布的[决策表](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.0/docs/trait-profile.md)从数值中选取，不使用 AI。由于未写入 JSON，因此可通过 `grift verify` 验算的，是作为语句来源的数值本身。

关于个人的语句和问题，仅在采用本人自报的 ID 且存在同意记录时输出。其他情况下，则用一句话说明未输出的理由。批量汇总输出多人时（`--all`、`--top`），不输出语句。

该方法论的名称为 TEP（Technical Evidence Pipeline，提取技术证据的流程）。它由 4 个阶段组成：读取 git 记录、按固定规则计数、为计数值附带分母及无法计数的理由、让任何人都能按相同步骤重新计数。详细说明可参阅 Grift 网站的 [TEP 页面](https://griftai.org/tep)。

本页面及 griftai.org 中使用的表述与 CLI 在输出中所用的词汇对应如下：

| 网站表述 | CLI 词汇 |
|---|---|
| 检查值 | observed value（`kind: observed`。附带数值、单位与分母） |
| 测试伴随修改率 | test co-change |
| 返工率 | corrective rework |
| 修缮重触 | path retouch |
| Code recency | survival（仅在指定 `--survival` 时） |
| 代码仓库的上下文 | context profile |
| 工作领域、变更节奏、验证形态 | surface_profile / change_rhythm / verification_profile |

从 0.9.0 开始，CLI 的 Markdown 也将修改部分的划分（工作领域）、变更的节奏（变更节奏）、测试的编写方式（验证形态）、参与方式这 4 个观察维度，采用与 griftai.org 相同的称谓来描述。JSON 的键名保持不变。

- 代码仓库：[github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- 分发渠道：PyPI "grift-cli"（`pipx install grift-cli`，Python 3.11 及以上）
- 许可证：MIT
- 发布说明：[github.com/Cor-Incorporated/grift-cli/releases](https://github.com/Cor-Incorporated/grift-cli/releases)（各版本的变更点）

## 成果

2026 年 9 月 8 日，在 PyPI 上发布了 [v0.7.2](https://pypi.org/project/grift-cli/0.7.2/)。各项指标已在 117 个公开代码仓库上进行了验证，并在 GitHub 上公开了能够区分的对比与尚无法区分的对比（为公司内部测定，未接受第三方审计）。

2026 年 10 月 25 日，我们逐行核对了网站用语与 CLI 输出。发现多人员名单（`actor-index`）虽然在注释中写明“非排名”，但实际却是按提交次数降序排列的；因此在 2026 年 10 月 26 日发布的 [0.8.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0) 中，已将排序改为按 ID 的字典序。提交次数的数值仍予保留。相关经过及对 0.8 系列设定的 5 项验收条件已记录在[博客文章](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/)中。

在 2026 年 10 月 27 日发布的 [0.9.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.0) 中，增加了上述报告开头的语句及面试问题。同时，从 Markdown 中移除了倾向的“强弱”行和对照的“契合度”行。这是因为两份报告并列时，容易被解读为能力强的人与能力弱的人、合适的人与不合适的人。此外，还修正了 4 处可能得出与个人实际不符的数值的问题。

目前，我们正在与中介机构及 SES 企业推进试导入（PoC）准备工作，旨在基于候选人本人在本地运行得出的记录，让推荐理由更加具体充实。我们也面向自研企业的招聘负责人，就通过候选人本人共享的记录来核实其具体工作经历的试导入（PoC）接受咨询。关于正式版，计划结合试导入的结果，争取于 2027 年开始提供。Grift 在 [griftai.org](https://griftai.org) 亦有介绍。

关于 Grift 的理念，亦在 [Qiita](https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1) 和 [note](https://note.com/cor_instrument/n/nd58ba0955317) 的文章中进行了介绍。
