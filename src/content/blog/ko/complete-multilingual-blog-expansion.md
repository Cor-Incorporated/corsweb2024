---
title: "【완전 5개 언어 대응】일·영 전용이었던 블로그를 중·한·서까지 확장한 노도의 3시간 분투기"
description: "5개 언어 대응인 줄 알았더니 사실 2개 언어뿐이었다는 충격적인 사실. Claude Code와 함께 중국어·한국어·스페인어 대응을 초고속으로 구현한 전체 기록"
summary: "5개 언어를 지원해야 할 사이트에서 블로그만 일본어와 영어만 지원하고 있었습니다. Claude Code와 함께 약 3시간 만에 중국어·한국어·스페인어 페이지를 제작하고, 기존 8개 기사를 Gemini API로 번역하며 빌드 오류를 해결했습니다. '지원하고 있다'의 실제 내용은 직접 확인해 보기 전에는 알 수 없습니다."
pubDate: 2025-09-25
updatedDate: 2026-10-23
author: "Terisuke"
category: "engineering"
tags: ["多言語化", "i18n", "Astro", "Claude Code", "自動化", "Gemini API"]
image:
  url: "/images/blog/ko-404.avif"
  alt: "한국어 블로그 404 페이지"
lang: "ko"
featured: true
isDraft: false
translationSourceHash: "772589688a81666ca3dff4dff9d0215ef52dad0a70360fe768f0873b4d940fc3"
translatedAt: "2026-10-23T06:22:10.122Z"
translationModel: "gemini-3.8-flash"
---

# 【완전 5개 언어 대응】일·영 전용이었던 블로그를 중·한·서까지 확장한 노도의 3시간 분투기

"5개 국어 대응이라고 쓰여 있잖아요!"

목요일 오후 무렵, 무심코 사이트의 Develop 브랜치 구현을 살펴보고 있었을 때의 일이다. Cursor Agent에 요청한 대로 언어 전환 버튼에는 분명히 5개의 국기가 나란히 놓여 있었다. 하지만 중국어로 블로그 페이지를 열어 보았다.

![404 에러가 표시되는 중국어 블로그 페이지](/images/blog/404.avif)

**404 Not Found**.

확인해 보니 충격적인 사실을 알게 되었다.

## 5개 언어 대응이라는 이름의 2개 언어 대응

```typescript
// utils/i18n.ts には確かに5言語の翻訳が...
export type Locale = 'ja' | 'en' | 'zh' | 'ko' | 'es';
```

i18n 설정을 보는 한, 분명히 5개 언어를 대응하고 있다. 메인 페이지도, 회사 소개도 전부 제대로 번역되어 있다. 하지만 블로그 페이지의 디렉터리를 살펴보았다.

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

**블로그만 일·영밖에 대응하지 않고 있었다**.

![디렉터리 구조를 확인하는 모습](/images/blog/keyboardclasher.avif)

## Claude Code와의 초고속 구현 개시

이렇게 된 이상, 나머지 3개 언어도 구현할 수밖에 없다. 다행히 Claude Code가 있다. 곧바로 구현을 시작했다.

### 스텝 1: 블로그 페이지 복제 및 수정

우선 영문판 블로그 페이지를 복사하여 각 언어용으로 수정한다.

```bash
# 中国語、韓国語、スペイン語のディレクトリを作成
for lang in zh ko es; do
  mkdir -p src/pages/$lang/blog/
  cp -r src/pages/en/blog/* src/pages/$lang/blog/
done
```

하지만 이것만으로는 동작하지 않는다. 각 파일 내의 언어 필터를 수정해야 한다.

```typescript
// 修正前（全ファイル共通）
const allPosts = await getCollection('blog', ({ data }) => {
  return data.lang === 'en' && !data.isDraft;
});

// 修正後（例：中国語版）
const allPosts = await getCollection('blog', ({ data }) => {
  return data.lang === 'zh' && !data.isDraft;
});
```

### 스텝 2: 번역 스크립트 작성

8개의 일본어 기사를 수동으로 번역하는 것은 현실적이지 않다. 그래서 Gemini API를 활용한 자동 번역 스크립트를 작성했다.

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

  // タイトルとdescriptionを翻訳
  const titleAndDescription = `Title: ${frontmatter.title}\nDescription: ${frontmatter.description}`;
  const translatedTitleDesc = await translateWithGemini(titleAndDescription, targetLang);

  // 本文を翻訳
  const translatedBody = await translateWithGemini(body, targetLang);

  // ファイルを保存
  saveTranslatedFile(targetLang, translatedContent);
}
```

https://github.com/Cor-Incorporated/corsweb2024/blob/52f7f174d7f2b32cd655b5d3c0e786cf137ab9fa/scripts/translate-blog-all-languages.js

### 스텝 3: 에러와의 사투

번역 스크립트를 실행하고, 의기양양하게 사이트를 확인하려 했다.

```bash
$ npm run build
✘ [ERROR] Expected "}" but found "."
  script:/ProductsTable.astro:3:33:
    3 │   buttonTexts: {t.buttonTexts},
      ╵                ^
```

**빌드 에러의 폭풍**.

![에러 로그의 산](/images/blog/naniittenda.avif)

## 버그 수정의 연속

### 문제 1: ProductsTable.astro의 의문의 디버그 코드

```javascript
// なぜか入っていた謎のデバッグコード
<script>
  console.log('Button text debug:', {
    buttonTexts: {t.buttonTexts},  // ← これが構文エラー
    goTo: {t.buttonTexts?.goTo},
    itemName: {item.name}
  });
