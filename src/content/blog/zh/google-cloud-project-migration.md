---
title: "将Google Cloud项目完整进行跨组织迁移，结果1天就搞定这件事"
description: "甚至特意写好了逐个迁移GCS的脚本，才发现其实可以直接按项目整体迁移，来自开发者的含泪记录"
summary: "Google Cloud的项目即便跨组织也可以通过gcloud beta projects move完整迁移。开启迁移通道并配置权限，迁移完成后更换结算账户，再删除放开的策略与权限即可。迁移命令本身甚至不到1分钟就执行完毕了。"
pubDate: 2025-07-24
updatedDate: 2026-10-23
author: "Terisuke"
category: "engineering"
tags: ["Google Cloud", "DevOps", "移行", "gcloud", "プロジェクト管理"]
image:
  url: "/images/blog/gcp-logo.avif"
  alt: "Google Cloud Platform 标志"
lang: "zh"
featured: false
translationSourceHash: "e931b0447ea24de7c5e3f41cbc9e772c31e92f20d0c727fd4e64f15c53057372"
translatedAt: "2026-10-23T06:19:23.130Z"
translationModel: "gemini-3.8-flash"
---

# 将Google Cloud项目完整进行跨组织迁移，结果1天就搞定这件事

你好，我是 Terisuke。

今天来聊聊我浪费了大把时间的一段经历。

因为公司要整理云环境，需要把原本在 `company@example-a.com` 管理的项目迁移到 `company@example-b.com` 的组织中。

一开始我还信心满满地想着：“好，那就用 terraform 和 gcloud 一点一点把 GCS bucket 和 Compute 实例迁过去吧！”

然而，我后来才知道，如果同样是 Google Cloud，其实有办法把整个项目完整搬移过去。

结果就是，我辛辛苦苦写好的 GCS 迁移脚本彻底打了水漂（哭）。

不过，为了不重蹈覆辙，我也顺便把这个方法整理下来作为备忘。

## 前提条件

这部分非常关键。首先，必须满足以下条件：

- 在两个组织中都拥有所有者（Owner）权限
- 要迁移的项目没有使用 VPC Service Controls 或 Shared VPC
- 未使用 Marketplace 的付费服务（否则需要重新购买）

## 实际操作的迁移步骤

### 1. 确认组织 ID

首先确认源组织和目标组织的组织 ID。这在后面的配置中至关重要。

```bash
# 移行元組織にログイン
gcloud config set account company@example-a.com
gcloud organizations list
# DISPLAY_NAME     ID             DIRECTORY_CUSTOMER_ID
# example-a.com    123456789012   C02xxxxxx

# 移行先組織にログイン  
gcloud config set account company@example-b.com
gcloud organizations list
# DISPLAY_NAME     ID             DIRECTORY_CUSTOMER_ID
# example-b.com    987654321098   C02yyyyyy
```

### 2. 事前确认

在迁移前最好确认以下几项。要是报错之后才发现，那可就太麻烦了。

```bash
# VPC Service Controlsの確認（エラーが出ればOK）
gcloud access-context-manager perimeters list

# Shared VPCの確認（{}が返ればOK）
gcloud compute shared-vpc get-host-project your-project-id

# 現在の請求アカウントをメモ
gcloud beta billing projects describe your-project-id
```

### 3. 配置迁移通道（Migration Corridor）

这是最关键的一步。为了能在组织间移动项目，需要开通“迁移通道”。简单来说，就是让两个组织建立互信关系的配置。

在源组织中，配置允许导出。
```bash
# export-policy.yamlを作成
cat > export-policy.yaml << EOF
name: organizations/123456789012/policies/resourcemanager.allowedExportDestinations
spec:
  rules:
    - values:
        allowedValues:
          - under:organizations/987654321098
EOF

# ポリシーを適用
gcloud org-policies set-policy export-policy.yaml
```

在目标组织中，配置允许导入。
```bash
# 移行先組織にログイン
gcloud config set account company@example-b.com

# import-policy.yamlを作成
cat > import-policy.yaml << EOF
name: organizations/987654321098/policies/resourcemanager.allowedImportSources
spec:
  rules:
    - values:
        allowedValues:
          - under:organizations/123456789012
EOF

# ポリシーを適用
gcloud org-policies set-policy import-policy.yaml
```

