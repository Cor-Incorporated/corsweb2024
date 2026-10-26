---
title: "Grift — 经历可以粉饰，证据无法造假。从git历史中提取可验证事实的开源软件（OSS）"
description: "自研产品Grift能从工程师的git历史中提取可验证的事实（检验指标），而非打分评级。本文将介绍该产品从估算辅助Web应用转型为开源CLI工具以及面向猎头中介/SES的推荐辅助工具的历程与设计理念。"
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "人才中介", "SES", "招聘"]
publishedAt: 2026-06-30
updatedAt: 2026-10-26
summary: "Grift是一款从工程师的git历史中提取“可验证事实”的自研产品。它不进行打分或排名。由于在评估中不使用AI（LLM），因此无论谁运行都会得到相同的结果，接收方也可进行验算。CLI工具已作为基于MIT许可证的开源软件（OSS）公开发布。"
isDraft: false
featured: true
lang: "zh"
translationSourceHash: "3ed7c2d9efb97af0e5865299da247aea96639ffd21f806a4c3e5ce3c5e3cc08e"
translatedAt: "2026-10-26T12:22:01.428Z"
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

## 挑战

猎头机构和SES（系统工程服务）公司的销售人员在向企业推荐候选人时，需要解释“为什么推荐这个人”。然而手头掌握的材料，几乎只有简历和面试印象。哪怕写着“5年Java经验”，究竟做了怎样的变更、如何一边确认一边推进，工作的实质内容却无法传达。

另一方面，像GitHub的绿墙和提交次数这类“活动量”，借助生成式AI或Agent可以轻松膨胀。数量的多寡已难以作为推荐的依据。可如果汇总成单一评分，测量的具体内容、时间跨度以及样本基数便荡然无存，甚至会被当作直接筛人的淘汰工具。无论对推荐方还是被推荐方而言，都缺乏“可验证的实质材料”。

## 方法

Grift于2026年2月作为一款支持受托开发估算的Web应用起步。在探寻估算依据的过程中，我们发现最确凿的材料莫过于工程师日积月累的git历史本身，遂于2026年8月将测量部分独立拆分为命令行工具。同年9月停止了旧Web应用的提供，将方向转向支持猎头机构和SES公司的销售人员。

在设计上，我们预先确立了3项承诺：

- 不打分数：输出的是检查值，判断权交给人类。不输出综合评分、排名、合格与否及等级，数值必须附带分子与分母
- 结果始终如一：测量不使用AI（LLM）。在相同的代码仓库和相同版本下，任何人执行都能得出相同的数值
- 绝不上报任何地方：仅在本地PC运行。是否共享、提供哪些代码仓库，由本人决定

与此同时，我们制定了包括“不将缺失理解为负面”“不凭单一数值进行筛除”“未经本人同意不得测量他人”在内的7条使用规范，并规定不遵守规范的使用方式不得冠以该方法之名（TEP：Technical Evidence Pipeline）。

## 实现

Grift CLI仅通过git历史提取如下观测数据：

- 归属区分：将工作划分为本人独立提交、他人工作、机器人、生成物/供应商成果、从fork源继承的历史等11类，厘清是谁的工作
- 测试伴随修改率：在包含生产代码变更的同一次提交中，同时修改了测试的比例
- 返工率・修缮重触：近期接触过的文件的重做及再次接触比例（仅用于记录倾向，不作为合格判断依据）
- 代码仓库背景脉络：实际工作天数、参与人数与最高产出者的占比、经由审查合并的比例等

在v0.6中加入的`report-v2`，增加了观察单名工程师工作形态的维度。所有指标均带有分子与分母，绝非对职能或能力的裁定。

