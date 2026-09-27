---
title: "【완벽 5개 국어 지원】영일만 지원하던 블로그를 중한서까지 확장한 격렬했던 3시간 분투기"
description: "5개 국어 지원이라 생각했지만 사실은 2개 국어만 지원했던 충격적인 사실. Claude Code와 함께 중국어, 한국어, 스페인어 지원을 폭풍처럼 구현했던 모든 기록"
pubDate: 2025-09-25
author: "Terisuke"
category: "engineering"
tags: ["多言語化", "i18n", "Astro", "Claude Code", "自動化", "Gemini API"]
image:
  url: "/images/blog/ko-404.avif"
  alt: "韓国語ブログ404ページ"
lang: "ko"
featured: true
isDraft: false
translationSourceHash: "7586bfc2c8375645439c90fb49b1669b1cc49c8f3ac391a4d605e79a6bc1ecb6"
translatedAt: "2026-09-27T15:04:04.309Z"
translationModel: "adopted-legacy"
---

# 【완전 5개 언어 지원】 영일 이중 언어만 지원하던 블로그를 중한서까지 확장한 격렬한 3시간 분투기

"5개 국어 지원이라고 쓰여 있잖아요!"

목요일 오후, 별 생각 없이 사이트의 Develop 브랜치의 구현을 보고 있을 때였습니다. Cursor Agent에게 요청한 대로 언어 전환 버튼에는 분명 5개의 국기가 나란히 놓여 있었습니다. 하지만 중국어로 블로그 페이지를 열어보니...

![404 에러가 표시되는 중국어 블로그 페이지](/images/blog/404.avif)

**404 Not Found.**

조사해 보니 충격적인 사실이 밝혀졌습니다.

## 5개 언어 지원이라는 이름의 2개 언어 지원

```typescript
// utils/i18n.ts 에는 분명 5개 언어 번역이...
export type Locale = 'ja' | 'en' | 'zh' | 'ko' | 'es';
```

i18n 설정을 보면 분명 5개 언어를 지원하고 있습니다. 메인 페이지도, 회사 개요도 모두 제대로 번역되어 있습니다. 하지만...

```bash
$ ls src/pages/*/blog/
src/pages/en/blog/:
[...page].astro  [...slug].astro

src/pages/zh/blog/:
ls: src/pages/zh/blog/: No such file or directory

src/pages/ko/blog/:
ls: src/pages/ko/blog/: No such file or directory

src/pages/es/blog/:
ls: src/pages/es/blog/: No such file or directory
```

**블로그만 영일 이중 언어만 지원하고 있었습니다.**

![디렉토리 구조를 확인하는 모습](/images/blog/keyboardclasher.avif)

## Claude Code와 함께 시작한 초고속 구현

이대로라면 남은 3개 언어도 구현해야 합니다. 다행히 Claude Code가 있습니다. 즉시 구현을 시작했습니다.

### 단계 1: 블로그 페이지 복제 및 수정

우선 영어판 블로그 페이지를 복사하여 각 언어에 맞게 수정합니다.

```bash
# 중국어, 한국어, 스페인어 디렉토리 생성
for lang in zh ko es; do
  mkdir -p src/pages/$lang/blog/
  cp -r src/pages/en/blog/* src/pages/$lang/blog/
done
```

하지만 이것만으로는 작동하지 않습니다. 각 파일 내의 언어 필터를 수정해야 합니다.

```typescript
// 수정 전 (모든 파일 공통)
const allPosts = await getCollection('blog', ({ data }) => {
  return data.lang === 'en' && !data.isDraft;
});

// 수정 후 (예: 중국어 버전)
const allPosts = await getCollection('blog', ({ data }) => {
  return data.lang === 'zh' && !data.isDraft;
});
```

### 단계 2: 최강의 번역 스크립트 제작

8개의 일본어 기사를 수동으로 번역하는 것은 현실적이지 않습니다. 그래서 Gemini API를 사용한 자동 번역 스크립트를 만들었습니다.