### 4. 授予权限

我在这里踩了坑。即便拥有组织所有者权限，也仍然需要项目级别的权限。我是在报错之后才注意到的，需要以下权限：

```bash
# 移行元アカウントに戻る
gcloud config set account company@example-a.com

# プロジェクトと組織に権限を付与
gcloud projects add-iam-policy-binding your-project-id \
    --member="user:company@example-a.com" \
    --role="roles/resourcemanager.projectMover"

gcloud organizations add-iam-policy-binding 123456789012 \
    --member="user:company@example-a.com" \
    --role="roles/resourcemanager.projectMover"

# 移行先組織にも権限を付与（組織をまたいだ権限付与）
gcloud config set account company@example-b.com
gcloud organizations add-iam-policy-binding 987654321098 \
    --member="user:company@example-a.com" \
    --role="roles/resourcemanager.projectCreator"
```

### 5. 正式迁移

准备就绪后，只需一条命令即可完成迁移。

```bash
# 移行元アカウントで実行
gcloud config set account company@example-a.com
gcloud beta projects move your-project-id --organization 987654321098
```

虽然会弹出警告，但输入 `Y` 继续即可。迁移还不到 1 分钟就完成了。速度快得让人猝不及防。

### 6. 更改结算账号

虽然项目已经移动过去了，但结算账号并没有改变。如果忘了这一步，账单就会一直寄给旧组织，麻烦可就大了。

```bash
# 移行先アカウントに切り替え
gcloud config set account company@example-b.com

# 新しい請求先に紐付け
gcloud beta billing accounts list
gcloud beta billing projects link your-project-id --billing-account NEW-BILLING-ID
```

这里也报了权限错误，因此需要给目标账号授予项目所有者权限。

```bash
# 移行元アカウントで実行
gcloud config set account company@example-a.com
gcloud projects add-iam-policy-binding your-project-id \
    --member="user:company@example-b.com" \
    --role="roles/owner"
```

### 7. 清理工作

堵上为了迁移而开辟的“安全漏洞”。这一步极其重要，要是忘了，两个组织之间就会一直处于可以随意移动项目的状态。

```bash
# 組織ポリシーを削除
gcloud config set account company@example-a.com
gcloud org-policies delete resourcemanager.allowedExportDestinations --organization=123456789012

gcloud config set account company@example-b.com
gcloud org-policies delete resourcemanager.allowedImportSources --organization=987654321098

# 組織間の権限も削除
gcloud organizations remove-iam-policy-binding 987654321098 \
    --member="user:company@example-a.com" \
    --role="roles/resourcemanager.projectCreator"
```

## 迁移后的注意事项

- 继承的 IAM 策略将会丢失。在组织级别授予的权限需要重新配置
- 预算提醒也需要重新设置。新的结算账号不会继承原有的预算设置
- 服务运行确认必不可少。特别是与外部联动的服务，务必要仔细检查

## 结尾反转：彻底白费的 GCS 迁移脚本

实际上在刚开始动手迁移时，我还专门写了一个通过本地中转来迁移 GCS bucket 的脚本。

https://github.com/terisuke/gcs-migration-project

我甚至还实现了并行下载、进度显示和错误处理，当时还斗志昂扬地想着：“这下大量 bucket 也能轻松迁移了！”

然而，在得知可以直接整个项目搬移的那一瞬间，这一切全都白费了。

不过嘛，这也算学到了 gsutil 的并行处理以及用 Python 操作 GCS 的知识，而且在无法跨组织移动的情况下也能派上用场，我只能这样安慰自己：这也不算完全白费吧。

## 总结

只要拥有合适的权限并完成相应配置，Google Cloud 的项目迁移出乎意料地简单。不过，千万别忘了清理安全配置。

如果有其他人要做类似的迁移工作，建议一开始就去查查 `gcloud beta projects move` 的相关资料。重新发明轮子虽然有趣，但时间是有限的。

话虽如此，真想把写那个 GCS 迁移脚本耗费的 3 天时间拿回来啊。

---

感谢阅读。

如果你也有过类似的经历，或者正准备进行迁移工作，欢迎在评论区告诉我。咱们一起抱头痛哭吧哈哈。
