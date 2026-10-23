---
title: "완전 마크다운 가이드: 블로그 글 작성의 모든 것"
description: "Cor.주식회사의 블로그에서 사용할 수 있는 마크다운 문법과 리치 콘텐츠 기능의 완전 가이드. 링크 카드, 수식, 코드 하이라이트 등 아름다운 글을 작성하기 위한 모든 기능을 망라"
summary: "Cor.주식회사의 블로그에서 사용할 수 있는 마크다운 문법과 링크 카드, 수식, 코드 하이라이트 등의 기능을 작성법 및 표시 예시와 함께 정리했다. URL을 단독으로 작성하면 링크 카드가 된다. 글을 작성할 때는 프론트매터와 제목 구조 등을 체크리스트로 확인한다."
pubDate: 2025-01-21
updatedDate: 2026-10-23
author: "Terisuke"
category: "lab"
tags: ["Markdown", "ブログ", "執筆", "技術文書", "ガイド"]
lang: "ko"
featured: true
translationSourceHash: "53582241983b96f366bf691edf6d87f76d0530f50e5090d0c45cae32999014c5"
translatedAt: "2026-10-23T06:21:50.613Z"
translationModel: "gemini-3.8-flash"
---

# 완전 마크다운 가이드: 블로그 글 작성의 모든 것

이 가이드에서는 Cor.주식회사의 블로그에서 사용할 수 있는 마크다운 문법과 리치 콘텐츠 기능을 모두 소개한다. 아름답고 읽기 쉬운 글을 작성하기 위한 테크닉을 남김없이 담아냈다. 마크다운 마스터로 가는 길은 여기서 시작된다.

## 기본적인 마크다운 문법

### 제목 (Heading)

```markdown
# 見出し1 (H1)
## 見出し2 (H2)
### 見出し3 (H3)
#### 見出し4 (H4)
```

### 텍스트 서식

```markdown
**太字テキスト**
*斜体テキスト*
~~取り消し線~~
`インラインコード`
```

**굵은 텍스트**
*기울임 텍스트*
~~취소선~~
`インラインコード`

### 목록

#### 순서 없는 목록

```markdown
- 項目1
- 項目2
  - サブ項目2.1
  - サブ項目2.2
- 項目3
```

- 항목 1
- 항목 2
  - 하위 항목 2.1
  - 하위 항목 2.2
- 항목 3

#### 순서 있는 목록

```markdown
1. 最初の項目
2. 二番目の項目
3. 三番目の項目
```

1. 첫 번째 항목
2. 두 번째 항목
3. 세 번째 항목

#### 할 일 목록 (Task List)

```markdown
- [x] 完了したタスク
- [ ] 未完了のタスク
- [ ] 別の未完了タスク
```

- [x] 완료된 작업
- [ ] 미완료 작업
- [ ] 또 다른 미완료 작업

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
- 기타 다수

```python
# Python例
def calculate_fibonacci(n):
    if n <= 1:
        return n
    return calculate_fibonacci(n-1) + calculate_fibonacci(n-2)

print(calculate_fibonacci(10))
```

```bash
# Bash例
#!/bin/bash
npm run build
npm run deploy
```

## 표 (테이블)

```markdown
| 項目 | 説明 | 価格 |
|------|------|------|
| 商品A | 高品質な商品 | ¥1,000 |
| 商品B | お手頃価格 | ¥500 |
| 商品C | プレミアム | ¥2,000 |
```

| 항목 | 설명 | 가격 |
|------|------|------|
| 상품 A | 고품질 상품 | ¥1,000 |
| 상품 B | 합리적인 가격 | ¥500 |
| 상품 C | 프리미엄 | ¥2,000 |

### 표 정렬

```markdown
| 左寄せ | 中央揃え | 右寄せ |
|:-------|:--------:|-------:|
| Left | Center | Right |
| L | C | R |
```

| 왼쪽 정렬 | 가운데 정렬 | 오른쪽 정렬 |
|:-------|:--------:|-------:|
| Left | Center | Right |
| L | C | R |

## 인용구

```markdown
> これは引用文です。
> 複数行にわたって
> 引用することができます。

> **重要な引用**
> 
> 引用の中で**マークダウン記法**も使用できます。
```

> 이것은 인용문입니다.
> 여러 줄에 걸쳐
> 인용할 수 있습니다.

> **중요한 인용**
> 
> 인용문 안에서도 **마크다운 문법**을 사용할 수 있습니다.

## 링크 및 이미지

### 기본적인 링크

```markdown
[Cor.inc公式サイト](https://cor-jp.com)
[お問い合わせ](/contact)
```

