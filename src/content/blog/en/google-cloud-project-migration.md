---
title: "We Migrated an Entire Google Cloud Project Between Organizations, and It Took Just One Day"
description: "The tearful tale of a developer who wrote a custom script to migrate GCS piece by piece, only to discover you can move the entire project all at once."
summary: "Google Cloud projects can be moved in their entirety across organizations using gcloud beta projects move. You open a migration corridor, assign permissions, migrate, switch the billing account, and remove the opened policies and permissions. The migration command itself took less than a minute."
pubDate: 2025-07-24
updatedDate: 2026-10-23
author: "Terisuke"
category: "engineering"
tags: ["Google Cloud", "DevOps", "移行", "gcloud", "プロジェクト管理"]
image:
  url: "/images/blog/gcp-logo.avif"
  alt: "Google Cloud Platform logo"
lang: "en"
featured: false
translationSourceHash: "e931b0447ea24de7c5e3f41cbc9e772c31e92f20d0c727fd4e64f15c53057372"
translatedAt: "2026-10-23T06:16:24.388Z"
translationModel: "gemini-3.8-flash"
---

# We Migrated an Entire Google Cloud Project Between Organizations, and It Took Just One Day

Hi, I'm Terisuke.

Today, I want to talk about how I wasted a massive amount of time.

As part of cleaning up our company's cloud environment, we needed to move a project managed under `company@example-a.com` over to the organization at `company@example-b.com`.

At first, I was all geared up: "Alright, let's migrate the GCS buckets and Compute instances piece by piece using terraform and gcloud!"

Then, I learned that within Google Cloud, you can actually move an entire project all at once.

As a result, the GCS migration script I painstakingly built went completely to waste (cries).

Still, to prevent others from making the same mistake, and as a note for myself, I've summarized the process below.

## Prerequisites

This part is crucial. First, you must satisfy the following conditions:

- Hold Owner permissions in both organizations
- The project to be migrated must not be using VPC Service Controls or Shared VPC
- It must not be using paid Marketplace services (these would require repurchase)

## The Step-by-Step Migration Process I Actually Followed

### 1. Check the Organization IDs

First, check the source and destination organization IDs. This becomes super important for the configurations later on.

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

### 2. Pre-migration Checks

Make sure to check the following items before migrating. Realizing an issue only after hitting an error is a real headache.

```bash
# VPC Service Controlsの確認（エラーが出ればOK）
gcloud access-context-manager perimeters list

# Shared VPCの確認（{}が返ればOK）
gcloud compute shared-vpc get-host-project your-project-id

# 現在の請求アカウントをメモ
gcloud beta billing projects describe your-project-id
```

### 3. Configure the Migration Corridor

This is the most critical part. Open a "migration corridor" so projects can move between organizations. In short, it's a setting that establishes trust between the two organizations.

In the source organization, configure permissions to allow exports.
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

In the destination organization, configure permissions to allow imports.
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

### 4. Grant Permissions

This is where I got stuck. Even as an organization owner, project-level permissions were required. I only realized it after getting an error, but the following permissions are necessary:

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

### 5. Time to Migrate

Once everything is ready, you can perform the migration with just a single command.

```bash
# 移行元アカウントで実行
gcloud config set account company@example-a.com
gcloud beta projects move your-project-id --organization 987654321098
```

A warning will appear, but proceed with `Y`. The migration finished in under a minute. It was so fast it caught me completely off guard.

### 6. Change the Billing Account

Even though the project moved, the billing account does not change automatically. If you forget this step, the old organization will keep getting billed, leading to major trouble.

```bash
# 移行先アカウントに切り替え
gcloud config set account company@example-b.com

# 新しい請求先に紐付け
gcloud beta billing accounts list
gcloud beta billing projects link your-project-id --billing-account NEW-BILLING-ID
```

I hit another permission error here, so I had to grant Project Owner permissions to the destination account.

```bash
# 移行元アカウントで実行
gcloud config set account company@example-a.com
gcloud projects add-iam-policy-binding your-project-id \
    --member="user:company@example-b.com" \
    --role="roles/owner"
```

### 7. Clean Up

Close the "security hole" that was opened for the migration. This step is extremely important; if you forget it, the state allowing arbitrary project moves between organizations will persist.

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

## Post-Migration Notes

- Inherited IAM policies are lost. Permissions granted at the organization level need to be reconfigured.
- Budget alerts also need to be reconfigured. Budget settings are not carried over to the new billing account.
- Verifying service operations is essential. Services integrated with external systems, in particular, require a close check.

## The Punchline: The GCS Migration Script That Went to Waste

To tell the truth, when I first started the migration work, I had gone as far as building a script to migrate GCS buckets via local storage.

https://github.com/terisuke/gcs-migration-project

I implemented parallel downloads, progress displays, and error handling, enthusiastically thinking, "Now I can migrate a ton of buckets with ease!"

The moment I learned you could move the entire project, all of that became completely pointless.

Well, I tell myself that it wasn't a total waste because I learned about gsutil parallel processing and handling GCS with Python—and it can still be used when you can't cross organizations.

## Summary

Migrating a Google Cloud project turned out to be surprisingly easy, provided you have the proper permissions and configurations in place. Just don't forget to clean up your security settings.

If anyone ever has to do a similar migration, I recommend looking into `gcloud beta projects move` right from the start. Reinventing the wheel is fun, but time is finite.

Still, I really wish I could get back the three days I spent building that GCS migration script.

---

Thanks for reading.

If you've had a similar experience or are planning a migration soon, let me know in the comments. We can cry together lol
