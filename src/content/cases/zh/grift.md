---
title: "Grift —— 简历可以注水，证据无法掺假。从git历史记录中提取可核实事实的开源软件"
description: "自研产品Grift能从工程师的git历史记录中提取可核实的事实（检验值），而非给出评分。本文将介绍我们从估算支持Web应用转型为开源CLI以及面向人才中介和SES企业的推荐支持工具的历程与设计方案。"
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "人才中介", "SES"]
publishedAt: 2026-06-30
updatedAt: 2026-10-26
summary: "Grift是一款从工程师的git历史记录中提取“可核实事实”的自研产品。它不进行打分或排名。由于在衡量中未使用AI（LLM），任何人运行都能获得相同的结果，且接收方可自行验算。其CLI作为遵循MIT协议的开源软件公开。"
isDraft: false
featured: true
lang: "zh"
translationSourceHash: "3e040444b57b65105b31020423b445f7e2670d2f2e3b6da65bf6bbeaed4d4660"
translatedAt: "2026-10-25T15:05:57.788Z"
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

人才中介机构和SES（系统工程服务）公司的销售人员在向企业推荐候选人时，需要解释“为什么推荐这个人”。然而手头掌握的材料，几乎只有简历和面试时的印象。哪怕写着“Java 5年”，具体做过怎样的修改、如何进行验证推进，工作细节依然无法体现。

另一方面，像GitHub上的绿墙或提交次数这类“活动量”，借助生成式AI和智能体已能轻易膨胀。单纯的数量多已很难作为推荐的依据。但如果汇总成一个单一的分数，到底衡量了什么、衡量周期多长、以什么为基数都会消失不见，反而容易被当作淘汰筛选的工具。无论是推荐方还是被推荐方，都缺少“可供核实的材料”。

## 方案

Grift于2026年2月启动，起初是一款用于辅助受托开发报价的Web应用。在探寻报价依据的过程中，我们意识到最可靠的材料其实是工程师日积月累的git历史本身，于是于2026年8月将测量部分拆分成了命令行工具。9月停止了旧版Web应用的提供，转型为赋能人才中介机构与SES销售的方向。

在设计上，我们首先确立了3项承诺：

- 不折算分数：提供的是检验值，负责判断的是人。不生成综合评分、排名、合格与否及等级，数值必须附带分子与分母
- 每次结果一致：测量不使用AI（LLM）。在相同的代码仓库和相同版本下，任何人执行得出的数值都完全一致
- 不向外发送任何数据：仅在本地PC上运行。是否共享、公开哪些代码仓库均由本人决定

同时，我们制定了包括“不将缺失理解为负面表现”、“不单纯依据数值进行淘汰筛选”、“未经本人同意不对他人进行测量”等在内的7条使用规范，并规定凡未遵守这些规范的用法，均不得使用该方法体系的名称（TEP: Technical Evidence Pipeline）来称呼。

## 实现

Grift CLI仅通过git历史提取如下观测数据：

- 归属划分：通过本人独立提交、他人工作、机器人、生成/供应商产出物、沿袭自fork源的历史等11类，区分是谁的工作
- 测试同步修改率：在更改生产代码的同一次提交中，同步修改了测试的比例
- 返工率・重新打磨：对近期修改过的文件进行返工或重新接触的比例（作为倾向的记录，不用于判定合格与否）
- 仓库上下文：实际工作天数、参与人数与最高贡献者的占比、经由审查的比例等

v0.6新增的`report-v2`中，增加了从多层次观察单个工程师工作形态的功能。各项指标均附带分子和分母，并非对职种或能力的评定。

- 工作领域（`surface_profile`）：分为test / docs / CI/CD / platform / data / observability / frontend / backend / config / 生成与供应商 / 其他等11个类别，统计各个领域的变更各有几项
- 变更节奏（`change_rhythm`）：最近180天内提交了变更的天数，以及提交的间隔（中位数与90分位数、在2天内连续提交的比例、间隔超过30天的比例）。这不代表劳动时间或意愿
- 验证形态（`verification_profile`）：涉及测试修改的提交比例及其类型（unit / integration / e2e / contract / 未知），fix类提交中附带测试的比例
- 角色4维度（`role_profile`）：仅包含domain / work_type / time / process_position 4个维度，不归拢为单一职种。仅在存在已记录本人同意的identity时才会输出

与项目需求的对照也以不排名的形式进行。项目方通过`grift project`声明所要求的领域、验证、节奏和输入，`grift align`则将候选人的观测数据按维度进行对比排列。对比形态仅有重合（overlap）、超出范围（outside_declared_range）、0件（observed_zero）、未观测到（not_observed）、未要求（not_declared）5种，不计算综合评分、排名或合格与否。通过`--team`以团队为单位查看时，仅显示满足要求的人数；不足3人时因可锁定个人而不予统计。

当基数小于20时，不显示比率而仅展示件数；未能观测到的内容不会显示为“无业绩”，而是附带理由显示为“未观测”。`grift verify` 会在相同条件下重新计算保存的报告，并返回一致、不一致或无法验证，便于接收方核实是否存在篡改或分歧。

该方法体系定名为TEP（Technical Evidence Pipeline，技术证据提取链路）。它由4个阶段构成：读取git记录、按固定规则计数、为计数值附带分母及无法计数之事项的理由、让任何人都能按相同步骤重新计数。详细说明可参阅Grift网站的[TEP页面](https://griftai.org/tep)。

本页面及griftai.org中使用的表述，与CLI在输出中使用的术语对应如下：

| 网站表述 | CLI术语 |
|---|---|
| 检验值 | observed value（`kind: observed`。附带数值、单位和分母） |
| 测试同步修改率 | test co-change |
| 返工率 | corrective rework |
| 重新打磨 | path retouch |
| 留存率 | survival（仅在指定`--survival`时） |
| 仓库上下文 | context profile |
| 工作领域・变更节奏・验证形态 | surface_profile / change_rhythm / verification_profile |

- 代码仓库：[github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- 分发方式：PyPI “grift-cli”（`pipx install grift-cli`，Python 3.11以上）
- 许可证：MIT

## 成果

2026年9月8日，在PyPI上发布了v0.7.2版本。指标已在117个公开的代码仓库中进行了验证，能够区分的比较与尚无法区分的比较均已在GitHub上公开（为内部测量，未接受第三方审计）。

2026年10月25日，我们对网站文案与CLI的输出进行了逐行对照。因多人列表（`actor-index`）在附注中虽注明“并非排名”，实际上却按提交次数降序排列，我们在下一个版本（0.8）中将排序方式调整为ID的字典顺序。提交次数的数值将予以保留。具体原委以及对0.8体系设定的5项验收条件，已撰写在[博客文章](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/)中。

目前，我们正在与中介机构及SES企业共同推进概念验证（PoC）的筹备工作，旨在基于候选人本人在本地执行的记录，让推荐理由更加具体化。正式版计划结合试导入的结果，于2027年开始提供。Grift在 [griftai.org](https://griftai.org) 也有介绍。

Grift的理念同样发布在 [Qiita](https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1) 和 [note](https://note.com/cor_instrument/n/nd58ba0955317) 的文章中。
