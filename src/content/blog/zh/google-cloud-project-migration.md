---
title: "整个 Google Cloud 项目一天之内完成组织间迁移，我的经验总结"
description: "大家好，我是 Terisuke。"
pubDate: 2025-07-24
author: "Terisuke"
category: "engineering"
tags: ["Google Cloud", "DevOps", "移行", "gcloud", "プロジェクト管理"]
image:
  url: "/images/blog/gcp-logo.avif"
  alt: "Google Cloud Platform ロゴ"
lang: "zh"
featured: false
translationSourceHash: "65d2d8e4ee3fb4c439d95c88fea7fca7e8286479aa45bbc964a3c502518304aa"
translatedAt: "2026-09-28T06:09:16.010Z"
translationModel: "adopted-legacy"
---

# 整个 Google Cloud 项目一天之内完成组织间迁移，我的经验总结

大家好，我是 Terisuke。

今天我要分享一个**白白浪费了大量时间**的故事。

公司决定整理云环境，需要将由 `company@example-a.com` 管理的项目迁移到 `company@example-b.com` 的组织下。

一开始，我雄心勃勃地想着“好吧，用 terraform 和 gcloud 慢慢迁移 GCS 存储桶和 Compute 实例吧！”...

**但后来我发现，在同一个 Google Cloud 环境中，有一个方法可以一次性迁移整个项目！**

结果，我辛辛苦苦写的 GCS 迁移脚本完全白费了（哭）

不过，为了避免大家重蹈覆辙，我将这次的迁移方法整理成备忘录。

## 先决条件（这里很重要）

首先，你需要满足以下条件：

- ✅ 拥有两个组织中的 Owner（所有者）权限。
- ✅ 要迁移的项目未使用 VPC Service Controls 或 Shared VPC。
- ✅ 未使用 Marketplace 的付费服务（需要重新购买）。

## 迁移流程（实际操作步骤）

### 1. 确认组织 ID

首先，确认迁移源组织和目标组织的 ID。这在后续的配置中至关重要。

```bash
# 登录迁移源组织
gcloud config set account company@example-a.com
gcloud organizations list
# DISPLAY_NAME     ID             DIRECTORY_CUSTOMER_ID
# example-a.com    123456789012   C02xxxxxx

# 登录迁移目标组织
gcloud config set account company@example-b.com
gcloud organizations list
# DISPLAY_NAME     ID             DIRECTORY_CUSTOMER_ID
# example-b.com    987654321098   C02yyyyyy
```

### 2. 事前检查（这里如果出错会很麻烦）

在迁移前，请务必检查以下内容。等到出现错误再发现就太麻烦了。

```bash
# 检查 VPC Service Controls（出现错误则表示正常）
gcloud access-context-manager perimeters list

# 检查 Shared VPC（返回 {} 表示正常）
gcloud compute shared-vpc get-host-project your-project-id

# 记录当前账单账户
gcloud beta billing projects describe your-project-id
```

### 3. 配置迁移通道（这是关键）

这是最重要的一步。我们需要建立一个“迁移通道”，以便在组织之间移动项目。简而言之，就是让两个组织相互信任的设置。

**在迁移源组织设置导出权限：**
```bash
# 创建 export-policy.yaml 文件
cat > export-policy.yaml << EOF
name: organizations/123456789012/policies/resourcemanager.allowedExportDestinations
spec:
  rules:
    - values:
        allowedValues:
          - under:organizations/987654321098
EOF

# 应用策略
gcloud org-policies set-policy export-policy.yaml
```

**在迁移目标组织设置导入权限：**
```bash
# 登录迁移目标组织
gcloud config set account company@example-b.com

# 创建 import-policy.yaml 文件
cat > import-policy.yaml << EOF
name: organizations/987654321098/policies/resourcemanager.allowedImportSources
spec:
  rules:
    - values:
        allowedValues:
          - under:organizations/123456789012
EOF

# 应用策略
gcloud org-policies set-policy import-policy.yaml
```

