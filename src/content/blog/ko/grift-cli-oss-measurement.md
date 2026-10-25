---
title: "점수를 매기지 않는 툴을 실제 OSS에 사용해 보면 무엇이 나올까. Grift CLI 0.8.0으로 4개 리포지토리를 측정했다"
description: "Grift CLI의 다음 버전(0.8.0)으로 click, flask, httpx, commander.js 4개 OSS를 측정했습니다. 명령어와 출력을 있는 그대로 싣고, 무엇이 보이고 무엇이 보이지 않았는지, 수치를 어떻게 읽으면 잘못 해석하게 되는지를 작성합니다. 리포지토리 간의 우열은 비교하지 않습니다."
summary: "Grift CLI의 다음 버전(0.8.0)으로 4개 OSS를 측정해 본 결과, 관측은 모두 2.5초 이내에 완료되었으며 grift verify의 재계산과 전 항목이 일치했습니다. 작업 영역, 변경 간격, 검증 형태는 값이 도출되는 반면, 리뷰, 이슈 관리, 개인의 경험은 이유와 함께 미관측 상태로 남습니다. 값은 경로 규칙과 관측 기간에 따라 결정되므로, 리포지토리끼리 나란히 두고 우열을 따져 읽을 수는 없습니다."
pubDate: 2026-10-25
author: "Terisuke"
category: "engineering"
ctaIntent: "grift-team-beta"
tags: ["Grift", "OSS", "CLI", "git", "実測"]
lang: "ko"
featured: false
isDraft: false
translationSourceHash: "1a6743e05b9509c026319d50ed64815235cd876ba8f948088f196f9f7252180d"
translatedAt: "2026-10-25T14:27:43.720Z"
translationModel: "gemini-3.8-flash"
---

Grift CLI는 git 이력에서 확인할 수 있는 사실을 추출하며, 점수도 순위도 매기지 않겠다고 약속합니다. 그렇다면 실제 OSS에 적용하면 무엇이 나올까요? Cor.는 2026년 10월 25일에 다음 버전(0.8.0)으로 4개의 OSS를 측정했습니다.

이 글에서는 절차와 출력을 있는 그대로 싣습니다. 리포지토리 간의 우열은 비교하지 않습니다. 수치의 차이는 리포지토리의 성격 차이로 서술합니다. 0.8에서 무엇을 수정하기로 결정했는지는 같은 날의 글 「[‘점수도 순위도 매기지 않는다’를 구현으로 어떻게 지킬 것인가](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/)」에 적었습니다.

## 이 글에서 싣지 않는 것

repo의 보고서에는 해당 리포지토리에 참여한 사람들의 목록도 포함됩니다. 이 글에는 개인 단위의 수치를 단 하나도 싣지 않습니다. 실을 경우 실제 기여자를 숫자로 줄 세우게 되며, 본인의 동의가 없는 관측을 공개하게 되기 때문입니다. `grift actor`, `--actors`, `--top`도 사용하지 않았습니다.

0.8.0은 2026년 10월 25일 시점에 PyPI에 공개되지 않았습니다. 공개 버전은 0.7.2이며, 0.8.0은 공개 준비 중입니다.

## 측정한 환경과 대상

- grift 0.8.0(정의 버전 `tep-v0.8.0-2026-10-25`). 공개 전 소스(개발용 리포지토리의 `87076c8`)를 로컬 환경에 설치했습니다.
- 비교를 위해 공개 버전인 0.7.2도 동일한 4개 리포지토리에 적용했습니다.
- Apple M4 Max, macOS 26.7.1, Python 3.12.9, git 2.54.0

대상은 2026년 9월 2일에 clone한 이후 업데이트하지 않은 로컬 환경의 4개 리포지토리입니다. 다시 clone하지 않고 그 상태 그대로 측정했습니다.

