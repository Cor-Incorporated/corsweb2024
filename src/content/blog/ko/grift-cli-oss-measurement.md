---
title: "이력서의 연차로는 업무 방식을 알 수 없다. 점수를 매기지 않는 Grift로 실제 OSS 4개를 측정해 보았다"
description: "이력서의 연차나 맨먼스(man-month)만으로는 그 사람이 어떤 방식으로 일해왔는지 알 수 없습니다. Cor.가 점수도 순위도 매기지 않는 Grift를 만든 이유와 MBTI와의 차이점, 실제 OSS 4개를 측정하여 보인 것과 보이지 않았던 점을 채용 소개 회사 및 SES 영업 담당자, 엔지니어 분들을 위해 정리해 전해드립니다."
summary: "Grift는 git에 남겨진 변경 기록을 통해 업무 성향과 그 근거가 된 건수를 도출합니다. 본인이 질문에 답하여 유형을 판별하는 MBTI와 달리, 근거가 자기 신고가 아닌 기록에 기반하므로 동일한 기록이라면 누가 집계하든 같은 값이 나옵니다. 실제 OSS 4개를 측정한 결과 작업 영역이나 변경 간격의 차이는 드러난 반면, 리뷰의 질이나 회의, 본인의 동의가 없는 경험은 파악할 수 없었습니다. 숫자는 모수(분모) 및 규칙과 함께 해석해야 하며, 판단은 사람의 몫입니다."
pubDate: 2026-10-25
updatedDate: 2026-10-26
author: "Terisuke"
category: "engineering"
ctaIntent: "grift-team-beta"
tags: ["Grift", "OSS", "CLI", "git", "実測"]
lang: "ko"
featured: false
isDraft: false
translationSourceHash: "b6c9b7d77d676cc7d362bd1bf2a315d0eb07c6a72f8dd4d50288ab08761e0456"
translatedAt: "2026-10-26T12:21:04.117Z"
translationModel: "gemini-3.8-flash"
---

이력서에 'Python 5년'이라고 적혀 있어도, 그 5년 동안 어떤 일을 해왔는지는 알 수 없습니다.

연수나 인월(M/M)은 업무량의 기준은 됩니다. 하지만 동작을 확인하는 테스트를 작성하며 진행하는 사람인지, 문서를 깔끔하게 정리하는 사람인지, 작은 변경을 자주 반영하는 사람인지, 일하는 방식까지는 알려주지 않습니다.

인재 소개 회사나 SES 영업 담당자가 추천 이유를 명확한 근거로 설명하지 못해 멈칫하게 되는 것, 그 원인 중 하나가 바로 이 간극에 있다고 Cor.주식회사은 생각합니다.

## 점수를 매기지 않는 이유

Grift는 이 간극을 메우기 위해 만든 자사 프로덕트입니다. git(소프트웨어 변경 사항을 매번 기록하는 시스템)에 남은 기록으로부터 업무 경향과 그 근거가 된 건수를 추출합니다. 점수도, 순위도 매기지 않습니다.

대표인 데라다 코스케은 리크루트에서 구인 광고 영업을 하던 시절, 말이 온전히 전해지지 않는 답답함을 겪었습니다. Grift에 대해서는 "이력은 부풀릴 수 있어도, 증거는 부풀릴 수 없다."라고 말합니다.

점수화하면 어떤 일이 벌어질까요? 서로 다른 종류의 기록을 하나의 숫자로 뭉뚱그리면, 무엇을 세었는지, 무엇을 세지 못했는지가 사라집니다. 그리고 점수가 있으면 높은 사람이 더 나은 사람으로 보입니다. 나열하면 순위가 됩니다.

Grift를 통해 저희가 하고자 하는 일은 사람을 순위대로 줄 세우는 것이 아닙니다. 그 사람의 업무 경향에 맞는 프로젝트와 사람을 연결하는 것입니다. 이를 위해 검증 가능한 사실만을 제시합니다. 판단은 사람의 몫입니다.

## MBTI와의 차이점

순위를 매기지 않는다는 말을 듣고 MBTI를 떠올리는 분도 계실지 모릅니다.

MBTI는 본인이 질문에 답하고, 네 가지 선호도의 조합을 통해 16가지 유형을 도출합니다. MBTI 재단(The Myers & Briggs Foundation)은 모든 유형이 가치 있으며, 채용 목적으로 만들어진 것이 아니라고 밝히고 있습니다.

