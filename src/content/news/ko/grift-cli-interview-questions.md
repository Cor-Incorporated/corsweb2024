---
title: "Grift CLI 리포트 첫머리에 면담에서 확인하고 싶은 점을 적도록 개선했습니다(0.9.0)"
description: "Grift CLI 0.9.0 버전을 2026년 10월 27일에 공개했습니다. 본인이 직접 밝힌 ID로 동의 기록이 있을 때에만, 리포트 첫머리에 기록을 통해 보이는 업무 진행 방식과 면담에서 확인하고 싶은 점을 짧은 문장으로 기재합니다. 점수·순위·유형명은 기존과 마찬가지로 표기하지 않습니다."
publishedAt: 2026-10-27
category: "update"
tags: ["Grift", "OSS", "제품"]
source: "Grift"
isDraft: false
featured: false
lang: "ko"
translationSourceHash: "a7fe0fafe296a0da9774befadd179855e488c4514793080dd3360f94cbaa222b"
translatedAt: "2026-10-27T13:35:55.507Z"
translationModel: "gemini-3.8-flash"
---

## 0.9.0 변경 사항

Cor.주식회사는 2026년 10월 27일에 Grift CLI의 [0.9.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.0)을 출시했습니다. 점수·순위·유형명은 기존과 동일하게 제공하지 않습니다.

`grift actor`·`grift project`·`grift align`의 Markdown 서두에 기록을 통해 보이는 업무 진행 방식을 짧은 문장으로 기술합니다. 변경된 부분의 구분, 변경 속도, 테스트 작성 방식, 참여 방식에 대해 건수와 기간을 덧붙여 작성하며, 이어서 본 기록으로는 파악할 수 없는 내용과 면담에서 확인하고자 하는 내용을 질문 형태로 나열합니다. 문장은 공개된 [결정표](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.0/docs/trait-profile.md)를 바탕으로 수치에 따라 선택됩니다. AI는 사용하지 않으며, JSON에는 포함되지 않습니다.

인물에 관한 문장과 질문은 본인이 제시한 ID이자 동의 기록이 있는 경우에만 표시됩니다. 그 외에는 표시하지 않는 이유를 한 문장으로 기술합니다. 면담 질문은 지원자 본인에게 확인할 내용을 구체화하기 위한 참고 자료입니다. 합격 여부나 순위를 결정하기 위한 것이 아닙니다.

경향의 '강도' 행과 대조의 '방향' 행은 Markdown에서 제외했습니다. 두 보고서를 나란히 놓았을 때 강한 사람·약한 사람, 잘 맞는 사람·맞지 않는 사람으로 해석될 수 있기 때문입니다. 아울러 인물에 관해 사실과 다른 수치가 산출될 수 있었던 지점 4곳을 수정했습니다. 수정된 부분은 [릴리스 노트](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.0)에서 확인하실 수 있습니다.

## 업데이트 전 안내

0.8.0에서 저장된 보고서(`analyze`·`actor`·`repo`) 및 대조 결과는 정의 버전이 변경됨에 따라 0.9.0의 `grift verify`에서 '확인 불가(`CANNOT_VERIFY`)'로 표시됩니다. project 보고서는 '불일치(`MISMATCH`)'로 표시됩니다. 0.9.0에서 다시 생성해 주시기 바랍니다. 자세한 내용은 [마이그레이션 주의사항](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.0/docs/migration-v090.md)에 기재되어 있습니다.

```bash
pipx upgrade grift-cli
```

Grift의 철학과 개발 경위는 [Grift 사례 연구 페이지](/works/grift)에 정리되어 있습니다.
