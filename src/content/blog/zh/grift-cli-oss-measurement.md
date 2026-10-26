---
title: "简历上的年限，无法体现工作风格。用不打分的Grift，测评4个真实的开源项目"
description: "仅凭简历上的年限或人月，无法了解一个人具体是如何开展工作的。本文面向人才中介公司、SES销售人员及工程师，阐述Cor.打造不打分也不排名的Grift的缘由、其与MBTI的区别，以及通过测评4个真实的开源项目所看清与看不清的内容。"
summary: "Grift基于git中留存的变更记录，呈现工作倾向以及作为佐证的具体件数。与本人回答问题得出类型的MBTI不同，其依据并非主观陈述而是客观记录，对于同一份记录，无论由谁来统计得出的数值都完全一致。通过测评4个真实的开源项目，虽然能够看清工作领域以及变更间隔的差异，但评审质量、会议情况以及未经本人同意的经历则无法呈现。数字需要结合分母与规则一起解读，最终做出判断的依然是人。"
pubDate: 2026-10-25
author: "Terisuke"
category: "engineering"
ctaIntent: "grift-team-beta"
tags: ["Grift", "OSS", "CLI", "git", "実測"]
lang: "zh"
featured: false
isDraft: false
translationSourceHash: "ef859896fc1d4aa3ef654f35a97cd16672a5019bbb963d9ae3a20559c1fa9303"
translatedAt: "2026-10-25T15:06:38.430Z"
translationModel: "gemini-3.8-flash"
---

即使简历上写着“Python 5年”，也无法得知这5年里具体做过什么样的工作。

年限或人月可以作为工作量的一个参考标准。然而，这个人是在推进工作的同时编写测试来确认运行效果，还是专注于整理文档，亦或是频繁提交细微的修改？仅凭年限无法看出其工作方式。

职业中介或SES（系统工程服务）的业务人员常常因为说不出推荐的依据而陷入僵局。Cor.认为，造成这一现象的原因之一，就在于这层认知空白。

## 不打分的原因

Grift正是为了填补这一空白而开发的自研产品。它从git（逐次记录软件变更的机制）留下的记录中，提取工作倾向以及作为其依据的件数。既不打分，也不排定名次。

创始人寺田 康佑曾在Recruit从事招聘广告业务，深切体会过言辞无法传达事实的焦灼感。关于Grift，他曾写道：“简历可以注水。证据无法注水。”

一旦打分，会发生什么？将不同维度的记录概括成一个数字，就会让“统计了什么”以及“没能统计什么”消失不见。而且只要有了分数，高分的人看起来就更优秀。一旦排列，就形成了名次。

在Grift中，我们想做的并不是给人排定名次，而是把人与符合其工作倾向的项目连接起来。为此，我们只提供可查证的事实。做出判断的是人。

## 与MBTI的区别

听到不排定名次，可能有人会联想到MBTI。

MBTI是由本人回答问卷，从4种偏好的组合中得出16种人格类型。MBTI基金会（The Myers & Briggs Foundation）指出，每种类型都有其价值，且该测试并非为了招聘目的而创建。

Grift不提问，不起类型名称，也不是诊断性格的工具。它通过统计git中留下的记录，给出倾向以及作为依据的件数。

如果将这种区别对应到业务人员遇到的困扰，就更容易理解了。

“不知道简历上的自主陈述能在多大程度上采信。”MBTI的结果与简历一样，都出自本人的回答。而Grift的依据是记录。只要提供相同的记录，无论由谁来统计，都会得出相同的值。

“仅凭年限或人月，看不出工作方式。”Grift会以件数形式给出接触过哪些领域（测试、文档、核心程序等）、以怎样的时间间隔提交变更、修复变更是否附带测试。

不过，未在记录中留存的内容不会呈现。会议中的表现、代码审查的质量、未公开的工作均无法体现。未经本人同意，也不会呈现个人的经验与角色。

## 名为TEP的流程

Grift将从记录中提取事实的流程称为TEP（Technical Evidence Pipeline，技术证据提取流程）。其核心包含4个阶段：

1. 读取git记录。不使用AI推测
2. 按照既定规则进行统计。例如，根据文件的存放位置和名称，区分是测试还是文档
3. 为统计值附上分母，并注明未能统计的项目的理由
4. 确保任何人都能按照相同流程重新核算

