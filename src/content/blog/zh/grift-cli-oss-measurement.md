---
title: "将不打分的工具应用于实际开源软件会呈现什么？使用 Grift CLI 0.8.0 测量4个代码仓库"
description: "我们使用 Grift CLI 的下一版本（0.8.0）测量了 click、flask、httpx 和 commander.js 这4个开源软件。本文原样展示命令与输出，并阐述能看到什么、看不到什么，以及如何解读数字才不会产生误解。我们不对各代码仓库的优劣进行比较。"
summary: "使用 Grift CLI 的下一版本（0.8.0）测量4个开源软件时，观测均在2.5秒内完成，且与 grift verify 的重新计算在所有项目上均保持一致。虽然工作区、变更间隔和验证形式会得出具体数值，但代码审查、议题管理和个人经验则会附带理由地显示为未观测。数值取决于路径规则与观测窗口，因此无法通过并列各代码仓库来比较其优劣。"
pubDate: 2026-10-25
author: "Terisuke"
category: "engineering"
ctaIntent: "grift-team-beta"
tags: ["Grift", "OSS", "CLI", "git", "実測"]
lang: "zh"
featured: false
isDraft: false
translationSourceHash: "1a6743e05b9509c026319d50ed64815235cd876ba8f948088f196f9f7252180d"
translatedAt: "2026-10-25T14:26:46.942Z"
translationModel: "gemini-3.8-flash"
---

Grift CLI 承诺从 git 历史中提取可验证的事实，不打分，也不排排名。那么，将其应用于实际的开源软件（OSS）时会输出什么呢？Cor. 于 2026 年 10 月 25 日使用下一个版本（0.8.0）对 4 个 OSS 进行了度量。

本文将原样展示步骤和输出。我们不会比较代码库之间的优劣。数值的差异将作为代码库特性的不同来表述。关于在 0.8 中决定修复什么，已写在同日的文章《[如何在实现中坚守“不打分、不排名”](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/)》中。

## 本文中不包含的内容

代码库的报告中也包含参与该代码库的人员列表。本文不会刊登任何一项个人层面的数据。因为如果刊登，就等于将真实的贡献者按数字排列，公开了未经本人同意的观察结果。本文也未使用 `grift actor`、`--actors`、`--top`。

截至 2026 年 10 月 25 日，0.8.0 尚未在 PyPI 上公开。公开版本为 0.7.2，0.8.0 正在准备公开中。

## 度量环境与对象

- grift 0.8.0（定义版本 `tep-v0.8.0-2026-10-25`）。在本地安装了公开前的源码（开发用代码库的 `87076c8`）
- 为了进行对比，公开版本的 0.7.2 也对相同的 4 个项目进行了度量
- Apple M4 Max、macOS 26.7.1、Python 3.12.9、git 2.54.0

度量对象是在本地自 2026 年 9 月 2 日 clone 后未再更新的 4 个项目。未重新 clone，直接在该状态下进行了度量。

