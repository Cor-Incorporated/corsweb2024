---
title: "Git 이력에서 확인할 수 있는 사실을 추출하는 'Grift CLI'를 OSS로 공개하고 있습니다"
description: "자사 프로덕트 Grift의 명령줄 도구인 'Grift CLI'를 MIT 라이선스의 OSS로 PyPI와 GitHub에 공개하고 있습니다. 점수나 순위를 매기지 않으며, 누가 실행하더라도 동일한 결과가 나옵니다."
publishedAt: 2026-10-20
category: "update"
tags: ["Grift", "OSS", "프로덕트"]
source: "Grift"
isDraft: false
featured: true
lang: "ko"
translationSourceHash: "ed5a3adbdd57154b1cbb7ab4f8318fb3e0b08de7c0d8a8e3a1084e6b7179df2e"
translatedAt: "2026-10-26T13:33:49.794Z"
translationModel: "gemini-3.8-flash"
---

## Grift CLI 공개

Cor.주식회사는 자사 프로덕트인 'Grift'의 명령줄 도구 'Grift CLI'를 MIT 라이선스의 오픈소스 소프트웨어(OSS)로 공개하고 있습니다. 2026년 9월 8일에 PyPI를 통해 v0.7.2를 공개했습니다.

Grift CLI는 엔지니어의 git 이력에서 '확인 가능한 사실(검사값)'을 추출하는 도구입니다. 캐치프레이즈는 "경력은 과장할 수 있어도, 증거는 과장할 수 없다."입니다.

## 3가지 약속

- 점수화하지 않는다: 종합 점수, 순위, 합격/불합격을 매기지 않습니다. 수치에는 항상 분자와 분모를 함께 표기합니다.
- 매번 일관된 결과: 측정에 AI(LLM)를 사용하지 않으므로, 동일한 리포지토리와 동일한 버전이라면 누가 실행하더라도 같은 수치가 나옵니다. 저장된 보고서는 `grift verify`로 재계산하여 검산할 수 있습니다.
- 어디로도 전송하지 않는다: 로컬 PC에서만 작동합니다. 공유 여부는 본인이 직접 결정합니다.

## 사용 방법

Python 3.11 이상의 환경에서 다음 명령어로 시작할 수 있습니다.

```bash
pipx install grift-cli
cd your-repo
grift report
grift verify
```

- GitHub: [github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- PyPI: [pypi.org/project/grift-cli](https://pypi.org/project/grift-cli/)

## 방침 변경 안내

Grift는 2026년 2월, 수탁 개발 견적을 지원하는 웹 애플리케이션으로 시작되었습니다. 2026년 8월에 측정 부분을 CLI로 분리하였으며, 9월에 기존 웹 애플리케이션의 제공을 종료했습니다. 이전에 안내해 드렸던 Team Beta 등의 플랜은 2026년 10월에 철회되었습니다.

현재는 헤드헌팅사 및 SES 영업 담당자가 추천 이유를 명확한 근거와 함께 전달하거나, 자체 서비스 개발 기업의 채용 담당자가 지원자 본인이 공유한 기록을 바탕으로 어떤 업무를 수행해 왔는지 확인하기 위한 시범 도입(PoC) 상담을 접수하고 있습니다. 자세한 내용은 [Grift 도입 사례 페이지](/works/grift)를 확인해 주시기 바랍니다.
