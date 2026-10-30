---
title: "Grift —— 履历可以美化，证据无法伪造。从git历史中提取可验证事实的开源软件"
description: "自研产品Grift能从工程师的git历史中提取可验证的事实（检查值）而非评分。本文将介绍它从估算支持Web应用转向开源CLI以及面向人才中介与SES的推荐支持工具的历程与设计。"
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "人才中介", "SES", "招聘"]
publishedAt: 2026-06-30
updatedAt: 2026-10-28
summary: "Grift是一款从工程师的git历史中提取“可验证事实”的自研产品。它不进行打分或排名。由于度量过程不使用AI（LLM），任何人运行都能得到相同的结果，接收方亦可复核验算。CLI工具已作为MIT许可证的开源软件公开。"
isDraft: false
featured: true
lang: "zh"
translationSourceHash: "93cbb0803f562926b2ef1cdbf6ab3a50bfaecdfcb668cd2478e8aa436d42c9a5"
translatedAt: "2026-10-30T03:57:01.909Z"
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
2026-10-30: 0.9.2 の変更（Docker で実行、grift update、grift contribute の同意後の表示、リポジトリの文脈の年とタグの頻度）を「実装」と「成果」に足した。0.9.2 の公開後に出す。公開日は公開したら「成果」に足す。
-->

## 课题

人才中介机构和 SES 的销售人员在向企业推荐候选人时，需要说明“为何推荐此人”。然而手头掌握的材料，几乎只有简历和面试印象。即使上面写着“Java 5 年”，其推进工作时做了哪些变更、又是如何验证的，具体的工作内容却无法传达。

另一方面，GitHub 的绿墙和提交数等“活动量”，借助生成式 AI 或智能体已能轻松刷高。数量多已很难再作为推荐的依据。话虽如此，如果将其归结为一个评分，又会抹去测量的具体内容、时间范围以及基数，沦为粗暴筛选的淘汰工具。无论对推荐方还是被推荐方而言，“可供核实的材料”都远远不够。

## 方案

Grift 始于 2026 年 2 月，最初是一款用于支持外包开发估算的 Web 应用。在探寻估算依据的过程中，团队意识到最确凿的材料正是工程师自己积累的 Git 历史本身，于是在 2026 年 8 月将测量部分拆分出来，做成了命令行工具。9 月停止了旧 Web 应用的提供，将方向调整为支持人才中介机构与 SES 的销售人员。

在设计上，我们预先定下了 3 项承诺：

- 不打分：输出的是检查值，负责判断的是人。不给出综合评分、排名、合格与否及等级，数值必须附带分子和分母
- 每次结果完全一致：测量不使用 AI（LLM）。只要代码仓库和版本相同，任何人执行都会得到相同的数值
- 不向任何地方发送数据：仅在本地电脑上运行。是否共享、出示哪个代码仓库均由本人决定

与此同时，还制定了包括“不将缺失理解为负面”、“不单纯以数值淘汰”、“未经本人同意不测量他人”等在内的 7 条使用规范，并规定不遵守规范的使用方式不得冠以该方法论的名称（TEP: Technical Evidence Pipeline）。

## 实现

Grift CLI 仅从 Git 历史中提取以下维度的观测结果：

- 归属区分：通过本人的独立提交、他人的工作、bot、生成及供应商产物、沿袭自 fork 源的历史等 11 类划分，厘清到底是谁的工作
- 测试伴随修改率：在修改生产代码的同一次提交中，同时修改了测试的比例
- 返工率・修缮重触：对近期改动过的文件进行返工或重新接触的比例（作为倾向的记录，不用于评判合格与否）
- 仓库上下文：实际工作天数、参与人数及最高产作者的占比、经由 Review 的比例等

在 v0.6 中新增的 `report-v2` 中，增加了用于观察单个工程师工作模式的层级。各项均附带分子和分母，并非对职能或能力的判定。