### 4. 授予权限（我在这里遇到了问题）

即使是组织所有者，也需要项目级别的权限。我是在出现错误后才意识到的，需要以下权限：

```bash
# 切换回迁移源账号
gcloud config set account company@example-a.com

# 向项目和组织授予权限
gcloud projects add-iam-policy-binding your-project-id \
    --member="user:company@example-a.com" \
    --role="roles/resourcemanager.projectMover"

gcloud organizations add-iam-policy-binding 123456789012 \
    --member="user:company@example-a.com" \
    --role="roles/resourcemanager.projectMover"

# 向迁移目标组织授予权限（跨组织授予权限）
gcloud config set account company@example-b.com
gcloud organizations add-iam-policy-binding 987654321098 \
    --member="user:company@example-a.com" \
    --role="roles/resourcemanager.projectCreator"
```

### 5. 终于开始迁移（只需一个命令！）

准备就绪后，只需一个命令即可完成迁移。

```bash
# 在迁移源账号下执行
gcloud config set account company@example-a.com
gcloud beta projects move your-project-id --organization 987654321098
```

会出现一个警告，输入 `Y` 继续。**不到 1 分钟就完成了迁移**。速度之快让我感到意外。

### 6. 更改账单账户（忘记更改会很麻烦）

项目已移动，但账单账户不会自动更改。如果忘记更改，费用将继续向旧组织收取。

```bash
# 切换到迁移目标账号
gcloud config set account company@example-b.com

# 关联新的账单账户
gcloud beta billing accounts list
gcloud beta billing projects link your-project-id --billing-account NEW-BILLING-ID
```

在这里也出现了权限错误，因此需要向迁移目标账号授予项目所有者权限。

```bash
# 在迁移源账号下执行
gcloud config set account company@example-a.com
gcloud projects add-iam-policy-binding your-project-id \
    --member="user:company@example-b.com" \
    --role="roles/owner"
```

### 7. 清理（非常重要）

我们需要关闭为了迁移而打开的“安全漏洞”。如果忘记此步骤，组织之间将可以随意移动项目。

```bash
# 删除组织策略
gcloud config set account company@example-a.com
gcloud org-policies delete resourcemanager.allowedExportDestinations --organization=123456789012

gcloud config set account company@example-b.com
gcloud org-policies delete resourcemanager.allowedImportSources --organization=987654321098

# 删除组织间权限
gcloud organizations remove-iam-policy-binding 987654321098 \
    --member="user:company@example-a.com" \
    --role="roles/resourcemanager.projectCreator"
```

## 迁移后的注意事项

- **继承的 IAM 策略**将会丢失。需要重新配置在组织级别授予的权限。
- **预算提醒**也需要重新设置。新的账单账户不会继承预算设置。
- **服务运行状况检查**是必须的。特别是与外部集成的服务，需要仔细检查。

## 结果：白费的 GCS 迁移脚本

实际上，在开始迁移工作时，我甚至还写了一个脚本，用于通过本地网络迁移 GCS 存储桶。

https://github.com/terisuke/gcs-migration-project

我实现了并行下载、进度显示和错误处理，原本觉得“这样就可以轻松迁移大量存储桶了！”...

但当我得知**可以移动整个项目**时，这一切都变得毫无意义了。

不过，至少我通过这个过程学习了 `gsutil` 的并行处理和 Python 操作 GCS 的技巧，而且如果无法跨组织迁移，这个脚本还是有用的，所以我这样安慰自己。

## 总结

Google Cloud 项目的迁移，只要拥有正确的权限和设置，就可以惊人地简单。但请务必不要忘记清理安全设置。

如果有人也面临类似的迁移任务，我建议你们一开始就研究一下 `gcloud beta projects move` 命令。重复造轮子虽然有趣，但时间是宝贵的。

说起来，那三天写 GCS 迁移脚本的时间真想还给我啊。

---

**感谢阅读！**

如果您有类似的经历，或者计划进行迁移工作，请在评论区告诉我。我们一起哭吧（笑）
