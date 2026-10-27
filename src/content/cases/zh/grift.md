---
title: "Grift —— 履历可以造假，证据无法伪造。从 git 历史中提取可验证事实的开源软件"
description: "自研产品 Grift 可从工程师的 git 历史中提取可验证的事实（检查值）而非简单分数。本文介绍了其从估算支持 Web 应用转向开源 CLI 以及面向猎头中介和 SES 的推荐支持的方向调整过程与系统设计。"
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "人才中介", "SES", "招聘"]
publishedAt: 2026-06-30
updatedAt: 2026-10-28
summary: "Grift 是一款从工程师的 git 历史中提取“可验证事实”的自研产品。它不进行打分或排名。由于评估不使用 AI（LLM），任何人运行都能得到相同的结果，接收方亦可进行复算验证。CLI 采用 MIT 许可证作为开源软件公开发布。"
isDraft: false
featured: true
lang: "zh"
translationSourceHash: "ed8b2d807036f1d1157b45ef4600db884b5b4e3ba81d095feec7e68f891ccb08"
translatedAt: "2026-10-27T17:17:32.544Z"
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
-->

## 课题

人才中介机构和SES（系统工程服务）业务人员在向企业推荐候选人时，需要说明“为何推荐此人”。然而手头的材料往往仅有简历和面试印象。即使上面写着“5年 Java 经验”，也无法体现出具体进行了怎样的变更、以何种方式验证推进等实际工作内容。

另一方面，像 GitHub 绿墙或提交次数这类“活动量”，借助生成式 AI 和 Agent 如今可以轻易膨胀。数量多已很难作为推荐的依据。但如果将其汇总成单一分数，又会丢失测量的内容、时间范围以及基数，沦为粗暴筛选的门槛工具。无论推荐方还是被推荐方，都缺少“可供核实的材料”。

## 方案

Grift 于2026年2月启动，最初是一款用于支持外包开发报价的 Web 应用。在探寻报价依据的过程中，我们发现最确凿的材料莫过于工程师日积月累的 Git 历史记录本身，因此在2026年8月将度量部分抽离成了命令行工具。9月停止了旧版 Web 应用的提供，将方向调整为支持人才中介机构与 SES 业务人员。

在设计上，我们预先定下了3条约定：

- 不打分：输出的是检查值，做判断的是人。不输出综合评分、排名、合格与否及等级，数值必须附带分子和分母
- 每次结果相同：度量不使用 AI（LLM）。只要代码仓库和版本相同，无论谁执行都能得到相同的数值
- 不发送至任何地方：仅在本地 PC 运行。是否共享、提交哪些代码仓库由本人决定

与此同时，我们制定了包括“不将缺失解读为负面”“不单纯以数值设卡筛选”“未经本人同意不得度量他人”等在内的7条使用规范，并规定不遵守规范的使用方式不得冠以该方法名称（TEP：Technical Evidence Pipeline）。

## 实现

Grift CLI 仅从 Git 历史记录中提取如下观察结果：

- 归属区分：通过本人独立提交、他人工作、Bot、生成与供应商产物、沿袭自 Fork 源的历史等11种分类，厘清工作归属
- 测试伴随修改率：在修改生产代码的同一次提交中，测试代码也一并修改的比例
- 返工率・修缮重触：近期接触过文件的返工与重新修改的比例（仅作倾向记录，不用作判定合格与否）
- 代码仓库上下文：实际工作天数、参与人数及最多产出者的占比、经由审查的比例等

v0.6 中新增的 `report-v2` 增加了观察单个工程师工作方式的维度。各项均附带分子和分母，并非对职能或能力的判定。

- 工作领域（`surface_profile`）：按 test / docs / CI/CD / platform / data / observability / frontend / backend / config / 生成与供应商 / 其他等11个分类，统计各领域变更的件数
- 变更节奏（`change_rhythm`）：近180天内提交变更的天数及提交间隔（中位数和第90百分位数、在2天内连续提交的比例、间隔30天以上的比例）。这不代表劳动时长或积极性
- 验证形态（`verification_profile`）：涉及测试的提交比例及其类型（unit / integration / e2e / contract / 未知），以及在修复类提交中附带测试的比例
- 角色的4个维度（`role_profile`）：仅包含 domain / work_type / time / process_position 这4项，不归拢为单一职位名称。仅在存在记录了本人同意的 identity 时才会输出

与项目需求的对照也采取不排定名次的方式进行。项目方通过 `grift project` 声明所需的领域、验证、节奏与输入，`grift align` 则按各个维度将候选人的观察结果并列呈现。并列呈现仅有重叠（overlap）、超出声明范围（outside_declared_range）、0件（observed_zero）、未观察到（not_observed）、无要求（not_declared）5种情况，不计算总分、排名或合格与否。在通过 `--team` 按团队维度查看时，仅输出满足要求的人数；不足3人时因可锁定个人而不予统计。

