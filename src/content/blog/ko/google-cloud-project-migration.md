---
title: "Google Cloud 프로젝트를 통째로 조직 간 이전했더니 하루 만에 끝나버린 건에 대하여"
description: "GCS를 일일이 이전하는 스크립트까지 만들었는데, 알고 보니 프로젝트째 이동할 수 있다는 사실을 알게 된 개발자의 눈물겨운 기록"
summary: "Google Cloud 프로젝트는 조직이 달라도 gcloud beta projects move를 통해 통째로 이전할 수 있다. 마이그레이션 통로를 열어 권한을 부여하고, 이동한 뒤 결제 계정을 재연결하며, 열어두었던 정책과 권한을 삭제한다. 이전 명령 자체는 1분도 채 걸리지 않고 끝났다."
pubDate: 2025-07-24
updatedDate: 2026-10-23
author: "Terisuke"
category: "engineering"
tags: ["Google Cloud", "DevOps", "移行", "gcloud", "プロジェクト管理"]
image:
  url: "/images/blog/gcp-logo.avif"
  alt: "Google Cloud Platform 로고"
lang: "ko"
featured: false
translationSourceHash: "e931b0447ea24de7c5e3f41cbc9e772c31e92f20d0c727fd4e64f15c53057372"
translatedAt: "2026-10-23T06:22:26.647Z"
translationModel: "gemini-3.8-flash"
---

# Google Cloud 프로젝트를 통째로 조직 간 이전했더니 하루 만에 끝나버린 건에 대하여

안녕하세요, Terisuke다.

오늘은 시간을 엄청나게 낭비했던 이야기를 해보려 한다.

회사 클라우드 환경을 정리하게 되면서, `company@example-a.com`에서 관리하던 프로젝트를 `company@example-b.com` 조직으로 이전해야 할 일이 생겼다.

처음에는 '좋아, terraform이나 gcloud를 써서 GCS 버킷이랑 Compute 인스턴스를 하나하나 꼼꼼히 이전해보자!'라며 의욕에 차 있었다.

그런데, 같은 Google Cloud라면 프로젝트 자체를 통째로 이동할 수 있는 방법이 있다는 것을 알게 되었다.

결과적으로, 기껏 만들어 둔 GCS 이전 스크립트는 완전히 쓸모없어졌다 (눈물).

하지만 같은 실수를 반복하지 않도록, 비망록 겸 그 방법을 정리해 둔다.

## 전제 조건

이 부분은 중요하다. 먼저, 다음 조건을 만족해야 한다.

- 양쪽 조직 모두에서 소유자 권한을 가지고 있을 것
- 이전할 프로젝트가 VPC Service Controls나 Shared VPC를 사용하고 있지 않을 것
- Marketplace의 유료 서비스를 사용하고 있지 않을 것 (재구매가 필요해짐)

## 실제로 진행한 이전 절차

### 1. 조직 ID 확인

먼저 이전 원본과 이전 대상의 조직 ID를 확인한다. 이게 이후 설정에서 매우 중요해진다.

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

### 2. 사전 확인

이전하기 전에 다음 항목을 확인해 두자. 에러가 발생한 뒤에 알아차리면 정말 골치 아프다.

```bash
# VPC Service Controlsの確認（エラーが出ればOK）
gcloud access-context-manager perimeters list

# Shared VPCの確認（{}が返ればOK）
gcloud compute shared-vpc get-host-project your-project-id

# 現在の請求アカウントをメモ
gcloud beta billing projects describe your-project-id
```

### 3. 마이그레이션 통로 설정

이 부분이 가장 중요한 부분이다. 조직 간에 프로젝트를 이동할 수 있도록 '마이그레이션 통로'를 개설한다. 요컨대 서로의 조직을 신뢰하도록 만드는 설정이다.

이전 원본 조직에서 내보내기 허용을 설정한다.
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

이전 대상 조직에서 가져오기 허용을 설정한다.
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

### 4. 권한 부여

여기서 애를 먹었다. 조직 소유자라도 프로젝트 수준의 권한이 필요했다. 에러가 나고 나서야 알게 되었는데, 다음 권한이 필요하다.

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

### 5. 드디어 이전

준비가 완료되면, 단 명령어 1줄로 이전할 수 있다.

```bash
# 移行元アカウントで実行
gcloud config set account company@example-a.com
gcloud beta projects move your-project-id --organization 987654321098
```

경고가 뜨지만, `Y`로 진행한다. 이전은 1분도 채 걸리지 않고 끝났다. 너무 빨라서 허탈할 정도였다.

### 6. 결제 계정 변경

프로젝트는 이동했지만 결제 계정은 바뀌지 않는다. 이걸 잊어버리면 기존 조직으로 청구가 계속 발생해 큰일이 난다.

```bash
# 移行先アカウントに切り替え
gcloud config set account company@example-b.com

# 新しい請求先に紐付け
gcloud beta billing accounts list
gcloud beta billing projects link your-project-id --billing-account NEW-BILLING-ID
```

여기서도 권한 에러가 발생했기 때문에, 이전 대상 계정에 프로젝트 소유자 권한을 부여해야 했다.

```bash
# 移行元アカウントで実行
gcloud config set account company@example-a.com
gcloud projects add-iam-policy-binding your-project-id \
    --member="user:company@example-b.com" \
    --role="roles/owner"
```

### 7. 정리 작업

이전을 위해 열어두었던 '보안 구멍'을 메운다. 이 절차는 매우 중요하며, 잊어버리면 조직 간에 임의로 프로젝트를 이동할 수 있는 상태가 유지된다.

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

## 이전 후 주의 사항

- 상속된 IAM 정책은 유실된다. 조직 수준에서 부여했던 권한은 재설정이 필요함
- 예산 알림도 재설정이 필요하다. 새로운 결제 계정에는 예산 설정이 승계되지 않음
- 서비스 동작 확인은 필수다. 특히 외부 연동되어 있는 서비스는 반드시 확인 필요

## 결말: 헛수고가 된 GCS 이전 스크립트

사실 이전 작업을 시작할 당시에는 GCS 버킷을 로컬을 거쳐 이전하는 스크립트까지 만들어 두었었다.

https://github.com/terisuke/gcs-migration-project

병렬 다운로드, 진행 상황 표시, 에러 핸들링까지 구현해서 '이걸로 대량의 버킷도 수월하게 이전할 수 있겠지!'라며 의욕이 넘쳤었다.

그런데 프로젝트 통째로 이동할 수 있다는 걸 알게 된 순간, 전부 헛수고가 되어버렸다.

하지만 뭐, gsutil 병렬 처리나 Python으로 GCS를 다루는 공부는 되었고, 조직을 넘나들 수 없는 경우에는 활용할 수 있으니 완전히 헛수고는 아니었다고 스스로를 위로하고 있다.

## 정리

Google Cloud의 프로젝트 이전은 적절한 권한과 설정만 갖추어져 있다면 놀라울 정도로 간단했다. 다만, 보안 설정 정리 작업은 잊지 말자.

만약 비슷한 이전 작업을 하려는 분이 있다면, 처음부터 `gcloud beta projects move`의 존재를 찾아보는 것을 추천한다. 바퀴의 재발명은 즐겁지만, 시간은 유한하니까.

그건 그렇고, 저 GCS 이전 스크립트를 만드느라 쓴 3일을 돌려받고 싶다.

---

읽어주셔서 감사하다.

비슷한 경험을 하신 분이나 앞으로 이전 작업을 진행할 예정인 분은 꼭 댓글로 알려달라. 같이 울자 ㅎㅎ