[Cor.주식회사 공식 사이트](https://cor-jp.com)
[문의하기](/contact)

### 이미지

```markdown
![Alt text](/images/example.jpg)
![説明文](/images/example.jpg "タイトル")
```

## 수식 (KaTeX)

### 인라인 수식

```markdown
円の面積は $A = \pi r^2$ で計算できます。
```

원의 넓이는 $A = \pi r^2$ 로 계산할 수 있습니다.

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

URL을 단독으로 작성하기만 하면 리치 미리보기 카드가 자동으로 생성된다. 마법 같지만, 사실 remark-link-card-plus의 작동 덕분이다.

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

- 자동 메타데이터 가져오기: 제목, 설명문, 파비콘을 자동으로 가져온다
- OG 이미지 표시: 웹사이트의 썸네일 이미지를 표시한다
- 캐시 기능: 한 번 가져온 정보는 로컬에 캐시한다
- 반응형: 데스크톱과 모바일 모두 지원한다
- 다크 모드: 테마에 맞춰 자동으로 조정된다

## 구분선

```markdown
---
```

---

## 이스케이프 문자

마크다운 문법으로 해석되지 않도록 하려는 문자는 백슬래시로 이스케이프한다. 이를 모르면 의도치 않은 표시로 낭패를 볼 수 있다.

```markdown
\*これは斜体になりません\*
\`これはコードになりません\`
\# これは見出しになりません
```

\*이 텍스트는 기울임꼴이 되지 않습니다\*
\`이 텍스트는 코드가 되지 않습니다\`
\# 이 텍스트는 제목이 되지 않습니다

## 프런트매터 (Frontmatter)

글의 서두에는 메타데이터를 설정하는 프런트매터를 작성한다. 이를 빠뜨리면 Astro가 오류를 뱉어내며 화를 낸다.

```yaml
---
title: "記事のタイトル"
description: "記事の説明文"
pubDate: 2025-01-21
author: "Terisuke"
category: "lab"
tags: ["tag1", "tag2", "tag3"]
# image:
#   url: "/images/blog/example.avif"
#   alt: "画像の説明"
lang: "ja"
featured: true
---
```

### 카테고리 목록

- `ai-driven-futures`: AI 기반 미래
- `high-performance-engineering`: 고성능 엔지니어링
- `founders-journey`: 창업자의 궤적
- `tech-lab-creativity`: 테크 랩의 창의성

## 모범 사례 (Best Practices)

### 1. 구조화된 제목

```markdown
# メインタイトル (H1は自動生成)

## 大きなセクション (H2)

### サブセクション (H3)

#### 詳細項目 (H4)
```

### 2. 읽기 쉬운 코드

- 코드 블록에는 적절한 언어를 지정한다 (구문 강조는 독자의 눈을 편안하게 한다)
- 긴 코드는 논리적인 단위로 분할한다 (아무도 100줄짜리 코드를 한 번에 읽고 싶어 하지 않는다)
- 주석으로 설명을 추가한다 (미래의 나에게 보내는 편지다)

### 3. 효과적인 링크 카드

- 관련성이 높은 URL만 링크 카드로 만든다
- 글의 마지막에 "참고 자료" 섹션을 마련한다
- 외부 링크는 신뢰할 수 있는 소스를 선택한다

### 4. 시각적 요소

- 표를 사용하여 정보를 정리한다
- 인용구로 중요한 포인트를 강조한다
- 구분선으로 섹션을 나눈다

## 문제 해결 (Troubleshooting)

### 자주 묻는 문제

1. 링크 카드가 표시되지 않는다
   - URL이 단독 행에 있는지 확인
   - HTTPS로 시작하는지 확인
   - 웹사이트에 접속할 수 있는지 확인

2. 수식이 표시되지 않는다
   - `$` 기호 앞뒤에 공백이 없는지 확인
   - 특수 문자 이스케이프 확인

3. 코드 하이라이트가 적용되지 않는다
   - 언어명의 맞춤법 확인
   - 백틱(`) 개수 확인

## 정리

이 가이드에서 소개한 기능을 활용하면 읽기 쉽고 아름다운 블로그 글을 작성할 수 있다. 특히 링크 카드는 독자에게 유용한 참고 자료를 시각적으로도 매력적인 형태로 보여줄 수 있는 강력한 기능이다. URL을 적는 것만으로 카드가 나타난다니, 마치 마법사가 된 기분이다.

글을 작성할 때는 다음 체크리스트를 활용해 보자.

- [ ] 프런트매터가 올바르게 설정되어 있는가 (Astro가 화내지 않도록)
- [ ] 제목 구조가 논리적인가 (독자가 길을 잃지 않도록)
- [ ] 코드 블록에 적절한 언어 지정이 되어 있는가 (아름다운 하이라이트를 위해)
- [ ] 링크 카드가 올바르게 표시되는가 (멋진 디자인을 위해)
- [ ] 수식이 올바르게 표시되는가 (수학자도 만족)
- [ ] 이미지의 alt 속성이 설정되어 있는가 (접근성은 중요)