</script>
```

이 디버그 코드를 삭제하여 해결했다.

### 문제 2: CategoryBadge의 언어 대응 누락

```typescript
// 修正前
const categoryLabels = {
  ja: { 'ai': 'AI', 'engineering': 'エンジニアリング', ... },
  en: { 'ai': 'AI', 'engineering': 'Engineering', ... },
  // zh, ko, es が存在しない！
};

// 修正後
const categoryLabels = {
  ja: { ... },
  en: { ... },
  zh: { 'ai': '人工智能', 'engineering': '工程', ... },
  ko: { 'ai': 'AI', 'engineering': '엔지니어링', ... },
  es: { 'ai': 'IA', 'engineering': 'Ingeniería', ... },
};
```

### 문제 3: PostCard의 링크가 전부 영어로 이동함

```typescript
// 修正前
const postUrl = currentLocale === 'ja'
  ? `/blog/${cleanSlug}`
  : `/en/blog/${cleanSlug}`;  // 他の言語でも/en/に飛んでしまう！

// 修正後
const postUrl = currentLocale === 'ja'
  ? `/blog/${cleanSlug}`
  : `/${currentLocale}/blog/${cleanSlug}`;
```

### 문제 4: 번역되었는데 제목이 일본어 그대로임

가장 골치 아팠던 것이 이것이다. 번역 스크립트는 정상적으로 동작하고 있어야 하는데, frontmatter의 title과 description이 일본어 그대로였다.

```yaml
# 中国語の記事なのに...
---
title: "【爆速15分】MCPサーバーでMCPサーバーを作る！"  # 日本語！
description: "LT中止の絶望から生まれた奇跡..."  # 日本語！
lang: "zh"
---

# 【闪电15分钟】用MCP服务器构建MCP服务器！  # 本文は中国語
```

원인을 조사해 보니, 번역 스크립트의 파싱 처리에 버그가 있었다. 수정용 스크립트를 별도로 만들어 대응했다.

```javascript
// scripts/fix-translated-frontmatter.cjs
function extractTitleFromBody(body) {
  const lines = body.split('\n');
  for (const line of lines) {
    if (line.startsWith('# ')) {
      return line.substring(2).trim();  // 本文の最初の見出しから抽出
    }
  }
  return null;
}
```

## 숨 가쁜 3시간의 성과

최초 에러 발견으로부터 약 3시간. 마침내 모든 문제를 해결했다.

### 구현한 기능 목록

- 중국어·한국어·스페인어 블로그 페이지 생성
- 카테고리 페이지의 5개 언어 대응
- 태그 페이지의 5개 언어 대응
- RSS 피드의 5개 언어 대응
- 결제 성공/취소 페이지의 5개 언어 대응
- 기존 8개 기사×3개 언어＝24개 기사 자동 번역
- 모든 TypeScript 에러 해결
- 빌드 성공 (317페이지)

![완성된 중국어 블로그](/images/blog/zh.avif)
![완성된 한국어 블로그](/images/blog/ko.avif)
![완성된 스페인어 블로그](/images/blog/es.avif)


### 번역 품질

Gemini API를 통한 번역은 상상 이상으로 고품질이었다.

```text
日本語: 「いい感じにアレしとくアプリ」開発秘話
中国語: "随心所欲处理应用"开发秘辛
韓国語: '적당히 알아서 해주는 앱' 개발 비화
スペイン語: La historia detrás de la aplicación 'Hazlo bien y ya'
```

각 언어의 뉘앙스를 제대로 살린 자연스러운 번역이 되어 있다.

## 배운 점

### 1. '대응하고 있다'의 정의는 모호하다

'5개 언어 대응'이라고 해도 실제로 어디까지 대응하고 있는지는 확인해 보지 않으면 모른다. 이번처럼 메인 페이지는 대응하고 있어도 블로그는 대응하지 않는 것과 같은 케이스는 의외로 꽤 있을 법하다.

### 2. Claude Code와의 협업의 위력

3시간 만에 5개 언어×8개 기사의 구현을 완료할 수 있었던 것은 Claude Code의 존재가 크다. 특히 다음 부분에서 큰 도움이 되었다.

- 에러 메시지로부터 원인을 즉각 특정
- 수정 패턴을 학습하여 유사한 수정을 일괄 적용
- 번역 스크립트의 로직을 효율적으로 구현

### 3. 자동화 스크립트는 정의다

수동으로 24개 기사를 번역했다면 아마 훨씬 더 오래 걸렸을 것이다. 자동화 스크립트를 만드는 데 1시간을 투자하더라도 그 이상의 리턴이 있다.

### 4. 에러는 보물창고다

이번에 마주친 수많은 에러는 시스템의 잠재적인 문제를 발견할 수 있는 좋은 기회였다. 특히 CategoryBadge의 언어 대응 누락은 언젠가 문제가 되었을 것이 분명하다.

## 요약: 진정한 다국어 대응을 향해

처음에는 '5개 언어 대응 완료'라고 생각했던 사이트가 사실은 '무늬만 5개 언어 대응'이었다는 충격적인 사실. 하지만 Claude Code와 함께 분투한 3시간 동안 진정한 5개 언어 대응을 실현할 수 있었다.

지금은 중국어로도, 한국어로도, 스페인어로도 제대로 블로그 기사가 표시된다. 404 에러는 더 이상 뜨지 않는다.

이것이 진정한 다국어 대응이다.

---

*구현한 코드는 GitHub에 공개되어 있습니다. 번역 스크립트는 다른 Astro 프로젝트에서도 활용할 수 있을 것입니다.*

https://github.com/Cor-Incorporated/corsweb2024

*Claude Code와 함께 싸운 3시간은 숨 가쁘면서도 보람찬 시간이었다.*