- 工作领域（`surface_profile`）：分为 test / docs / CI/CD / platform / data / observability / frontend / backend / config / 生成及供应商 / 其他共 11 个类别，展示各个领域的变更各有多少件
- 变更节奏（`change_rhythm`）：近 180 天内提交了变更的天数，以及提交的间隔（中位数与 90 分位数、2 天内连续提交的比例、间隔 30 天以上的比例）。这并非劳动时间或工作意愿
- 验证形态（`verification_profile`）：涉及测试的提交比例及其类型（unit / integration / e2e / contract / 未知），fix 提交中伴随测试的比例
- 职责的 4 个维度（`role_profile`）：仅包含 domain / work_type / time / process_position 4 项，不将其折叠合并为单一职务。仅在存在记录了本人同意的 identity 时才会输出

与项目需求的对照，同样以不排名的方式进行。项目方通过 `grift project` 声明所需的领域、验证、节奏与输入，`grift align` 则将候选人的观测结果按各个轴向排列对比。排列仅有重合（overlap）、超出声明范围（outside_declared_range）、0 件（observed_zero）、未观测到（not_observed）、无要求（not_declared）5 种情况，不计算综合得分、排名或合格与否。使用 `--team` 以团队为单位查看时，仅输出满足要求的人数；不足 3 人时由于能推定到个人，因此不进行统计。

基数小于 20 时不输出比率而仅展示件数，未能观测到的项目不会标为“无实绩”，而是作为附带理由的“未观测到”输出。`grift verify` 会在相同条件下重新计算保存的报告，并返回一致、不一致或无法验证，以便接收方核实是否存在篡改或分歧。

从 0.9.0 开始，在 `grift actor` 的 Markdown 开头，会用简短的语句描述从记录中反映出的工作推进方式。围绕变更部位的分类、变更节奏、测试添加方式以及参与方式，附带件数和周期进行阐述；紧接着写明本记录中无法体现的事项，并以提问的形式列出建议在面试中核实的问题。`grift project` 以相同的规则阐述项目仓库的推进方式，不输出个人层面的数据和参与方式。`grift align` 在要求与记录的排列之后，以提问的形式附上建议在面试中核实的问题。陈述语句和提问根据公开的[决策表](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.0/docs/trait-profile.md)由数据选出，不使用 AI。由于不写入 JSON，因此能用 `grift verify` 进行验算的，是作为陈述语句来源的那些数据。

关于个人的陈述语句和提问，仅在属于本人声明的 ID 且存在同意记录时输出。其他情况下，会以一句话说明未输出的理由。汇总输出多个人员时（`--all`、`--top`）不输出陈述语句。

