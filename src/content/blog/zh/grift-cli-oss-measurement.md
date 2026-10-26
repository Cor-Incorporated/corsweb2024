---
title: "简历上的年限看不出工作方式。用不打分的Grift，测评了4个真实的开源项目"
description: "仅凭简历上的年限或人月，无法了解一个人具体是如何开展工作的。本文面向职业介绍公司、SES销售人员及工程师，阐述Cor.打造不打分也不排名的Grift的缘由、它与MBTI的区别，以及测评4个真实开源项目时能看到的与看不到的内容。"
summary: "Grift根据git中留存的变更记录，呈现工作倾向以及作为其依据的件数。与本人回答问题得出类型的MBTI不同，它的依据不是自我申报而是记录，只要记录相同，无论谁来统计都会得出相同的数值。在对4个真实开源项目进行测评后，虽然能看出工作领域以及变更间隔的差异，但无法体现评审质量、会议以及未获本人同意的经历。数字必须结合分母和规则来解读，最终做出判断的仍然是人。"
pubDate: 2026-10-25
updatedDate: 2026-10-26
author: "Terisuke"
category: "engineering"
ctaIntent: "grift-team-beta"
tags: ["Grift", "OSS", "CLI", "git", "実測"]
lang: "zh"
featured: false
isDraft: false
translationSourceHash: "b44f7e8456ab016f75a19cebd16e68f08f1dd0d7ff7409e14f2d35c261b63b91"
translatedAt: "2026-10-26T13:31:20.824Z"
translationModel: "gemini-3.8-flash"
---

即便简历上写着“Python 5年”，我们依然无法了解在这5年里对方究竟做过怎样的工作。

年限与人月确实可以作为工作量的参考标准。然而，对方是习惯一边编写验证行为的测试一边推进开发的人吗？是善于整理文档的人吗？还是习惯频繁提交细微修改的人？这些数据无法告诉我们其工作方式。

职业介绍机构与SES的销售人员往往会因为无法拿出确凿依据说明推荐理由而陷入停滞。Cor.株式会社认为，原因之一正是在于这层落差。

## 不打分数的理由

Grift是为了填补这一落差而开发的自研产品。它从git（逐次记录软件变更的机制）中留存的记录中，提取出工作倾向以及作为其依据的数据项数。它既不给出评分，也不进行排位。

公司代表寺田 康佑在Recruit从事招聘广告销售期间，曾深切体会过话语无法传达意图的焦灼感。关于Grift，他曾写道：“简历可以注水，证据无法造假。”

一旦将其转化为分数，会发生什么？将不同类型的记录压缩为一个数字后，统计了什么、无法统计什么，都会随之消失。而且只要有了分数，高分者就会显得更优秀；一旦排序，就会形成顺位。

在Grift中，我们想做的事情并不是将人按顺位排列，而是将契合该人工作倾向的项目与人才连接起来。为此，我们仅呈现可验证的事实。做判断的始终是人。

## 与MBTI的区别

听到“不排顺位”，可能有人会联想到MBTI。

MBTI是由本人回答问卷，从4种偏好的组合中得出16种类型。MBTI基金会（The Myers & Briggs Foundation）指出，每种类型都具有价值，且该测试并非为了招聘目的而创建。

Grift不进行问卷提问，不贴上类型标签，也不是诊断性格的工具。它通过统计git中留存的记录，输出工作倾向以及作为其依据的件数。

若结合销售人员的困扰来看，两者的区别会更加清晰易懂。

简历上的自我申报，不知道该相信到什么程度。MBTI的结果与简历一样，均来自本人的回答。而Grift的依据是客观记录。只要提供相同的记录，无论由谁来统计，都会得出相同的数值。

仅凭年限或人月，无法了解工作方式。Grift会以件数形式呈现对方接触过哪些领域（测试、文档、主体程序等）、以怎样的时间间隔提交变更，以及修复性变更是否附带了测试。

不过，未留存在记录中的内容则无法呈现。在会议中的表现、代码评审的质量、未公开的工作内容均无法窥见。在未获得本人同意的情况下，也不会呈现个人的经验与角色。

## 名为TEP的流程

Grift将从记录中提取事实的流程称为TEP（Technical Evidence Pipeline，技术证据提取流程）。其核心包含4个阶段：

1. 读取git记录。不使用AI推测
2. 按照既定规则进行统计。例如，根据文件的存放位置和名称，区分属于测试还是文档
3. 为统计所得数值附上分母，并注明未能统计的项目之原因
4. 确保任何人都能按照相同流程重新核算

