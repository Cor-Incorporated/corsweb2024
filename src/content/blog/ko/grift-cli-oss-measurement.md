---
title: "Git 이력에서 무엇이 보이고 무엇이 보이지 않는가. Grift로 OSS 4개를 검산했다"
description: "git 이력에서, 밝힌 규칙으로 셀 수 있는 것과 셀 수 없는 것을 나눕니다. 실재하는 OSS 4개를 저장소 단위로 검산했습니다. 사람의 능력이나 기록이 완전하다는 것은 보증하지 않습니다."
summary: "Grift가 확인하는 것은, 건네받은 기록을 명시한 규칙으로 센 결과입니다. 입력 범위와 commit, CLI 버전, 정의와 설정이 같으면 누가 세어도 같은 값이 됩니다. 실제 OSS 4개를 재면 작업 영역과 변경 간격의 차이는 보였지만, 사람의 능력이나 기록의 완전성은 보증하지 않습니다."
pubDate: 2026-10-25
updatedDate: 2026-10-29
author: "Terisuke"
category: "engineering"
ctaIntent: "grift-team-beta"
tags: ["Grift", "OSS", "CLI", "git", "実測"]
lang: "ko"
featured: false
isDraft: false
translationSourceHash: "75880e785376c1dd4282d8cbc16ea72155087b188d630bf6e14a8cf249212451"
translatedAt: "2026-10-29T05:20:00.000Z"
translationModel: "manual-i18n-sync"
---

이력서에 'Python 5년'이라고 적혀 있어도, 그 5년 동안 어떤 일을 해왔는지는 알 수 없습니다.

연수나 맨먼스(man-month)는 업무량의 기준은 됩니다. 하지만 동작을 확인하는 테스트를 작성하며 진행하는 사람인지, 문서를 정리하는 사람인지, 작은 변경을 자주 반영하는 사람인지, 일하는 방식까지는 알려주지 않습니다.

소개 회사나 SES의 영업 담당자가 추천 이유를 명확한 근거로 설명하지 못하고 막혀버리는 경우가 있습니다. Cor.주식회사은 그 원인 중 하나가 바로 이 간극에 있다고 생각합니다.

## 점수를 매기지 않는 이유

Grift는 이 간극을 메우기 위해 만든 자사 제품입니다. git(소프트웨어 변경 내역을 한 건씩 기록하는 시스템)에 남은 기록에서 업무 성향과 그 근거가 된 건수를 추출합니다. 점수도, 순위도 매기지 않습니다.

대표인 데라다 코스케은 리쿠르트에서 구인 광고 영업을 하던 시절, 말이 닿지 않는 답답함을 겪었습니다. Grift의 말은 "경력 설명에, 확인할 수 있는 근거를."입니다.

Grift가 확인하는 것은, 건네받은 기록을 명시한 규칙으로 센 결과입니다. 기록되지 않은 일, 기록을 만든 배경, 성과에 대한 실제 기여는 그것만으로는 알 수 없습니다. 다시 계산할 수 있다는 것은 사람의 능력이나 기록의 완전성을 보증하는 것이 아닙니다.

점수화하면 어떤 일이 벌어질까요? 서로 다른 종류의 기록을 하나의 숫자로 뭉뚱그리면, 무엇을 셌고 무엇을 세지 못했는지가 사라집니다. 그리고 점수가 있으면 점수가 높은 사람이 우수한 사람처럼 보입니다. 줄을 세우면 순위가 됩니다.

Grift가 지향하는 것은 사람을 순위로 줄 세우는 것이 아닙니다. 건네받은 기록을 명시한 규칙으로 센 결과를 남기는 것입니다. 판단은 사람의 몫입니다.

## MBTI와의 차이점

순위를 매기지 않는다는 말을 듣고 MBTI를 떠올리는 분도 계실지 모릅니다.

MBTI는 본인이 질문에 답하고, 4가지 선호 지표의 조합을 통해 16가지 유형을 도출합니다. MBTI 재단(The Myers & Briggs Foundation)은 모든 유형이 저마다 가치가 있으며, 채용 목적으로 만들어진 것이 아니라고 밝히고 있습니다.

