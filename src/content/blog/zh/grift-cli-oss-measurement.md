---
title: "简历上的从业年限无法体现做事方式。用不打分的Grift对4个真实开源项目进行测算"
description: "仅凭简历上的年限或人月数，无法了解一个人以往的具体工作方式。本文面向人才中介公司、SES销售人员及工程师，阐述Cor.开发不打分也不排名的Grift的初衷、它与MBTI的区别，以及通过测算4个真实开源项目所看清与未能看清的事物。"
summary: "Grift根据git中留存的变更记录，导出工作倾向以及作为其依据的数据量。与本人通过回答问卷来测出类型的MBTI不同，其依据不是个人陈述而是客观记录，对于同一份记录，无论谁来统计都会得出相同数值。通过对4个真实开源项目进行测算，虽然能看出工作领域和变更间隔的差异，但无法体现代码审查的质量、会议讨论以及未经本人同意的经历。数字必须与分母及统计规则结合阅读，而做出最终判断的始终是人。"
pubDate: 2026-10-25
updatedDate: 2026-10-26
author: "Terisuke"
category: "engineering"
ctaIntent: "grift-team-beta"
tags: ["Grift", "OSS", "CLI", "git", "実測"]
lang: "zh"
featured: false
isDraft: false
translationSourceHash: "b6c9b7d77d676cc7d362bd1bf2a315d0eb07c6a72f8dd4d50288ab08761e0456"
translatedAt: "2026-10-26T12:20:17.928Z"
translationModel: "gemini-3.8-flash"
---

即便简历上写着“Python 5年”，我们也不知道这5年里对方究竟做过什么样的工作。

年限或人月可以作为工作量的一个参考指标。但是，对方是那种一边编写用于确认运行的测试一边推进的人吗？是注重梳理文档的人吗？还是习惯频繁提交微小修改的人呢？年限并不能告诉我们其工作方式。

职业介绍机构或SES（系统工程服务）的销售人员往往会卡在无法拿出有说服力的依据来阐述推荐理由这一步。Cor.株式会社认为，原因之一就在于这层信息断层。

## 不打分的原因

Grift正是为了填补这一断层而自研的产品。它从git（一次次记录软件变更的机制）中留下的记录，提取出工作倾向以及作为其依据的件数。它既不打分，也不排定名次。

公司代表寺田 康佑在Recruit从事招聘广告销售期间，曾深切体会过无法有效传递价值的焦虑。关于Grift，他写道：“履历可以注水，证据无法作假。”

如果进行打分，会发生什么？将不同种类的记录压缩为一个数字，究竟统计了什么、遗漏了什么就会消失不见。而且一旦有了分数，高分者就会显得更优秀；只要罗列出来，就会形成名次。

我们在Grift中想做的，并不是按名次对人进行排列，而是将人才与契合其工作倾向的岗位/项目连接起来。为此，我们只提供可验证的事实。做判断的是人。

## 与MBTI的区别

听到不排定名次，可能有人会联想到MBTI。

MBTI是由本人回答问卷，根据4种偏好的组合得出16种人格类型。MBTI基金会（The Myers & Briggs Foundation）表示，每种类型都有其价值，且该测试并非为了招聘目的而创建。

Grift不提问，不起类型名称，也不是诊断性格的工具。它通过统计git中留下的记录，给出倾向以及作为其依据的件数。

结合销售人员的痛点来看，两者的区别就一目了然了。

不知道简历中的自我陈述在多大程度上可信。MBTI的结果与简历一样，出自本人的回答；而Grift的依据是记录。只要提供相同的记录，无论由谁来统计，都会得出相同的数值。

仅凭年限或人月，看不出工作方式。Grift则会以件数呈现对方接触过哪些领域（测试、文档、主程序等）、以怎样的时间间隔提交变更、修复变更是否附带测试。

不过，未留下记录的内容是无法呈现的。会议中的表现、评审的质量、未公开的工作都无法被看到。在未经本人同意的情况下，也不会展示个人的经验或职责。

## 名为TEP的流程

Grift将从记录中提取事实的流程称为TEP（Technical Evidence Pipeline，技术证据提取流程）。其内容分为4个阶段：

1. 读取git记录。不使用AI推测
2. 按照既定规则进行统计。例如，根据文件的存放位置和名称，区分是测试还是文档
3. 为统计出的数值附上分母，以及未能统计的内容的原因
4. 确保任何人都可以按照相同的流程重新进行核算

