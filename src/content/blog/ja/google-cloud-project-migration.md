---
title: "Google Cloudプロジェクトをまるごと組織間移行したら、1日で終わってしまった件"
description: "GCSをちまちま移行するスクリプトまで作ったのに、実はプロジェクトごと移動できることを知った開発者の涙の記録"
summary: "Google Cloudのプロジェクトは、組織をまたいでもgcloud beta projects moveでまるごと移せる。移行コリドーを開いて権限を付け、移したあとは請求先を付け替え、開けたポリシーと権限を消す。移行のコマンド自体は1分もかからずに終わった。"
pubDate: 2025-07-24
updatedDate: 2026-10-23
author: "Terisuke"
category: "engineering"
tags: ["Google Cloud", "DevOps", "移行", "gcloud", "プロジェクト管理"]
image:
  url: "/images/blog/gcp-logo.avif"
  alt: "Google Cloud Platform ロゴ"
lang: "ja"
featured: false
---

# Google Cloudプロジェクトをまるごと組織間移行したら、1日で終わってしまった件

こんにちは、Terisukeだ。

今日はめちゃくちゃ時間を無駄にした話をする。

会社のクラウド環境を整理することになって、`company@example-a.com`で管理していたプロジェクトを`company@example-b.com`の組織に移す必要が出てきた。

最初は「よし、terraformやgcloudを使ってGCSバケットやComputeインスタンスをちまちま移行していこう！」と意気込んでいた。

ところが、同じGoogle Cloudなら、プロジェクトごとまるっと移動できる方法があるってことを知った。

結果、せっかく作ったGCS移行スクリプトは完全に無駄になった（泣）

でも、同じ轍を踏まないように、備忘録も兼ねてその方法をまとめておく。

## 前提条件

ここは重要だ。まず、次の条件を満たしている必要がある。

- 両方の組織でオーナー権限を持っていること
- 移行するプロジェクトがVPC Service ControlsやShared VPCを使っていないこと
- Marketplaceの有料サービスを使っていないこと（再購入が必要になる）

## 実際にやった移行の手順

### 1. 組織IDの確認

まずは移行元と移行先の組織IDを確認する。これが後の設定で超重要になる。

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

### 2. 事前確認

移行前に次の項目を確認しておこう。エラーになってから気づくと本当に面倒だ。

```bash
# VPC Service Controlsの確認（エラーが出ればOK）
gcloud access-context-manager perimeters list

# Shared VPCの確認（{}が返ればOK）
gcloud compute shared-vpc get-host-project your-project-id

# 現在の請求アカウントをメモ
gcloud beta billing projects describe your-project-id
```

### 3. 移行コリドーの設定

ここが一番重要な部分だ。組織間でプロジェクトを移動できるように「移行コリドー」を開設する。要は、お互いの組織を信頼させる設定だね。

移行元の組織で、エクスポートの許可を設定する。
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

移行先の組織で、インポートの許可を設定する。
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

### 4. 権限の付与

ここでハマった。組織オーナーでも、プロジェクトレベルの権限が必要だった。エラーが出てから気づいたんだけど、次の権限が必要になる。

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

### 5. いよいよ移行

準備が整ったら、たった1コマンドで移行できる。

```bash
# 移行元アカウントで実行
gcloud config set account company@example-a.com
gcloud beta projects move your-project-id --organization 987654321098
```

警告が出るけど、`Y`で進む。移行は1分もかからずに終わった。早すぎて拍子抜けした。

### 6. 請求先の変更

プロジェクトは移動したけど、請求先は変わらない。これを忘れると、旧組織に請求が行き続けて大変なことになる。

```bash
# 移行先アカウントに切り替え
gcloud config set account company@example-b.com

# 新しい請求先に紐付け
gcloud beta billing accounts list
gcloud beta billing projects link your-project-id --billing-account NEW-BILLING-ID
```

ここでも権限エラーが出たので、移行先アカウントにプロジェクトオーナー権限を付与する必要があった。

```bash
# 移行元アカウントで実行
gcloud config set account company@example-a.com
gcloud projects add-iam-policy-binding your-project-id \
    --member="user:company@example-b.com" \
    --role="roles/owner"
```

### 7. クリーンアップ

移行のために開けた「セキュリティホール」を塞ぐ。この手順は超重要で、忘れると組織間で勝手にプロジェクトを移動できる状態が続く。

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

## 移行後の注意点

- 継承されたIAMポリシーは失われる。組織レベルで付与していた権限は再設定が必要
- 予算アラートも再設定が必要。新しい請求アカウントでは予算設定が引き継がれない
- サービスの動作確認は必須。特に外部連携しているサービスは要チェック

## オチ：無駄になったGCS移行スクリプト

実は移行作業を始めた当初、GCSバケットをローカル経由で移行するスクリプトまで作っていた。

https://github.com/terisuke/gcs-migration-project

並列ダウンロード、進捗表示、エラーハンドリングまで実装して、「これで大量のバケットも楽に移行できるぞ！」と意気込んでいた。

それが、プロジェクトごと移動できると知った時点で、すべて無駄になった。

でもまあ、gsutilの並列処理やPythonでのGCS操作の勉強にはなったし、組織をまたげない場合は使えるので、完全に無駄ではない、と自分に言い聞かせている。

## まとめ

Google Cloudのプロジェクト移行は、適切な権限と設定さえあれば驚くほど簡単だった。ただし、セキュリティ設定のクリーンアップは忘れずに。

もし同じような移行作業をする人がいたら、最初から`gcloud beta projects move`の存在を調べることをおすすめする。車輪の再発明は楽しいけど、時間は有限だ。

それにしても、あのGCS移行スクリプトを作った3日間を返してほしい。

---

読んでいただいてありがとう。

同じような経験をした方、これから移行作業をする予定の方、ぜひコメントで教えてくれ。一緒に泣こうぜ笑