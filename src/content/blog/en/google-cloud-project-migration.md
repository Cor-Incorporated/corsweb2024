---
title: "The Case Where Migrating an Entire Google Cloud Project Across Organizations Finished in One Day"
description: "A record of a developer's tears upon discovering that projects could be moved in their entirety, despite having created scripts for incremental GCS migration."
pubDate: 2025-07-24
author: "Terisuke"
category: "engineering"
tags: ["Google Cloud", "DevOps", "移行", "gcloud", "プロジェクト管理"]
image:
  url: "/images/blog/gcp-logo.avif"
  alt: "Google Cloud Platform ロゴ"
lang: "en"
featured: false
translationSourceHash: "65d2d8e4ee3fb4c439d95c88fea7fca7e8286479aa45bbc964a3c502518304aa"
translatedAt: "2026-09-28T06:09:16.002Z"
translationModel: "adopted-legacy"
---

# The Time Google Cloud Projects Migrated Across Organizations Finished in One Day

Hello, this is Terisuke.

Today, I'm going to tell you a story about **a huge waste of time**.

As part of organizing our company's cloud environment, we needed to move projects managed under `company@example-a.com` to the organization of `company@example-b.com`.

At first, I was eager to "Alright, let's use terraform and gcloud to migrate GCS buckets and Compute instances little by little!" but...

**I learned that there's actually a way to move entire projects within the same Google Cloud environment.**

As a result, the GCS migration script I painstakingly created was completely useless (cry).

However, to avoid falling into the same trap, I'm documenting the method as a memo.

## Prerequisites (This is Important)

First, you need to meet the following conditions:

- ✅ You have Owner permissions in both organizations.
- ✅ The project to be migrated does not use VPC Service Controls or Shared VPC.
- ✅ You are not using paid services from the Marketplace (you will need to repurchase them).

## Migration Flow (Actual Steps Taken)

### 1. Confirming Organization IDs

First, confirm the Organization IDs of the source and destination. This is crucial for later configuration.

```bash
# Log in to the source organization
gcloud config set account company@example-a.com
gcloud organizations list
# DISPLAY_NAME     ID             DIRECTORY_CUSTOMER_ID
# example-a.com    123456789012   C02xxxxxx

# Log in to the destination organization
gcloud config set account company@example-b.com
gcloud organizations list
# DISPLAY_NAME     ID             DIRECTORY_CUSTOMER_ID
# example-b.com    987654321098   C02yyyyyy
```

### 2. Pre-checks (Getting stuck here is troublesome)

Before migrating, check the following. It's really troublesome to notice errors after they occur.

```bash
# Check VPC Service Controls (if an error appears, it's okay)
gcloud access-context-manager perimeters list

# Check Shared VPC (if {} is returned, it's okay)
gcloud compute shared-vpc get-host-project your-project-id

# Note down the current billing account
gcloud beta billing projects describe your-project-id
```

### 3. Setting up the Migration Corridor (This is the Key)

This is the most important part. We establish a "migration corridor" to enable project movement between organizations. In essence, it's a setting to make each organization trust the other.

**Set export permission in the source organization:**
```bash
# Create export-policy.yaml
cat > export-policy.yaml << EOF
name: organizations/123456789012/policies/resourcemanager.allowedExportDestinations
spec:
  rules:
    - values:
        allowedValues:
          - under:organizations/987654321098
EOF

# Apply the policy
gcloud org-policies set-policy export-policy.yaml
```

**Set import permission in the destination organization:**
```bash
# Log in to the destination organization
gcloud config set account company@example-b.com

# Create import-policy.yaml
cat > import-policy.yaml << EOF
name: organizations/987654321098/policies/resourcemanager.allowedImportSources
spec:
  rules:
    - values:
        allowedValues:
          - under:organizations/123456789012
EOF

# Apply the policy
gcloud org-policies set-policy import-policy.yaml
```

### 4. Granting Permissions (Got stuck here)

Even as an organization owner, project-level permissions were required. I realized this after encountering an error, but the following permissions are necessary.

```bash
# Switch back to the source account
gcloud config set account company@example-a.com

# Grant permissions to the project and organization
gcloud projects add-iam-policy-binding your-project-id \
    --member="user:company@example-a.com" \
    --role="roles/resourcemanager.projectMover"

gcloud organizations add-iam-policy-binding 123456789012 \
    --member="user:company@example-a.com" \
    --role="roles/resourcemanager.projectMover"

# Grant permissions to the destination organization as well (cross-organization permission granting)
gcloud config set account company@example-b.com
gcloud organizations add-iam-policy-binding 987654321098 \
    --member="user:company@example-a.com" \
    --role="roles/resourcemanager.projectCreator"
```

### 5. The Actual Migration (Just 1 Command!)

Once everything is ready, you can migrate with just one command.

```bash
# Execute with the source account
gcloud config set account company@example-a.com
gcloud beta projects move your-project-id --organization 987654321098
```

A warning will appear, but proceed by typing `Y`. **The migration was completed in less than a minute**. I was taken aback by how fast it was.

### 6. Changing the Billing Account (You'll regret it if you forget)

Although the project has moved, the billing account does not change. If you forget this, billing will continue to go to the old organization.

```bash
# Switch to the destination account
gcloud config set account company@example-b.com

# Link to the new billing account
gcloud beta billing accounts list
gcloud beta billing projects link your-project-id --billing-account NEW-BILLING-ID
```

I encountered permission errors here as well, so I had to grant the project owner permission to the destination account.

```bash
# Execute with the source account
gcloud config set account company@example-a.com
gcloud projects add-iam-policy-binding your-project-id \
    --member="user:company@example-b.com" \
    --role="roles/owner"
```

### 7. Cleanup (Extremely Important)

Close the "security holes" that were opened for the migration. If you forget this, the ability to move projects freely between organizations will persist.

```bash
# Delete organization policies
gcloud config set account company@example-a.com
gcloud org-policies delete resourcemanager.allowedExportDestinations --organization=123456789012

gcloud config set account company@example-b.com
gcloud org-policies delete resourcemanager.allowedImportSources --organization=987654321098

# Delete cross-organization permissions as well
gcloud organizations remove-iam-policy-binding 987654321098 \
    --member="user:company@example-a.com" \
    --role="roles/resourcemanager.projectCreator"
```

## Post-Migration Considerations

- **Inherited IAM policies** will be lost. Permissions granted at the organization level will need to be reconfigured.
- **Budget alerts** will also need to be reconfigured. Budget settings are not carried over to the new billing account.
- **Service operational checks** are essential. Pay special attention to services with external integrations.

## The Punchline: The Useless GCS Migration Script

When I initially started the migration process, I had even created a script to migrate GCS buckets via local transfer.

https://github.com/terisuke/gcs-migration-project

I implemented parallel downloads, progress display, and error handling, thinking, "This will make migrating large numbers of buckets much easier!" but...

The moment I learned that **projects could be moved whole**, everything became useless.

However, I'm telling myself that it wasn't entirely wasted, as I learned about parallel processing with `gsutil` and GCS operations in Python, and it could still be useful in cases where cross-organization movement isn't possible.

## Summary

Google Cloud project migration was surprisingly easy with the right permissions and configuration. However, don't forget to clean up security settings.

If anyone else is undertaking a similar migration, I recommend investigating the existence of `gcloud beta projects move` from the start. Reinventing the wheel can be fun, but time is finite.

Still, I wish I could get back the three days I spent creating that GCS migration script.

---

**Thank you for reading!**

If you've had a similar experience or are planning a migration, please let me know in the comments. Let's cry together (lol).
