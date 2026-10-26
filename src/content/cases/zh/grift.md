---
title: "Grift — 简历可以美化，证据无法造假。从git历史中提取可验证事实的OSS"
description: "自主研发产品Grift，旨在从工程师的git历史中提取可验证的事实（检查值）而非简单打分。本文将介绍该产品从估算辅助Web应用转向OSS CLI工具以及面向猎头中介/SES的推荐辅助支持的历程与架构设计。"
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "人才中介", "SES"]
publishedAt: 2026-06-30
updatedAt: 2026-10-26
summary: "Grift是一款从工程师的git历史中提取“可验证事实”的自研产品。它不打分、不排名。由于衡量过程不使用AI（LLM），任何人运行都能获得相同的结果，接收方亦可自行验算。其CLI工具已作为采用MIT许可的OSS公开发布。"
isDraft: false
featured: true
lang: "zh"
translationSourceHash: "a8dfe812f53fcb36961bc564396c501ad8a746b23ccaa423c7c09d13cd6b686f"
translatedAt: "2026-10-26T04:37:55.893Z"
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

## 面临的课题

人才中介机构及SES（系统工程服务）公司的销售人员在向企业推荐候选人时，需要解释“为什么推荐这个人”。然而，目前手头拥有的材料几乎仅限于履历书和面试印象。即便上面写着“5年Java经验”，也无法传达具体的工作内容——例如究竟进行了怎样的代码变更、又是如何边确认边推进的。

另一方面，诸如GitHub上的“小绿墙”或提交次数等“活动量”，借助生成式AI或智能体已能轻松刷高。单纯的“量多”已很难作为推荐的依据。但如果将其归纳为一个单一的综合评分，又会抹去“在什么期间、以什么为基准母数、衡量了什么”，最终沦为一刀切初筛的工具。无论对于推荐方还是被推荐方，都缺乏“可供核实的客观材料”。

## 解决途径

Grift于2026年2月启动，最初是一款用于支持外包开发报价的Web应用。在寻找报价依据的过程中，团队意识到最确凿的材料正是工程师日积月累的git历史本身，于是在2026年8月将度量部分抽离为了命令行工具。9月，停止了原Web应用的提供，将方向转为支持人才中介及SES的销售业务。

在设计上，我们预先确立了三项原则：

- 不打分：仅输出检验值，由人来做判断。不给出综合评分、排名、合格与否或评级，所有数值均附带分子与分母
- 每次结果完全一致：度量中不使用AI（LLM）。在相同的代码仓库、相同的版本下，任何人执行都会得到相同的数值
- 不向外发送任何数据：仅在本地电脑上运行。是否共享、公开哪些代码仓库，完全由本人决定

同时，我们制定了包括“不将缺失理解为负面表现”、“不单纯依据数值进行筛选淘汰”、“未经本人同意不对他人进行度量”在内的7条使用规范，并规定未遵守这些规范的用法不得冠以该方法论的名称（TEP：Technical Evidence Pipeline）。

## 具体实现

Grift CLI仅通过git历史提取如下观测数据：

- 归属区分：通过本人的独立提交、他人的工作、bot、生成式/供应商产物、从fork源继承的历史等11类，厘清各项工作到底出自谁手
- 测试同步修改率：在修改生产代码的同一次提交中，同步修改了测试代码的比例
- 返工率・二次打磨：对近期改动过的文件进行推倒重来或再次修改的比例（仅作为工作倾向的记录，不用作判定合格与否）
- 仓库上下文：实际工作天数、参与人数与最高贡献者的占比、经过代码审查的提交比例等

在v0.6中加入的`report-v2`，增加了观察单名工程师工作样态的维度。所有指标均带有分子与分母，不用于判定职位或能力。