Grift는 질문을 하지 않습니다. 유형 이름도 붙이지 않습니다. 성격을 진단하는 도구도 아닙니다. git에 남은 기록을 카운트하여 경향과 그 근거가 된 건수를 제시합니다.

이 차이는 영업 담당자의 고민에 대입해 보면 쉽게 이해할 수 있습니다.

이력서의 자기 신고 내용을 어디까지 믿어야 할지 알 수 없다. MBTI 결과 역시 이력서와 마찬가지로 본인의 응답에서 나옵니다. Grift의 근거는 기록입니다. 같은 기록을 전달하면 누가 카운트해도 동일한 값이 나옵니다.

연수나 인월로는 일하는 방식을 알 수 없다. Grift는 어떤 영역을 다루어 왔는지(테스트, 문서, 본체 프로그램 등), 변경을 어느 정도의 간격으로 반영하는지, 버그 수정 변경에 테스트가 수반되는지를 건수로 보여줍니다.

다만, 기록에 남지 않는 것은 드러나지 않습니다. 회의에서의 활약, 코드 리뷰의 질, 공개되지 않은 업무는 보이지 않습니다. 본인의 동의가 없다면 개인의 경험이나 역할도 나타내지 않습니다.

## TEP라는 절차

Grift는 기록에서 사실을 추출하는 절차를 TEP(Technical Evidence Pipeline, 기술적 증거를 추출하는 파이프라인)라고 부릅니다. 이는 4단계로 구성됩니다.

1. git 기록을 읽는다. AI의 추측은 사용하지 않습니다
2. 정해진 규칙에 따라 카운트한다. 예를 들어 파일의 위치와 이름을 바탕으로 테스트인지 문서인지를 구분합니다
3. 카운트한 값에 분모와 함께 집계되지 않은 항목의 이유를 덧붙인다
4. 동일한 절차를 통해 누구나 다시 카운트할 수 있도록 한다

