---
title: "Grift —— 履历可以夸大，证据无法伪造。从git历史中提取可验证事实的开源软件（OSS）"
description: "自研产品Grift能从工程师的git历史中提取可验证的事实（检查值），而非评分。本文将介绍从最初的估算辅助Web应用，转变为面向猎头机构与SES的开源CLI及推荐辅助工具的历程与设计架构。"
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "人才中介", "SES", "招聘"]
publishedAt: 2026-06-30
updatedAt: 2026-10-31
summary: "Grift是一款能从工程师的git历史中提取“可验证事实”的自研产品。它不进行打分或排名。由于分析过程不使用AI（LLM），任何人运行都能得出相同的结果，接收方亦可自行验算。其CLI工具以MIT许可证作为开源软件（OSS）公开。"
isDraft: false
featured: true
lang: "zh"
translationSourceHash: "6ef8194a514d202c2b450d889b28ec82bda30c14a0122cd1097c0e3a21d0f2b1"
translatedAt: "2026-10-31T06:22:16.321Z"
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
2026-10-30: 0.9.2 の変更（Docker で実行、grift update、grift contribute の同意後の表示、リポジトリの文脈の年とタグの頻度）を「実装」と「成果」に足した。0.9.2 は 2026-10-31 に PyPI へ公開（Release v0.9.2）。2026-10-31 に公開日を「成果」に足した。同日、release/v0.9.2 の CHANGELOG（c7e2a6e）と突き合わせ、grift update・grift contribute・文脈の表示の書き方を CHANGELOG と docs/usage.md に揃え、定義の版が変わったことを「成果」に足した。
-->

## 课题

人才中介机构和SES企业的销售人员在向企业推荐候选人时，需要说明“为什么推荐这位人选”。然而，手头拥有的材料几乎只有简历和面试印象。即使上面写着“5年Java经验”，但其具体进行了怎样的修改、又是如何进行验证推进的，这些工作的实际内容依然无法传达。

另一方面，像GitHub贡献图（绿墙）和提交次数这类的“活动量”，借助生成式AI和智能体已能够轻易膨胀。数量的多寡已难以作为推荐的依据。话虽如此，如果将其归纳为一个综合评分，又会抹去测量的具体内容、时间跨度及样本基数，沦为简单筛选淘汰的工具。无论对推荐方还是被推荐方而言，都缺少“可供核实的材料”。

## 应对方案

Grift最初于2026年2月作为支持外包开发估算的Web应用启动。在探寻估算依据的过程中，我们发现最可靠的材料正是工程师自身积累的git历史记录，并于2026年8月将测量部分独立拆分为命令行工具。9月，我们停止了原Web应用的提供，将方向调整为支持人才中介机构及SES企业的销售业务。

在设计之初，我们确立了三条约定：

- 不打分：仅输出检查值，由人来进行判断。不输出综合评分、排名、合格与否及评级，数值必须附带分子与分母
- 每次结果相同：测量不使用AI（LLM）。在相同的代码仓库和相同版本下，任何人执行都会得到相同的数值
- 不向任何地方发送：仅在本地PC上运行。是否共享、提供哪些仓库均由本人决定

同时，我们制定了包括“不将缺失理解为负面指标”、“不凭单一数值进行筛选淘汰”、“未经本人同意不对他人进行测量”等7条使用规范，并规定不遵守规范的使用方式不得冠以该方法论的名称（TEP: Technical Evidence Pipeline）。

## 实现

Grift CLI仅通过git历史记录提取如下观测数据：

- 归属区分：通过本人的独立提交、他人的工作、bot、生成与供应商产物、沿袭自fork源的历史等11种分类，划分具体是谁的工作
- 测试伴随修改率：在修改生产代码的同一次提交中，测试代码也一并修改的比例
- 返工率・修缮重触：近期触及文件的返工或重新触及比例（作为倾向的记录，不用于评判合格与否）
- 代码仓库背景信息：实际工作天数、参与人数与最高频创建者的占比、经由审查合并的比例等