Grift는 질문을 하지 않습니다. 유형 이름도 붙이지 않습니다. 성격을 진단하는 도구도 아닙니다. git에 남은 기록을 집계하여, 성향과 그 근거가 된 건수를 보여줍니다.

차이점은 영업 담당자의 고민에 대입해 보면 쉽게 이해할 수 있습니다.

이력서의 자기 신고 내용을 어디까지 믿어야 할지 알 수 없습니다. MBTI 결과 역시 이력서와 마찬가지로 본인의 응답에서 나옵니다. 반면 Grift의 근거는 기록입니다. 입력 범위와 commit, CLI 버전, 정의와 설정이 같으면 누가 집계하더라도 같은 값이 나옵니다.

연수나 맨먼스로는 일하는 방식을 알 수 없습니다. Grift는 어떤 영역을 다루어 왔는지(테스트, 문서, 본체 프로그램 등), 변경을 어느 정도의 간격으로 내고 있는지, 수정 작업에 테스트가 동반되는지를 건수로 보여줍니다.

다만 기록에 남지 않는 것은 드러나지 않습니다. 회의에서의 기여도, 코드 리뷰의 품질, 비공개 프로젝트에서의 업무는 보이지 않습니다. 본인의 동의가 없다면 개인의 경험이나 역할도 제공하지 않습니다.

## TEP라는 프로세스

Grift는 기록에서 사실을 추출하는 프로세스를 TEP(Technical Evidence Pipeline, 기술 증거 파이프라인)라고 부릅니다. 세부 과정은 4단계로 이루어집니다.

1. git 기록을 읽습니다. AI의 추측은 사용하지 않습니다
2. 정해진 규칙에 따라 집계합니다. 예를 들어 파일의 위치와 이름을 바탕으로 테스트인지 문서인지를 구분합니다
3. 집계한 수치에 분모와 집계되지 않은 항목의 이유를 덧붙입니다
4. 동일한 절차를 통해 누구나 다시 검산할 수 있도록 합니다