```javascript
// scripts/translate-blog-all-languages.js
const LANGUAGES = {
  en: { name: 'English', author: 'Terisuke' },
  zh: { name: 'Chinese', author: 'Terisuke' },
  ko: { name: 'Korean', author: 'Terisuke' },
  es: { name: 'Spanish', author: 'Terisuke' }
};

async function translateToLanguage(inputFile, targetLang, body, frontmatter) {
  console.log(`📝 Translating to ${LANGUAGES[targetLang].name}...`);

  // 제목과 description 번역
  const titleAndDescription = `Title: ${frontmatter.title}\nDescription: ${frontmatter.description}`;
  const translatedTitleDesc = await translateWithGemini(titleAndDescription, targetLang);

  // 본문 번역
  const translatedBody = await translateWithGemini(body, targetLang);

  // 파일 저장
  saveTranslatedFile(targetLang, translatedContent);
}
```

https://github.com/Cor-Incorporated/corsweb2024/blob/52f7f174d7f2b32cd655b5d3c0e786cf137ab9fa/scripts/translate-blog-all-languages.js

### 단계 3: 오류와의 사투

번역 스크립트를 실행하고 의기양양하게 사이트를 확인했는데...

```bash
$ npm run build
✘ [ERROR] Expected "}" but found "."
  script:/ProductsTable.astro:3:33:
    3 │   buttonTexts: {t.buttonTexts},
      ╵                ^
```

**빌드 오류의 폭풍.**

![오류 로그 더미](/images/blog/naniittenda.avif)

## 버그 수정의 연속

### 문제 1: ProductsTable.astro의 알 수 없는 디버깅 코드

```javascript
// 어째서인지 들어가 있던 알 수 없는 디버깅 코드
<script>
  console.log('Button text debug:', {
    buttonTexts: {t.buttonTexts},  // ← 이것이 문법 오류
    goTo: {t.buttonTexts?.goTo},
    itemName: {item.name}
  });
</script>
```

이 디버깅 코드를 삭제하여 해결했습니다.

### 문제 2: CategoryBadge 언어 지원 누락

```typescript
// 수정 전
const categoryLabels = {
  ja: { 'ai': 'AI', 'engineering': 'エンジニアリング', ... },
  en: { 'ai': 'AI', 'engineering': 'Engineering', ... },
  // zh, ko, es 가 존재하지 않음!
};

// 수정 후
const categoryLabels = {
  ja: { ... },
  en: { ... },
  zh: { 'ai': '人工智能', 'engineering': '工程', ... },
  ko: { 'ai': 'AI', 'engineering': '엔지니어링', ... },
  es: { 'ai': 'IA', 'engineering': 'Ingeniería', ... },
};
```

### 문제 3: PostCard 링크가 모두 영어로 이동

```typescript
// 수정 전
const postUrl = currentLocale === 'ja'
  ? `/blog/${cleanSlug}`
  : `/en/blog/${cleanSlug}`;  // 다른 언어에서도 /en/으로 이동함!

// 수정 후
const postUrl = currentLocale === 'ja'
  ? `/blog/${cleanSlug}`
  : `/${currentLocale}/blog/${cleanSlug}`;
```

### 문제 4: 번역은 되었으나 제목이 일본어로 유지됨

가장 골치 아팠던 부분입니다. 번역 스크립트는 정상적으로 작동하는 것으로 보였지만, frontmatter의 title과 description이 일본어로 남아 있었습니다...

```yaml
# 중국어 기사인데...
---
title: "【爆速15分】MCPサーバーでMCPサーバーを作る！"  # 일본어!
description: "LT中止の絶望から生まれた奇跡..."  # 일본어!
lang: "zh"
---

# 【闪电15分钟】用MCP服务器构建MCP服务器！  # 본문은 중국어
```

원인을 조사한 결과, 번역 스크립트의 파싱 처리에 버그가 있음을 발견했습니다. 수정용 스크립트를 별도로 만들어 대응했습니다.