Grift将第4步的重新统计称为“验算”。有关TEP的详细说明，请参阅Grift网站的[TEP页面](https://griftai.org/tep)。

## 用真实的开源软件（OSS）进行测试

这种流程真的能看出工作倾向吗？2026年10月25日，我们使用Grift CLI（通过命令行运行的Grift工具）的0.8.0版本进行了验证。截至当天，0.8.0仍在准备发布，并于次日10月26日正式发布（[发布说明](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0)）。

为了避免在未经同意的情况下衡量真实个人，我们以代码公开的开源软件（OSS）为对象，按代码仓库（汇总单一软件记录的场所）单位进行了测量。本文中完全未刊载任何针对个人的具体数据。

我们测量了性质各异的4个仓库：

- click：在Python中用于制作命令行工具的库（供其他程序调用的组件）
- flask：在Python中用于构建Web服务的库
- httpx：在Python中用于进行Web通信的库
- commander.js：在JavaScript中用于制作命令行工具的库

## 观察到的现象

4个仓库的测量与验算均在2.5秒内完成。验算结果在4个仓库的所有项目上均完全一致。

同时也可以看出各代码仓库的性质差异。

在click中，截至记录最后一天的180天内，共有187次变更。变更之间的时间间隔中位数约为2小时，呈现出以较短间隔持续变更的特征。

在flask中，涉及文档的变更达1,841次，超过了涉及主程序的变更（1,765次）。

在httpx中，包含测试文件的变更在1,335次中占575次。

在commander.js中，JavaScript的主文件未被计入“主程序”，而是归入了“其他”。这是Grift规则上的疏漏，原因在于作为主程序统计的扩展名（文件名末尾部分）中，未包含JavaScript的`.js`。

## 对数字的误读

通过实际测量我们发现，如果只把数字罗列出来，很容易产生误读。以下列举5个例子。

### 变更次数

变更次数多的仓库，并不等同于优秀的仓库。flask的变更为3,674次，httpx为1,335次。历史长度方面，flask为5,976天，httpx为2,517天。次数会因历史的长短以及是否将变更合并合入而发生变化。

### 文档变更

文档变更较多，并不代表对编写文档充满热情。在click中被计为文档的变更里，约40%仅仅改动了更新日志文件。在每次变更都会记录更新日志的仓库中，文档的次数就会相应增加。

### 修复变更

标题以“fix”（修复）开头的变更未附带测试，并不意味着不写测试。在flask中对标题以“fix”开头的变更重新统计后发现，407次中有198次仅修改了文档或配置文件。其标题如“fix typo”（修复笔误）等。

### 变更较少

变更较少，并不意味着开发已停滞。在httpx中，观察的180天内仅有11次变更，间隔显示为“未观测”（未能测出）。测量的记录是在9月2日拉取到本地的数据，并不代表当前的状态。

### 活跃天数

活跃天数（发生过变更的天数）可以通过切分变更的方式人为增加。我们创建了2个小型仓库用于验证，分别添加了相同的5行代码。如果一次性集中添加，活跃天数为2天；若分5天每天添加1行，则为6天（均包含最初的1次）。内容本身完全一致。

Grift不会对该数字进行修正。作为替代，会在数字旁注明：“每天提交 1 个微小的 commit 会增加天数，将相同的变更合并在 1 天内完成则会减少。”

## 未能看到的内容

Grift将未能测量的内容标注为“未观测”。未观测是指“未能测出”，并不意味着“没有实际成果”。在本次的4个仓库中，未能观测到以下内容：

- 评审及问题管理：由于未提供GitHub等平台的记录，因此属于未观测
- 个人的经验与职责：由于没有本人同意，因此属于未观测
- 是否属于本公司的变更：由于未定义本公司的电子邮箱地址，全部显示为“无法判定”

在此也记录未达到预期的地方。如前所述，commander.js的主程序被归入“其他”属于规则漏洞。此外，在同一天的文章中曾提到“测试同修率（主程序变更的同时也修改测试的比例）也会因形式上的测试修改而上升”。在0.8.0中，该项提示尚未标注在数字旁，目前仅针对活跃天数标注了一句提示。

## 0.8.0中修正的内容

在[0.7.2](https://pypi.org/project/grift-cli/0.7.2/)（测量时的公开发布版本）中，参与仓库的人员列表是按照变更从多到少的顺序排列的。这容易让人将排在最上面的人误读为“做得最好的人”。而在0.8.0中，则改按ID（为每个人分配的标识符）顺序排列。

我们在4个仓库中对比了0.7.2与0.8.0的列表。不看姓名和数量，仅观察排列方式。0.7.2在4个仓库中，排在最上面的都是变更最多的人。而在0.8.0中，该人员所在行在click中为467行中的第120行，flask中为870行中的第280行，httpx中为258行中的第232行，commander.js中为203行中的第15行。

如果将0.8.0的列表重新按变更从多到少排序，验算将无法通过。其他数值在0.7.2与0.8.0中保持一致。

## 与项目需求并列呈现

在与项目/岗位进行对接时，项目方需要达成的要求会预先写明。Grift将此称为“声明”。它会与从git中观察到的情况（观测）在不同的栏位中并列呈现，不输出合格与否的判定。

我们尝试声明了一个虚构的小型项目“Python库的维护”。声明内容包括：180天内活跃天数在12天以上、变更间隔中位数在7天以内、接触过主程序与测试、包含单元测试、查阅GitHub等记录。

将其应用到click时，声明栏的“12天以上”旁边便会列出观测栏的“62天”。由于未提供GitHub等记录，该栏仍保持未观测状态。

并列之后，前一节所述的误读风险依然存在。commander.js中“主程序”为0次是由于规则漏洞，而httpx的间隔因记录不足显示为未观测。如何解读并列呈现的数值，由人来决定。

此外，也支持将工程师本人的记录与项目需求进行并列呈现的用法。此时，仅会使用获得本人同意的记录。由于这涉及到对真实个人进行衡量，本文未作尝试。

## 结语

git记录可以作为核实简历中文字陈述的材料。但是，同样存在未留下记录的工作。

Grift所提供的，是倾向、作为其依据的件数，以及未能观测到的事物的原因。在此基础上做出何种判断，应由阅读者自行决定。

## 依据数据

为方便工程师在本地进行验证，现将测量的条件与数据整理如下。

- grift 0.8.0（定义版本`tep-v0.8.0-2026-10-25`）。将发布前的源码（开发用仓库的`87076c8`）安装至本地。公开发布的0.8.0的`src/`（程序本体）与该源码相同
- 为进行对比，当时的公开发布版本[0.7.2](https://pypi.org/project/grift-cli/0.7.2/)也针对相同的4个仓库进行了运行
- Apple M4 Max、macOS 26.7.1、Python 3.12.9、git 2.54.0
- 对象为2026年9月2日clone后未再更新的本地4个仓库

所测量的commit（单次变更记录）的SHA（赋予每个commit的标识符）及其日期如下：

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

`grift repo`在4个仓库中均在2.5秒内完成，`grift verify`在4个仓库中均为`VERIFIED`。即使是对全新clone的click，除执行时间外，也得出了相同的结果。与当时公开发布版[0.7.2](https://pypi.org/project/grift-cli/0.7.2/)相同的源码相比，此处刊载的观测值亦完全一致。

| 代码仓库 | 人工commit / merge / bot |
|---|---|
| click | 2,000 / 1,131 / 200 |
| flask | 3,674 / 1,691 / 191 |
| httpx | 1,335 / 41 / 147 |
| commander.js | 1,095 / 284 / 138 |

人工commit为剔除merge（合入其他分支变更的记录）后的件数。已排除bot（自动提交变更的程序）的修改。

工作领域（`surface_profile`）根据文件的存放位置和扩展名确定分类，并按分类统计commit。由于1次commit可能对应多个分类，合计数值会超过分母。

| 代码仓库 | 分母 | test / docs / backend / other |
|---|---|---|
| click | 1,999 | 562 / 1,024 / 1,158 / 309 |
| flask | 3,673 | 627 / 1,841 / 1,765 / 575 |
| httpx | 1,333 | 575 / 501 / 874 / 112 |
| commander.js | 1,094 | 286 / 468 / 0 / 530 |

变更间隔（`change_rhythm`）以HEAD的日期作为观测日，统计此前180天内的数据。观测日即上方SHA右侧所写的日期。

| 代码仓库 | commit / 活跃天数 | 间隔中位数 / p90 |
|---|---|---|
| click | 187 / 62天 | 0.08天 / 3.36天 |
| flask | 32 / 19天 | 0.80天 / 15.60天 |
| httpx | 11 / 8天 | 未观测 |
| commander.js | 22 / 18天 | 2.88天 / 17.89天 |

httpx未观测的原因是`insufficient_population`。时间窗口内的commit仅有11件，未达到计算比率所需的下限20件。

验证形式（`verification_profile`）统计命中test存放位置的commit。

| 代码仓库 | 包含test的commit | 标题为fix且修改了test的commit |
|---|---|---|
| click | 562 / 2,000 | 80 / 249 |
| flask | 627 / 3,674 | 58 / 408 |
| httpx | 575 / 1,335 | 46 / 114 |
| commander.js | 286 / 1,095 | 30 / 106 |

test类型方面，click为unit 555、不明23；flask为unit 484、不明204；httpx为unit 554、不明101；commander.js为不明286。

未观测的项目在click、flask、commander.js中为23项，httpx中为27项。主要原因如下：

- `forge_export_not_provided`、`tracker_export_not_provided`：评审、问题管理、事件
- `consenting_actor_required`：经验、职责、库上下文
- `no_upstream_lineage`、`parent_repo_not_provided`、`template_not_provided`：与upstream的关系、从模板继承
- `no_tenant_commits`：包含本公司80% commit的期间
- `survival_scan_disabled`：代码新鲜度（当前代码在多大程度上属于近期编写）
- `outcome_declaration_not_provided`：作业后发生事件的声明
- `deferred_to_v0.6`：行级返工（在0.8.0中仍沿用0.6时期的命名）

来源（`origin`）方面，4个仓库中除bot以外的所有commit均为`unresolved`。这是因为未提供定义本公司电子邮箱地址的identity.toml，也未指定fork的上游源。

在click中计为文档的commit明细，以及flask中fix commit的明细，并非Grift的直接输出，而是应用相同规则通过git log在本地重新统计的大致数值。click在1,025件中有414件作为文档修改的文件仅为`CHANGES.rst`。flask在407件标题为fix的commit中，有198件仅修改了文档或配置文件。

列表排序（`actor_directory`）方面，将0.8.0的数据行按commit数从多到少重新排列后交由`grift verify`处理，会因`MISMATCH: 1 field(s) differ`以退出代码1结束。使用0.8.0对在0.7.2下保存的报告进行验算时，会因定义版本不一致而显示为`CANNOT_VERIFY`。关于活跃天数的提示文案，在0.8.0中刊载于`activity.limitations`与`change_rhythm.limitations`，而在0.7.2中并不存在。

项目的声明使用了以下文件：

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

输出分为“项目方的声明”与“观测到的数值”两个章节，未声明的项目显示为`not_declared`（项目方未填写，并非不足）。按维度比对声明与观测由`grift align`执行，输出结果分为重合、超出范围、0件、未观测、无要求5种情况。

## 参考资料

- [grift-cli（GitHub、MIT）](https://github.com/Cor-Incorporated/grift-cli) - CLI源码。测量时的公开发布版本为0.7.2，0.8.0于2026年10月26日发布
- [grift-cli 0.8.0发布说明（GitHub）](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0) - 0.8.0的变更点
- [grift-cli 0.7.2（PyPI）](https://pypi.org/project/grift-cli/0.7.2/) - 测量时的公开发布版本
- [Grift](https://griftai.org) - 产品网站
- [TEP页面（Grift）](https://griftai.org/tep) - TEP的详细说明
- [grift报告解读指南（metrics-guide）](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/metrics-guide.md) - 各指标的浅显解读
- [TEP使用规范（norms）](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/norms.md) - 避免将缺失做负面解读、禁止加权与折算
- [如何在实现中守护“既不打分也不排定名次”（Cor.株式会社博客，2026年10月25日）](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/) - 0.8版本确立的5项条件
- [为了让“啊，传达到了”成为日常，我创立了这家公司（Cor.株式会社博客）](https://cor-jp.com/blog/founder-story/) - 创始人故事与Grift诞生的初衷
- [Ethical Use of the MBTI（The Myers & Briggs Foundation）](https://www.myersbriggs.org/unique-features-of-myers-briggs/ethical-use-of-the-mbti/) - MBTI使用规范（自愿原则、非招聘目的）
- [MBTI Basics（The Myers & Briggs Foundation）](https://www.myersbriggs.org/my-mbti-personality-type/mbti-basics/) - 4种偏好与16种类型
- [pallets/click](https://github.com/pallets/click) - 测量的开源软件（HEAD `36baa15`）
- [pallets/flask](https://github.com/pallets/flask) - 测量的开源软件（HEAD `d318b68`）
- [encode/httpx](https://github.com/encode/httpx) - 测量的开源软件（HEAD `b5addb6`）
- [tj/commander.js](https://github.com/tj/commander.js) - 测量的开源软件（HEAD `ba6d13d`）