该方法论名为 TEP（Technical Evidence Pipeline，技术证据提取链路）。由 4 个阶段构成：读取 Git 记录、依据固定规则统计、为统计数值附上分母及未统计项的理由、让任何人都能按相同步骤重新统计。详细说明可参阅 Grift 网站的 [TEP 页面](https://griftai.org/tep)。

本页面及 griftai.org 中使用的表述，与 CLI 输出中所用术语的对应关系如下：

| 网站表述 | CLI 术语 |
|---|---|
| 检查值 | observed value（`kind: observed`。附带数值、单位与分母） |
| 测试伴随修改率 | test co-change |
| 返工率 | corrective rework |
| 修缮重触 | path retouch |
| Code recency | survival（仅在指定 `--survival` 时） |
| 仓库上下文 | context profile |
| 工作领域・变更节奏・验证形态 | surface_profile / change_rhythm / verification_profile |

从 0.9.0 开始，CLI 的 Markdown 也将变更部位的分类（工作领域）、变更节奏（变更节奏）、测试添加方式（验证形态）和参与方式这 4 个观察视角，采用与 griftai.org 相同的称谓来描述。JSON 的 key 保持不变。

在 0.9.2 中，支持了无需在宿主机上安装 Python，直接使用基于 grift-cli 代码仓库构建的 Docker 镜像执行。需要读取的代码仓库需获取全部历史记录，并传递给 `/repo`。通过 `git worktree` 生成的工作树无法使用。

`grift update` 变更为显式更新当前运行环境，并显示更新后的版本。`grift update --check` 仅读取 PyPI 上的最新版本信息，不执行更新。不存在自动更新，日常的测量命令也不会发起用于核对版本的通信。

`grift contribute` 在取得本人同意后将提交用文件保存至本地，并显示提交所需的信息及提交目的地。不会自动发送。若要公开提交由默认的 `--door local` 生成的文件，请使用 `--door public-pr` 重新生成，并使用新显示的提交 ID、hash 以及 meta。无论是本人提交的公开 PR，还是隐去身份的代理 PR，文件内容均会被公开。

- 代码仓库：[github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- 分发方式：PyPI “grift-cli”（`pipx install grift-cli`，Python 3.11 及以上）
- 开源许可：MIT
- 发布说明：[github.com/Cor-Incorporated/grift-cli/releases](https://github.com/Cor-Incorporated/grift-cli/releases)（各版本的变更点）

## 成果

2026 年 9 月 8 日，在 PyPI 上发布了 [v0.7.2](https://pypi.org/project/grift-cli/0.7.2/)。各项指标在公开的 117 个代码仓库中进行了验证，已区分出的对比和尚未能区分出的对比均已在 GitHub 上公开（为公司内部测定，未接受第三方审计）。

2026 年 10 月 25 日，对网站文案与 CLI 输出进行了逐行核对。由于多人员一览（`actor-index`）在批注中虽然写着“非排名”，却按提交数从大到小排列，因此在 2026 年 10 月 26 日发布的 [0.8.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0) 中，将顺序更改为 ID 的字典序。提交数的数值予以保留。来龙去脉以及对 0.8 系列设定的 5 项验收条件已写入[博客文章](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/)。

在 2026 年 10 月 27 日发布的 [0.9.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.0) 中，加入了前述报告开头的陈述语句和面试提问。同时，从 Markdown 中移除了倾向的“强弱”行和对照的“朝向”行。这是因为将两份报告并列时，容易被解读为谁强谁弱、合不合适。关于个人的部分，还修复了 4 处可能产生与事实不符数值的地方。

在 2026 年 10 月 28 日发布的 [0.9.1](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.1) 中，修复了 0.9.0 之后发现的、涉及人员或项目时可能产生与事实不符数值的地方。没有新增命令，不输出评分、排名、类型名称的做法也保持不变。由于定义版本发生了变更，使用 0.9.0 保存的报告与对照，在 0.9.1 的 `grift verify` 中将无法验算（仅由要求生成的项目报告等例外情况，请参阅[迁移注意事项](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.1/docs/migration-v091.md)）。

在 [0.9.2](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.2) 中，展示仓库上下文的输出中，新增了观测历史中首次活动年份与最终活动年份，以及标签频率的分子和分母。即使是目前仍活跃的人员也会显示最终活动年份，因此并不代表退出或离职。标签频率是“标签数 ÷ 活动期间天数 × 365.25”的年折算数值，并非观测到的发布次数。不输出评分、排名、合格与否的做法保持不变。

目前，我们正在与中介机构和 SES 企业共同推进概念验证（PoC）的准备工作，旨在基于候选人本人在本地执行的记录，让推荐理由更加具体。同时也面向自主开发企业的招聘负责人，接受关于概念验证（PoC）的咨询，以通过候选人本人共享的记录来核实其具体工作历程。关于正式版，我们计划根据概念验证的结果，争取于 2027 年开始提供。Grift 在 [griftai.org](https://griftai.org) 上也有介绍。

Grift 的理念在 [Qiita](https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1) 和 [note](https://note.com/cor_instrument/n/nd58ba0955317) 的文章中亦有介绍。
