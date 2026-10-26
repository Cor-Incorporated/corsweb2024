---
title: "Grift —— 履历可以美化，证据无法伪造。从git历史记录中提取可核实事实的开源软件（OSS）"
description: "自研产品Grift能从工程师的git历史记录中提取可核实的事实（检验值），而非打分。本文将介绍它从估算支持Web应用转向开源CLI工具以及面向人才中介机构与SES企业的推荐支持工具的演进历程与设计理念。"
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "人才中介", "SES", "招聘"]
publishedAt: 2026-06-30
updatedAt: 2026-10-26
summary: "Grift是一款从工程师的git历史记录中提取“可核实事实”的自研产品。它不进行打分或排名。由于在度量中不使用AI（LLM），因此任何人运行都会得出相同的结果，接收方亦可进行验算。CLI工具已作为基于MIT许可证的开源软件（OSS）发布。"
isDraft: false
featured: true
lang: "zh"
translationSourceHash: "55cea17da0f2c5b39ce62e7acd9d278a9f47ee15e380c572f3b4a26ddc531cb7"
translatedAt: "2026-10-26T08:01:55.045Z"
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

人才中介机构和SES的销售人员在向企业推荐候选人时，需要说明“为什么推荐这位人选”。然而手头掌握的材料，往往只有简历和面试时的印象。即便上面写着“Java 5年经验”，究竟进行了怎样的变更、是如何边验证边推进的，其具体工作内容依然无法传达。

另一方面，像GitHub上的绿墙或提交次数这类“活动量”，如今借助生成式AI和智能体（Agent）即可轻松膨胀。数量多早已难以作为推荐的依据。但如果将其归纳为一个综合评分，又会抹去测量的对象、时间跨度及测量基数，沦为一刀切初筛的工具。无论对推荐方还是被推荐方而言，“可核验的材料”都十分匮乏。

## 方法

Grift于2026年2月启动，最初是一款用于支持受托开发估算的Web应用。在探索估算依据的过程中，我们意识到最可靠的材料正是工程师日积月累的git历史本身，于是在2026年8月将测量部分独立提取为命令行工具。9月，我们停止了原Web应用的提供，将方向调整为支持人才中介机构及SES销售人员。

在设计之初，我们确立了三项原则：

- 不折算为分数：提供的是检验值，由人来进行判断。不提供综合得分、排名、合格与否或等级，数值必定附带分子与分母
- 每次结果一致：测量中不使用AI（LLM）。在相同的代码仓库和相同版本下，任何人执行都会得到相同的数值
- 不上传至任何地方：仅在本地电脑上运行。是否共享、公开哪些仓库，均由本人决定

同时，我们制定了包括“不将缺失解读为负面表现”、“不单纯依据数值进行一刀切筛选”、“未经本人同意不对他人进行测量”等在内的7条使用规范；凡未遵守规范的使用方式，一律不得使用该方法的名称（TEP: Technical Evidence Pipeline）指代。

## 实现

Grift CLI仅从git历史中提取以下观测指标：

- 归属区分：分为本人独立提交、他人工作、机器人、生成及供应商产出、继承自fork源的历史等11个类别，区分具体是谁的工作
- 测试伴随修改率：在修改生产代码的同一次提交中，同时修改测试的比例
- 返工率与反复打磨：对近期触碰过的文件进行返工或再次改动的比例（仅作倾向记录，不用于判定合格与否）
- 仓库上下文：实际工作天数、参与人数与最高产出者的占比、经由审查（Review）合入的比例等

v0.6新增的`report-v2`中，增加了观察单名工程师工作样态的维度。所有指标均附带分子和分母，并非对职能或能力的评判。