- 工作领域（`surface_profile`）：分为test / docs / CI/CD / platform / data / observability / frontend / backend / config / 生成物与供应商 / 其他等11个类别，统计各个领域的变更各有几项
- 变更节奏（`change_rhythm`）：最近180天内提交变更的天数以及提交间隔（中位数与90百分位数、2天内连续提交的比例、间隔30天以上的比例）。并非衡量劳动时间或积极性
- 验证形态（`verification_profile`）：涉及测试的提交比例及其类型（unit / integration / e2e / contract / 未知），fix类提交伴随测试的比例
- 角色4维度（`role_profile`）：仅包含domain / work_type / time / process_position这4个维度，不折叠为单一职能。仅在存在记录了本人同意的identity时方才输出

与项目需求的对照比对，也以不排定名次的方式展开。项目方通过`grift project`声明所要求的领域、验证、节奏及输入，由`grift align`将候选人的观测值按各个维度并列呈现。排列状态仅有重叠（overlap）、超出声明范围（outside_declared_range）、0项（observed_zero）、未观测到（not_observed）、未要求（not_declared）这5种情况，绝不计算综合分、排名或合格状态。通过`--team`以团队为单位查看时，仅输出满足要求的人数，若不足3人因可能识别到个人而不予统计。

当样本基数小于20时，不显示比率而仅展示件数；未能观测到的内容不会判定为“无业绩”，而是附带理由作为“未观测到”输出。`grift verify` 会在相同条件下重新计算已保存的报告，返回一致、不一致或无法验证，便于接收方核实是否存在篡改或分歧。

该方法的名称为TEP（Technical Evidence Pipeline，技术证据提取链路）。它由4个阶段构成：读取git记录、依照既定规则计数、为计数值附上分母及未能计数的理由、让任何人都能按相同步骤重新计数。详细说明请参阅Grift网站上的[TEP页面](https://griftai.org/tep)。

本页面及griftai.org中使用的表述与CLI输出中所用术语对应如下：

| 网站表述 | CLI术语 |
|---|---|
| 检查值 | observed value（`kind: observed`。附带数值、单位与分母） |
| 测试伴随修改率 | test co-change |
| 返工率 | corrective rework |
| 修缮重触 | path retouch |
| 代码新鲜度 | survival（仅在指定`--survival`时） |
| 代码仓库背景脉络 | context profile |
| 工作领域・变更节奏・验证形态 | surface_profile / change_rhythm / verification_profile |

- 代码仓库：[github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- 分发渠道：PyPI“grift-cli”（`pipx install grift-cli`，支持Python 3.11及以上版本）
- 许可证：MIT
- 发布说明：[github.com/Cor-Incorporated/grift-cli/releases](https://github.com/Cor-Incorporated/grift-cli/releases)（各版本变更点）

## 成果

2026年9月8日，我们在PyPI上发布了[v0.7.2](https://pypi.org/project/grift-cli/0.7.2/)。各项指标在117个公开代码仓库中进行了验证，能够区分的对比和尚未能区分的对比均已在GitHub上公开（为内部测量，未接受第三方审计）。

2026年10月25日，我们逐行比对了网站文案与CLI的输出。发现多人一览（`actor-index`）虽然在注释中写明“非排名”，但实际按提交数由多到少进行了排列，因此在2026年10月26日发布的[0.8.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0)中，将排序更改为ID的字典顺序。提交数的数值予以保留。具体原委以及对0.8版本设定的5条验收条件，已记录于[博客文章](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/)中。

目前，我们正在与猎头机构及SES企业共同推进概念验证（PoC）的筹备工作，旨在基于候选人本人在本地执行的记录，使推荐理由更加具体充实。我们也面向自研企业的招聘负责人，受理基于候选人本人共享的记录来确认其工作实绩的概念验证（PoC）咨询。关于正式版本，我们计划根据概念验证的结果，争取在2027年开始提供。Grift的相关介绍也可参阅 [griftai.org](https://griftai.org)。

Grift的设计理念在[Qiita](https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1)与[note](https://note.com/cor_instrument/n/nd58ba0955317)的文章中亦有介绍。
