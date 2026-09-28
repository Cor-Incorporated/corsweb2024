---
title: "Google Cloud 프로젝트를 전체 조직 간 이전했더니, 하루 만에 끝나버린 이야기"
description: "GCS를 조금씩 이전하는 스크립트까지 만들었는데, 사실은 프로젝트 단위로 이동할 수 있다는 것을 알게 된 개발자의 눈물겨운 기록"
pubDate: 2025-07-24
author: "Terisuke"
category: "engineering"
tags: ["Google Cloud", "DevOps", "移行", "gcloud", "プロジェクト管理"]
image:
  url: "/images/blog/gcp-logo.avif"
  alt: "Google Cloud Platform ロゴ"
lang: "ko"
featured: false
translationSourceHash: "65d2d8e4ee3fb4c439d95c88fea7fca7e8286479aa45bbc964a3c502518304aa"
translatedAt: "2026-09-28T06:09:16.017Z"
translationModel: "adopted-legacy"
---

# Google Cloud 프로젝트 전체를 조직 간 마이그레이션했더니, 하루 만에 끝난 이야기

안녕하세요, Terisuke입니다.

오늘은 **엄청난 시간을 낭비한 이야기**를 해보려고 합니다.

회사의 클라우드 환경을 정리하면서 `company@example-a.com`으로 관리하던 프로젝트를 `company@example-b.com` 조직으로 옮겨야 하는 상황이 발생했습니다.

처음에는 "좋아, terraform이나 gcloud를 사용해서 GCS 버킷이나 Compute 인스턴스를 하나씩 마이그레이션하자!"라고 의욕적으로 시작했었는데...

**사실 같은 Google Cloud 내에서는 프로젝트 전체를 그대로 이동할 수 있는 방법이 있다**는 것을 알게 되었습니다.

결과적으로, 공들여 만든 GCS 마이그레이션 스크립트는 완전히 무용지물이 되었습니다 (울먹).

하지만 같은 실수를 반복하지 않도록, 저 자신을 위한 기록도 겸하여 그 방법을 정리해 두겠습니다.

## 사전 조건 (여기 중요)

먼저, 다음 조건을 만족해야 합니다:

- ✅ 양쪽 조직 모두에서 Owner 권한을 가지고 있어야 합니다.
- ✅ 마이그레이션할 프로젝트가 VPC Service Controls나 Shared VPC를 사용하고 있지 않아야 합니다.
- ✅ Marketplace 유료 서비스를 사용하고 있지 않아야 합니다 (재구매가 필요할 수 있습니다).

## 마이그레이션 흐름 (실제로 진행한 절차)

### 1. 조직 ID 확인

먼저 마이그레이션 원본과 대상 조직의 ID를 확인합니다. 이것은 이후 설정에서 매우 중요합니다.

```bash
# 마이그레이션 원본 조직에 로그인
gcloud config set account company@example-a.com
gcloud organizations list
# DISPLAY_NAME     ID             DIRECTORY_CUSTOMER_ID
# example-a.com    123456789012   C02xxxxxx

# 마이그레이션 대상 조직에 로그인
gcloud config set account company@example-b.com
gcloud organizations list
# DISPLAY_NAME     ID             DIRECTORY_CUSTOMER_ID
# example-b.com    987654321098   C02yyyyyy
```

### 2. 사전 확인 (여기서 막히면 번거롭습니다)

마이그레이션 전에 다음을 확인해 봅시다. 오류가 발생한 후에 알게 되면 정말 번거롭습니다.

```bash
# VPC Service Controls 확인 (오류가 발생하면 OK)
gcloud access-context-manager perimeters list

# Shared VPC 확인 ({}가 반환되면 OK)
gcloud compute shared-vpc get-host-project your-project-id

# 현재 결제 계정 정보 기록
gcloud beta billing projects describe your-project-id
```

### 3. 마이그레이션 복도 설정 (이것이 핵심)

이 부분이 가장 중요합니다. 조직 간에 프로젝트를 이동할 수 있도록 "마이그레이션 복도"를 개설합니다. 즉, 서로의 조직을 신뢰하도록 설정하는 것입니다.

**마이그레이션 원본 조직에서 내보내기 허용 설정:**
```bash
# export-policy.yaml 생성
cat > export-policy.yaml << EOF
name: organizations/123456789012/policies/resourcemanager.allowedExportDestinations
spec:
  rules:
    - values:
        allowedValues:
          - under:organizations/987654321098
EOF

# 정책 적용
gcloud org-policies set-policy export-policy.yaml
```

**마이그레이션 대상 조직에서 가져오기 허용 설정:**
```bash
# 마이그레이션 대상 조직에 로그인
gcloud config set account company@example-b.com

# import-policy.yaml 생성
cat > import-policy.yaml << EOF
name: organizations/987654321098/policies/resourcemanager.allowedImportSources
spec:
  rules:
    - values:
        allowedValues:
          - under:organizations/123456789012
EOF

# 정책 적용
gcloud org-policies set-policy import-policy.yaml
```

### 4. 권한 부여 (여기서 막혔습니다)

조직 Owner라 할지라도, 프로젝트 레벨의 권한이 필요했습니다. 오류가 발생한 후에 알게 되었지만, 다음 권한이 필요합니다.