第4步的重新核算在Grift中被称为验算。关于TEP的详细说明，请参阅Grift网站的[TEP页面](https://griftai.org/tep)。

## 在真实OSS上进行验证

按照这一流程，是否真的能看出工作倾向？2026年10月25日，我们使用Grift CLI（通过命令行运行的Grift工具）0.8.0版本进行了验证。截至当天，0.8.0版本仍在准备公开发布，并于次日10月26日正式发布（[发布说明](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0)）。

为避免在未获同意的情况下测量真实人物，我们以代码公开的软件（OSS）的代码仓库（汇集单一软件记录的场所）为单位进行了测量。本文未包含任何针对个人的数据。

我们测量了4个特性各异的软件：

- click：Python中用于构建命令行工具的库（供其他程序调用的组件）
- flask：Python中用于构建Web服务的库
- httpx：Python中用于进行Web通信的库
- commander.js：JavaScript中用于构建命令行工具的库

## 观察到的结果

4个软件的测量与验算均在2.5秒内完成。4个软件的验算结果在所有项目上均完全一致。

各代码仓库的特性差异也得以显现。

在click中，截至记录最后一日的180天内，共有187次变更。变更与变更之间的中位数间隔约为2小时。变更以较短的间隔持续进行。

在flask中，涉及文档的变更有1,841次，多于涉及主体程序的变更（1,765次）。

在httpx中，包含测试文件的变更在1,335次中占了575次。

在commander.js中，主体JavaScript文件未被计入“主体程序”，而是被归入了“其他”。这是Grift规则的疏漏。原因在于作为主体程序进行统计的扩展名（文件名末尾部分）中，未包含JavaScript的`.js`。

## 对数字的误读

通过实际测量我们发现，如果仅仅罗列数字，极易产生误读。以下列举5个例子：

### 变更次数

变更次数多的代码仓库，并不等同于优质的代码仓库。flask的变更为3,674次，httpx为1,335次。历史跨度上，flask为5,976天，httpx为2,517天。次数会因历史长短以及是否合并汇总引入变更而发生变化。

### 文档变更

文档变更较多，并不意味着对撰写文档充满热情。在click中被计为文档的变更里，约有4成的变更仅触及了变更历史文件这一种文档文件。在每次变更都会记录变更历史的代码仓库中，文档的次数便会增加。

### 修复性变更

主题以“fix”（修复）开头的变更未附带测试，并不意味着不写测试。重新统计flask中以“fix”开头的变更后发现，407次中有198次仅仅是针对文档或配置文件的变更。这些提交的主题例如“fix typo”（修改错字）等。

### 较少的变更

变更较少，并不意味着开发处于停滞状态。在httpx中，所观察的180天内仅有11次变更，间隔显示为“未观测”（未能测量）。本次测量使用的是9月2日拉取到本地的记录，并非当前最新状态。

### 活跃天数

活跃天数（发生变更的天数）可以通过变更的拆分方式来人为增加。为了验证，我们创建了2个小型代码仓库，并分别增加了相同的5行代码。如果一次性汇总添加，活跃天数为2天；如果分5天每天添加1行，则为6天（两者均包含最初的1次）。其实际内容是完全相同的。

Grift不会对该数字进行修正。作为替代，它会在数字旁注明：“每天提交 1 次细微 commit 会使该值增加，将相同变更合并至 1 天则会减少。”

## 未能观察到的内容

Grift会将未能测量的项目标注为“未观测”。未观测意为“未能测量”，并不等同于“没有业绩”。在本次的4个软件中，以下内容未能观察到：

- 评审与问题管理：由于未提供GitHub等平台的记录，因此属于未观测
- 个人经验与角色：由于未获本人同意，因此属于未观测
- 是否属于本公司变更：由于未定义本公司的邮箱地址，因此全部显示为“无法判定”

在此也记录未能顺利运作的部分。正如前文所述，commander.js的主体程序被归入“其他”属于规则疏漏。此外，在同日的文章中曾提到“测试伴随修改率（修改主体的同时修改测试的比例）也会因形式上的测试变更而上升”。在0.8.0版本中，该提示尚未显示在数字旁。当前附带提示的，仅有活跃天数的一句话说明。

## 0.8.0版本中的修复

在[0.7.2](https://pypi.org/project/grift-cli/0.7.2/)（测量时的公开版本）中，参与代码仓库的人员列表是按照变更次数由多到少的顺序排列的。这容易让人将排在首位的人误读为“贡献最大的人”。在0.8.0版本中，改为按照ID（分配给每个人的标识）顺序排列。

我们在4个代码仓库中对比了0.7.2与0.8.0的列表。不看姓名和数量，仅观察排列顺序。0.7.2在4个软件中，排在最首位的均是变更次数最多的人。而在0.8.0中，该人员所在行在click中为467行中的第120行，在flask中为870行中的第280行，在httpx中为258行中的第232行，在commander.js中为203行中的第15行。

若将0.8.0的列表重新按变更次数从多到少排序，则无法通过验算。其他数值在0.7.2与0.8.0中均保持一致。

## 与项目需求对照

在与项目进行匹配对接时，需要预先写明项目方所期望的要求。Grift将此称为宣言。它与从git中观察到的情况（观测）分列于不同栏目中，且不给出合规与否的结论。

作为测试，我们设定了一个虚构的微型项目需求“维护Python库”。该宣言要求：180天内有12天以上的活跃记录、变更间隔的中位数值在7天以内、接触过主体程序与测试、包含单元测试、查阅GitHub等平台的记录。

将其对照到click时，在宣言的“12天以上”旁边，会并列显示观测到的“62天”。由于未提供GitHub等平台的记录，该栏目保持为未观测。

即使并列呈现，前文提到的误读风险依然存在。commander.js的“主体程序”为0次是规则疏漏所致，而httpx的间隔则因记录不足显示为未观测。如何解读并列呈现的数值，由人来决定。

此外，也存在将工程师本人的记录与项目需求进行对照的用法。在这种情况下，仅使用获得本人同意的记录。由于这涉及到对真实个人的测量，因此本文中未进行该项尝试。

## 结语

git记录可以作为核实简历陈述的参考材料。然而，有些工作并不会留在记录中。

Grift所呈现的，是工作倾向、作为其依据的件数，以及未能观察到的项目之原因。在此基础上得出怎样的判断，应由阅读者自行决定。

## 依据数据

为方便工程师在本地进行验证，现将测量条件与数据汇总如下：

- grift 0.8.0（定义版本`tep-v0.8.0-2026-10-25`）。本地引入了公开发布前的源代码（开发仓库的`87076c8`）。公开发布的0.8.0版本`src/`（程序主体）与此源代码一致
- 为进行对比，当时的公开版本[0.7.2](https://pypi.org/project/grift-cli/0.7.2/)也对相同的4个软件进行了处理
- Apple M4 Max、macOS 26.7.1、Python 3.12.9、git 2.54.0
- 目标为2026年9月2日clone后未作更新的本地4个软件

测量的commit（单次变更记录）的SHA（赋予各commit的标识符）及其日期如下：

```text
pallets/click    36baa15ff831b939a22bc527cd76ce653ef6f66d  2026-08-26
pallets/flask    d318b683471101618febed18996405ad26462110  2026-08-16
encode/httpx     b5addb64f0161ff6bfe94c124ef76f6a1fba5254  2026-02-23
tj/commander.js  ba6d13ddb4243e5913367734f8c159089ffe7834  2026-05-29
```

以click为例的命令如下：

```bash
git clone https://github.com/pallets/click
git -C click checkout 36baa15ff831b939a22bc527cd76ce653ef6f66d
grift repo click --format both --out out/click
grift verify out/click/report.json --repo click
```

`grift repo`在4个软件中均在2.5秒内完成，`grift verify`在4个软件中均为`VERIFIED`。即使在重新clone的click上执行，除了执行时间以外，得出的结果完全一致。使用与当时公开版本[0.7.2](https://pypi.org/project/grift-cli/0.7.2/)相同的源代码执行，此处记载的观测值也是相同的。

| 代码仓库 | 人工commit / merge / bot |
|---|---|
| click | 2,000 / 1,131 / 200 |
| flask | 3,674 / 1,691 / 191 |
| httpx | 1,335 / 41 / 147 |
| commander.js | 1,095 / 284 / 138 |

人工commit为排除merge（合并其他分支变更的记录）后的件数。已排除bot（自动提交变更的程序）的变更。

工作领域（`surface_profile`）根据文件的存放位置和扩展名确定分类，并按分类统计commit。由于单次commit可能对应多个分类，因此合计值会超过分母。

| 代码仓库 | 分母 | test / docs / backend / other |
|---|---|---|
| click | 1,999 | 562 / 1,024 / 1,158 / 309 |
| flask | 3,673 | 627 / 1,841 / 1,765 / 575 |
| httpx | 1,333 | 575 / 501 / 874 / 112 |
| commander.js | 1,094 | 286 / 468 / 0 / 530 |

变更间隔（`change_rhythm`）以HEAD的日期作为观测日，统计此前180天内的数据。观测日即上方SHA右侧所注明的日期。

| 代码仓库 | commit / 活跃天数 | 间隔中位数 / p90 |
|---|---|---|
| click | 187 / 62天 | 0.08天 / 3.36天 |
| flask | 32 / 19天 | 0.80天 / 15.60天 |
| httpx | 11 / 8天 | 未观测 |
| commander.js | 22 / 18天 | 2.88天 / 17.89天 |

httpx未观测的原因为`insufficient_population`。时间窗口内的commit仅有11件，未达到计算比率所需的最低下限20件。

验证形态（`verification_profile`）统计归属于test位置的commit。

| 代码仓库 | 包含test的commit | 主题为fix且同时修改了test的commit |
|---|---|---|
| click | 562 / 2,000 | 80 / 249 |
| flask | 627 / 3,674 | 58 / 408 |
| httpx | 575 / 1,335 | 46 / 114 |
| commander.js | 286 / 1,095 | 30 / 106 |

关于test的种类，click为unit 555、不明23；flask为unit 484、不明204；httpx为unit 554、不明101；commander.js为不明286。

未观测的项目数量，click、flask、commander.js为23项，httpx为27项。主要原因如下：

- `forge_export_not_provided`、`tracker_export_not_provided`：评审、问题管理、事件
- `consenting_actor_required`：经验、角色、库的上下文
- `no_upstream_lineage`、`parent_repo_not_provided`、`template_not_provided`：与upstream的关系、从模板的继承
- `no_tenant_commits`：包含本公司8成commit的时段
- `survival_scan_disabled`：Code recency（当前代码在多大程度上是近期编写的）
- `outcome_declaration_not_provided`：作业发生后情况的宣言
- `deferred_to_v0.6`：行级别的返工（在0.8.0中依然沿用0.6时期的命名）

来源（`origin`）方面，4个软件中除bot以外的所有commit均为`unresolved`。这是因为既没有提供定义本公司邮箱地址的identity.toml，也没有提供fork的父级。

click中计入文档的commit明细，以及flask中fix的commit明细，并非Grift的输出结果。这是将相同规则应用于git log后在本地重新核算的概数。click的1,025件中有414件作为文档触及的文件仅有`CHANGES.rst`。flask的主题为fix的407件commit中，有198件仅修改了文档或配置文件。

列表排序（`actor_directory`）方面，若将0.8.0的数据行按commit数量从多到少重新排列并用`grift verify`校验，会显示`MISMATCH: 1 field(s) differ`并以退出码1结束。若使用0.8.0验算在0.7.2中保存的报告，则因定义版本不同而显示`CANNOT_VERIFY`。活跃天数的提示语句在0.8.0中出现在`activity.limitations`和`change_rhythm.limitations`中，而0.7.2中没有该提示。

项目需求的宣言使用了以下文件：

```toml
schema_version = "tep-project-v1"
project_id = "example-python-lib-maintenance"
title = "Python ライブラリの保守（架空の案件）"

[requirements.change_rhythm]
active_days_180d_min = 12
median_gap_days_max = 7

[requirements.surfaces]
required = ["backend", "test"]

[requirements.verification]
required = ["unit"]

[requirements.inputs]
required = ["git", "forge"]
```

```bash
grift project click --requirements python-lib-maintenance.toml --format both --out project/click
```

输出结果分为“项目方宣言”和“观测到的数值”两个章节，未作宣言的项目显示为`not_declared`（项目方未注明，并非不足）。按各维度比对宣言与观测结果的是`grift align`，以重叠、超出范围、0件、未观测、无要求5种状态呈现。

## 参考资料

- [grift-cli（GitHub，MIT）](https://github.com/Cor-Incorporated/grift-cli) - CLI源代码。测量时的公开版本为0.7.2，0.8.0于2026年10月26日发布
- [grift-cli 0.8.0发布说明（GitHub）](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0) - 0.8.0变更点
- [grift-cli 0.7.2（PyPI）](https://pypi.org/project/grift-cli/0.7.2/) - 测量时的公开版本
- [Grift](https://griftai.org) - 产品网站
- [TEP页面（Grift）](https://griftai.org/tep) - TEP详细说明
- [grift报告阅读指南（metrics-guide）](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/metrics-guide.md) - 各指标的浅显解读
- [TEP利用规范（norms）](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/norms.md) - 不将缺失作负面解读、禁止加权与折算
- [如何在实现中坚守“不打分、不排位”（Cor.株式会社博客，2026年10月25日）](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/) - 0.8确立的5项条件
- [为了让“啊，对方理解了”成为日常，我创立了这家公司（Cor.株式会社博客）](https://cor-jp.com/blog/founder-story/) - 代表的故事与Grift诞生的初衷
- [Ethical Use of the MBTI（The Myers & Briggs Foundation）](https://www.myersbriggs.org/unique-features-of-myers-briggs/ethical-use-of-the-mbti/) - MBTI使用规定（遵循自愿原则、非招聘目的）
- [MBTI Basics（The Myers & Briggs Foundation）](https://www.myersbriggs.org/my-mbti-personality-type/mbti-basics/) - 4种偏好与16种类型
- [pallets/click](https://github.com/pallets/click) - 测量的OSS（HEAD `36baa15`）
- [pallets/flask](https://github.com/pallets/flask) - 测量的OSS（HEAD `d318b68`）
- [encode/httpx](https://github.com/encode/httpx) - 测量的OSS（HEAD `b5addb6`）
- [tj/commander.js](https://github.com/tj/commander.js) - 测量的OSS（HEAD `ba6d13d`）
