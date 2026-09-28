---
title: "완전 마크다운 가이드: 블로그 게시물 작성의 모든 것"
description: "Cor.inc 블로그에서 사용할 수 있는 마크다운 구문 및 풍부한 콘텐츠 기능에 대한 완전한 가이드입니다. 링크 카드, 수식, 코드 하이라이트 등 아름다운 게시물을 만들기 위한 모든 기능을 다룹니다."
pubDate: 2025-01-21
author: "Terisuke"
category: "lab"
tags: ["Markdown", "ブログ", "執筆", "技術文書", "ガイド"]
lang: "ko"
featured: true
translationSourceHash: "dbecd1e75a0534d9b057e76963572d2d50d8a1ffc53ee3eb506947308821ccd1"
translatedAt: "2026-09-28T06:09:16.016Z"
translationModel: "adopted-legacy"
---

# 완벽 마크다운 가이드: 블로그 게시물 작성의 모든 것

이 가이드에서는 Cor.inc 블로그에서 사용할 수 있는 모든 마크다운 구문 및 풍부한 콘텐츠 기능을 소개합니다. 아름답고 읽기 쉬운 게시물을 만들기 위한 모든 테크닉을 담았습니다. 마크다운 마스터로 가는 길은 여기서 시작됩니다.

## 기본적인 마크다운 구문

### 제목

```markdown
# 제목1 (H1)
## 제목2 (H2)
### 제목3 (H3)
#### 제목4 (H4)
```

### 텍스트 서식

```markdown
**볼드 텍스트**
*기울임꼴 텍스트*
~~취소선~~
`인라인 코드`
```

**볼드 텍스트**
*기울임꼴 텍스트*
~~취소선~~
`인라인 코드`

### 목록

#### 순서 없는 목록

```markdown
- 항목1
- 항목2
  - 하위 항목2.1
  - 하위 항목2.2
- 항목3
```

- 항목1
- 항목2
  - 하위 항목2.1
  - 하위 항목2.2
- 항목3

#### 순서 있는 목록

```markdown
1. 첫 번째 항목
2. 두 번째 항목
3. 세 번째 항목
```

1. 첫 번째 항목
2. 두 번째 항목
3. 세 번째 항목

#### 작업 목록

```markdown
- [x] 완료된 작업
- [ ] 미완료된 작업
- [ ] 다른 미완료 작업
```

- [x] 완료된 작업
- [ ] 미완료된 작업
- [ ] 다른 미완료 작업

## 코드 블록

### 기본적인 코드 블록

```markdown
\`\`\`javascript
function greet(name) {
  console.log(`Hello, ${name}!`);
}

greet('World');
\`\`\`
```

### 실제 표시 예시

```javascript
function greet(name) {
  console.log(`Hello, ${name}!`);
}

greet('World');
```

### 지원 언어

- JavaScript/TypeScript
- Python
- HTML/CSS
- Bash/Shell
- JSON/YAML
- Markdown
- 그 외 다수

```python
# Python 예시
def calculate_fibonacci(n):
    if n <= 1:
        return n
    return calculate_fibonacci(n-1) + calculate_fibonacci(n-2)

print(calculate_fibonacci(10))
```

```bash
# Bash 예시
#!/bin/bash
npm run build
npm run deploy
```

## 표 (테이블)

```markdown
| 항목 | 설명 | 가격 |
|------|------|------|
| 상품A | 고품질 상품 | 1,000엔 |
| 상품B | 합리적인 가격 | 500엔 |
| 상품C | 프리미엄 | 2,000엔 |
```

| 항목 | 설명 | 가격 |
|------|------|------|
| 상품A | 고품질 상품 | 1,000엔 |
| 상품B | 합리적인 가격 | 500엔 |
| 상품C | 프리미엄 | 2,000엔 |

### 표 정렬

```markdown
| 왼쪽 정렬 | 가운데 정렬 | 오른쪽 정렬 |
|:-------|:--------:|-------:|
| Left | Center | Right |
| L | C | R |
```

