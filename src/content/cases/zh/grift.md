---
title: "Grift —— 履历可以夸大，证据无法伪造。从git历史中提取可验证事实的OSS"
description: "自研产品Grift能从工程师的git历史中提取可验证的事实（检查值），而非评分。本文将介绍它从估算支持Web应用转向面向人才中介与SES的推荐支持以及开源CLI工具的经过与设计。"
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "人才中介", "SES", "招聘"]
publishedAt: 2026-06-30
updatedAt: 2026-10-28
summary: "Grift是一款从工程师的git历史中提取“可验证事实”的自研产品。它不进行打分或排名。由于在衡量中不使用AI（LLM），任何人运行都能得到相同的结果，接收方亦可复核验算。CLI工具已作为遵循MIT许可证的OSS公开发布。"
isDraft: false
featured: true
lang: "zh"
translationSourceHash: "ce7e4b679a9275c594e1988d06ee37cd223d1c0192af506aa307ea7b0c8f1ff6"
translatedAt: "2026-10-30T12:27:45.202Z"
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
2026-10-30: 0.9.2 の変更（Docker で実行、grift update、grift contribute の同意後の表示、リポジトリの文脈の年とタグの頻度）を「実装」と「成果」に足した。0.9.2 の公開後に出す。公開日は公開したら「成果」に足す。同日、release/v0.9.2 の CHANGELOG（c7e2a6e）と突き合わせ、grift update・grift contribute・文脈の表示の書き方を CHANGELOG と docs/usage.md に揃え、定義の版が変わったことを「成果」に足した。
-->

## 课题

人才中介机构和SES公司的销售人员在向企业推荐候选人时，需要说明“为什么推荐这位人选”。然而手头掌握的材料，往往只有简历和面试印象。即使上面写着“Java 5年”，也无法传达具体的工作实质：究竟做过怎样的变更，又是如何一边验证一边推进的。

另一方面，像GitHub绿墙或提交次数这类“活动量”，借助生成式AI和智能体即可轻松刷高。单纯的数量多，已很难再作为推荐的依据。但若是汇总成一个分数，又会抹去测量的对象、时间跨度以及样本基数，沦为粗暴筛选淘汰的工具。无论对于推荐方还是被推荐方，都缺乏“可查证的材料”。

## 应对策略

Grift最初于2026年2月作为一款支持受托开发估算服务的Web应用起步。在探寻估算依据的过程中，团队意识到最切实可靠的材料正是工程师日积月累的git历史本身，因此于2026年8月将测量部分独立剥离为命令行工具。9月停止提供旧版Web应用，转向为人才中介机构和SES公司的销售业务提供支持。

在设计上，我们预先确立了三条承诺：

- 不打分：输出的是检查值，负责判断的是人。不输出综合评分、排名、合格与否及等级，数值必须附带分子与分母
- 每次结果一致：测量不使用AI（LLM）。对于相同的代码仓库和相同版本，任何人运行得出的数值都完全一致
- 绝不外传：仅在本地PC上运行。是否共享、出示哪些代码仓库，均由本人决定

同时，我们制定了包括“不将缺失解读为负面表现”、“不单纯依据数值进行淘汰”、“未经本人同意不对他人进行测量”等在内的7条使用规范，并规定凡不遵守规范的使用方式，一律不得冠以该方法论的名称（TEP：Technical Evidence Pipeline）。

## 实现细节

Grift CLI仅通过git历史提取如下观察指标：

- 归属划分：细分为本人独立提交、他人工作、bot、生成/供应商产出、继承自fork源的历史等11类，厘清各项工作出自谁手
- 测试伴随修改率：在变更生产代码的同一提交中，同时变更测试代码的比例
- 返工率与修缮重触：近期接触过的文件的返工或重新接触比例（仅作为趋势记录，不用作合格与否的判定）
- 仓库上下文：实际工作天数、参与人数与最高产作者的占比、经由审查合并的比例等

在v0.6加入的`report-v2`中，增加了观察单一工程师工作形态的层级。各项均附带分子与分母，绝非对职种或能力的断定。