| 代码库 | 特性 | 度量的 HEAD | HEAD 的日期 |
|---|---|---|---|
| [pallets/click](https://github.com/pallets/click) | Python 的 CLI 库 | `36baa15ff831b939a22bc527cd76ce653ef6f66d` | 2026-08-26 |
| [pallets/flask](https://github.com/pallets/flask) | Python 的 Web 框架 | `d318b683471101618febed18996405ad26462110` | 2026-08-16 |
| [encode/httpx](https://github.com/encode/httpx) | Python 的 HTTP 客户端 | `b5addb64f0161ff6bfe94c124ef76f6a1fba5254` | 2026-02-23 |
| [tj/commander.js](https://github.com/tj/commander.js) | JavaScript 的 CLI 库 | `ba6d13ddb4243e5913367734f8c159089ffe7834` | 2026-05-29 |

## 执行的命令

为了使读者能够在本地得出相同的数值，以 click 为例展示命令。

```bash
git clone https://github.com/pallets/click
git -C click checkout 36baa15ff831b939a22bc527cd76ce653ef6f66d
grift repo click --format both --out out/click
grift verify out/click/report.json --repo click
```

`grift repo` 观察整个代码库，并写入 `report.json` 和 `report.md`。`grift verify` 则按照报告中记录的条件重新计算，并对比所有项目。即使重新 clone 并切换到该 SHA 的 click，除了执行时间（`analyzed_at`）之外，其他结果均与本地一致。

使用公开版本的 0.7.2（通过 `pipx install grift-cli` 安装的版本）在相同源码上进行了度量，本文展示的观察值与 0.8.0 相同。0.8.0 中发生变化的是人员列表的排列顺序和附注。具体差异将在后文确认。

## 4 个项目的观察结果

| 项目 | click | flask | httpx | commander.js |
|---|---|---|---|---|
| `grift repo` 的执行时间 | 1.57 秒 | 2.32 秒 | 1.16 秒 | 1.14 秒 |
| `grift verify` 的结果 | VERIFIED（1.62 秒） | VERIFIED（2.40 秒） | VERIFIED（1.33 秒） | VERIFIED（1.28 秒） |
| 人工 commit（不含 merge） | 2,000 | 3,674 | 1,335 | 1,095 |
| merge commit | 1,131 | 1,691 | 41 | 284 |
| 排除的 bot commit | 200 | 191 | 147 | 138 |
| 工作领域的分母（获取到 path 的人工 commit） | 1,999 | 3,673 | 1,333 | 1,094 |
| 工作领域 test | 562 | 627 | 575 | 286 |
| 工作领域 docs | 1,024 | 1,841 | 501 | 468 |
| 工作领域 backend | 1,158 | 1,765 | 874 | 0 |
| 工作领域 other | 309 | 575 | 112 | 530 |
| 统计变更间隔的窗口（180 天） | 2026-02-27～2026-08-26 | 2026-02-17～2026-08-16 | 2025-08-27～2026-02-23 | 2025-11-30～2026-05-29 |
| 窗口内的 commit / 活动天数 | 187 件 / 62 天 | 32 件 / 19 天 | 11 件 / 8 天 | 22 件 / 18 天 |
| 间隔的中位数 / p90 | 0.08 天 / 3.36 天 | 0.80 天 / 15.60 天 | 未观察（样本不足） | 2.88 天 / 17.89 天 |
| 包含 test 的 commit | 562 / 2,000 | 627 / 3,674 | 575 / 1,335 | 286 / 1,095 |
| 以 fix 为主题且修改了 test 的 commit | 80 / 249 | 58 / 408 | 46 / 114 | 30 / 106 |
| test 的种类（由 path 判定） | unit 555、未知 23 | unit 484、未知 204 | unit 554、未知 101 | 未知 286 |
| 来源（origin） | bot 以外的所有 commit 均为 unresolved | 相同 | 相同 | 相同 |
| 未观察（not_observed）的项目 | 23 | 23 | 27 | 23 |

由于 1 次 commit 可能归入多个类别，工作领域的总和会超过分母。

横向对比该表，并不能判断哪个代码库更好。原因将在后面的“数字的误读”一节中说明。

## 未能看到的内容

未观察（not_observed）的意思是“无法度量”，并不意味着“没有实际成果”。报告会为每个未观察的项目注明理由。4 个项目共同出现的 23 个项目的理由如下。在输入栏中重复出现相同理由的部分已合并为一行。

| 变为未观察的项目 | 理由（reason） | 观察所需条件 |
|---|---|---|
| 审查、议题管理、事件及其间隔 | `forge_export_not_provided`、`tracker_export_not_provided` | forge 和 tracker 的导出文件（`--forge-export`、`--tracker-export`） |
| 经验、角色、库的上下文 | `consenting_actor_required` | 记录了同意的本人 identity |
| 与 upstream 的关系、从模板的继承 | `no_upstream_lineage`、`parent_repo_not_provided`、`template_not_provided` | 父代码库或模板的路径 |
| 包含本公司 80% commit 的期间 | `no_tenant_commits` | 定义了本公司邮箱地址的 identity |
| 留存率（survival） | `survival_scan_disabled` | `--survival`（耗时较长） |
| 工作之后所发生事件的声明 | `outcome_declaration_not_provided` | `--outcome-declaration` |
| 行级返工 | `deferred_to_v0.6` | 在 0.8.0 中不输出 |

在 httpx 中，又增加了 4 个变更间隔项目（中位数、p90、2 天以内的比例、30 天以上的比例）。理由是 `insufficient_population`。窗口内的 commit 仅有 11 件，未达到计算比例的下限 20 件。行级返工的理由在 0.8.0 中仍保持着 0.6 时代的名称（`deferred_to_v0.6`）。

来源（origin）全部变为 unresolved，也是未能看到的内容之一。只有在提供了定义本公司邮箱地址的 identity.toml，或者提供了 fork 的父代码库时，来源才会被分类。在直接度量 OSS 时两者均未提供，因此 bot 以外的所有 commit 都会变成“无法判定”。同表中 `tenant_unique` 等为 0 件，这表示“无对应项”，与 unresolved 的含义不同。

## 数字的误读

### commit 的数量

commit 的数量会因历史的长短和合并方式而发生变化。flask 的人工 commit 为 3,674 件，httpx 为 1,335 件。这种差距并非优劣之分。从首次 commit 算起的天数，flask 为 5,976 天，httpx 为 2,517 天。merge commit 方面，flask 为 1,691 件，httpx 为 41 件。即使是相同的变更，是合并后纳入还是保持 commit 原样纳入，件数都会有所不同。

### 工作领域的名称

工作领域的名称是 path 规则的名称。commander.js 的 backend 为 0 件，other 为 530 件。这是因为作为 commander.js 主体的 `.js` 文件未包含在 backend 规则中。backend 规则由 `api/`、`services/` 等目录以及 `.py`、`.go`、`.rs` 等扩展名决定。

相反，click 的 backend 有 1,158 件，是因为 `.py` 的文件全部归入 backend。click 并不是服务端程序。报告本身也注明了“这是通过 path 与扩展名进行的工作领域观察”。

### docs 的件数

docs 件数多并不意味着对文档投入度高。docs 的规则是 `.md`、`.rst` 等扩展名以及 `docs/` 等目录。在每次变更都会在变更历史文件中追加内容的代码库中，docs 的件数就会增加。

在 click 中，按照相同规则从 git log 中重新统计计入 docs 的 commit 明细后发现，1,025 件中有 414 件作为 docs 涉及的文件仅仅是变更历史（`CHANGES.rst`）。该明细并非 grift 的输出，而是在本地重新统计的大致数据。报告在 click 中写道“docs 系 surface 相对较多倾向”，并将其强度定为 weak，置信度定为 directional。

### fix 的主题

“以 fix 为主题且修改了 test 的 commit”，是指主题以 `fix`、`bug`、`revert` 等开头，且同时修改了 test 文件的 commit。在 flask 中，408 件里有 58 件。

按照相同规则重新统计 flask 的 git log，在 407 件以 fix 为主题的 commit 中，有 198 件仅修改了 docs 或配置文件。主题为“fix typo”或修正链接。由于近半数是不伴随 test 的“fix”，因此将该数值解读为“修了 bug 却不写测试”是错误的。

### 统计变更间隔的窗口

变更间隔是以观察日起 180 天的窗口进行统计的。若未通过 `--as-of` 指定观察日，HEAD 的 commit 日期将成为观察日（`window_basis=legacy_head_date`）。因此，4 个项目的窗口各属不同时期。

httpx 的窗口（2025-08-27～2026-02-23）仅有 11 件 commit，间隔数值变成了未观察。如果将其解读为“开发停滞”同样是错误的。度量的只是本地的 checkout，而非 upstream 当下的状态。

### 活动天数

最后，我们创建了 2 个用于验证的小型代码库进行确认。两者均在首次 commit 之后添加相同的 5 行文件。其中一个是一次性 commit 这 5 行，另一个则是分 5 天每天 commit 1 行。

| 创建方式 | commit（含首次） | 最终 tree | 活动天数 |
|---|---|---|---|
| 5 行一次性 commit | 2 | `880a82d` | 2 天 |
| 分 5 天每天 commit 1 行 | 6 | `880a82d` | 6 天 |

即使内容相同，活动天数也会变成 2 天和 6 天。0.8.0 不会对该数字进行修正。作为替代，在数值旁边会附上这样一句话：“若每天提交 1 件微小 commit 则数值增加，若将相同变更集中在 1 天内则数值减少。”

## 0.8.0 中的修正

正如同一天的文章中所述，0.8.0 调整了人员列表的排列顺序，并披露了活动天数的膨胀方式。针对相同的 4 个项目，对比了 0.7.2 和 0.8.0 输出的代码库报告中的人员列表（`actor_directory`）。不看姓名和数量，仅对比排序方式。

| 项目 | 0.7.2 | 0.8.0 |
|---|---|---|
| 行的排列 | 4 个项目均按 commit 数量从多到少排列 | 4 个项目均按 actor_id 排列 |
| 首行是否为 commit 数量最多的人 | 4 个项目均为是 | 4 个项目均不是 |
| commit 数量最多的人所在行位置 | 4 个项目均在第 1 行 | click 第 120 行（共 467 行）、flask 第 280 行（共 870 行）、httpx 第 232 行（共 258 行）、commander.js 第 15 行（共 203 行） |
| 活动天数膨胀方式的说明文字 | 无 | 在 `activity.limitations` 和 `change_rhythm.limitations` 中存在 |

0.7.2 的 Markdown 标题虽为“actor 列表（非质量排名）”，但各行仍按 commit 数量从多到少排列。0.8.0 在相同标题下注明了“行按 actor_id 排列（非 commit 数顺序）。行的位置没有任何含义。”

若将 0.8.0 输出中的行按 commit 数量从多到少重新排列并交由 `grift verify` 校验，则会显示 `MISMATCH: 1 field(s) differ`（`actor_directory.actors`），退出码为 1。重新排序后的列表无法通过校验。

其他数值没有变化。工作领域、验证方式、来源、样本数值在 0.7.2 和 0.8.0 中对于 4 个项目完全一致。变更间隔的差异仅在于附注（limitations）由 3 句话增加到了 4 句话。使用 0.8.0 的 `grift verify` 校验以 0.7.2 保存的报告时，由于定义版本为 `tep-v0.7.2-2026-09-07`，与当前版本不一致，因此会显示 `CANNOT_VERIFY`。

我们还确认了是否能检测出数值篡改。在 click 的报告中，将 fix 与 test 组合的值（`fix_with_test_pairing`）从 0.3213 篡改为 0.9 并交由 `grift verify` 校验，工具列出了 `report=0.9 recomputed=0.3213` 这两个数值，并以退出码 1 中止。

另一方面，也存在尚未包含的内容。同日文章的条件 4 中提到，测试协同修改率也会因为对测试文件进行形式上的 1 行修改而上升。在 0.8.0 的代码库报告中，这一路径尚未标注在数值旁边。0.8.0 放置在数值旁边的，仅有活动天数的那一句话。

## 与项目声明并列

`grift project` 会将项目方所写的要求（声明）与从 git 角度看到的运作形态（观察）分节并列展示。我们声明了一个虚构的小型项目“Python 库的维护”，并应用于这 4 个项目。

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

输出分为“项目方的声明”和“观察到的数值”两个章节，不包含合格与否的判定。未声明的间隔 p90 显示为 `not_declared`，报告注明“项目方未填写。并非不足”。即便声明中要求了 forge，但由于未提供 forge 的导出数据，观察方的审查仍保持未观察状态。在 click 中呈现如下排列：

| 维度 | 声明 | click 的观察 |
|---|---|---|
| 180 天活动天数 | 12 天以上 | 62 天（窗口内 commit 187 件） |
| 间隔中位数 | 7 天以下 | 0.08 天 |
| 间隔 p90 | 未声明（not_declared） | 3.36 天 |
| 工作领域 | backend、test | backend 1,158 件、test 562 件 |
| test 种类 | unit | unit 555 件 |
| 输入 | git、forge | 仅 git（forge 为未观察） |

其他 3 个项目也以相同形式排列。并列之后，前一节中的误读风险依然存在。commander.js 的 backend 为 0 件是因为规则中没有 `.js`，而 httpx 的间隔中位数则因窗口样本不足而处于未观察状态。

按维度将声明与观察进行比对的是 `grift align`，会以重合、超出范围、0 件、未观察、无要求这 5 种情况输出。但 `grift align` 将候选人一方的观察作为输入。由于这会涉及对真实个人的度量，本文未执行此项操作。

## 结语

4 个项目的数值均在 2.5 秒内计算完成，且与校验结果一致。不过，任何数值若不与分母、观察窗口以及 path 规则结合起来阅读，都会产生误解。报告本身已附带理由详细说明了能看到什么、未能看到什么。

读者也可以在自己的代码库中通过相同的命令进行确认。从列出的数值中做出何种判断，取决于阅读者自己。

## 参考资料

- [grift-cli（GitHub、MIT）](https://github.com/Cor-Incorporated/grift-cli) - CLI 源码。公开版本为 0.7.2，0.8.0 正在准备公开中
- [Grift](https://griftai.org) - 产品网站
- [grift 报告解读指南（metrics-guide）](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/metrics-guide.md) - 各指标的浅显解说
- [TEP 使用规范（norms）](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/norms.md) - 不将缺失作负面解读、禁止加权与折算
- [如何在实现中坚守“不打分、不排名”（Cor.株式会社 博客，2026 年 10 月 25 日）](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/) - 0.8 确定的 5 个条件
- [pallets/click](https://github.com/pallets/click) - 度量的 OSS（HEAD `36baa15`）
- [pallets/flask](https://github.com/pallets/flask) - 度量的 OSS（HEAD `d318b68`）
- [encode/httpx](https://github.com/encode/httpx) - 度量的 OSS（HEAD `b5addb6`）
- [tj/commander.js](https://github.com/tj/commander.js) - 度量的 OSS（HEAD `ba6d13d`）
