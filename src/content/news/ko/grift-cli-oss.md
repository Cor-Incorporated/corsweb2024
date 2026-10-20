---
title: "Git 이력에서 확인할 수 있는 사실을 추출하는 'Grift CLI'를 OSS로 공개하고 있습니다"
description: "자사 제품 Grift의 명령줄 도구 'Grift CLI'를 MIT 라이선스의 OSS로 PyPI와 GitHub에 공개하고 있습니다. 점수나 순위를 매기지 않으며, 누가 실행하더라도 동일한 결과가 나옵니다."
publishedAt: 2026-10-20
category: "update"
tags: ["Grift", "OSS", "제품"]
source: "Grift"
isDraft: false
featured: true
lang: "ko"
translationSourceHash: "881ec4903ce970a25ca72acd37f1fa6db515a1cfc8d1278eb12d20837ed7de41"
translatedAt: "2026-10-20T01:58:15.765Z"
translationModel: "gemini-3.8-flash"
---

## Grift CLI를 공개하고 있습니다

Cor.주식회사는 자사 프로덕트 'Grift'의 커맨드 라인 툴인 'Grift CLI'를 MIT 라이선스의 OSS로 공개하고 있습니다. 2026년 9월 8일에 PyPI를 통해 v0.7.2를 공개했습니다.

Grift CLI는 엔지니어의 git 이력에서 '확인 가능한 사실(검사 수치)'을 추출하는 툴입니다. 캐치프레이즈는 "경력은 부풀릴 수 있다. 증거는 부풀릴 수 없다."입니다.

## 3가지 약속

- **점수화하지 않는다**: 종합 점수·순위·합불 결과는 산출하지 않습니다. 수치에는 반드시 분자와 분모를 함께 표기합니다
- **매번 동일한 결과**: 측정에 AI(LLM)를 사용하지 않으므로, 동일한 리포지토리·동일한 버전이라면 누가 실행해도 같은 수치가 나옵니다. 저장된 리포트는 `grift verify`로 다시 계산하여 검산할 수 있습니다
- **어디로도 전송하지 않는다**: 로컬 PC 내에서만 동작합니다. 공유 여부는 본인이 결정합니다

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

## 방침 변경에 대하여

Grift는 2026년 2월에 수탁 개발 견적을 지원하는 웹 앱으로 시작되었습니다. 2026년 8월에 측정 부분을 CLI로 분리하였고, 9월에 기존 웹 앱 서비스를 종료했습니다. 이전에 안내해 드렸던 Team Beta 등의 플랜은 2026년 10월에 철회하였습니다.

현재는 인재 소개 회사 및 SES 영업 담당자가 추천 사유를 명확한 근거와 함께 전달하기 위한 실증 실험(PoC) 상담을 접수하고 있습니다. 자세한 내용은 [Grift 도입 사례 페이지](/works/grift)를 확인해 주시기 바랍니다.