- 工作领域（`surface_profile`）：按test / docs / CI/CD / platform / data / observability / frontend / backend / config / 生成与供应商 / 其他等11个类别，统计各领域发生了多少件变更
- 变更节奏（`change_rhythm`）：最近180天内提交变更的天数，以及提交间隔（中位数与90分位数、2天内连续提交的比例、间隔30天以上的比例）。这不代表劳动时长或工作意愿
- 验证形态（`verification_profile`）：涉及测试的提交比例及其类型（unit / integration / e2e / contract / 未知），fix类提交伴随测试的比例
- 角色的4个维度（`role_profile`）：仅包含domain / work_type / time / process_position这4个维度，不折叠为单一职种名称。仅在存在记录了本人同意的identity时方才输出

与项目需求的对照比对，同样采用不分先后排名的方式进行。项目方通过`grift project`声明所要求的领域、验证方式、节奏与输入，`grift align`将候选人的观察指标按各维度进行对照排列。排列仅分为重合（overlap）、超出声明范围（outside_declared_range）、0件（observed_zero）、未观察到（not_observed）、无要求（not_declared）这5种情况，不计算综合得分、排名或合格与否。通过`--team`按团队维度查看时，仅输出满足要求的人数；不满3人时因存在个人身份识别风险，不进行统计汇算。

当样本基数不足20时，不输出比率而仅展示件数；对于未能观察到的项目，不标为“无业绩”，而是附带理由标为“未观察到”。`grift verify`能够以相同条件重新计算已保存的报告，并返回一致、不一致或无法验证的结果，以便接收方核实是否存在篡改或出入。

从0.9.0开始，在`grift actor`的Markdown开头，会用简短的语句描述从记录中所体现的工作推进方式。针对变更类别的分布、变更节奏、测试添加方式以及参与方式，附带件数和时间跨度进行说明；随后说明从该记录中无法看出的事项，并以问题的形式列出希望在面谈中确认的要点。`grift project`以相同的规则编写项目仓库的推进方式，不输出个人维度的数字和参与方式。`grift align`在要求与记录的对照中，以问题的形式附带希望在面谈中确认的事项。文句和问题根据公开的[判定表](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.0/docs/trait-profile.md)基于数字选取，不使用AI。由于未纳入JSON，因此可通过`grift verify`验算的，是作为文句生成来源的那些数字。

针对个人的描述语句和问题，仅在采用本人声明的ID且存在同意记录时才会输出。其他情况下，将用一句话说明未输出的理由。批量汇总输出多人时（`--all`、`--top`），不输出描述语句。

