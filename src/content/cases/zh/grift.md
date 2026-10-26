---
title: "Grift —— 履历可以造假，证据无法伪造。从git历史中提取可验证事实的开源软件（OSS）"
description: "介绍自有产品Grift：从工程师的git历史中提取可验证的事实（检验值）而非评分。分享我们如何将方向从估算支持Web应用调整为面向人才介绍公司和SES的推荐支持与开源CLI的经过及设计。"
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "人才介绍", "SES", "招聘"]
publishedAt: 2026-06-30
updatedAt: 2026-10-26
summary: "Grift是一款从工程师的git历史中提取“可验证事实”的自有产品。它不进行打分或排名。由于在衡量中不使用AI（LLM），任何人运行都会得出相同的结果，接收方亦可进行复核验算。CLI已作为MIT许可的开源软件（OSS）公开。"
isDraft: false
featured: true
lang: "zh"
translationSourceHash: "c46c32cd0131a2bb6afc55a971d8dd86ce2270ed68c889bfacfec9bdbe39ffbf"
translatedAt: "2026-10-26T07:50:25.613Z"
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

人才中介机构和SES（系统工程服务）的业务人员在向企业推荐候选人时，需要说明“为何推荐此人”。然而，手头的材料往往仅限于简历和面试印象。即使上面写着“5年Java经验”，但对方究竟做了怎样的变更、如何一边验证一边推进工作，其工作实质却无从体现。

另一方面，像GitHub绿墙和提交数这样的“活动量”，如今借助生成式AI和智能体已能轻松膨胀。数量多寡已很难再作为推荐的依据。但若将其汇总为一个分数，究竟衡量了什么、衡量区间是多久、基数是多少都会被抹去，从而沦为一刀切的初筛工具。无论对于推荐方还是被推荐方，“可验证的材料”都十分匮乏。

## 方法

Grift始于2026年2月，最初是一款辅助外包开发估算的Web应用。在探寻估算依据的过程中，我们意识到最可靠的材料正是工程师日积月累的git历史本身，于是在2026年8月将度量部分剥离为命令行工具。9月，我们停止了原Web应用的提供，将方向调整为赋能人才中介与SES业务。

在设计上，我们预先确立了3项承诺：

- 不折算分数：提供的是检验值，做判断的是人。不生成综合评分、排名、合格与否及评级，数值必须附带分子与分母
- 每次结果一致：度量过程不使用AI（LLM）。在相同的代码仓库和相同版本下，任何人执行都会得到相同的数值
- 不向任何地方发送：仅在本地PC运行。是否共享、提供哪些代码仓库，均由本人决定

同时，我们制定了包括“不将缺失理解为负面评价”、“不单纯依据数值进行筛选”、“未经本人同意不对他人进行度量”在内的7条使用规范，并规定不遵守规范的使用方式不得冠以该方法论的名称（TEP：Technical Evidence Pipeline）。

## 实现

Grift CLI仅从git历史中提取如下观测值：

- 归属区分：分为本人独立提交、他人工作、机器人、生成/供应商产物、沿袭自fork源头的历史等11个类别，以此区分是谁的工作
- 测试伴随修改率：在更改生产代码的同一次提交中，也修改了测试的比例
- 返工率与修饰打磨：针对近期触及文件的返工或再次改动的比例（记录倾向，不用于评判合格与否）
- 代码仓库背景语境：实际工作天数、参与人数与最高产作者的占比、经由审查合并的比例等

在v0.6加入的`report-v2`中，新增了用于观察单一工程师工作形态的层级。各项指标均附带分子与分母，并非对职能或能力的判定。

- 工作领域（`surface_profile`）：分为test / docs / CI/CD / platform / data / observability / frontend / backend / config / 生成与供应商 / 其他共11个类别，展示各领域的变更各有多少件
- 变更节奏（`change_rhythm`）：在最近180天内提交变更的天数，以及提交的间隔（中位数与90分位数、在2天内连续提交的比例、间隔30天以上的比例）。这并非衡量劳动时间或积极性
- 验证形态（`verification_profile`）：涉及测试的提交比例及其类型（unit / integration / e2e / contract / 未知），以及修复（fix）提交中伴随测试的比例
- 角色4维度（`role_profile`）：仅由domain / work_type / time / process_position这4个维度构成，不归纳折叠为单一工种。仅在存在已记录本人同意的identity时才会输出

与项目需求的对照，同样以不排定名次的方式进行。项目方通过`grift project`声明所需的领域、验证、节奏与输入，`grift align`将候选人的观测值按各个维度进行平铺对照。对照结果仅有重合（overlap）、超出声明范围（outside_declared_range）、0件（observed_zero）、未观测到（not_observed）、未作要求（not_declared）这5种情况，不计算综合分、排名或合格与否。通过`--team`以团队为单位查看时，仅输出满足要求的人数，若不足3人，因存在识别出个人的风险而不进行统计。

当基数不足20时，不输出比率，仅展示件数；对于未能观测到的项，不显示为“无业绩”，而是附带理由作为“未观测到”输出。`grift verify` 会在相同条件下重新计算已保存的报告，并返回一致、不一致或无法验证，以便接收方核实是否存在篡改或分歧。

该方法论名为TEP（Technical Evidence Pipeline，技术证据提取管线）。它由4个阶段构成：读取git记录、按既定规则计数、为计数值附加分母及未计入原因、使任何人都能以相同步骤重新计数。详细说明请参阅Grift网站的[TEP页面](https://griftai.org/tep)。

本页面及griftai.org所使用的表述，与CLI在输出中所使用的词汇对应如下：

| 网站表述 | CLI词汇 |
|---|---|
| 检验值 | observed value（`kind: observed`。附带数值、单位与分母） |
| 测试伴随修改率 | test co-change |
| 返工率 | corrective rework |
| 修饰打磨 | path retouch |
| 存续率 | survival（仅在指定`--survival`时） |
| 代码仓库背景语境 | context profile |
| 工作领域、变更节奏、验证形态 | surface_profile / change_rhythm / verification_profile |

- 代码仓库：[github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- 分发方式：PyPI “grift-cli”（`pipx install grift-cli`，支持Python 3.11及以上）
- 许可证：MIT
- 发布说明：[github.com/Cor-Incorporated/grift-cli/releases](https://github.com/Cor-Incorporated/grift-cli/releases)（各版本的变更点）

## 成果

2026年9月8日，我们在PyPI上发布了[v0.7.2](https://pypi.org/project/grift-cli/0.7.2/)。各项指标在117个公开的代码仓库中进行了验证，能够区分的对比与尚无法区分的对比均已在GitHub上公开（属于公司内部测定，未接受第三方审计）。

2026年10月25日，我们逐行比对了网站文案与CLI的输出。由于多人列表（`actor-index`）虽然在注释中写有“并非排名”，实际上却按提交数由多到少排序，因此在2026年10月26日发布的[0.8.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0)中，将排序改为了ID的字典序。提交数的数值予以保留。相关原委及对0.8版本设定的5项验收条件，已记录于[博客文章](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/)中。

目前，我们正与中介公司及SES企业推进概念验证（PoC）的准备工作，旨在基于候选人本人在本地执行的记录，让推荐理由更加具体。我们同时也面向自主研发企业的招聘负责人，受理关于通过候选人本人共享的记录来确认其工作内容的试导入咨询。关于正式版，我们计划结合试导入的结果，争取在2027年开始提供。Grift在 [griftai.org](https://griftai.org) 亦有介绍。

关于Grift的设计理念，在[Qiita](https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1)与[note](https://note.com/cor_instrument/n/nd58ba0955317)的文章中也有介绍。