在v0.6加入的`report-v2`中，增加了观察单名工程师工作形态的层级。各项均附带分子与分母，并非对职能或能力的评判。

- 工作领域（`surface_profile`）：按照test / docs / CI/CD / platform / data / observability / frontend / backend / config / 生成与供应商 / 其他等11个分类，统计各个领域的修改各有几件
- 变更节奏（`change_rhythm`）：近180天中提交修改的天数及提交间隔（中位数与90百分位数、2天以内连续提交的比例、间隔30天以上的比例）。并不代表工作时长或工作意愿
- 验证形态（`verification_profile`）：触及测试的提交比例及其类型（unit / integration / e2e / contract / 未知），以及修复（fix）提交中伴随测试的比例
- 角色4个维度（`role_profile`）：仅使用domain / work_type / time / process_position这4个维度，不折叠为单一职能。仅在存在记录了本人同意的identity时才会输出

与项目需求的对照比对也以不排名的方式进行。项目侧在`grift project`中声明所要求的领域、验证、节奏及输入，`grift align`将候选人的观测数据按维度并列呈现。比对结果仅有重合（overlap）、超出范围（outside_declared_range）、0件（observed_zero）、未观测到（not_observed）、无要求（not_declared）5种情形，不计算综合分、排名或合格与否。通过`--team`按团队维度查看时，仅输出满足要求的人数，不足3人时不作统计以避免个人被识别。

当样本基数不足20时，不输出比率而仅展示件数；未能观测到的内容不列为“无实绩”，而是附带理由列为“未观测到”。`grift verify`能够按相同条件重新计算已保存的报告，并返回一致、不一致或无法验证，以便接收方核实是否存在篡改或分歧。

自0.9.0起，在`grift actor`的Markdown开头，会用简短的语句描述从记录中反映出的工作推进方式。针对修改部分的分类、修改节奏、测试添加方式以及参与方式，附上件数与时间跨度予以说明；紧接着阐述通过本记录无法看出的内容，并以问题的形式列出希望在面试中予以确认的事项。`grift project`以相同的规则描述项目仓库的推进方式，不输出每个人的具体数值和参与方式。`grift align`在要求与记录的并列对照中，以问题的形式附上希望在面试中确认的事项。文句与问题通过公开的[决策表](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.0/docs/trait-profile.md)根据数字选取，不使用AI。由于不包含在JSON中，可通过`grift verify`验算的仅为作为文句生成依据的数字。

关于个人的文句与问题，仅在为本人申报的ID且存在同意记录时才会输出。其他情况下，会以一句话说明未输出的理由。在汇总输出多人时（`--all`、`--top`），不输出文句。