Grift将第4点的重新核算称为“验算”。关于TEP的详细说明，请参阅Grift网站的[TEP页面](https://griftai.org/tep)。

## 在真实OSS上进行尝试

按照这个流程，真的能看出工作倾向吗？2026年10月25日，我们使用Grift CLI（通过命令行运行的Grift工具）的下一版本（0.8.0）进行了验证。截至当天，0.8.0仍处于公开发布的准备阶段。

为了避免未经同意测量真实的人，我们以代码公开的开源软件（OSS）为对象，按代码仓库（汇总单个软件记录的场所）单位进行了测量。本文中完全没有收录任何具体个人的数据。

我们测量了4个特性各不相同的项目：

- click：Python中用于构建命令行工具的库（供其他程序使用的组件）
- flask：Python中用于构建Web服务的库
- httpx：Python中用于Web通信的库
- commander.js：JavaScript中用于构建命令行工具的库

## 观察到的结果

4个项目的测量与验算均在2.5秒内完成。4个项目的验算结果在所有项目上均完全一致。

各代码仓库的特性差异也得以体现。

在click中，截至记录最后一日的180天内，共有187次变更。变更之间的时间间隔中位数约为2小时。短间隔的变更持续进行。

在flask中，涉及文档的变更达1,841次，多于涉及核心程序的变更（1,765次）。

在httpx中，包含测试文件的变更在1,335次中占575次。

在commander.js中，核心的JavaScript文件未被计入“核心程序”，而是被归入了“其他”。这是Grift规则的疏漏。这是由于作为核心程序进行统计的扩展名（文件名末尾部分）中，未包含JavaScript的`.js`。

## 对数字的误读

经过测量我们发现，如果只把数字罗列出来，很容易造成误读。在此列举5个例子。

### 变更次数

变更次数多的代码仓库，并不等于优质的代码仓库。flask的变更为3,674次，httpx为1,335次。历史跨度方面，flask为5,976天，httpx为2,517天。次数会因历史的长短以及是否合并变更有很大差异。

### 文档变更

文档变更较多，并不代表热衷于编写文档。在click中被计入文档的变更中，约有4成所涉及的文档文件仅仅是更新日志文件。在每次修改都要记录更新日志的代码仓库中，文档的次数就会增加。

### 修复变更

主题以“fix”（修复）开头的变更未附带测试，并不意味着不编写测试。重新统计flask中主题以“fix”开头的变更，407次中有198次仅仅修改了文档或配置文件。其主题为“fix typo”（修改错字）等。

### 少量变更

变更较少，并不意味着开发处于停滞状态。在httpx中，所观察的180天内仅有11次变更，时间间隔显示为“未观测”（未能测出）。测量的记录是在9月2日拉取到本地的，并不代表当前的状态。

### 活跃天数

活跃天数（发生过变更的天数）可以通过切分变更的方式人为增加。我们创建了2个小型代码仓库用于验证，并添加了相同的5行代码。如果一次性全部添加，活跃天数为2天；如果分5天每天添加1行，则为6天（两者均包含最初的1次）。内容完全相同。

Grift不对该数字进行修正。作为替代，会在数字旁注明：“每天提交 1 个小型 commit 就会增加，将相同的变更集中在 1 天则会减少。”

## 未能体现的内容

Grift将未能测量的内容标注为“未观测”。未观测的意思是“未能测出”，并不代表“没有实际成果”。在本次的4个项目中，未能体现以下内容：

- 代码审查与议题管理：由于未提供GitHub等平台的记录，因此属于未观测
- 个人的经验与角色：由于未获得本人同意，因此属于未观测
- 是否属于本公司的变更：由于未定义本公司的邮箱地址，全部判定为“无法确定”

在此也记录下未能顺利进行的方面。commander.js的核心程序被归入“其他”，正如前文所述是规则上的疏漏。此外，在同日的文章中曾提到“测试同步修改率（修改核心程序的同时也修改了测试的比例）也会因为形式上的测试变更而升高”。在0.8.0中，这一注意事项尚未标注在数字旁边。标注上的仅有关于活跃天数的那句话。

## 0.8.0中的修正

在0.7.2（当前的公开版）中，参与代码仓库的人员列表是按变更次数由多到少的顺序排列的。这容易让人将排在最上面的人误读为“贡献最大的人”。在0.8.0中，改为按ID（为每个人分配的标识）顺序排列。

在4个代码仓库中，我们对比了0.7.2和0.8.0的列表。不看姓名和数量，仅看排列方式。在0.7.2中，4个项目排在最上面的都是变更最多的人。而在0.8.0中，该人员所在行在click中为467行中的第120行，在flask中为870行中的第280行，在httpx中为258行中的第232行，在commander.js中为203行中的第15行。

如果将0.8.0的列表重新按变更由多到少排序，验算将无法通过。其他数值在0.7.2和0.8.0中均相同。

## 与项目对照

在与项目进行匹配时，项目方需要达到的要求会预先写明。Grift将此称为“声明”。它会与从git中观察到的情况（观测）放在不同的栏目中并列展示，不给出合格与否的判定。

作为尝试，我们声明了一个虚构的小型项目“Python库的维护”。声明内容为：180天内有12天以上的活跃度、变更间隔的中位数在7天以内、接触过核心程序和测试、包含单元测试、同时参考GitHub等平台的记录。

对应到click时，声明的“12天以上”旁边会列出观测到的“62天”。由于未提供GitHub等平台的记录，该栏目保持未观测状态。

并列展示之后，前一小节提到的误读依然存在。commander.js的“核心程序”为0次是规则疏漏所致，httpx的时间间隔则因记录不足而显示为未观测。如何解读并列呈现的数值，由人来决定。

还可以将工程师本人的记录与项目进行并列对照使用。此时，只使用经过本人同意的记录。由于这涉及到对真实个人的测量，因此本文中未作尝试。

## 结语

git记录可以作为印证简历言辞的素材。但是，也存在无法留存在记录中的工作。

Grift所呈现的，是倾向、作为其依据的件数，以及未能体现的内容的理由。从中做出何种判断，应由阅读者来决定。

## 依据数据

为了让工程师可以在本地自行验证，现将测量条件和数据汇总如下。

- grift 0.8.0（定义版本`tep-v0.8.0-2026-10-25`）。本地安装了未公开的源码（开发代码仓库的`87076c8`）
- 为了便于对比，公开版0.7.2也对相同的4个项目进行了分析
- Apple M4 Max、macOS 26.7.1、Python 3.12.9、git 2.54.0
- 对象为2026年9月2日clone后未作更新的本地4个项目

测量的commit（单次变更记录）的SHA（每个commit附带的标识符）及其日期如下。

```text
pallets/click    36baa15ff831b939a22bc527cd76ce653ef6f66d  2026-08-26
pallets/flask    d318b683471101618febed18996405ad26462110  2026-08-16
encode/httpx     b5addb64f0161ff6bfe94c124ef76f6a1fba5254  2026-02-23
tj/commander.js  ba6d13ddb4243e5913367734f8c159089ffe7834  2026-05-29
```

以click为例的命令如下。

```bash
git clone https://github.com/pallets/click
git -C click checkout 36baa15ff831b939a22bc527cd76ce653ef6f66d
grift repo click --format both --out out/click
grift verify out/click/report.json --repo click
```

4个项目的`grift repo`均在2.5秒内完成，`grift verify`4个项目均为`VERIFIED`。在重新clone的click上，除了执行时间外，得出了相同的结果。即使使用与公开版0.7.2相同的源码，此处列出的观测值也是相同的。

| 代码仓库 | 人工commit / merge / bot |
|---|---|
| click | 2,000 / 1,131 / 200 |
| flask | 3,674 / 1,691 / 191 |
| httpx | 1,335 / 41 / 147 |
| commander.js | 1,095 / 284 / 138 |

人工commit为排除merge（合并其他分支变更的记录）后的件数。已剔除bot（自动提交变更的程序）的修改。

工作领域（`surface_profile`）根据文件的存放位置和扩展名划分区间，并按区间统计commit。由于单次commit可能对应多个区间，因此总和会超过分母。

| 代码仓库 | 分母 | test / docs / backend / other |
|---|---|---|
| click | 1,999 | 562 / 1,024 / 1,158 / 309 |
| flask | 3,673 | 627 / 1,841 / 1,765 / 575 |
| httpx | 1,333 | 575 / 501 / 874 / 112 |
| commander.js | 1,094 | 286 / 468 / 0 / 530 |

变更间隔（`change_rhythm`）以HEAD的日期作为观测日，统计此前180天的数据。观测日即上方SHA右侧所注日期。

| 代码仓库 | commit / 活跃天数 | 间隔中位数 / p90 |
|---|---|---|
| click | 187 / 62天 | 0.08天 / 3.36天 |
| flask | 32 / 19天 | 0.80天 / 15.60天 |
| httpx | 11 / 8天 | 未观测 |
| commander.js | 22 / 18天 | 2.88天 / 17.89天 |

httpx未观测的理由为`insufficient_population`。窗口期内的commit仅有11件，未达到计算比率所需的20件下限。

验证形态（`verification_profile`）统计了命中test存放位置的commit。

| 代码仓库 | 包含test的commit | fix主题且修改了test的commit |
|---|---|---|
| click | 562 / 2,000 | 80 / 249 |
| flask | 627 / 3,674 | 58 / 408 |
| httpx | 575 / 1,335 | 46 / 114 |
| commander.js | 286 / 1,095 | 30 / 106 |

关于test的种类，click为unit 555、不明23；flask为unit 484、不明204；httpx为unit 554、不明101；commander.js为不明286。

未观测的项目数量，click、flask、commander.js为23项，httpx为27项。主要理由如下：

- `forge_export_not_provided`、`tracker_export_not_provided`：代码审查、议题管理、事件
- `consenting_actor_required`：经验、角色、库的上下文
- `no_upstream_lineage`、`parent_repo_not_provided`、`template_not_provided`：与upstream的关系、从模板的继承
- `no_tenant_commits`：包含8成本公司commit的期间
- `survival_scan_disabled`：留存率
- `outcome_declaration_not_provided`：对作业后发生情况的声明
- `deferred_to_v0.6`：行维度的返工（在0.8.0中仍保留0.6时期的命名）

来源（`origin`）方面，4个项目中除bot外的全部commit均为`unresolved`。这是因为既未提供定义本公司邮箱地址的identity.toml，也未提供fork的源头。

在click中计入文档的commit明细，以及flask中fix的commit明细，并非Grift的输出结果。这是将相同规则应用于git log后在本地重新核算的概数。click在1,025件中有414件所修改的文档仅为`CHANGES.rst`。flask在fix主题的407件commit中，有198件仅修改了文档或配置文件。

关于列表排序（`actor_directory`），将0.8.0的行按commit数量由多到少重新排列后执行`grift verify`，结果为`MISMATCH: 1 field(s) differ`，退出代码为1。使用0.8.0验算0.7.2保存的报告时，因定义版本不同而变为`CANNOT_VERIFY`。关于活跃天数的提示语句，在0.8.0中载于`activity.limitations`和`change_rhythm.limitations`，而在0.7.2中并不存在。

项目的声明使用了以下文件。

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

输出结果分为“项目方的声明”和“观测到的数值”两个章节，未声明的项目显示为`not_declared`（项目方未填写，并非缺失）。按各维度将声明与观测进行对照的是`grift align`，呈现为重合、超出范围、0件、未观测、无要求5种状态。

## 参考资料

- [grift-cli（GitHub、MIT）](https://github.com/Cor-Incorporated/grift-cli) - CLI源码。公开版为0.7.2，0.8.0处于发布准备阶段
- [Grift](https://griftai.org) - 产品网站
- [TEP页面（Grift）](https://griftai.org/tep) - TEP详细说明
- [grift报告的阅读方法（metrics-guide）](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/metrics-guide.md) - 各项指标的简明解析
- [TEP使用规范（norms）](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/norms.md) - 勿将缺失解读为负面、禁止加权与折算
- [如何在实现中守护“既不打分也不排定名次”（Cor.株式会社博客，2026年10月25日）](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/) - 0.8版确定的5项条件
- [为了让“啊，对方理解了”成为日常，我创立了这家公司（Cor.株式会社博客）](https://cor-jp.com/blog/founder-story/) - 负责人的讲述与Grift诞生的初衷
- [Ethical Use of the MBTI（The Myers & Briggs Foundation）](https://www.myersbriggs.org/unique-features-of-myers-briggs/ethical-use-of-the-mbti/) - MBTI使用规范（自愿原则、非招聘目的）
- [MBTI Basics（The Myers & Briggs Foundation）](https://www.myersbriggs.org/my-mbti-personality-type/mbti-basics/) - 4种偏好与16种类型
- [pallets/click](https://github.com/pallets/click) - 测量的OSS（HEAD `36baa15`）
- [pallets/flask](https://github.com/pallets/flask) - 测量的OSS（HEAD `d318b68`）
- [encode/httpx](https://github.com/encode/httpx) - 测量的OSS（HEAD `b5addb6`）
- [tj/commander.js](https://github.com/tj/commander.js) - 测量的OSS（HEAD `ba6d13d`）