네 번째인 재집계를 Grift에서는 검산이라고 부릅니다. TEP에 관한 자세한 설명은 Grift 웹사이트의 [TEP 페이지](https://griftai.org/tep)에서 확인할 수 있습니다.

## 실제 OSS를 통한 검증

정말로 이 절차를 통해 업무 성향을 파악할 수 있을까요? 2026년 10월 25일, Grift CLI(명령어로 실행하는 Grift 도구) 0.8.0 버전으로 검증을 진행했습니다. 0.8.0은 당시 공개 준비 중이었으며, 다음 날인 10월 26일에 공개되었습니다([릴리스 노트](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0)).

실제 인물을 동의 없이 측정하지 않도록, 소스 코드가 공개된 소프트웨어(OSS)를 저장소(소프트웨어 하나의 기록을 모아둔 공간) 단위로 측정했습니다. 개인별 수치는 본 글에 일절 싣지 않았습니다.

측정한 대상은 성격이 다른 4개 프로젝트입니다.

- click: Python에서 명령어로 실행하는 도구를 만들기 위한 라이브러리(다른 프로그램에서 사용하는 부품)
- flask: Python으로 웹 서비스를 구축하기 위한 라이브러리
- httpx: Python으로 웹과 통신하기 위한 라이브러리
- commander.js: JavaScript에서 명령어로 실행하는 도구를 만들기 위한 라이브러리

## 확인된 사실

4개 저장소 모두 측정과 검산이 2.5초 이내에 완료되었습니다. 검산 결과는 4개 모두 전 항목에서 일치했습니다.

저장소별 성격의 차이도 확인할 수 있었습니다.

click의 경우 기록의 마지막 날까지 180일 동안 187회의 변경이 있었습니다. 변경과 변경 사이의 간격은 중앙값 기준 약 2시간이었습니다. 짧은 간격으로 변경이 꾸준히 이어졌습니다.

flask에서는 문서를 다룬 변경이 1,841회로, 본체 프로그램을 다룬 변경(1,765회)보다 많았습니다.

httpx에서는 테스트 파일을 포함한 변경이 전체 1,335회 중 575회였습니다.

commander.js에서는 본체 JavaScript 파일이 '본체 프로그램'으로 집계되지 않고 '기타'로 분류되었습니다. 이는 Grift 규칙의 허점입니다. 본체 프로그램으로 인식하는 확장자(파일명 끝부분)에 JavaScript의 `.js`가 누락되어 있었기 때문입니다.

## 숫자의 오독

실제로 측정해 보고 알게 된 것은, 숫자만 나열하면 쉽게 오독하게 된다는 점이었습니다. 5가지 사례를 소개합니다.

### 변경 횟수

변경 횟수가 많은 저장소라고 해서 반드시 좋은 저장소인 것은 아닙니다. flask의 변경은 3,674회, httpx는 1,335회였습니다. 변경 이력의 길이는 flask가 5,976일, httpx가 2,517일이었습니다. 횟수는 이력의 길이와 변경 사항을 일괄 병합하는지 여부에 따라 달라집니다.

### 문서의 변경

문서 변경이 많다고 해서 문서 작성에 열성적이라는 의미는 아닙니다. click에서 문서로 집계된 변경의 약 40%는 문서로서 다룬 파일이 변경 이력 파일뿐이었습니다. 변경이 발생할 때마다 변경 이력을 작성하는 저장소라면 문서 변경 횟수가 늘어납니다.

### 수정 변경

제목이 'fix'(수정)로 시작하는 변경에 테스트가 포함되지 않았다고 해서 테스트를 작성하지 않는다는 의미는 아닙니다. flask에서 제목이 'fix'로 시작하는 변경을 다시 집계해 보니, 407회 중 198회는 문서나 설정 파일만 변경된 경우였습니다. 제목은 'fix typo'(오타 수정) 등이었습니다.

### 적은 변경 수

변경이 적다고 해서 개발이 중단되었다는 뜻은 아닙니다. httpx의 경우 관측 기간인 180일 동안 변경이 11회에 불과하여 간격이 '미관측'(측정 불가)으로 나타났습니다. 이는 9월 2일에 로컬로 가져온 기록을 측정한 결과이며, 현재의 상태를 나타내는 것은 아닙니다.

### 활동 일수

활동 일수(변경이 발생한 날의 수)는 변경을 어떻게 쪼개느냐에 따라 늘릴 수 있습니다. 검증을 위해 소규모 저장소 2개를 만들고 동일한 5줄을 추가해 보았습니다. 1회에 일괄 추가하면 활동 일수는 2일, 5일에 걸쳐 1줄씩 나누어 추가하면 6일이 됩니다(둘 다 최초 1회를 포함합니다). 내용은 동일합니다.

Grift는 이 수치를 인위적으로 보정하지 않습니다. 대신 수치 옆에 "매일 1건의 작은 커밋을 올리면 늘어나고, 동일한 변경을 하루에 몰아서 처리하면 줄어듭니다."라는 문구를 표기합니다.

## 보이지 않았던 것

Grift는 측정할 수 없었던 항목을 '미관측'으로 표기합니다. 미관측은 '측정할 수 없었다'는 의미이지, '실적이 없었다'는 뜻이 아닙니다. 이번 4개 프로젝트에서는 다음 항목들이 보이지 않았습니다.

- 리뷰 및 이슈 관리: GitHub 등의 기록을 연동하지 않았으므로 미관측입니다
- 개인의 경험 및 역할: 본인의 동의가 없으므로 미관측입니다
- 자사의 변경 여부: 자사의 이메일 주소를 정의하지 않았으므로 모두 '판별 불가'로 처리되었습니다

원활하지 않았던 점도 솔직히 밝힙니다. commander.js의 본체가 '기타'로 분류된 것은 앞서 언급했듯이 규칙의 허점이었습니다. 또한 같은 날 작성된 글에서 "테스트 동시 수정률(본체와 동시에 테스트도 수정한 비율) 역시 형식적인 테스트 변경만으로도 높아질 수 있다"라고 썼습니다. 0.8.0 버전에서는 이 주의 문구가 아직 수치 옆에 반영되지 않았습니다. 현재 반영된 것은 활동 일수에 대한 한 문장뿐입니다.

## 0.8.0에서 수정한 점

[0.7.2](https://pypi.org/project/grift-cli/0.7.2/)(측정 당시의 공개 버전)에서는 저장소 기여자 목록이 변경 횟수가 많은 순서대로 정렬되어 있었습니다. 이는 맨 위에 있는 사람을 '가장 큰 기여를 한 사람'으로 오해하게 만들 여지가 있습니다. 0.8.0에서는 ID(개인별로 부여된 식별자) 순으로 정렬합니다.

4개 저장소에서 0.7.2와 0.8.0의 목록을 비교해 보았습니다. 이름과 수치는 보지 않고 정렬 방식만을 확인했습니다. 0.7.2는 4개 저장소 모두 맨 위에 변경 횟수가 가장 많은 사람이 위치했습니다. 반면 0.8.0에서는 해당 인물이 위치한 행이 click은 467행 중 120행, flask는 870행 중 280행, httpx는 258행 중 232행, commander.js는 203행 중 15행이었습니다.

0.8.0의 목록을 다시 변경 횟수 순으로 정렬하면 검산을 통과하지 못합니다. 그 외의 값은 0.7.2와 0.8.0에서 동일했습니다.

## 프로젝트 요구사항과의 비교

프로젝트와 인재를 연결할 때는 프로젝트 측에서 요구하는 조건을 사전에 정의해 둡니다. Grift에서는 이를 '선언'이라고 부릅니다. git에서 확인된 사실(관측)과는 별도의 항목에 나란히 배치하며, 합격·불합격 판정은 내리지 않습니다.

테스트 삼아 가상의 소규모 프로젝트인 'Python 라이브러리 유지보수'를 선언해 보았습니다. 180일 동안 12일 이상의 활동이 있을 것, 변경 간격의 중앙값이 7일 이내일 것, 본체 프로그램과 테스트를 다루었을 것, 단위 테스트가 존재할 것, GitHub 등의 기록도 함께 확인할 것, 이라는 선언입니다.

click에 대입하면 선언 항목의 '12일 이상' 옆에 관측 항목의 '62일'이 나란히 표시됩니다. GitHub 등의 기록은 전달하지 않았으므로 해당 칸은 미관측 상태로 남습니다.

나란히 비교한 후에도 앞 장에서 언급한 오독의 가능성은 그대로 남습니다. commander.js에서 '본체 프로그램'이 0회인 것은 규칙의 허점 때문이며, httpx의 간격은 기록이 부족하여 미관측된 것입니다. 나란히 놓인 수치를 어떻게 해석할지는 사람이 결정합니다.

엔지니어 본인의 기록을 프로젝트 요구사항과 나란히 비교하는 활용법도 있습니다. 그 경우에는 본인이 동의한 기록만을 사용합니다. 실제 개인을 측정하게 되므로 본 글에서는 다루지 않았습니다.

## 맺음말

git 기록은 이력서에 적힌 내용을 확인할 수 있는 훌륭한 근거 자료가 됩니다. 하지만 기록에 남지 않는 업무도 분명 존재합니다.

Grift가 제공하는 것은 성향과 그 근거가 되는 건수, 그리고 관측되지 않은 항목의 이유입니다. 이를 바탕으로 어떤 판단을 내릴지는 글을 읽는 사람의 몫입니다.

## 근거 데이터

엔지니어분들이 직접 검증해 보실 수 있도록 측정한 조건과 데이터를 정리했습니다.

- grift 0.8.0(정의 버전 `tep-v0.8.0-2026-10-25`). 배포 전 소스 코드(개발용 저장소의 `87076c8`)를 로컬 환경에 설치했습니다. 정식 배포된 0.8.0의 `src/`(프로그램 본체)는 이 소스 코드와 동일합니다
- 비교를 위해 당시 공개 버전이었던 [0.7.2](https://pypi.org/project/grift-cli/0.7.2/)도 동일한 4개 저장소에 적용했습니다
- Apple M4 Max, macOS 26.7.1, Python 3.12.9, git 2.54.0
- 대상은 2026년 9월 2일에 clone한 이후 업데이트하지 않은 로컬의 4개 저장소입니다

측정한 commit(1회분의 변경 기록)의 SHA(커밋별 식별자)와 해당 날짜는 다음과 같습니다.

```text
pallets/click    36baa15ff831b939a22bc527cd76ce653ef6f66d  2026-08-26
pallets/flask    d318b683471101618febed18996405ad26462110  2026-08-16
encode/httpx     b5addb64f0161ff6bfe94c124ef76f6a1fba5254  2026-02-23
tj/commander.js  ba6d13ddb4243e5913367734f8c159089ffe7834  2026-05-29
```

click을 예로 든 실행 명령어입니다.

```bash
git clone https://github.com/pallets/click
git -C click checkout 36baa15ff831b939a22bc527cd76ce653ef6f66d
grift repo click --format both --out out/click
grift verify out/click/report.json --repo click
```

`grift repo`는 4개 모두 2.5초 이내에 완료되었으며, `grift verify`는 4개 모두 `VERIFIED`이었습니다. 새로 clone한 click에서도 실행 시각을 제외하면 동일한 결과가 나왔습니다. 당시 공개 버전이었던 [0.7.2](https://pypi.org/project/grift-cli/0.7.2/)와 동일한 소스 코드에서도 여기에 기재된 관측치는 일치했습니다.

| 저장소 | 사람의 commit / merge / bot |
|---|---|
| click | 2,000 / 1,131 / 200 |
| flask | 3,674 / 1,691 / 191 |
| httpx | 1,335 / 41 / 147 |
| commander.js | 1,095 / 284 / 138 |

사람의 commit은 merge(다른 브랜치의 변경 사항을 병합한 기록)를 제외한 건수입니다. bot(자동으로 변경을 반영하는 프로그램)의 커밋은 제외했습니다.

작업 영역(`surface_profile`)은 파일의 위치와 확장자로 영역을 나누고, 영역별 commit을 집계합니다. 1건의 commit이 여러 영역에 걸칠 수 있으므로 합계는 분모를 초과합니다.

| 저장소 | 분모 | test / docs / backend / other |
|---|---|---|
| click | 1,999 | 562 / 1,024 / 1,158 / 309 |
| flask | 3,673 | 627 / 1,841 / 1,765 / 575 |
| httpx | 1,333 | 575 / 501 / 874 / 112 |
| commander.js | 1,094 | 286 / 468 / 0 / 530 |

변경 간격(`change_rhythm`)은 HEAD의 날짜를 관측일로 삼아 그 직전 180일간의 데이터를 집계합니다. 관측일은 위 SHA 우측에 기재된 날짜입니다.

| 저장소 | commit / 활동 일수 | 간격 중앙값 / p90 |
|---|---|---|
| click | 187 / 62일 | 0.08일 / 3.36일 |
| flask | 32 / 19일 | 0.80일 / 15.60일 |
| httpx | 11 / 8일 | 미관측 |
| commander.js | 22 / 18일 | 2.88일 / 17.89일 |

httpx가 미관측된 이유는 `insufficient_population` 때문입니다. 윈도우 내 commit이 11건으로, 비율 산출 최소 기준인 20건에 미치지 못했습니다.

검증 형태(`verification_profile`)는 test 디렉터리에 해당하는 commit을 집계합니다.

| 저장소 | test를 포함한 commit | fix 제목에 test도 함께 수정한 commit |
|---|---|---|
| click | 562 / 2,000 | 80 / 249 |
| flask | 627 / 3,674 | 58 / 408 |
| httpx | 575 / 1,335 | 46 / 114 |
| commander.js | 286 / 1,095 | 30 / 106 |

test 유형의 경우 click은 unit 555·불명 23, flask는 unit 484·불명 204, httpx는 unit 554·불명 101, commander.js는 불명 286이었습니다.

미관측 항목은 click·flask·commander.js가 23개, httpx가 27개였습니다. 주요 사유는 다음과 같습니다.

- `forge_export_not_provided`, `tracker_export_not_provided`: 리뷰, 이슈 관리, 이벤트
- `consenting_actor_required`: 경험, 역할, 라이브러리 컨텍스트
- `no_upstream_lineage`, `parent_repo_not_provided`, `template_not_provided`: upstream과의 관계, 템플릿으로부터의 상속
- `no_tenant_commits`: 자사 commit의 80%가 포함된 기간
- `survival_scan_disabled`: Code recency(현재 코드가 얼마나 최근에 작성되었는지)
- `outcome_declaration_not_provided`: 작업 이후 발생한 사항의 선언
- `deferred_to_v0.6`: 라인 단위 롤백(0.8.0에서도 0.6 버전 당시의 명칭을 유지하고 있습니다)

출처(`origin`)는 4개 저장소 모두 bot을 제외한 전체 commit이 `unresolved`이었습니다. 자사 이메일 주소를 정의한 identity.toml도, fork의 부모 저장소도 연동하지 않았기 때문입니다.

click에서 문서로 집계된 commit의 세부 내역과 flask의 fix commit 세부 내역은 Grift의 출력 결과가 아닙니다. 동일한 규칙을 git log에 적용하여 로컬에서 재집계한 대략적인 수치입니다. click은 1,025건 중 414건에서 문서로 다룬 파일이 `CHANGES.rst`뿐이었습니다. flask는 fix 제목의 커밋 407건 중 198건이 문서 또는 설정 파일만을 수정한 것이었습니다.

목록 정렬(`actor_directory`)의 경우, 0.8.0의 행을 커밋 수가 많은 순으로 다시 정렬하여 `grift verify`에 전달하면 `MISMATCH: 1 field(s) differ`와 함께 종료 코드 1이 발생했습니다. 0.7.2에서 저장한 리포트를 0.8.0에서 검산하면 정의 버전이 달라 `CANNOT_VERIFY`가 됩니다. 활동 일수 주의 문구는 0.8.0의 경우 `activity.limitations`와 `change_rhythm.limitations`에 표기되었으며, 0.7.2에는 존재하지 않았습니다.

프로젝트 요구사항 선언에는 다음 파일을 사용했습니다.

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

출력 결과는 '프로젝트 측 선언'과 '관측된 수치'의 2개 섹션으로 나뉘며, 선언하지 않은 항목은 `not_declared`(프로젝트 측 미기재. 부족함이 아님)로 처리되었습니다. 축별로 선언과 관측을 대조하는 작업은 `grift align`에서 담당하며, 일치·범위 초과·0건·미관측·요구 없음의 5가지 형태로 출력됩니다.

## 참고 자료

- [grift-cli(GitHub, MIT)](https://github.com/Cor-Incorporated/grift-cli) - CLI 소스 코드. 측정 당시 공개 버전은 0.7.2이며, 0.8.0은 2026년 10월 26일에 배포
- [grift-cli 0.8.0 릴리스 노트(GitHub)](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0) - 0.8.0 변경 사항
- [grift-cli 0.7.2(PyPI)](https://pypi.org/project/grift-cli/0.7.2/) - 측정 당시 공개 버전
- [Grift](https://griftai.org) - 제품 웹사이트
- [TEP 페이지(Grift)](https://griftai.org/tep) - TEP에 관한 상세 설명
- [grift 리포트 확인 가이드(metrics-guide)](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/metrics-guide.md) - 지표별 알기 쉬운 설명
- [TEP 이용 규범(norms)](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/norms.md) - 부재를 부정적으로 해석하지 않음, 가중치 부여 및 환산 금지
- ['점수도 순위도 매기지 않는다'를 구현으로 지켜내는 방법(Cor.주식회사 블로그, 2026년 10月 25일)](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/) - 0.8 버전에서 확립한 5가지 조건
- [대표가 회사를 만든 이야기(Cor.주식회사 블로그)](https://cor-jp.com/blog/founder-story/) - 대표의 이야기와 Grift가 탄생한 배경
- [Ethical Use of the MBTI(The Myers & Briggs Foundation)](https://www.myersbriggs.org/unique-features-of-myers-briggs/ethical-use-of-the-mbti/) - MBTI 활용 원칙(자발적 참여 원칙, 채용 목적 사용 금지)
- [MBTI Basics(The Myers & Briggs Foundation)](https://www.myersbriggs.org/my-mbti-personality-type/mbti-basics/) - 4가지 선호 지표와 16가지 성격 유형
- [pallets/click](https://github.com/pallets/click) - 측정 대상 OSS(HEAD `36baa15`)
- [pallets/flask](https://github.com/pallets/flask) - 측정 대상 OSS(HEAD `d318b68`)
- [encode/httpx](https://github.com/encode/httpx) - 측정 대상 OSS(HEAD `b5addb6`)
- [tj/commander.js](https://github.com/tj/commander.js) - 측정 대상 OSS(HEAD `ba6d13d`)
