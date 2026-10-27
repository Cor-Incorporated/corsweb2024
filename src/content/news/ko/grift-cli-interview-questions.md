---
title: "Grift CLI 리포트에 면담에서 확인하고 싶은 점을 작성하도록 했습니다 (0.9.0)"
description: "Grift CLI 0.9.0 버전을 2026년 10월 27일에 공개했습니다. 본인이 직접 밝힌 ID로 동의 기록이 있는 경우에만 리포트 맨 앞에 기록을 통해 보이는 본인의 업무 방식과 면담에서 확인하고 싶은 점을 짧은 문장으로 작성합니다. 점수, 순위, 유형 이름은 기존과 마찬가지로 제공하지 않습니다."
publishedAt: 2026-10-27
category: "update"
tags: ["Grift", "OSS", "프로덕트"]
source: "Grift"
isDraft: false
featured: false
lang: "ko"
translationSourceHash: "1af911264961073a5818f1745fa3379f031c6cefe30d129970b18a44e89409c5"
translatedAt: "2026-10-27T13:52:53.156Z"
translationModel: "gemini-3.8-flash"
---

## 0.9.0에서 변경된 점

Cor.주식회사은 2026년 10월 27일에 Grift CLI의 [0.9.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.0)을 공개했습니다. 점수·순위·유형명은 기존과 마찬가지로 표시하지 않습니다.

`grift actor`의 Markdown 맨 앞에 기록을 통해 확인할 수 있는 업무 진행 방식을 짧은 문장으로 작성합니다. 변경한 부분의 구분, 변경 페이스, 테스트 작성 방식, 참여 방식에 대해 건수 및 기간과 함께 작성하며, 이어서 이 기록으로는 알 수 없는 점을 작성하고 면담에서 확인하고 싶은 점을 질문 형태로 나열합니다. `grift project`은 프로젝트 리포지토리의 진행 방식을 동일한 규칙으로 작성하며, 개인별 수치와 참여 방식은 표시하지 않습니다. `grift align`는 요구사항과 기록의 나열에 면담에서 확인하고 싶은 점을 질문 형태로 덧붙입니다. 문장과 질문은 공개된 [결정표](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.0/docs/trait-profile.md)에 따라 수치로부터 선택되며, AI는 사용하지 않습니다. JSON에는 포함되지 않으므로, `grift verify`로 검산할 수 있는 것은 문장의 바탕이 된 수치 쪽입니다.

개인에 대한 문장과 질문은 본인이 밝힌 ID이며 동의 기록이 있을 때만 표시합니다. 그 외의 경우에는 표시하지 않는 이유를 한 문장으로 작성합니다. 면담 질문은 후보자 본인에게 물어볼 내용을 구체화하기 위한 자료입니다. 합격 여부나 순위를 결정하기 위한 것이 아닙니다.

경향의 '강도' 행과 대조의 '방향' 행은 Markdown에서 제외했습니다. 두 리포트를 나란히 놓았을 때 강한 사람·약한 사람, 맞는 사람·맞지 않는 사람으로 읽힐 수 있기 때문입니다. 아울러 개인에 대해 사실과 다른 수치가 나타날 수 있었던 부분 4곳을 수정했습니다. 수정한 부분은 [릴리스 노트](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.0)에서 확인할 수 있습니다.

## 업데이트 전에

0.8.0에서 저장한 리포트(`analyze`·`actor`·`repo`) 및 대조는 정의 버전이 변경되었기 때문에 0.9.0의 `grift verify`에서는 '확인할 수 없음(`CANNOT_VERIFY`)'으로 표시됩니다. project 리포트는 '불일치(`MISMATCH`)'로 표시됩니다. 0.9.0에서 다시 생성해 주십시오. 자세한 내용은 [이전 시 주의사항](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.0/docs/migration-v090.md)에 있습니다.

```bash
pipx upgrade grift-cli
```

Grift의 접근 방식과 개발 경위는 [Grift 사례 페이지](/works/grift)에 정리되어 있습니다.