- 工作领域（`surface_profile`）：分为test / docs / CI/CD / platform / data / observability / frontend / backend / config / 生成与供应商 / 其他等11个类别，统计各领域的改动各有多少件
- 变更节奏（`change_rhythm`）：最近180天内提交过变更的天数，以及提交的时间间隔（中位数与90百分位数、2天内连续提交的比例、间隔30天以上的比例）。这并非工作时长或积极性的指标
- 验证方式（`verification_profile`）：涉及测试的提交比例及其类型（unit / integration / e2e / contract / 未知），以及修复（fix）提交中附带测试的比例
- 角色的4个维度（`role_profile`）：仅由domain / work_type / time / process_position这4项构成，不归结为单一职种。仅在存在记录了本人同意的identity时才会输出

与项目需求的对照匹配同样采取不排先后顺序的形式。需求方在`grift project`中声明所需的领域、验证、节奏与输入，`grift align`将候选人的观测值按各个维度进行平铺对照。比对结果仅有重合（overlap）、超出声明范围（outside_declared_range）、0件（observed_zero）、未观测到（not_observed）、未作要求（not_declared）这5种情况，不计算综合得分、排名或合格与否。通过`--team`以团队为单位查看时，仅输出满足要求的人数；若少于3人，由于会导致个人身份可被推断，将不进行统计汇总。

当母数小于20时，不显示百分比，仅展示具体件数；未能观测到的项目不会被标为“无实绩”，而是作为附带原因的“未观测到”予以展示。`grift verify` 会在相同条件下重新计算已保存的报告，并返回一致、不一致或无法验证的结果，以便接收方核实报告是否存在篡改或分歧。

该方法论名为TEP（Technical Evidence Pipeline，技术证据提取管线）。它由四个阶段构成：读取git记录、依固定规则计数、为计数值附上分母及未计入内容的理由、让任何人都能依相同步骤重新核算。详细说明请参阅Grift网站的[TEP页面](https://griftai.org/tep)。

本页面及griftai.org中所用的表述，与CLI在输出中使用的术语对应如下：

| 网站表述 | CLI术语 |
|---|---|
| 检验值 | observed value（`kind: observed`。附带数值、单位与分母） |
| 测试同步修改率 | test co-change |
| 返工率 | corrective rework |
| 二次打磨 | path retouch |
| 存留率 | survival（仅在指定`--survival`时提供） |
| 仓库上下文 | context profile |
| 工作领域・变更节奏・验证方式 | surface_profile / change_rhythm / verification_profile |

- 代码仓库：[github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- 分发渠道：PyPI "grift-cli"（`pipx install grift-cli`，支持Python 3.11及以上）
- 许可证：MIT
- 发布说明：[github.com/Cor-Incorporated/grift-cli/releases](https://github.com/Cor-Incorporated/grift-cli/releases)（各版本的变更点）

## 成果

2026年9月8日，我们在PyPI上发布了[v0.7.2](https://pypi.org/project/grift-cli/0.7.2/)。各项指标在117个公开的代码仓库中进行了验证，已成功区分的比对与尚无法区分的比对均已在GitHub上公开（为内部测定结果，未经过第三方审计）。

2026年10月25日，我们对网站文案与CLI的输出结果逐行进行了比对。发现多人一览（`actor-index`）虽然在批注中写明了“并非排名”，但实际上仍按提交次数从多到少进行了排序；因此在2026年10月26日发布的[0.8.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0)中，我们将排序方式改为了ID的字典序。提交次数的数值予以保留。相关经过以及针对0.8版本设定的5项验收条件，已记录在[博客文章](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/)中。

目前，我们正在与多家人才中介公司及SES企业共同筹备概念验证（PoC），旨在基于候选人本人在本地环境运行生成的记录，让推荐理由更加具象充实。关于正式版本，我们计划根据概念验证的结果，争取在2027年开始提供。关于Grift的介绍也可访问 [griftai.org](https://griftai.org) 查看。

关于Grift的设计理念，在[Qiita](https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1)与[note](https://note.com/cor_instrument/n/nd58ba0955317)的文章中亦有介绍。
