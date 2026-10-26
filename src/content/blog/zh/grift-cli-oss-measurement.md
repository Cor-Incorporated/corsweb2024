---
title: "简历上的年限无法体现工作风格。用不打分的Grift，对4个真实开源项目进行了测算"
description: "仅凭简历上的年限和人月，无法了解一个人具体是如何开展工作的。Cor.为何开发既不打分也不排名的Grift？它与MBTI有何不同？对4个真实开源项目进行测算后看到了什么、又没看到什么？本文面向人才中介机构、SES业务负责人以及工程师撰写。"
summary: "Grift根据git中留存的变更记录，导出工作倾向以及作为其依据的件数。与本人回答问题得出类型的MBTI不同，其依据不是自我申报而是记录，只要记录相同，任何人统计都会得出相同的数值。测算4个真实的开源项目后，虽然能够看出工作领域和变更间隔的差异，但无法体现审查质量、会议情况以及未经本人同意的经历。数字需要结合分母和规则一起解读，最终做出判断的仍然是人。"
pubDate: 2026-10-25
updatedDate: 2026-10-26
author: "Terisuke"
category: "engineering"
ctaIntent: "grift-team-beta"
tags: ["Grift", "OSS", "CLI", "git", "実測"]
lang: "zh"
featured: false
isDraft: false
translationSourceHash: "61adea75f963a89f574f1cd38d9f408c55358ef125e28f24b4119267c8a3c4a5"
translatedAt: "2026-10-26T04:36:19.631Z"
translationModel: "gemini-3.8-flash"
---

简历上即使写着“Python 5年”，也无法据此得知这5年里究竟做过怎样的工作。

年限与人月可以作为工作量的参考。但是，此人是边写测试验证运行边推进工作的人吗？是注重梳理文档的人吗？还是频繁提交细小修改的人？这些都无法体现出具体的工作方式。

人才中介或SES（系统工程服务）的销售人员往往因无法给出有据可依的推荐理由而陷入停滞。Cor.株式会社认为，原因之一正是在于这处断层。

## 不打分的理由

Grift就是为了填补这处断层而自研的产品。它从git（逐次记录软件变更的机制）中留存的记录出发，提取出工作倾向以及作为其依据的件数。既不打分，也不排定名次。

代表寺田 康佑在Recruit从事招聘广告销售期间，曾体会过言语无法准确传达的无奈。关于Grift，他写道：“经历可以注水，证据无法作假。”

如果折算成分数，会发生什么？把不同种类的记录归结为一个数字，究竟统计了什么、遗漏了什么就会彻底消失。而且一旦有了分数，得分高的人看起来就更优秀。排在一起，便成了排行榜。

在Grift中，我们想做的事情绝非给人排定座次，而是将契合该人工作倾向的项目与人才连接起来。为此，我们只呈现可供核实的事实。做出判断的始终是人。

## 与MBTI的区别

听到不排定名次，也许有人会联想到MBTI。

MBTI由本人回答问卷，从4种偏好的组合中得出16种人格类型。MBTI基金会（The Myers & Briggs Foundation）指出，每种类型都有其价值，且该测试并非为了招聘目的而创建。

Grift不提问题。不给类型贴标签。也不是诊断性格的工具。它通过统计git中留存的记录，输出工作倾向以及作为其依据的件数。

若代入销售人员的困扰中，两者的区别就很容易理解。

不知道简历中的自我陈述能在多大程度上采信。MBTI的结果与简历一样，均源自本人的回答。而Grift的依据是客观记录。只要提供同一份记录，无论由谁来统计，得到的值都完全相同。

仅凭年限与人月，无法了解工作方式。Grift以具体件数呈现出曾涉足过哪些领域（测试、文档、主程序等）、变更提交的间隔频率、修复性变更中是否附带测试等。

不过，未留存在记录中的内容无法呈现。会议中的贡献、代码审查的质量、未公开的工作均不可见。若未经本人同意，个人的经验与职责也不会输出。

## 名为TEP的流程

Grift将从记录中提取事实的流程称为TEP（Technical Evidence Pipeline，技术证据提取管线）。其内容分为4个阶段：

1. 读取git记录。不使用AI推测
2. 按照固定规则统计。例如，根据文件的存放位置与名称，区分测试或文档
3. 为统计得到的值附上分母，并注明未统计项的理由
4. 确保任何人按照相同流程都能重新统计验算