- 工作领域（`surface_profile`）：分为test / docs / CI/CD / platform / data / observability / frontend / backend / config / 生成及供应商 / 其他等11个类别，统计各领域的变更件数
- 变更节奏（`change_rhythm`）：最近180天中提交变更的天数，以及提交的间隔（中位数与第90百分位数、2天内连续提交的比例、间隔30天以上的比例）。并不代表劳动时间或工作意愿
- 验证形态（`verification_profile`）：涉及测试的提交比例及其类型（unit / integration / e2e / contract / 未知），以及在修复（fix）提交中伴随测试的比例
- 角色四维度（`role_profile`）：仅包含domain / work_type / time / process_position四项，不归纳为单一职位名称。仅在存在记录了本人同意的identity时方才输出

与项目需求的对照匹配同样以不进行排名的方式展开。项目方通过`grift project`声明所需领域、验证方式、节奏和输入要求，`grift align`则将候选人的观测值按维度逐一并列。对照状态仅有重合（overlap）、超出声明范围（outside_declared_range）、0件（observed_zero）、未观测到（not_observed）、未提出要求（not_declared）这5种情况，不计算综合得分、排名或合格与否。通过`--team`以团队为单位查看时，仅显示满足要求的人数；少于3人时因可能识别到个人而不予统计。

基数小于20时不提供比率，仅展示具体件数；未能观测到的内容不列为“无实绩”，而是附带原因列为“未观测到”。`grift verify` 会在相同条件下重新计算已保存的报告，并返回一致、不一致或无法验证的结果，以便接收方核验是否存在篡改或分歧。

该方法的名称为TEP（Technical Evidence Pipeline，技术证据提取流程）。它由四个阶段组成：读取git记录、按既定规则计数、为计数值附带分母及无法计数的理由、使任何人都能以相同步骤重新计数。详细说明可参阅Grift网站的[TEP页面](https://griftai.org/tep)。

本页面及griftai.org中所使用的表述与CLI输出词汇的对应关系如下：

| 网站表述 | CLI词汇 |
|---|---|
| 检验值 | observed value（`kind: observed`。附带数值、单位和分母） |
| 测试伴随修改率 | test co-change |
| 返工率 | corrective rework |
| 反复打磨 | path retouch |
| 存留率 | survival（仅在指定`--survival`时） |
| 仓库上下文 | context profile |
| 工作领域・变更节奏・验证形态 | surface_profile / change_rhythm / verification_profile |

- 代码仓库：[github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- 分发渠道：PyPI "grift-cli"（`pipx install grift-cli`，支持Python 3.11及以上版本）
- 许可证：MIT
- 发布说明：[github.com/Cor-Incorporated/grift-cli/releases](https://github.com/Cor-Incorporated/grift-cli/releases)（各版本变更点）

## 成果

2026年9月8日，我们在PyPI上发布了[v0.7.2](https://pypi.org/project/grift-cli/0.7.2/)。各项指标已在117个公开代码仓库中进行了验证，能够区分的对比与尚无法区分的对比均已在GitHub上公开（为内部测量结果，未接受第三方审计）。

2026年10月25日，我们逐行比对了网站文案与CLI的输出内容。发现多人列表（`actor-index`）在备注中虽注明“并非排名”，却按提交次数从多到少进行了排序；因此在2026年10月26日发布的[0.8.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0)中，我们将排序调整为ID的字典顺序。提交次数的具体数值依然保留。详细经过以及对0.8版本设定的5项验收条件已记录在[博客文章](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/)中。

目前，我们正与人才中介机构及SES企业推进概念验证（PoC）的筹备工作，旨在基于候选人本人在本地执行的记录，让推荐理由更加具体。对于自研企业的招聘负责人，我们也接受关于通过候选人本人共享的记录来核验其过往工作的概念验证（PoC）咨询。关于正式版本，我们计划根据概念验证的结果，争取于2027年开始提供。Grift的相关介绍也可在 [griftai.org](https://griftai.org) 查看。

关于Grift的设计理念，亦可参阅我们在 [Qiita](https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1) 和 [note](https://note.com/cor_instrument/n/nd58ba0955317) 上发布的文章。