该方法论定名为TEP（Technical Evidence Pipeline，技术证据提取链路）。由读取git记录、按既定规则计数、为计数得出的数值附带分母及无法计数的理由、确保任何人均可按相同步骤重新计数这4个阶段构成。详细说明请参阅Grift网站的[TEP页面](https://griftai.org/tep)。

本页面及griftai.org所使用的表述，与CLI输出中编写的词汇对应如下：

| 网站表述 | CLI词汇 |
|---|---|
| 检查值 | observed value（`kind: observed`。附带数值、单位与分母） |
| 测试伴随修改率 | test co-change |
| 返工率 | corrective rework |
| 修缮重触 | path retouch |
| Code recency | survival（仅在指定`--survival`时） |
| 仓库上下文 | context profile |
| 工作领域・变更节奏・验证形态 | surface_profile / change_rhythm / verification_profile |

从0.9.0开始，CLI的Markdown也将变更类别的分布（工作领域）、变更节奏（变更节奏）、测试添加方式（验证形态）以及参与方式这4个观察视角，采用与griftai.org相同的名称进行书写。JSON的键名保持不变。

在0.9.2中，实现了无需在宿主机安装Python，即可使用基于grift-cli仓库构建的Docker镜像运行。欲读取的仓库需获取完整历史并传递给`/repo`。通过`git worktree`创建的工作树无法使用。

`grift update`已变更为仅更新当前正在运行的环境，并在更新后显示所安装的版本。不使用PATH中的其他环境。`grift update --check`仅读取PyPI的最新版本信息，不执行更新。不存在自动更新以及日常测量命令为确认版本而进行通信的情况。

`grift contribute`会在获得本人同意后将提交用文件保存至本地。不会自动发送。使用默认的`--door local`创建的文件无法提交至公开接收渠道，因此不显示提交ID、PR内的文件名及meta行，仅显示通过`--door public-pr`重新创建的步骤。若要公开提交，需使用重新创建后的执行所显示的提交ID、PR内的文件名、meta行以及两条提交途径的URL。无论是本人发起的公开PR，还是隐匿身份的代理PR，文件内容都将被公开。

- 代码仓库: [github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- 分发渠道: PyPI“grift-cli”（`pipx install grift-cli`，需Python 3.11以上）
- 许可证: MIT
- 发行说明: [github.com/Cor-Incorporated/grift-cli/releases](https://github.com/Cor-Incorporated/grift-cli/releases)（各版本变更点）

## 成果

2026年9月8日，在PyPI上发布了[v0.7.2](https://pypi.org/project/grift-cli/0.7.2/)。各项指标在117个公开仓库中进行了验证，能够区分的对比和尚无法区分的对比均已在GitHub上公开（属于内部测量，未接受第三方审计）。

2026年10月25日，我们将网站文案与CLI输出逐行进行了对照核对。发现多人一览（`actor-index`）中虽然在备注中写有“并非排名”，但实际上却是按照提交次数从多到少的顺序排列的；因此在2026年10月26日发布的[0.8.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0)中，将排序变更为按ID的字典序。提交次数的数值予以保留。具体原委以及对0.8版本设定的5条验收条件已写入[博客文章](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/)。

在2026年10月27日发布的[0.9.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.0)中，加入了上述报告开头的描述语句与面谈问题。与此同时，从Markdown中移除了体现倾向“强弱”的行以及比对“适向”的行。这是因为两份报告并列放置时，容易被解读为能力强的人与能力弱的人、合适的人与不合适的人。此外，还修复了4处可能导致针对个人输出失实数据的缺陷。

在2026年10月28日发布的[0.9.1](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.1)中，修复了0.9.0发布后发现的可能导致针对个人或项目输出失实数据的缺陷。没有新增命令，不输出评分、排名、类型名称的做法也保持不变。由于定义版本发生了变更，使用0.9.0保存的报告和比对结果，在0.9.1的`grift verify`中将无法完成验算（仅根据要求生成的项目报告等例外情况，请参阅[迁移注意事项](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.1/docs/migration-v091.md)）。

在[0.9.2](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.2)中，`grift report`的Markdown所包含的仓库上下文栏目中，新增显示了在所观察历史中首次活动的年份、最后活动的年份，以及标签频率的分子和分母。JSON中的数值保持不变。由于目前仍在活动的人员也会显示最后活动年份，因此这并不表示离开项目或离职。标签频率是按照“标签数 ÷ 活动期间天数 × 365.25”进行年化换算的数值，并非观察到的实际发布次数。对于活动期间不足20天的仓库，不进行年化换算，仅显示标签数量和天数。

没有新增命令，不输出评分、排名、合格与否的做法也保持不变。虽然没有修改分析数值的改动，但由于提升了定义版本，使用0.9.1保存的报告和比对结果，在0.9.2的`grift verify`中将无法完成验算（仅根据要求生成的项目报告等例外情况，请参阅[迁移注意事项](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.2/docs/migration-v092.md)）。

目前，我们正与中介机构及SES企业共同推进概念验证（PoC）的筹备工作，旨在基于候选人本人在本地运行的记录，让推荐理由更加具体充实。我们也欢迎自研企业的招聘负责人就概念验证（PoC）进行咨询，以探讨如何根据候选人本人分享的记录，查证其过往从事过怎样的工作。关于正式版本，我们计划根据概念验证的结果，争取在2027年开始提供。Grift在 [griftai.org](https://griftai.org) 上也有介绍。

Grift的理念在[Qiita](https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1)和[note](https://note.com/cor_instrument/n/nd58ba0955317)的文章中亦有介绍。