第四步的重新统计，在Grift中被称为“检算”。关于TEP的详细说明，请参阅Grift网站上的[TEP页面](https://griftai.org/tep)。

## 使用真实开源软件（OSS）进行测试

通过这一流程，是否真的能看清工作倾向？2026年10月25日，我们使用Grift CLI（命令行运行的Grift工具）0.8.0进行了验证。0.8.0在当天尚处于发布准备阶段，并于次日10月26日正式发布（[发布说明](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0)）。

为避免在未经同意的情况下度量真实的人，我们以代码公开的开源软件（OSS）为对象，按代码仓库（归档单个软件记录的单元）进行了度量。本文未列出任何关于具体个人的数据。

我们度量了4个特性各不相同的仓库：

- click：Python中用于构建命令行工具的库（供其他程序调用的组件）
- flask：Python中用于构建Web服务的库
- httpx：Python中用于进行Web通信的库
- commander.js：JavaScript中用于构建命令行工具的库

## 观察到的现象

4个仓库的度量与检算均在2.5秒内完成。检算结果在4个仓库的所有项目中均完全一致。

各代码仓库特性的差异也清晰展现了出来。

在click中，截至记录最后一天的180天内，共有187次变更。变更与变更之间的间隔中位数约为2小时。变更是以较短的间隔持续进行的。

在flask中，涉及文档的变更有1,841次，多于涉及主程序的变更（1,765次）。

在httpx中，包含测试文件的变更有575次，共计1,335次。

在commander.js中，主JavaScript文件未被计入“主程序”，而是落入了“其他”。这是Grift规则的疏漏。原因是作为主程序统计的扩展名（文件名末尾部分）中，未包含JavaScript的`.js`。

## 对数字的误读

经过度量后发现，如果仅罗列数字，极易产生误读。以下列举5个示例。

### 变更次数

变更次数多的代码仓库，并不等同于优秀的代码仓库。flask的变更为3,674次，httpx为1,335次。其提交历史跨度，flask为5,976天，httpx为2,517天。次数会因历史长短以及是否集中合并变更而有所不同。

### 文档变更

文档变更次数多，并不意味着热衷于撰写文档。在click中被归为文档的变更中，约有4成所触及的文件仅为更新日志（Changelog）。在每次变更都附带更新日志的代码仓库中，文档的次数自然会增多。

### 修复性变更

主题以“fix”（修复）开头的变更未附带测试，并不意味着不写测试。重新统计flask中以“fix”开头的变更，407次中有198次仅仅是修改了文档或配置文件。其主题为“fix typo”（修复错别字）等。

### 较少的变更

变更较少，并不意味着开发已停滞。在httpx中，观察期180天内仅有11次变更，间隔显示为“未观测”（未能测出）。测定所使用的是9月2日拉取到本地的记录，并不代表当前的状态。

### 活跃天数

活跃天数（有变更的天数）可以通过切分变更的方式人为增加。为了验证，我们创建了2个小型代码仓库，增加了相同的5行代码。一次性集中添加时活跃天数为2天，分5天每天增加1行则为6天（两者均包含最初的1次提交）。其实际内容完全相同。

Grift不对该数字进行修正。作为替代，会在数字旁注明：“每天提交 1 次细小的 commit 会使其增加，将相同的变更合并至 1 天则会减少。”

## 未能观测到的内容

Grift将未能测出的内容标注为“未观测”。未观测的含义是“未能测出”，并不代表“没有实际成果”。在本次的4个对象中，未能观测到以下内容：

- 审查与工单管理：因未提供GitHub等记录，故显示为未观测
- 个人经验与职责：因未获得本人同意，故显示为未观测
- 是否为本公司变更：因未定义本公司的电子邮箱后缀，故全部判定为“无法确定”

在此也记录未能顺利运行的部分。commander.js的主程序落入“其他”，正如前文所述属于规则的疏漏。此外，在同日发布的文章中我们提到过“测试联修率（修改主程序时同步修改测试的比例）也会因形式主义的测试修改而虚高”。在0.8.0中，该注意事项尚未标注在数字旁。当时标注的仅有关于活跃天数的那一句话。

## 0.8.0中的修正

在[0.7.2](https://pypi.org/project/grift-cli/0.7.2/)（度量时的公开版本）中，参与代码仓库的人员列表是按变更次数降序排列的。这容易让人将排在最上面的人理解为“贡献最大的人”。在0.8.0中，改为按ID（为每个人分配的标识符）排序。

我们在4个代码仓库中对比了0.7.2与0.8.0的列表。不看姓名和数量，仅观察排序方式。在0.7.2中，4个仓库排在最顶部的均为变更次数最多的人。而在0.8.0中，该人员所在的行在click中为467行中的第120行，在flask中为870行中的第280行，在httpx中为258行中的第232行，在commander.js中为203行中的第15行。

若将0.8.0的列表重新按变更次数排序，则无法通过检算。其他数值在0.7.2与0.8.0中完全相同。

## 与项目并列比对

与项目需求进行对接时，需预先写明项目方的要求。Grift将此称为“声明”。它与从git中观察到的情况（观测）分栏并列展示，不给出合格与否的判定。

作为尝试，我们声明了一个虚构的小型项目——“Python库的维护”。声明内容为：180天内活跃天数在12天以上、变更间隔中位数在7天以内、涉足过主程序与测试、包含单元测试、查阅GitHub等记录。

以click为例进行比对，声明一栏的“12天以上”旁边，会并列显示观测到的“62天”。由于未提供GitHub等记录，该栏仍显示为未观测。

即使并列放置，上一节提到的误读风险依然存在。commander.js中“主程序”为0次属于规则疏漏，而httpx的间隔则因记录不足显示为未观测。如何解读并列呈现的数据，完全由人来决定。

该工具亦可用于将工程师本人的记录与项目进行比对。届时，仅会使用获得本人同意的记录。由于这涉及到度量真实的个人，本文未对此进行尝试。

## 结语

git记录可以作为核实简历陈述的参考材料。但是，同样存在无法留存在记录中的工作。

Grift所呈现的，是工作倾向、作为其依据的件数以及未能观测到的理由。从中得出何种判断，应由阅读者自行决定。

## 依据数据

为方便工程师在本地进行核实，现将度量条件与数据汇总如下。

- grift 0.8.0（定义版本`tep-v0.8.0-2026-10-25`）。在本地安装了发布前的源码（开发用仓库的`87076c8`）。正式发布的0.8.0的`src/`（程序本体）与该源码完全相同
- 为进行对比，当时的公开版本[0.7.2](https://pypi.org/project/grift-cli/0.7.2/)也针对相同的4个对象进行了运行
- Apple M4 Max、macOS 26.7.1、Python 3.12.9、git 2.54.0
- 对象为2026年9月2日clone后未曾更新过的本地4个仓库

所测定的commit（单次变更记录）的SHA（赋予每次commit的标识符）及其日期如下：

```text
pallets/click    36baa15ff831b939a22bc527cd76ce653ef6f66d  2026-08-26
pallets/flask    d318b683471101618febed18996405ad26462110  2026-08-16
encode/httpx     b5addb64f0161ff6bfe94c124ef76f6a1fba5254  2026-02-23
tj/commander.js  ba6d13ddb4243e5913367734f8c159089ffe7834  2026-05-29
```

以click为例的执行命令：

```bash
git clone https://github.com/pallets/click
git -C click checkout 36baa15ff831b939a22bc527cd76ce653ef6f66d
grift repo click --format both --out out/click
grift verify out/click/report.json --repo click
```

4个仓库的`grift repo`均在2.5秒内完成，`grift verify`均为`VERIFIED`。即使针对重新clone的click执行，除运行时间外结果完全一致。使用与当时公开版本[0.7.2](https://pypi.org/project/grift-cli/0.7.2/)相同的源码运行，此处列出的观测值也完全相同。

| 代码仓库 | 人工commit / merge / bot |
|---|---|
| click | 2,000 / 1,131 / 200 |
| flask | 3,674 / 1,691 / 191 |
| httpx | 1,335 / 41 / 147 |
| commander.js | 1,095 / 284 / 138 |

人工commit为剔除merge（合并其他分支变更的记录）后的件数。已排除bot（自动提交变更的程序）的修改。

工作领域（`surface_profile`）根据文件的存放位置与扩展名划分区间，并按区间统计commit。由于单次commit可能同时属于多个区间，因此各区间总和会超过分母。

| 代码仓库 | 分母 | test / docs / backend / other |
|---|---|---|
| click | 1,999 | 562 / 1,024 / 1,158 / 309 |
| flask | 3,673 | 627 / 1,841 / 1,765 / 575 |
| httpx | 1,333 | 575 / 501 / 874 / 112 |
| commander.js | 1,094 | 286 / 468 / 0 / 530 |

变更间隔（`change_rhythm`）以HEAD的日期作为观测日，统计此前180天内的数据。观测日为上方SHA右侧标注的日期。

| 代码仓库 | commit / 活跃天数 | 间隔中位数 / p90 |
|---|---|---|
| click | 187 / 62天 | 0.08天 / 3.36天 |
| flask | 32 / 19天 | 0.80天 / 15.60天 |
| httpx | 11 / 8天 | 未观测 |
| commander.js | 22 / 18天 | 2.88天 / 17.89天 |

httpx未观测的理由为`insufficient_population`。统计窗口内的commit仅有11件，未达到计算比率所需的最低下限20件。

验证形式（`verification_profile`）统计落入test存放位置的commit。

| 代码仓库 | 包含test的commit | fix主题且同时修改了test的commit |
|---|---|---|
| click | 562 / 2,000 | 80 / 249 |
| flask | 627 / 3,674 | 58 / 408 |
| httpx | 575 / 1,335 | 46 / 114 |
| commander.js | 286 / 1,095 | 30 / 106 |

test的种类分布为：click为unit 555、不明23；flask为unit 484、不明204；httpx为unit 554、不明101；commander.js为不明286。

未观测的项目数量为：click、flask、commander.js均为23项，httpx为27项。主要原因如下：

- `forge_export_not_provided`、`tracker_export_not_provided`：审查、工单管理、事件
- `consenting_actor_required`：经验、职责、库上下文
- `no_upstream_lineage`、`parent_repo_not_provided`、`template_not_provided`：与upstream的关系、从模板的继承
- `no_tenant_commits`：包含本公司8成commit的时间段
- `survival_scan_disabled`：留存率
- `outcome_declaration_not_provided`：工作后续情况的声明
- `deferred_to_v0.6`：行维度的返工（0.8.0中仍沿用0.6时期的命名）

归属来源（`origin`）方面，4个仓库中除bot以外的所有commit均为`unresolved`。这是因为未提供定义本公司电子邮箱的identity.toml，也未提供fork的源仓库。

click中计入文档的commit细分数据，以及flask中fix相关的commit细分数据，并非Grift的直接输出结果。而是将相同规则应用于git log，在本地重新统计得出的概数。click的1,025件中有414件所修改的文档仅为`CHANGES.rst`。flask的407件fix主题commit中，有198件仅修改了文档或配置文件。

列表排序（`actor_directory`）方面，若将0.8.0生成的行按commit数量降序重新排列并执行`grift verify`，会以`MISMATCH: 1 field(s) differ`退出且退出代码为1。若使用0.8.0检算0.7.2保存的报告，由于定义版本不一致，会显示为`CANNOT_VERIFY`。活跃天数的注意事项在0.8.0中载于`activity.limitations`与`change_rhythm.limitations`，而在0.7.2中并不存在。

项目声明使用了以下文件：

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

输出分为“项目方声明”与“观测到的数值”两个章节，未声明的项目显示为`not_declared`（项目方未填写，并非缺失）。按各维度将声明与观测进行比对的是`grift align`，分为重合、超出范围、0件、未观测、无要求5种状态输出。

## 参考资料

- [grift-cli（GitHub、MIT）](https://github.com/Cor-Incorporated/grift-cli) - CLI源码。测定时的公开版为0.7.2，0.8.0于2026年10月26日发布
- [grift-cli 0.8.0发布说明（GitHub）](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0) - 0.8.0的变更点
- [grift-cli 0.7.2（PyPI）](https://pypi.org/project/grift-cli/0.7.2/) - 测定时的公开版
- [Grift](https://griftai.org) - 产品网站
- [TEP页面（Grift）](https://griftai.org/tep) - TEP的详细说明
- [grift报告阅读指南（metrics-guide）](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/metrics-guide.md) - 各指标的浅显解读
- [TEP使用规范（norms）](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/norms.md) - 勿将缺失解读为负面、禁止加权与折算
- [如何在实现中坚守“不打分、不排排名”（Cor.株式会社官方博客，2026年10月25日）](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/) - 0.8确立的5项条件
- [为了让“心意相通”成为日常，我创立了这家公司（Cor.株式会社官方博客）](https://cor-jp.com/blog/founder-story/) - 代表的心声与Grift诞生的初衷
- [Ethical Use of the MBTI（The Myers & Briggs Foundation）](https://www.myersbriggs.org/unique-features-of-myers-briggs/ethical-use-of-the-mbti/) - MBTI使用规范（自愿原则、非招聘目的）
- [MBTI Basics（The Myers & Briggs Foundation）](https://www.myersbriggs.org/my-mbti-personality-type/mbti-basics/) - 4种偏好与16种类型
- [pallets/click](https://github.com/pallets/click) - 测定的开源软件（HEAD `36baa15`）
- [pallets/flask](https://github.com/pallets/flask) - 测定的开源软件（HEAD `d318b68`）
- [encode/httpx](https://github.com/encode/httpx) - 测定的开源软件（HEAD `b5addb6`）
- [tj/commander.js](https://github.com/tj/commander.js) - 测定的开源软件（HEAD `ba6d13d`）