| 리포지토리 | 성격 | 측정한 HEAD | HEAD 일자 |
|---|---|---|---|
| [pallets/click](https://github.com/pallets/click) | Python의 CLI 라이브러리 | `36baa15ff831b939a22bc527cd76ce653ef6f66d` | 2026-08-26 |
| [pallets/flask](https://github.com/pallets/flask) | Python의 웹 프레임워크 | `d318b683471101618febed18996405ad26462110` | 2026-08-16 |
| [encode/httpx](https://github.com/encode/httpx) | Python의 HTTP 클라이언트 | `b5addb64f0161ff6bfe94c124ef76f6a1fba5254` | 2026-02-23 |
| [tj/commander.js](https://github.com/tj/commander.js) | JavaScript의 CLI 라이브러리 | `ba6d13ddb4243e5913367734f8c159089ffe7834` | 2026-05-29 |

## 실행한 명령어

로컬 환경에서 동일한 값을 도출할 수 있도록 click을 예로 들어 명령어를 싣습니다.

```bash
git clone https://github.com/pallets/click
git -C click checkout 36baa15ff831b939a22bc527cd76ce653ef6f66d
grift repo click --format both --out out/click
grift verify out/click/report.json --repo click
```

`grift repo`는 리포지토리 전체를 관측하고 `report.json` 및 `report.md`을 작성합니다. `grift verify`은 보고서에 기록된 조건으로 다시 계산하여 모든 항목을 비교합니다. 새로 clone하여 이 SHA에 맞춘 click에서도 실행한 시각(`analyzed_at`) 외에는 로컬 환경의 결과와 동일했습니다.

공개 버전인 0.7.2(`pipx install grift-cli`로 설치되는 버전)와 동일한 소스로도 측정했으며, 이 글에 실은 관측값은 0.8.0과 동일했습니다. 0.8.0에서 변경된 것은 사람 목록의 정렬 순서와 주석입니다. 차이점은 뒷부분의 섹션에서 확인합니다.

## 4개 리포지토리의 관측 결과

| 항목 | click | flask | httpx | commander.js |
|---|---|---|---|---|
| `grift repo`의 실행 시간 | 1.57초 | 2.32초 | 1.16초 | 1.14초 |
| `grift verify`의 결과 | VERIFIED(1.62초) | VERIFIED(2.40초) | VERIFIED(1.33초) | VERIFIED(1.28초) |
| 사람의 commit(merge 제외) | 2,000 | 3,674 | 1,335 | 1,095 |
| merge commit | 1,131 | 1,691 | 41 | 284 |
| 제외된 bot의 commit | 200 | 191 | 147 | 138 |
| 작업 영역의 분모(path를 가져올 수 있었던 사람의 commit) | 1,999 | 3,673 | 1,333 | 1,094 |
| 작업 영역 test | 562 | 627 | 575 | 286 |
| 작업 영역 docs | 1,024 | 1,841 | 501 | 468 |
| 작업 영역 backend | 1,158 | 1,765 | 874 | 0 |
| 작업 영역 other | 309 | 575 | 112 | 530 |
| 변경 간격을 계산하는 윈도우(180일) | 2026-02-27~2026-08-26 | 2026-02-17~2026-08-16 | 2025-08-27~2026-02-23 | 2025-11-30~2026-05-29 |
| 윈도우 내 commit / 활동 일수 | 187건 / 62일 | 32건 / 19일 | 11건 / 8일 | 22건 / 18일 |
| 간격의 중앙값 / p90 | 0.08일 / 3.36일 | 0.80일 / 15.60일 | 미관측(모수 부족) | 2.88일 / 17.89일 |
| test를 포함한 commit | 562 / 2,000 | 627 / 3,674 | 575 / 1,335 | 286 / 1,095 |
| fix 제목으로 test도 변경한 commit | 80 / 249 | 58 / 408 | 46 / 114 | 30 / 106 |
| test 종류(path로 판정) | unit 555, 불명 23 | unit 484, 불명 204 | unit 554, 불명 101 | 불명 286 |
| 유래(origin) | bot 이외의 전체 commit이 unresolved | 동일 | 동일 | 동일 |
| 미관측(not_observed) 항목 | 23 | 23 | 27 | 23 |

작업 영역은 1건의 commit이 여러 구분에 해당할 수 있으므로 합계가 분모를 초과합니다.

이 표를 가로로 읽어 어떤 리포지토리가 더 좋은지 결정할 수는 없습니다. 그 이유는 이어지는 「수치의 오독」 섹션에서 설명합니다.

## 보이지 않았던 것

미관측(not_observed)은 ‘측정할 수 없었다’는 뜻이지, ‘실적이 없었다’는 뜻이 아닙니다. 보고서는 미관측 항목마다 이유를 명시합니다. 4개 리포지토리에 공통으로 나타난 23개 항목의 이유는 다음과 같습니다. 입력란에 동일한 이유가 중복되어 나타나는 항목은 한 줄로 정리했습니다.

| 미관측된 항목 | 이유(reason) | 관측하는 데 필요한 것 |
|---|---|---|
| 리뷰, 이슈 관리, 이벤트 및 그 간격 | `forge_export_not_provided`, `tracker_export_not_provided` | forge와 tracker의 export 파일(`--forge-export`, `--tracker-export`) |
| 경험, 역할, 라이브러리의 맥락 | `consenting_actor_required` | 동의를 기록한 본인의 identity |
| upstream과의 관계, 템플릿으로부터의 상속 | `no_upstream_lineage`, `parent_repo_not_provided`, `template_not_provided` | 상위 리포지토리나 템플릿의 경로 |
| 자사 commit의 80%가 포함되는 기간 | `no_tenant_commits` | 자사 이메일 주소를 정의한 identity |
| 정착률(survival) | `survival_scan_disabled` | `--survival`(시간이 걸립니다) |
| 작업 후에 일어난 일의 선언 | `outcome_declaration_not_provided` | `--outcome-declaration` |
| 라인 단위의 재작업 | `deferred_to_v0.6` | 0.8.0에서는 나오지 않습니다 |

httpx에서는 여기에 변경 간격의 4개 항목(중앙값, p90, 2일 이내 비율, 30일 이상 비율)이 추가되었습니다. 이유는 `insufficient_population`입니다. 윈도우 내 commit이 11건으로, 비율을 산출하는 하한선인 20건에 미치지 못했습니다. 라인 단위 재작업의 이유는 0.8.0에서도 0.6 시절의 이름(`deferred_to_v0.6`) 그대로입니다.

유래(origin)가 전건 unresolved로 나타난 것 또한 보이지 않았던 것 중 하나입니다. 유래는 자사 이메일 주소를 정의한 identity.toml이나 fork의 부모를 전달했을 때 분류됩니다. OSS를 그대로 측정할 때는 둘 다 전달하지 않으므로, bot 이외의 commit은 모두 ‘판단할 수 없음’이 됩니다. 같은 표의 `tenant_unique` 등은 0건이지만, 이는 ‘해당 사항이 없었다’는 뜻입니다. unresolved와는 의미가 다릅니다.

## 수치의 오독

### commit 수

commit 수는 이력의 길이와 반영 방식에 따라 달라집니다. flask의 사람 commit은 3,674건, httpx는 1,335건입니다. 이 차이는 우열이 아닙니다. 최초 commit으로부터의 일수는 flask가 5,976일, httpx가 2,517일입니다. merge commit은 flask가 1,691건, httpx가 41건이었습니다. 동일한 변경이라도 하나로 묶어서 반영하는지, commit 단위 그대로 반영하는지에 따라 건수는 달라집니다.

### 작업 영역의 이름

작업 영역의 이름은 path 규칙의 이름입니다. commander.js의 backend는 0건이고, other가 530건이었습니다. commander.js의 본체에 해당하는 `.js`의 파일들이 backend 규칙에 포함되지 않기 때문입니다. backend 규칙은 `api/`이나 `services/` 등의 디렉터리와 `.py`, `.go`, `.rs` 등의 확장자로 결정됩니다.

반대로 click의 backend가 1,158건인 것은 `.py`의 파일이 모두 backend에 들어가기 때문입니다. click은 서버 프로그램이 아닙니다. 보고서 자체도 "path와 확장자에 의한 작업 영역의 관측입니다"라고 적고 있습니다.

### docs 건수

docs 건수가 많다는 것이 문서화에 열정적이라는 뜻은 아닙니다. docs 규칙은 `.md`, `.rst` 확장자와 `docs/` 등의 디렉터리입니다. 변경이 있을 때마다 변경 이력 파일을 덧붙여 쓰는 리포지토리에서는 docs 건수가 늘어납니다.

click에서 docs로 집계된 commit의 내역을 동일한 규칙으로 git log에서 다시 세어보면, 1,025건 중 414건은 docs로서 수정한 파일이 변경 이력(`CHANGES.rst`)뿐이었습니다. 이 내역은 grift의 출력이 아니라 로컬 환경에서 다시 집계한 대략적인 수치입니다. 보고서는 click에 대해 "docs 계열 surface가 상대적으로 많은 경향"이라 적고 있으며, 그 강도를 weak, 확실성을 directional로 표기합니다.

### fix 제목

‘fix 제목으로 test도 변경한 commit’은 제목이 `fix`, `bug`, `revert` 등으로 시작하는 commit 중 test 파일도 수정한 것입니다. flask에서는 408건 중 58건이었습니다.

동일한 규칙으로 flask의 git log를 다시 집계해 보면, fix 제목의 commit 407건 중 198건은 docs나 설정 파일만 수정했습니다. 제목은 "fix typo"나 링크 수정이었습니다. test를 동반하지 않는 ‘fix’가 절반 가까이 되므로, 이 값을 ‘버그를 고쳐도 테스트를 작성하지 않는다’고 해석하는 것은 오독입니다.

### 변경 간격을 계산하는 윈도우

변경 간격은 관측일로부터 180일의 윈도우로 계산합니다. 관측일을 `--as-of`로 지정하지 않으면 HEAD commit의 일자가 관측일이 됩니다(`window_basis=legacy_head_date`). 따라서 4개 리포지토리의 윈도우는 모두 서로 다른 기간입니다.

httpx의 윈도우(2025-08-27~2026-02-23)에는 commit이 11건밖에 없어 간격 값이 미관측되었습니다. 이를 ‘개발이 중단되었다’고 읽는 것 또한 오독입니다. 측정한 것은 로컬 checkout이며, upstream의 현재 상태가 아닙니다.

### 활동 일수

마지막으로 검증용 소형 리포지토리 2개를 만들어 확인했습니다. 둘 다 첫 commit 이후에 동일한 5줄짜리 파일을 추가합니다. 한쪽은 5줄을 한 번에 commit했고, 다른 한쪽은 1줄씩 5일에 나누어 commit했습니다.

| 작성 방식 | commit(최초 포함) | 마지막 tree | 활동 일수 |
|---|---|---|---|
| 5줄을 한 번에 commit | 2 | `880a82d` | 2일 |
| 1줄씩 5일에 나누어 commit | 6 | `880a82d` | 6일 |

내용이 같더라도 활동 일수는 2일과 6일이 됩니다. 0.8.0은 이 수치를 보정하지 않습니다. 대신 수치 옆에 "매일 1건의 작은 commit을 남기면 늘어나고, 동일한 변경을 하루에 몰아서 처리하면 줄어듭니다."라는 문장을 표시합니다.

## 0.8.0에서 수정한 것

같은 날의 글에 적은 대로, 0.8.0에서는 사람 목록의 정렬 순서를 바꾸고 활동 일수를 부풀리는 방식을 공개했습니다. repo 보고서의 사람 목록(`actor_directory`)을 동일한 4개 리포지토리에서 0.7.2와 0.8.0의 출력으로 비교했습니다. 이름과 숫자는 보지 않고 정렬 방식만 비교했습니다.

| 항목 | 0.7.2 | 0.8.0 |
|---|---|---|
| 행 정렬 | 4개 모두 commit 수가 많은 순서 | 4개 모두 actor_id 순서 |
| 첫 번째 행이 commit 수가 가장 많은 사람인가 | 4개 모두 그렇다 | 4개 모두 아니다 |
| commit 수가 가장 많은 사람의 행 위치 | 4개 모두 1행 | click 120행(467행 중), flask 280행(870행 중), httpx 232행(258행 중), commander.js 15행(203행 중) |
| 활동 일수를 부풀리는 방식에 대한 문장 | 없음 | `activity.limitations`와 `change_rhythm.limitations`에 있음 |

0.7.2의 Markdown 제목은 "actor 목록(품질 랭킹이 아님)"이었지만 행은 commit 수가 많은 순서였습니다. 0.8.0에서는 동일한 제목 아래에 "행은 actor_id 순(commit 수 순이 아님). 행의 위치는 아무것도 의미하지 않음."이라고 명시되어 있습니다.

0.8.0 출력의 행을 commit 수가 많은 순서로 다시 정렬하여 `grift verify`에 넣으면 `MISMATCH: 1 field(s) differ`(`actor_directory.actors`)로 종료 코드 1이 발생했습니다. 순서를 바꾼 목록은 검산을 통과하지 못합니다.

다른 값은 바뀌지 않았습니다. 작업 영역, 검증 형태, 유래, 모수 값은 0.7.2와 0.8.0에서 4개 모두 동일했습니다. 변경 간격의 차이는 주석(limitations)이 3개 문장에서 4개 문장으로 늘어난 것뿐입니다. 0.7.2에서 저장한 보고서를 0.8.0의 `grift verify`에 넣으면 정의 버전이 `tep-v0.7.2-2026-09-07`로 현재 버전과 다르기 때문에 `CANNOT_VERIFY`가 됩니다.

값의 변조를 감지할 수 있는지도 확인했습니다. click 보고서에서 fix와 test 조합 값(`fix_with_test_pairing`)을 0.3213에서 0.9로 수정한 후 `grift verify`에 넣자, `report=0.9 recomputed=0.3213`와 함께 두 값을 모두 제시하며 종료 코드 1로 중단되었습니다.

한편 아직 반영되지 않은 사항도 있었습니다. 같은 날의 글의 조건 4에서는 테스트 동반 수정률 역시 테스트 파일에 대한 형식적인 1줄 변경으로 올릴 수 있다고 적었습니다. 0.8.0의 repo 보고서에서는 이 경로가 아직 수치 옆에 적혀 있지 않습니다. 0.8.0에서 수치 옆에 둔 것은 활동 일수에 대한 1개 문장뿐입니다.

## 프로젝트 선언과 나란히 놓기

`grift project`은 프로젝트 측이 작성한 요구사항(선언)과 git 관점에서 본 운영 형태(관측)를 서로 다른 섹션에 나란히 배치합니다. 가상의 작은 프로젝트 ‘Python 라이브러리 유지보수’를 선언하여 4개 리포지토리에 적용했습니다.

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

출력은 ‘프로젝트 측 선언’과 ‘관측된 수치’라는 두 섹션으로 나뉘며, 합격/불합격 판정은 없습니다. 선언하지 않은 간격의 p90은 `not_declared`가 되며, 보고서는 "프로젝트 측이 작성하지 않음. 부족함이 아님"이라고 명시합니다. 선언에서 forge를 요구하더라도 forge export를 전달하지 않았으므로 관측 측의 리뷰는 미관측 상태로 남습니다. click에서는 다음과 같이 나란히 표시되었습니다.

| 축 | 선언 | click의 관측 |
|---|---|---|
| 180일 활동 일수 | 12일 이상 | 62일(윈도우 내 commit 187건) |
| 간격의 중앙값 | 7일 이하 | 0.08일 |
| 간격의 p90 | 선언 없음(not_declared) | 3.36일 |
| 작업 영역 | backend, test | backend 1,158건, test 562건 |
| test 종류 | unit | unit 555건 |
| 입력 | git, forge | git만(forge는 미관측) |

다른 3개 리포지토리도 동일한 형태로 나란히 표시됩니다. 나란히 놓은 후에도 이전 섹션의 오독 여지는 그대로 남습니다. commander.js의 backend가 0건인 것은 `.js`가 규칙에 없기 때문이며, httpx의 간격 중앙값은 윈도우 모수가 부족하여 미관측 상태입니다.

축별로 선언과 관측을 대조하는 것은 `grift align`로, 일치·범위 외·0건·미관측·요구 없음의 5가지 형태로 출력합니다. 단, `grift align`은 후보자 측의 관측을 입력값으로 사용합니다. 실제 개인을 측정하게 되므로 이 글에서는 실행하지 않았습니다.

## 맺음말

4개 리포지토리 모두 수치는 2.5초 이내에 도출되었으며 검산 결과와 일치했습니다. 다만 어떤 수치든 분모와 관측 윈도우, path 규칙을 함께 읽지 않으면 의미를 잘못 이해하게 됩니다. 무엇이 보이고 무엇이 보이지 않았는지는 보고서 자체가 이유와 함께 명시하고 있습니다.

자신의 리포지토리에서도 동일한 명령어로 확인할 수 있습니다. 나열된 수치를 바탕으로 무엇을 판단할지는 읽는 사람이 결정할 몫입니다.

## 참고 자료

- [grift-cli(GitHub, MIT)](https://github.com/Cor-Incorporated/grift-cli) - CLI 소스 코드. 공개 버전은 0.7.2이며 0.8.0은 공개 준비 중
- [Grift](https://griftai.org) - 제품 사이트
- [grift 보고서 읽는 법(metrics-guide)](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/metrics-guide.md) - 지표별 평이한 해설
- [TEP 이용 규범(norms)](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/norms.md) - 부재를 부정적으로 해석하지 않음, 가중치 부여 및 환산 금지
- [‘점수도 순위도 매기지 않는다’를 구현으로 어떻게 지킬 것인가(Cor.주식회사 블로그, 2026년 10월 25일)](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/) - 0.8에서 결정한 5가지 조건
- [pallets/click](https://github.com/pallets/click) - 측정한 OSS(HEAD `36baa15`)
- [pallets/flask](https://github.com/pallets/flask) - 측정한 OSS(HEAD `d318b68`)
- [encode/httpx](https://github.com/encode/httpx) - 측정한 OSS(HEAD `b5addb6`)
- [tj/commander.js](https://github.com/tj/commander.js) - 측정한 OSS(HEAD `ba6d13d`)