该方法论名为TEP（Technical Evidence Pipeline，技术证据提取链路）。由读取git记录、按固定规则计数、为计数值附加分母以及无法计数之事项的理由、使任何人都能以相同步骤重新计数这4个阶段组成。详细说明请参阅Grift网站的[TEP页面](https://griftai.org/tep)。

本页面及griftai.org所用表述与CLI输出中所写词汇的对应关系如下：

| 网站表述 | CLI词汇 |
|---|---|
| 检查值 | observed value（`kind: observed`。附带数值、单位与分母） |
| 测试伴随修改率 | test co-change |
| 返工率 | corrective rework |
| 修缮重触 | path retouch |
| Code recency | survival（仅在指定`--survival`时） |
| 代码仓库背景信息 | context profile |
| 工作领域・变更节奏・验证形态 | surface_profile / change_rhythm / verification_profile |

自0.9.0起，CLI的Markdown中，修改部分的分类（工作领域）、修改节奏（变更节奏）、测试添加方式（验证形态）以及参与方式这4个视角，也采用与griftai.org相同的称谓表述。JSON的键名保持不变。

在0.9.2中，支持了无需在宿主机上安装Python，直接使用基于grift-cli仓库构建的Docker镜像来运行。需要读取的仓库需获取完整历史记录后传递给`/repo`。通过`git worktree`创建的工作树无法使用。

`grift update`已变更为仅更新当前正在运行的环境，并在更新后显示新安装的版本。不使用PATH中的其他环境。`grift update --check`仅读取PyPI的最新版本信息，不执行更新。不存在自动更新以及日常测量命令进行版本确认的网络通信。

`grift contribute`在获得本人同意后将提交用文件保存至本地。不会自动发送。使用默认的`--door local`创建的文件无法提交至公开入口，因此不会显示提交ID、PR内的文件名及meta行，仅显示通过`--door public-pr`重新创建的步骤。公开提交时，请使用重新创建运行所显示的提交ID、PR内的文件名、meta行以及2个提交路径的URL。无论是本人发起的公开PR，还是隐藏身份的代理PR，文件内容均会公开。

- 代码仓库：[github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- 分发：PyPI“grift-cli”（`pipx install grift-cli`，Python 3.11及以上）
- 许可证：MIT
- 发布说明：[github.com/Cor-Incorporated/grift-cli/releases](https://github.com/Cor-Incorporated/grift-cli/releases)（各版本变更点）

## 成果

2026年9月8日，在PyPI上发布了[v0.7.2](https://pypi.org/project/grift-cli/0.7.2/)。指标已在公开的117个仓库上进行了验证，在GitHub上同时公开了已实现区分的比对与尚无法区分的比对（为内部测量，未接受第三方审计）。

2026年10月25日，我们逐行比对了网站文案与CLI的输出。发现多人列表（`actor-index`）中虽然注明“非排名”，却按提交次数降序排列，因此在2026年10月26日发布的[0.8.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0)中，将排序调整为ID的字典顺序。保留了提交次数的数值。相关背景以及对0.8版本设定的5项验收条件已记录在[博客文章](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/)中。

在2026年10月27日发布的[0.9.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.0)中，添加了上述报告开头的文句与面试问题。同时，从Markdown中移除了倾向的“强弱”行和比对的“适合方向”行。这是因为两份报告并列时，容易被解读为谁强谁弱、适合谁不适合谁。同时修正了4处可能导致输出与个人事实不符数值的地方。

在2026年10月28日发布的[0.9.1](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.1)中，修正了0.9.0发布后发现的、可能导致输出与个人或项目事实不符数值的地方。未添加新命令，不输出评分、排名和类型名称的原则也保持不变。由于定义版本发生了变更，使用0.9.0保存的报告与比对将无法在0.9.1的`grift verify`中进行验算（仅根据要求生成的项目报告等例外情况请参阅[迁移注意事项](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.1/docs/migration-v091.md)）。

在2026年10月31日发布的[0.9.2](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.2)中，在`grift report`的Markdown的代码仓库背景信息栏中，开始展示观测历史中首次活动年份与最后活动年份、标签频率的分子与分母。JSON的数值保持不变。由于目前仍在活动的人员也会显示最后活动年份，因此该项并不代表脱离或离职。标签频率是“标签数 ÷ 活动期间天数 × 365.25”的折合年化值，并非观测到的发布次数。对于活动期间不足20天的仓库，不进行年化折算，仅显示标签数和天数。

未添加新命令，不输出评分、排名或合格与否的原则同样保持不变。亦无更改分析数值的修复，但由于提升了定义版本，使用0.9.1保存的报告与比对将无法在0.9.2的`grift verify`中进行验算（仅根据要求生成的项目报告等例外情况请参阅[迁移注意事项](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.2/docs/migration-v092.md)）。

目前，我们正与中介公司及SES企业推进概念验证（PoC）的筹备工作，旨在基于候选人本人在本地执行的记录，让推荐理由更加具体充实。我们也面向自研企业的招聘负责人，受理基于候选人本人共享的记录来确认其过往工作内容的导入验证（PoC）咨询。关于正式版本，我们计划根据概念验证的结果，争取在2027年开始提供。关于Grift的介绍也可访问 [griftai.org](https://griftai.org)。

关于Grift的设计理念，在[Qiita](https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1) 与 [note](https://note.com/cor_instrument/n/nd58ba0955317) 的文章中亦有介绍。
