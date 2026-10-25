---
title: "Grift —— 简历可以注水，证据无法造假。从git历史中提取可验证事实的OSS"
description: "自研产品Grift能从工程师的git历史中提取可验证的事实（检验值）而非评分。本文将介绍它从估算支持Web应用转型为开源CLI，并面向人才中介与SES企业提供推荐支持的历程与设计。"
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "人才介绍", "SES"]
publishedAt: 2026-06-30
updatedAt: 2026-10-25
summary: "Grift是一款从工程师的git历史中提取“可验证事实”的自研产品。它不打分也不排名。由于在衡量过程中不使用AI（LLM），因此无论由谁运行都会得出相同的结果，接收方亦可复核验算。CLI已作为MIT许可证的OSS公开发布。"
isDraft: false
featured: true
lang: "zh"
translationSourceHash: "0c724e7e86ea6f90f6f9849a4cbea6fd163e7d36fe697b9a345d8eb38f42ca18"
translatedAt: "2026-10-25T07:40:18.519Z"
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
-->

## 课题

人才中介机构和SES（系统工程服务）公司的销售人员在向企业推荐候选人时，需要解释“为什么推荐这个人”。然而，手头拥有的材料几乎只有简历和面试印象。即使写着“Java 5年”，也无法传达具体的工作内容，比如做出了怎样的修改、又是如何进行验证推进的。

另一方面，像GitHub的绿墙（Contribution草图）和提交次数这类“活动量”，借助生成式AI和Agent可以轻松膨胀。数量的多寡已难以作为推荐的依据。但如果将其汇总成单一的分数，衡量了什么、在什么期间、基于多大的基数这些关键信息就会消失，甚至沦为粗暴筛选的淘汰工具。无论对于推荐方还是被推荐方，“可验证的材料”都严重匮乏。

## 方法

Grift于2026年2月起步，最初是一款用于支持受托开发估算的Web应用。在探寻估算依据的过程中，我们意识到最可靠的材料正是工程师长期积累的git历史本身，并于2026年8月将测量部分拆分成了命令行工具。9月，我们停止了原Web应用的提供，将方向调整为赋能人才中介机构和SES销售人员。

在设计上，我们预先确立了3项原则：

- 不打分：仅输出检测值，由人来做判断。不给出综合评分、排名、合格与否及等级，数值必须附带分子和分母
- 每次结果一致：测量不使用AI（LLM）。在相同的代码仓库和相同版本下，任何人执行都会得到相同的数值
- 不向任何地方发送：仅在本地电脑上运行。是否共享、出示哪些代码仓库均由本人决定

同时，我们制定了包括“不将缺失解读为负面表现”、“不单纯依据数值进行淘汰筛选”、“未经本人同意不对他人进行测量”等在内的7条使用规范，并规定不遵守规范的使用方式不得冠以此方法之名（TEP: Technical Evidence Pipeline）。

## 实现

Grift CLI仅从git历史中提取如下观测数据：

- 归属区分：分为本人独立提交、他人工作、bot、生成/供应商产出、继承自fork源的历史等11个类别，区分具体是谁的工作
- 测试同步修改率：在更改生产代码的同一次提交中，同步修改测试的比例
- 返工率・微调润色：对近期触碰过的文件进行返工或再次改动的比例（仅作为倾向记录，不用于判定合格与否）
- 代码仓库上下文：实际工作天数、参与人数与最多贡献者的占比、经过评审流程的比例等

在v0.6中加入的`report-v2`增加了一个观察单名工程师工作形态的层级。所有指标均带有分子和分母，并非对职能或能力的评判。

- 工作领域（`surface_profile`）：分为test / docs / CI/CD / platform / data / observability / frontend / backend / config / 生成与供应商产出 / 其他共11个类别，统计各个领域的修改各有几件
- 变更节奏（`change_rhythm`）：最近180天内提交变更的天数以及提交间隔（中位数和第90百分位数、2天内连续提交的比例、间隔30天以上的比例）。这不代表劳动时间或工作意愿
- 验证形态（`verification_profile`）：涉及测试的提交比例及其类型（unit / integration / e2e / contract / 未知）、fix提交中附带测试的比例
- 角色4维画像（`role_profile`）：仅包含domain / work_type / time / process_position四项，不归并为单一职种。仅在存在记录了本人同意的identity时才会输出

与项目需求的匹配也以不进行排名的方式进行。需求方通过`grift project`声明所需的领域、验证、节奏和输入，`grift align`将候选人的观测值按维度并列呈现。并列对照仅有重合（overlap）、超出声明范围（outside_declared_range）、0件（observed_zero）、未观测到（not_observed）、无要求（not_declared）这5种情况，不计算综合得分、排名和合格与否。通过`--team`按团队维度查看时，仅输出满足要求的人数；若少于3人，由于容易识别出个人，则不进行统计。

当基数小于20时，不显示比率而仅展示件数；对于未能观测到的内容，不作为“无业绩”处理，而是附带理由标记为“未观测到”。`grift verify` 会在相同条件下重新计算已保存的报告，并返回一致、不一致或无法验证的结果，以便接收方核实是否存在篡改或分歧。

该方法的名称为TEP（Technical Evidence Pipeline）。本页面及griftai.org中使用的表述与CLI输出中所写的术语对应如下：

| 网站表述 | CLI术语 |
|---|---|
| 检测值 | observed value（`kind: observed`。附带数值、单位和分母） |
| 测试同步修改率 | test co-change |
| 返工率 | corrective rework |
| 微调润色 | path retouch |
| 留存率 | survival（仅在指定了`--survival`时） |
| 代码仓库上下文 | context profile |
| 工作领域・变更节奏・验证形态 | surface_profile / change_rhythm / verification_profile |

- 代码仓库：[github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- 分发途径：PyPI“grift-cli”（`pipx install grift-cli`，支持Python 3.11及以上）
- 开源许可：MIT

## 成果

2026年9月8日，我们在PyPI上发布了v0.7.2。各项指标在117个公开代码仓库中进行了验证，能够区分的对照与尚未能区分的对照均已在GitHub上公开（属于内部测量，未接受第三方审计）。

2026年10月25日，我们将网站文案与CLI的输出进行了逐行比对。由于多人列表（`actor-index`）在附注中虽注明“并非排名”，但实际上是按提交次数降序排列的，因此在下一版本（0.8）中，排序将改为按ID的字典顺序。提交次数的数值将予以保留。具体原委以及为0.8版本设定的5项验收条件已记录在[博客文章](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/)中。

目前，我们正在与人才中介公司及SES企业共同推进概念验证（PoC）的准备工作，旨在基于候选人本人在本地执行的记录，让推荐理由更加具体充实。关于正式版，我们计划结合概念验证的结果，争取于2027年开始提供。Grift在 [griftai.org](https://griftai.org) 上也有介绍。

Grift的设计理念也已在 [Qiita](https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1) 和 [note](https://note.com/cor_instrument/n/nd58ba0955317) 的文章中发布。