```bash
# 마이그레이션 원본 계정으로 돌아가기
gcloud config set account company@example-a.com

# 프로젝트와 조직에 권한 부여
gcloud projects add-iam-policy-binding your-project-id \
    --member="user:company@example-a.com" \
    --role="roles/resourcemanager.projectMover"

gcloud organizations add-iam-policy-binding 123456789012 \
    --member="user:company@example-a.com" \
    --role="roles/resourcemanager.projectMover"

# 마이그레이션 대상 조직에도 권한 부여 (조직을 넘나드는 권한 부여)
gcloud config set account company@example-b.com
gcloud organizations add-iam-policy-binding 987654321098 \
    --member="user:company@example-a.com" \
    --role="roles/resourcemanager.projectCreator"
```

### 5. 드디어 마이그레이션 (단 1개의 명령어!)

준비가 완료되면, 단 1개의 명령어로 마이그레이션할 수 있습니다.

```bash
# 마이그레이션 원본 계정으로 실행
gcloud config set account company@example-a.com
gcloud beta projects move your-project-id --organization 987654321098
```

경고 메시지가 나오지만, `Y`를 눌러 진행합니다. **1분도 걸리지 않아 마이그레이션이 완료**되었습니다. 너무 빨라서 허탈할 지경이었습니다.

### 6. 결제 계정 변경 (잊으면 큰일)

프로젝트는 이동했지만, 결제 계정은 그대로 유지됩니다. 이를 잊으면 이전 조직으로 계속 결제가 청구됩니다.

```bash
# 마이그레이션 대상 계정으로 전환
gcloud config set account company@example-b.com

# 새 결제 계정에 연결
gcloud beta billing accounts list
gcloud beta billing projects link your-project-id --billing-account NEW-BILLING-ID
```

여기서도 권한 오류가 발생했기 때문에, 마이그레이션 대상 계정에 프로젝트 Owner 권한을 부여해야 했습니다.

```bash
# 마이그레이션 원본 계정으로 실행
gcloud config set account company@example-a.com
gcloud projects add-iam-policy-binding your-project-id \
    --member="user:company@example-b.com" \
    --role="roles/owner"
```

### 7. 정리 (매우 중요)

마이그레이션을 위해 열어둔 "보안 구멍"을 막아야 합니다. 이를 잊으면 조직 간에 임의로 프로젝트를 이동할 수 있는 상태가 계속 유지됩니다.

```bash
# 조직 정책 삭제
gcloud config set account company@example-a.com
gcloud org-policies delete resourcemanager.allowedExportDestinations --organization=123456789012

gcloud config set account company@example-b.com
gcloud org-policies delete resourcemanager.allowedImportSources --organization=987654321098

# 조직 간 권한도 삭제
gcloud organizations remove-iam-policy-binding 987654321098 \
    --member="user:company@example-a.com" \
    --role="roles/resourcemanager.projectCreator"
```

## 마이그레이션 후 주의사항

- **상속된 IAM 정책**은 사라집니다. 조직 레벨에서 부여했던 권한은 다시 설정해야 합니다.
- **예산 알림**도 다시 설정해야 합니다. 새 결제 계정에서는 예산 설정이 자동으로 이전되지 않습니다.
- **서비스 동작 확인**은 필수입니다. 특히 외부 연동 서비스는 꼭 점검해야 합니다.

## 결말: 무용지물이 된 GCS 마이그레이션 스크립트

사실 마이그레이션 작업을 시작할 무렵, GCS 버킷을 로컬을 경유하여 마이그레이션하는 스크립트까지 만들었습니다.

https://github.com/terisuke/gcs-migration-project

병렬 다운로드, 진행률 표시, 오류 처리까지 구현하며 "이제 대량의 버킷도 쉽게 마이그레이션할 수 있겠다!"라고 의욕을 불태웠었는데...

**프로젝트 전체를 이동할 수 있다**는 것을 알게 된 순간, 모든 것이 무용지물이 되었습니다.

하지만 뭐, `gsutil`의 병렬 처리나 Python으로 GCS를 조작하는 공부가 되었고, 조직 간 이동이 불가능한 경우에는 사용할 수 있으니 완전히 무의미한 것은 아니라고 스스로를 다독이고 있습니다.

## 요약

Google Cloud 프로젝트 마이그레이션은 적절한 권한과 설정만 갖춰진다면 놀라울 정도로 간단했습니다. 다만, 보안 설정 정리는 잊지 않도록 주의해야 합니다.

만약 저와 비슷한 마이그레이션 작업을 하시는 분이라면, 처음부터 `gcloud beta projects move`의 존재를 검색해 보시길 권합니다. 바퀴를 재발명하는 것은 즐겁지만, 시간은 유한하니까요.

그래도 그때 그 GCS 마이그레이션 스크립트를 만드는 데 쓴 3일의 시간을 돌려받고 싶습니다.

---

**읽어주셔서 감사합니다!**

비슷한 경험을 하신 분, 앞으로 마이그레이션 작업을 계획하고 계신 분은 댓글로 알려주세요. 함께 울어요 (웃음).