| 왼쪽 정렬 | 가운데 정렬 | 오른쪽 정렬 |
|:-------|:--------:|-------:|
| Left | Center | Right |
| L | C | R |

## 인용

```markdown
> 이것은 인용문입니다.
> 여러 줄에 걸쳐
> 인용할 수 있습니다.

> **중요한 인용**
> 
> 인용문 안에서도 **마크다운 구문**을 사용할 수 있습니다.
```

> 이것은 인용문입니다.
> 여러 줄에 걸쳐
> 인용할 수 있습니다.

> **중요한 인용**
> 
> 인용문 안에서도 **마크다운 구문**을 사용할 수 있습니다.

## 링크와 이미지

### 기본적인 링크

```markdown
[Cor.inc 공식 웹사이트](https://cor-jp.com)
[문의하기](/contact)
```

[Cor.inc 공식 웹사이트](https://cor-jp.com)
[문의하기](/contact)

### 이미지

```markdown
![대체 텍스트](/images/example.jpg)
![설명문](/images/example.jpg "제목")
```

## 수식 (KaTeX)

### 인라인 수식

```markdown
원의 넓이는 $A = \pi r^2$로 계산할 수 있습니다.
```

원의 넓이는 $A = \pi r^2$로 계산할 수 있습니다.

### 블록 수식

```markdown
$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$
```

$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$

### 복잡한 수식 예시

```markdown
$$
\begin{aligned}
\nabla \times \vec{\mathbf{B}} -\, \frac1c\, \frac{\partial\vec{\mathbf{E}}}{\partial t} &= \frac{4\pi}{c}\vec{\mathbf{j}} \\
\nabla \cdot \vec{\mathbf{E}} &= 4 \pi \rho \\
\nabla \times \vec{\mathbf{E}}\, +\, \frac1c\, \frac{\partial\vec{\mathbf{B}}}{\partial t} &= \vec{\mathbf{0}} \\
\nabla \cdot \vec{\mathbf{B}} &= 0
\end{aligned}
$$
```

$$
\begin{aligned}
\nabla \times \vec{\mathbf{B}} -\, \frac1c\, \frac{\partial\vec{\mathbf{E}}}{\partial t} &= \frac{4\pi}{c}\vec{\mathbf{j}} \\
\nabla \cdot \vec{\mathbf{E}} &= 4 \pi \rho \\
\nabla \times \vec{\mathbf{E}}\, +\, \frac1c\, \frac{\partial\vec{\mathbf{B}}}{\partial t} &= \vec{\mathbf{0}} \\
\nabla \cdot \vec{\mathbf{B}} &= 0
\end{aligned}
$$

## 리치 링크 카드

### 사용 방법

URL을 단독으로 작성하면, 자동으로 풍부한 미리보기 카드가 생성됩니다. 마법 같지만, 사실은 remark-link-card-plus의 기능입니다:

```markdown
https://cor-jp.com/

https://github.com

https://docs.astro.build
```

### 표시 예시

https://cor-jp.com/

https://github.com

https://docs.astro.build

### 기능

- **자동 메타데이터 가져오기**: 제목, 설명, 파비콘을 자동으로 가져옵니다.
- **OG 이미지 표시**: 웹사이트의 썸네일 이미지를 표시합니다.
- **캐시 기능**: 한번 가져온 정보는 로컬에 캐시됩니다.
- **반응형**: 데스크톱 및 모바일 모두 지원합니다.
- **다크 모드**: 테마에 따라 자동으로 조정됩니다.

## 수평선

```markdown
---
```

---

## 이스케이프 문자

마크다운 구문으로 해석되지 않기를 바라는 문자는 백슬래시(\)로 이스케이프합니다. 이를 모르면 의도치 않은 표시가 되어 낭패를 볼 수 있습니다:

```markdown
\*이것은 기울임꼴이 되지 않습니다\*
\`이것은 코드가 되지 않습니다\`
\# 이것은 제목이 되지 않습니다
```

\*이것은 기울임꼴이 되지 않습니다\*
\`이것은 코드가 되지 않습니다\`
\# 이것은 제목이 되지 않습니다

## 프론트매터

게시물 상단에는 메타데이터를 설정하는 프론트매터를 작성합니다. 이것을 잊으면 Astro가 오류를 내며 경고할 것입니다:

```yaml
---
title: "게시물 제목"
description: "게시물 설명"
pubDate: 2025-01-21
author: "Terisuke"
category: "lab"
tags: ["tag1", "tag2", "tag3"]
# image:
#   url: "/images/blog/example.avif"
#   alt: "이미지 설명"
lang: "ja"
featured: true
---
```

### 카테고리 목록

- `ai-driven-futures`: AI 기반 미래
- `high-performance-engineering`: 고성능 엔지니어링
- `founders-journey`: 창업자의 여정
- `tech-lab-creativity`: 테크랩 창의성

## 모범 사례

### 1. 구조화된 제목

```markdown
# 메인 제목 (H1은 자동 생성)

## 큰 섹션 (H2)

### 하위 섹션 (H3)

#### 상세 항목 (H4)
```

### 2. 읽기 쉬운 코드

- 코드 블록에는 적절한 언어 지정을 사용합니다 (구문 강조는 독자에게 친절합니다).
- 긴 코드는 논리적인 단위로 분할합니다 (아무도 100줄의 코드를 한 번에 읽고 싶어 하지 않습니다).
- 주석으로 설명을 추가합니다 (미래의 자신에게 보내는 편지입니다).

### 3. 효과적인 링크 카드

- 관련성 있는 URL만 링크 카드로 만듭니다.
- 게시물 끝에 참고 링크 섹션을 만듭니다.
- 외부 링크는 신뢰할 수 있는 소스를 선택합니다.

### 4. 시각적 요소

- 표를 사용하여 정보를 정리합니다.
- 인용문을 사용하여 중요한 포인트를 강조합니다.
- 수평선으로 섹션을 구분합니다.

## 문제 해결

### 일반적인 문제

1. **링크 카드가 표시되지 않음**
   - URL이 단독 행에 있는지 확인합니다.
   - HTTPS로 시작하는지 확인합니다.
   - 웹사이트에 접속 가능한지 확인합니다.

2. **수식이 표시되지 않음**
   - `$` 기호 앞뒤에 공백이 있는지 확인합니다.
   - 특수 문자 이스케이프를 확인합니다.

3. **코드 강조가 작동하지 않음**
   - 언어 이름의 오타를 확인합니다.
   - 백틱(`)의 개수를 확인합니다.

## 요약

이 가이드에서 소개한 기능을 활용하면 읽기 쉽고 아름다운 블로그 게시물을 만들 수 있습니다. 특히 링크 카드 기능은 독자에게 유익한 참고 자료를 시각적으로 매력적인 형태로 제공하는 강력한 기능입니다. URL을 작성하는 것만으로 카드가 나타나는 것은 마치 마법사가 된 기분입니다.

게시물을 작성할 때는 다음 체크리스트를 활용하세요:

- [ ] 프론트매터가 올바르게 설정되었는지 (Astro에 오류가 나지 않도록)
- [ ] 제목 구조가 논리적인지 (독자가 길을 잃지 않도록)
- [ ] 코드 블록에 적절한 언어 지정이 있는지 (아름다운 강조를 위해)
- [ ] 링크 카드가 올바르게 표시되는지 (멋을 위해)
- [ ] 수식이 올바르게 표시되는지 (수학자도 만족)
- [ ] 이미지의 alt 속성이 설정되었는지 (접근성은 중요합니다)

---

*이 가이드에 대해 질문이 있다면, [문의하기](/contact)로 연락해 주세요. 마크다운 마스터로 가는 길을 함께 걸어갑시다.*