네 번째의 다시 카운트하는 과정을 Grift에서는 검산이라고 부릅니다. TEP에 대한 자세한 설명은 Grift 사이트의 [TEP 페이지](https://griftai.org/tep)에서 확인하실 수 있습니다.

## 실제 OSS로 검증하기

정말 이 절차를 통해 업무 경향을 파악할 수 있을까요? 2026년 10월 25일, Grift CLI(명령어로 구동하는 Grift 도구) 0.8.0을 통해 확인해 보았습니다. 0.8.0은 당시 시점에서는 아직 공개 준비 중이었으며, 다음 날인 10월 26일에 공개되었습니다([릴리스 노트](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0)).

실제 인물을 동의 없이 측정하지 않도록, 소스 코드가 공개된 소프트웨어(OSS)를 리포지토리(소프트웨어 하나의 기록이 모인 저장소) 단위로 측정했습니다. 개인별 수치는 이 글에 단 하나도 싣지 않았습니다.

측정한 대상은 성격이 서로 다른 4가지입니다.

- click: Python에서 명령어로 구동하는 도구를 만들기 위한 라이브러리(다른 프로그램에서 사용하는 부품)
- flask: Python으로 웹 서비스를 만들기 위한 라이브러리
- httpx: Python으로 웹과 통신하기 위한 라이브러리
- commander.js: JavaScript에서 명령어로 구동하는 도구를 만들기 위한 라이브러리

## 확인된 사실

4가지 모두 측정과 검산이 각각 2.5초 이내에 완료되었습니다. 검산 결과는 4가지 모두 전 항목에서 일치했습니다.

리포지토리별 성격 차이도 명확히 드러났습니다.

click에서는 기록의 마지막 날까지의 180일 동안 187회의 변경이 있었습니다. 변경과 변경 사이의 간격은 중앙값으로 약 2시간이었습니다. 짧은 간격으로 꾸준히 변경이 이어지고 있습니다.

flask에서는 문서를 다룬 변경이 1,841회로, 본체 프로그램을 다룬 변경(1,765회)보다 많았습니다.

httpx에서는 테스트 파일을 포함한 변경이 1,335회 중 575회에 달했습니다.

commander.js에서는 본체 JavaScript 파일이 '본체 프로그램'으로 카운트되지 않고 '기타'로 분류되었습니다. 이는 Grift 규칙의 허점입니다. 본체 프로그램으로 카운트하는 확장자(파일명 끝부분)에 JavaScript의 `.js`가 포함되어 있지 않았기 때문입니다.

## 숫자의 오독

실제로 측정해 보며 알게 된 점은, 숫자만 나열하면 쉽게 오독하게 된다는 사실이었습니다. 5가지 예를 들어보겠습니다.

### 변경 횟수

변경 횟수가 많은 리포지토리가 반드시 좋은 리포지토리는 아닙니다. flask의 변경은 3,674회, httpx는 1,335회였습니다. 커밋 이력의 기간은 flask가 5,976일, httpx가 2,517일입니다. 횟수는 이력의 기간과 변경 사항을 한꺼번에 병합하는지 여부에 따라 달라집니다.

### 문서 변경

문서 변경이 많다고 해서 문서 작성에 열성적이라는 뜻은 아닙니다. click에서 문서로 카운트된 변경 중 약 40%는 문서로서 다룬 파일이 변경 이력 파일뿐이었습니다. 변경할 때마다 변경 이력을 작성하는 리포지토리에서는 문서 변경 횟수가 늘어납니다.

### 버그 수정 변경

제목이 'fix'(수정)로 시작하는 변경에 테스트가 포함되어 있지 않다고 해서 테스트를 작성하지 않는다는 의미는 아닙니다. flask에서 제목이 'fix'로 시작하는 변경을 다시 세어보면, 407회 중 198회는 문서나 설정 파일만을 수정한 변경이었습니다. 제목은 'fix typo'(오타 수정) 등입니다.

### 적은 변경 횟수

변경 횟수가 적다고 해서 개발이 중단되었다는 뜻은 아닙니다. httpx의 경우 관측 기간인 180일 동안 변경이 11회에 불과하여 간격이 '미관측'(측정 불가)으로 나타났습니다. 이는 9월 2일에 로컬 환경으로 가져온 기록을 측정한 것이며, 현재 상태를 나타내는 것은 아닙니다.

### 활동 일수

활동 일수(변경이 발생한 날의 수)는 커밋을 나누는 방식에 따라 늘릴 수 있습니다. 검증을 위해 작은 리포지토리 2개를 만들어 동일한 5줄의 코드를 추가해 보았습니다. 1번에 한꺼번에 추가하면 활동 일수는 2일, 5일에 걸쳐 1줄씩 추가하면 6일이 됩니다(둘 다 최초 1회를 포함합니다). 내용은 동일합니다.

Grift는 이 숫자를 임의로 보정하지 않습니다. 대신 숫자 옆에 "매일 1건의 작은 commit을 남기면 늘어나고, 같은 변경을 하루에 모으면 줄어듭니다."라는 문구를 표시합니다.

## 확인되지 않은 사실

Grift는 측정할 수 없는 항목을 '미관측'으로 표기합니다. 미관측은 '측정할 수 없었다'는 뜻이지 '실적이 없었다'는 의미가 아닙니다. 이번 4개 대상에서는 다음 항목들이 확인되지 않았습니다.

- 리뷰 및 이슈 관리: GitHub 등의 기록을 제공하지 않았으므로 미관측입니다
- 개인의 경험 및 역할: 본인의 동의가 없으므로 미관측입니다
- 자사 변경 여부: 자사 이메일 주소를 정의하지 않았으므로 모두 '판단 불가'로 처리되었습니다

잘 풀리지 않았던 점도 솔직히 밝힙니다. commander.js 본체가 '기타'로 분류된 것은 앞서 언급했듯이 규칙의 허점 때문입니다. 또한 같은 날 작성된 글에서 "테스트 병행 수정률(본체와 테스트를 동시에 수정한 비율) 역시 형식적인 테스트 수정만으로도 높아질 수 있다"라고 지적했습니다. 0.8.0에서는 이 주의 문구가 아직 숫자 옆에 표시되지 않으며, 활동 일수에 대한 문장 하나만 표시되어 있습니다.

## 0.8.0에서 수정한 점

[0.7.2](https://pypi.org/project/grift-cli/0.7.2/)(측정 당시 공개 버전)에서는 리포지토리에 참여한 사람들의 목록이 변경 횟수가 많은 순서대로 나열되어 있었습니다. 맨 위에 있는 사람을 '가장 기여도가 높은 사람'으로 오해할 소지가 있었습니다. 0.8.0에서는 ID(개인별로 부여된 식별자) 순으로 정렬합니다.

4개 리포지토리에서 0.7.2와 0.8.0의 목록을 비교해 보았습니다. 이름과 수치는 보지 않고 정렬 방식만 확인했습니다. 0.7.2는 4개 모두 맨 위가 변경이 가장 많은 사람이었습니다. 0.8.0에서는 그 사람의 위치가 click에서 467줄 중 120번째 줄, flask에서 870줄 중 280번째 줄, httpx에서 258줄 중 232번째 줄, commander.js에서 203줄 중 15번째 줄이었습니다.

0.8.0의 목록을 변경 횟수가 많은 순으로 다시 정렬하면 검산을 통과하지 못합니다. 다른 수치는 0.7.2와 0.8.0에서 동일했습니다.

## 프로젝트 요구사항과 나란히 비교하기

프로젝트와 연결할 때는 프로젝트 측에서 요구하는 조건을 먼저 명시해 둡니다. Grift에서는 이를 '선언'이라고 부릅니다. git에서 확인된 사실(관측)과는 별도의 란에 나란히 배치하며, 합격/불합격 여부는 판정하지 않습니다.

시험 삼아 가상의 작은 프로젝트인 'Python 라이브러리 유지보수'를 선언해 보았습니다. 180일 동안 12일 이상의 활동이 있을 것, 변경 간격의 중앙값이 7일 이내일 것, 본체 프로그램과 테스트를 다루었을 것, 단위 테스트가 존재할 것, GitHub 등의 기록도 확인할 것이라는 선언입니다.

click에 대입해 보면 선언 란의 '12일 이상' 옆에 관측 란의 '62일'이 나란히 표시됩니다. GitHub 등의 기록은 제공하지 않았으므로 해당 란은 미관측 상태로 남습니다.

나란히 비교하더라도 앞 장에서 설명한 오독의 위험은 그대로 남습니다. commander.js에서 '본체 프로그램'이 0회인 것은 규칙의 허점 때문이며, httpx의 간격은 기록이 부족하여 미관측인 상태입니다. 나란히 놓인 수치를 어떻게 해석할지는 사람이 결정합니다.

엔지니어 본인의 기록과 프로젝트를 비교하는 활용법도 있습니다. 그 경우에는 본인이 동의한 기록만을 사용합니다. 실제 개인을 측정하게 되므로 본 기사에서는 시도하지 않았습니다.

## 맺음말

git 기록은 이력서에 적힌 내용을 확인할 수 있는 훌륭한 재료가 됩니다. 하지만 기록에 남지 않는 업무도 분명 존재합니다.

Grift가 제시하는 것은 경향, 그 근거가 되는 건수, 그리고 확인할 수 없었던 항목에 대한 이유입니다. 이를 바탕으로 어떤 판단을 내릴지는 읽는 사람의 몫입니다.

## 근거 데이터

엔지니어분들이 직접 검증해 보실 수 있도록 측정한 조건과 수치를 정리했습니다.

- grift 0.8.0(정의 버전 `tep-v0.8.0-2026-10-25`). 공개 전 소스(개발용 리포지토리의 `87076c8`)를 로컬에 설치했습니다. 공개된 0.8.0의 `src/`(프로그램 본체)은 이 소스와 동일합니다
- 비교를 위해 당시 공개 버전이었던 [0.7.2](https://pypi.org/project/grift-cli/0.7.2/)도 동일한 4개 대상에 적용했습니다
- Apple M4 Max, macOS 26.7.1, Python 3.12.9, git 2.54.0
- 대상은 2026년 9월 2일에 clone한 이후 업데이트하지 않은 로컬의 4개 리포지토리입니다

측정한 commit(1회 분량의 변경 기록)의 SHA(커밋별 식별자)와 해당 날짜는 다음과 같습니다.

```text
pallets/click    36baa15ff831b939a22bc527cd76ce653ef6f66d  2026-08-26
pallets/flask    d318b683471101618febed18996405ad26462110  2026-08-16
encode/httpx     b5addb64f0161ff6bfe94c124ef76f6a1fba5254  2026-02-23
tj/commander.js  ba6d13ddb4243e5913367734f8c159089ffe7834  2026-05-29
```

click을 예로 든 명령어입니다.

```bash
git clone https://github.com/pallets/click
git -C click checkout 36baa15ff831b939a22bc527cd76ce653ef6f66d
grift repo click --format both --out out/click
grift verify out/click/report.json --repo click
```

`grift repo`는 4개 모두 2.5초 이내에 완료되었으며, `grift verify`는 4개 모두 `VERIFIED`였습니다. 새로 clone한 click에서도 실행 시각을 제외하면 동일한 결과가 나왔습니다. 당시 공개 버전이었던 [0.7.2](https://pypi.org/project/grift-cli/0.7.2/)와 동일한 소스에서도 여기에 실린 관측값은 같았습니다.

| 리포지토리 | 사람의 commit / merge / bot |
|---|---|
| click | 2,000 / 1,131 / 200 |
| flask | 3,674 / 1,691 / 191 |
| httpx | 1,335 / 41 / 147 |
| commander.js | 1,095 / 284 / 138 |

사람의 commit은 merge(다른 브랜치의 변경을 병합한 기록)를 제외한 건수입니다. bot(자동으로 변경을 반영하는 프로그램)의 변경은 제외했습니다.

작업 영역(`surface_profile`)은 파일 위치와 확장자로 구분을 정의하고, 구분별로 commit을 카운트합니다. 1건의 commit이 여러 구분에 해당할 수 있으므로 합계는 분모를 초과합니다.

| 리포지토리 | 분모 | test / docs / backend / other |
|---|---|---|
| click | 1,999 | 562 / 1,024 / 1,158 / 309 |
| flask | 3,673 | 627 / 1,841 / 1,765 / 575 |
| httpx | 1,333 | 575 / 501 / 874 / 112 |
| commander.js | 1,094 | 286 / 468 / 0 / 530 |

변경 간격(`change_rhythm`)은 HEAD 날짜를 관측일로 삼고, 그 이전 180일 동안을 카운트합니다. 관측일은 위 SHA 우측에 표기된 날짜입니다.

| 리포지토리 | commit / 활동 일수 | 간격의 중앙값 / p90 |
|---|---|---|
| click | 187 / 62일 | 0.08일 / 3.36일 |
| flask | 32 / 19일 | 0.80일 / 15.60일 |
| httpx | 11 / 8일 | 미관측 |
| commander.js | 22 / 18일 | 2.88일 / 17.89일 |

httpx가 미관측된 이유는 `insufficient_population` 때문입니다. 윈도우 내 commit이 11건으로, 비율을 산출하기 위한 최소 기준인 20건에 미치지 못했습니다.

검증 형태(`verification_profile`)는 test 위치에 해당하는 commit을 카운트합니다.

| 리포지토리 | test를 포함한 commit | fix 제목에 test도 수정한 commit |
|---|---|---|
| click | 562 / 2,000 | 80 / 249 |
| flask | 627 / 3,674 | 58 / 408 |
| httpx | 575 / 1,335 | 46 / 114 |
| commander.js | 286 / 1,095 | 30 / 106 |

test 종류는 click이 unit 555·불명 23, flask가 unit 484·불명 204, httpx가 unit 554·불명 101, commander.js가 불명 286이었습니다.

미관측 항목은 click·flask·commander.js가 23개, httpx가 27개였습니다. 주요 이유는 다음과 같습니다.

- `forge_export_not_provided`, `tracker_export_not_provided`: 리뷰, 이슈 관리, 이벤트
- `consenting_actor_required`: 경험, 역할, 라이브러리 맥락
- `no_upstream_lineage`, `parent_repo_not_provided`, `template_not_provided`: upstream과의 관계, 템플릿으로부터의 상속
- `no_tenant_commits`: 자사 commit의 80%가 포함되는 기간
- `survival_scan_disabled`: 코드 최신성(현재 코드가 얼마나 최근에 작성되었는가)
- `outcome_declaration_not_provided`: 작업 이후 발생한 일에 대한 선언
- `deferred_to_v0.6`: 라인 단위 롤백(0.8.0에서도 0.6 시절의 명칭 그대로 유지)

유래(`origin`)는 4가지 모두 bot 이외의 전 commit이 `unresolved`였습니다. 자사 이메일 주소를 정의한 identity.toml도, fork의 부모 리포지토리도 지정하지 않았기 때문입니다.

click에서 문서로 카운트된 commit 내역과 flask의 fix commit 내역은 Grift의 자체 출력이 아닙니다. 동일한 규칙을 git log에 적용하여 로컬에서 다시 카운트한 개략적인 수치입니다. click은 1,025건 중 414건에서 문서로 다룬 파일이 `CHANGES.rst`뿐이었습니다. flask는 fix 제목의 commit 407건 중 198건이 문서 또는 설정 파일만 수정한 것이었습니다.

목록의 정렬(`actor_directory`)은 0.8.0의 행을 commit 수가 많은 순으로 다시 정렬하여 `grift verify`에 전달하면 `MISMATCH: 1 field(s) differ`로 종료 코드 1이 발생합니다. 0.7.2에서 저장한 리포트를 0.8.0으로 검산하면 정의 버전이 달라 `CANNOT_VERIFY`이 됩니다. 활동 일수에 대한 주의 문구는 0.8.0에서는 `activity.limitations` 및 `change_rhythm.limitations`에 실려 있으며, 0.7.2에는 없었습니다.

프로젝트 선언에는 다음 파일을 사용했습니다.

```toml
schema_version = "tep-project-v1"
project_id = "example-python-lib-maintenance"
title = "Python ライブラリの保守（架空の案件）"

[requirements.change_rhythm]
active_days_180d_min = 12
median_gap_days_max = 7

[requirements.surfaces]
required = ["backend", "test"]

[requirements.verification]
required = ["unit"]

[requirements.inputs]
required = ["git", "forge"]
```

```bash
grift project click --requirements python-lib-maintenance.toml --format both --out project/click
```

출력은 '프로젝트 측 선언'과 '관측된 수치'의 두 섹션으로 나뉘며, 선언하지 않은 항목은 `not_declared`(프로젝트 측에서 명시하지 않음. 부족함이 아님)로 처리되었습니다. 축별로 선언과 관측을 대조하는 작업은 `grift align`를 통해 이루어지며, 중복·범위 외·0건·미관측·요구 없음의 5가지 형태로 출력됩니다.

## 참고 자료

- [grift-cli (GitHub, MIT)](https://github.com/Cor-Incorporated/grift-cli) - CLI 소스 코드. 측정 당시 공개 버전은 0.7.2였으며, 0.8.0은 2026년 10월 26일 공개
- [grift-cli 0.8.0 릴리스 노트 (GitHub)](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0) - 0.8.0 변경 사항
- [grift-cli 0.7.2 (PyPI)](https://pypi.org/project/grift-cli/0.7.2/) - 측정 당시 공개 버전
- [Grift](https://griftai.org) - 제품 사이트
- [TEP 페이지 (Grift)](https://griftai.org/tep) - TEP 상세 설명
- [grift 리포트 읽는 법 (metrics-guide)](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/metrics-guide.md) - 지표별 알기 쉬운 해설
- [TEP 이용 규범 (norms)](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/norms.md) - 부재를 부정적으로 해석하지 않기, 가중치 부여 및 환산 금지
- ['점수도 순위도 매기지 않는다'를 구현에서 어떻게 지킬 것인가 (Cor.주식회사 블로그, 2026년 10월 25일)](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/) - 0.8에서 정한 5가지 조건
- ['아, 전달됐다'를 일상으로 만들기 위해, 나는 회사를 만들었다 (Cor.주식회사 블로그)](https://cor-jp.com/blog/founder-story/) - 대표의 이야기와 Grift가 탄생한 배경
- [Ethical Use of the MBTI (The Myers & Briggs Foundation)](https://www.myersbriggs.org/unique-features-of-myers-briggs/ethical-use-of-the-mbti/) - MBTI 사용 수칙(자발적 참여 원칙, 채용 목적 사용 금지)
- [MBTI Basics (The Myers & Briggs Foundation)](https://www.myersbriggs.org/my-mbti-personality-type/mbti-basics/) - 4가지 선호도와 16가지 유형
- [pallets/click](https://github.com/pallets/click) - 측정 대상 OSS (HEAD `36baa15`)
- [pallets/flask](https://github.com/pallets/flask) - 측정 대상 OSS (HEAD `d318b68`)
- [encode/httpx](https://github.com/encode/httpx) - 측정 대상 OSS (HEAD `b5addb6`)
- [tj/commander.js](https://github.com/tj/commander.js) - 측정 대상 OSS (HEAD `ba6d13d`)