```javascript
// scripts/fix-translated-frontmatter.cjs
function extractTitleFromBody(body) {
  const lines = body.split('\n');
  for (const line of lines) {
    if (line.startsWith('# ')) {
      return line.substring(2).trim();  // 본문의 첫 번째 제목에서 추출
    }
  }
  return null;
}
```

## 격렬한 3시간의 성과

처음 오류를 발견한 시점부터 약 3시간. 마침내 모든 문제를 해결했습니다.

### 구현한 기능 목록

- ✅ 중국어, 한국어, 스페인어 블로그 페이지 생성
- ✅ 카테고리 페이지 5개 언어 지원
- ✅ 태그 페이지 5개 언어 지원
- ✅ RSS 피드 5개 언어 지원
- ✅ 결제 성공/취소 페이지 5개 언어 지원
- ✅ 기존 8개 기사 x 3개 언어 = 24개 기사 자동 번역
- ✅ 모든 TypeScript 오류 해소
- ✅ 빌드 성공 (317 페이지)

![완성된 중국어 블로그](/images/blog/zh.avif)
![완성된 한국어 블로그](/images/blog/ko.avif)
![완성된 스페인어 블로그](/images/blog/es.avif)

### 번역 품질

Gemini API를 통한 번역은 예상보다 훨씬 고품질이었습니다.

```text
일본어: 「いい感じにアレしとくアプリ」開発秘話
중국어: "随心所欲处理应用"开发秘辛
한국어: '적당히 알아서 해주는 앱' 개발 비화
스페인어: La historia detrás de la aplicación 'Hazlo bien y ya'
```

각 언어의 뉘앙스를 제대로 파악한 자연스러운 번역이었습니다.

## 배운 점

### 1. '지원'의 정의는 모호하다

'5개 언어 지원'이라고 해도 실제로 어디까지 지원하는지는 조사해 보아야 알 수 있습니다. 이번처럼 메인 페이지는 지원해도 블로그는 지원하지 않는 경우는 의외로 많을 수 있습니다.

### 2. Claude Code와의 협업의 위력

3시간 만에 5개 언어 x 8개 기사 구현을 완료할 수 있었던 것은 Claude Code의 존재가 컸습니다. 특히 다음과 같은 점에서 도움이 되었습니다.

- 오류 메시지에서 원인을 즉시 파악
- 수정 패턴을 학습하여 유사한 수정을 일괄 적용
- 번역 스크립트의 로직을 효율적으로 구현

### 3. 자동화 스크립트는 정의다

수동으로 24개 기사를 번역했다면 아마 1주일은 걸렸을 것입니다. 자동화 스크립트를 만드는 데 1시간을 투자하더라도 그 이상의 보상이 있습니다.

### 4. 오류는 보물산이다

이번에 겪은 오류들은 시스템의 잠재적인 문제를 발견하는 좋은 기회가 되었습니다. 특히 CategoryBadge의 언어 지원 누락은 언젠가 문제가 되었을 것입니다.

## 요약: 진정한 다국어 지원으로

당초 '5개 언어 지원 완료'라고 생각했던 사이트가 사실은 '흉내만 낸 5개 언어 지원'이었다는 충격적인 사실. 하지만 Claude Code와 함께 싸운 3시간 동안 진정한 5개 언어 지원을 실현할 수 있었습니다.

이제 중국어, 한국어, 스페인어 어디든 블로그 기사가 제대로 표시됩니다. 404 오류는 더 이상 표시되지 않습니다.

이것이 진정한 다국어 지원입니다.

---

*구현한 코드는 GitHub에 공개되어 있습니다. 번역 스크립트는 다른 Astro 프로젝트에서도 사용할 수 있을 것입니다.*

https://github.com/Cor-Incorporated/corsweb2024

*Claude Code와 함께 싸운 3시간. 그것은 격렬하면서도 보람 있는 시간이었습니다.*