当基数不足20时，不显示比率而仅展示件数；未观察到的项目不会标为“无实绩”，而是作为附带原因的“未观察到”输出。`grift verify` 能够在相同条件下对保存的报告重新计算，并返回一致、不一致或无法验证的结果，以便接收方核验是否存在篡改或出入。

从0.9.0起，在 `grift actor` 的 Markdown 开头，会用简短的语句写出根据记录呈现的工作推进方式。关于所修改部分的分类、变更节奏、测试添加方式、参与方式，会在附带件数和时间范围的前提下记述，接着写明在该记录中无法体现的事项，并以提问的形式列出希望在面谈中核实的内容。`grift project` 按相同规则记述项目代码仓库的推进方式，不输出个人层面的数字和参与方式。`grift align` 在需求与记录的对照中，以提问的形式附上希望在面谈中核实的内容。语句与提问由公开的[决策表](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.0/docs/trait-profile.md)根据数字选取，不使用 AI。由于不写入 JSON，可通过 `grift verify` 进行验算的是作为语句来源的那些数字。

关于个人的语句和提问，仅在属于本人声明的 ID 且存有同意记录时输出。其他情况下，将用一句话写明未输出的理由。在汇总输出多人时（`--all`、`--top`），不输出语句。

该方法的名称为 TEP（Technical Evidence Pipeline，技术证据提取流程）。由四个阶段构成：读取 Git 记录、按既定规则计数、为计数值附上分母及未能计数的理由、让任何人都能按相同步骤重新计数。详细说明请参阅 Grift 网站的 [TEP 页面](https://griftai.org/tep)。

本页面及 griftai.org 所使用的表述与 CLI 输出中所写入的用语对应关系如下：

| 网站表述 | CLI用语 |
|---|---|
| 检查值 | observed value（`kind: observed`。附带数值、单位与分母） |
| 测试伴随修改率 | test co-change |
| 返工率 | corrective rework |
| 修缮重触 | path retouch |
| Code recency | survival（仅在指定 `--survival` 时） |
| 代码仓库上下文 | context profile |
| 工作领域・变更节奏・验证形态 | surface_profile / change_rhythm / verification_profile |

从0.9.0起，CLI 的 Markdown 也将所修改部分的分类（工作领域）、变更节奏（变更节奏）、测试添加方式（验证形态）、参与方式这4个视角，采用与 griftai.org 相同的名称进行记述。JSON 的键保持不变。

- 代码仓库：[github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- 分发渠道：PyPI“grift-cli”（`pipx install grift-cli`，Python 3.11以上）
- 许可证：MIT
- 发布说明：[github.com/Cor-Incorporated/grift-cli/releases](https://github.com/Cor-Incorporated/grift-cli/releases)（各版本变更点）

## 成果

2026年9月8日，在 PyPI 上发布了 [v0.7.2](https://pypi.org/project/grift-cli/0.7.2/)。各项指标在117个公开代码仓库中进行了验证，能够区分的比较与尚无法区分的比较均已在 GitHub 上公开（为公司内部测定，未接受第三方审计）。

2026年10月25日，我们对网站文案与 CLI 输出进行了逐行核对。由于多人列表（`actor-index`）在附注中虽标明“非排名”，却按提交次数降序排列，我们在2026年10月26日发布的 [0.8.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0) 中，将顺序改为了 ID 的字典顺序。提交次数的数值予以保留。相关经过及对0.8系列设定的5项验收条件已记录在[博客文章](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/)中。

在2026年10月27日发布的 [0.9.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.0) 中，加入了上述报告开头的语句及面谈提问。同时，从 Markdown 中移除了倾向的“强度”行以及对照的“适配度”行。这是因为两份报告并列时，容易被解读为强势/弱势之人，或合适/不合适之人。此外，还修复了4处个人数据可能产生与事实不符数值的地方。

在2026年10月28日发布的 [0.9.1](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.1) 中，修复了0.9.0之后发现的、涉及个人或项目可能产生与事实不符数值的地方。未增加新命令，不输出打分、排名及类型名称的做法保持不变。由于定义版本发生了变更，使用0.9.0保存的报告无法使用0.9.1的 `grift verify` 进行验算。

目前，我们正在与中介机构及 SES 企业共同筹备试点引入（PoC），以候选人本人在本地执行的记录为基础，明确推荐理由。针对自主研发企业的招聘负责人，我们也在受理关于从候选人本人共享的记录中核验其实际工作内容的试点引入（PoC）咨询。关于正式版，我们计划根据试点引入的结果，争取于2027年开始提供。Grift 亦在 [griftai.org](https://griftai.org) 进行了介绍。

关于 Grift 的理念，在 [Qiita](https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1) 和 [note](https://note.com/cor_instrument/n/nd58ba0955317) 的文章中也均有介绍。
