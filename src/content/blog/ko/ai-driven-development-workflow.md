---
title: "AI와 개발하게 된 뒤 GitHub 활동량은 어떻게 바뀌었나. 2024년 하반기는 월 20〜40건, 2025년 5월은 약 300건"
description: "GitHub 기여 수는 2024년 하반기에 월 20〜40건 정도, 2025년 5월에 약 300건이었습니다. Issue, PR, 리뷰를 포함하는 GitHub 표준 집계이며, 2025년 5월 30일 그래프에 근거합니다. 개발 속도나 납품량의 배율이 아닙니다."
summary: "GitHub 기여 수(Issue·PR·리뷰를 포함하는 GitHub 표준 집계)는 2024년 하반기에 월 20〜40건 정도, 2025년 5월에 약 300건이 되었습니다. 초판의 『7배』는 AI를 쓰기 전을 월 약 50건으로 두었을 때의 반올림입니다. 품질, 재작업, 작업 시간은 같은 조건으로 비교하지 않았습니다."
pubDate: 2024-01-15
updatedDate: 2026-10-29
author: "Terisuke"
category: "ai"
ctaIntent: "contract-dev"
tags: ["AI", "コントリビュート", "Cursor", "CodeRabbit", "GitHub Copilot"]
lang: "ko"
featured: true
translationSourceHash: "955397d96732625a2361532f533d4934ab6c77e0cc2b5d2853afae8f1f9b3d47"
translatedAt: "2026-10-29T05:20:00.000Z"
translationModel: "manual-i18n-sync"
---

GitHub 기여 수(Issue·PR·리뷰를 포함하는 GitHub 표준 집계)는 2024년 하반기에 월 20〜40건 정도였습니다. 2025년 5월에는 약 300건이 되었습니다(2025년 5월 30일에 올린 그래프).

초판의 『7배』는 AI를 쓰기 전을 월 약 50건으로 두었을 때의 반올림입니다.

이 건수는 개발 속도나 납품량이 몇 배가 되었는지를 나타내는 숫자가 아닙니다.

이 글에서는 당시 어떤 작업을 AI에 맡겼고, 무엇이 진행하기 쉬워졌는지를 돌아봅니다. 품질, 재작업, 실제 작업 시간은 같은 조건으로 비교하지 않았습니다. 그 개선율은 주장하지 않습니다.

비교하는 것은 2024년 하반기의 월별 건수와 2025년 5월의 건수입니다. 비공개 저장소의 건수를 포함하는지는 공개 정보로는 알 수 없습니다. 과거 숫자에 맞추려고 새로운 분모나 품질 지표를 만들지 않았습니다.

## 당시 작업을 나눈 방식

### 코드를 만드는 작업

코드는 Claude Code가 썼습니다. 먼저 Claude Desktop과 대화하며 지시서를 다듬고, 그 내용을 터미널에서 Claude Code에 전달했습니다. 몇 분 만에 기본 골격이 되는 코드가 나왔습니다. 그다음 「이 클래스에 메서드를 추가하고 유닛 테스트도 작성해」처럼 구체적인 지시를 겹쳤습니다.

### 리뷰

PR을 만들면 CodeRabbit이 리뷰를 시작하고, 버그 가능성, 보안상의 지적, 코딩 규약과의 차이를 PR에 댓글로 남겼습니다. 지적된 곳은 Cursor의 Agent 기능으로 고쳤습니다. 지적이 전부를 찾는다는 뜻은 아닙니다.

## 센 것

센 것은 GitHub 기여 수입니다. 2024년 하반기는 월 20〜40건 정도였습니다. 2025년 5월은 약 300건이었습니다. 둘 다 2025년 5월 30일에 올린 그래프의 범위입니다.

기여는 커밋 수가 아닙니다. GitHub의 정의에서는 커밋 외에 Issue, Pull Request, 리뷰도 수에 들어갑니다.

## 쓰던 도구

- Cursor: AI가 들어간 편집기. 지적된 곳을 Agent 기능으로 고친다
- Claude Desktop: 대화하면서 지시서를 다듬는다
- Claude Code: 지시서를 바탕으로 코드를 쓴다
- CodeRabbit: PR에 대한 자동 리뷰

당시 느낌으로는 코드를 한 줄씩 쓰기보다 AI와 대화하며 문제를 푸는 일에 가까워졌습니다. 이것은 느낌이지, 작업 시간이나 납품량을 잰 결과가 아닙니다.

## 참고 자료

2025년 6월 1일 note 글의 제목에는 개발 속도 7배가 있습니다. 회사의 이 글의 숫자는 2025년 5월 30일 그래프에 맞춥니다. 속도나 납품량의 배율로는 다루지 않습니다.

https://note.com/cor_instrument/n/n800a959f7284

2025년 5월 30일 게시물에는 월별 기여 그래프가 있습니다.

https://x.com/cor_terisuke/status/1928266812019368121

- [GitHub Docs: Profile contributions](https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference) - 기여로 세는 대상에 대한 공식 설명

https://cor-jp.com/

https://github.com
