---
title: "完整 Markdown 指南：博客文章撰写的全部内容"
description: "可在 Cor.株式会社 博客中使用的 Markdown 语法与丰富内容功能完整指南。全面涵盖链接卡片、数学公式、代码高亮等用于撰写精美文章的全部功能"
summary: "汇总了可在 Cor.株式会社 博客中使用的 Markdown 语法，以及链接卡片、数学公式、代码高亮等功能的编写方法与展示示例。单独输入 URL 即可生成链接卡片。撰写文章时，请通过检查清单核对 front matter、标题结构等内容。"
pubDate: 2025-01-21
updatedDate: 2026-10-23
author: "Terisuke"
category: "lab"
tags: ["Markdown", "ブログ", "執筆", "技術文書", "ガイド"]
lang: "zh"
featured: true
translationSourceHash: "53582241983b96f366bf691edf6d87f76d0530f50e5090d0c45cae32999014c5"
translatedAt: "2026-10-23T06:18:49.206Z"
translationModel: "gemini-3.8-flash"
---

# 完整 Markdown 指南：博客文章撰写的全部内容

本指南将全面介绍可在 Cor.株式会社 博客中使用的 Markdown 语法和富媒体内容功能。我们倾囊相授，汇集了撰写精美且易读文章的各种技巧。通往 Markdown 大师之路从这里启程。

## 基础 Markdown 语法

### 标题

```markdown
# 見出し1 (H1)
## 見出し2 (H2)
### 見出し3 (H3)
#### 見出し4 (H4)
```

### 文本样式

```markdown
**太字テキスト**
*斜体テキスト*
~~取り消し線~~
`インラインコード`
```

**粗体文本**
*斜体文本*
~~删除线~~
`インラインコード`

### 列表

#### 无序列表

```markdown
- 項目1
- 項目2
  - サブ項目2.1
  - サブ項目2.2
- 項目3
```

- 项目 1
- 项目 2
  - 子项目 2.1
  - 子项目 2.2
- 项目 3

#### 有序列表

```markdown
1. 最初の項目
2. 二番目の項目
3. 三番目の項目
```

1. 第一个项目
2. 第二个项目
3. 第三个项目

#### 任务列表

```markdown
- [x] 完了したタスク
- [ ] 未完了のタスク
- [ ] 別の未完了タスク
```

- [x] 已完成的任务
- [ ] 未完成的任务
- [ ] 另一项未完成的任务

## 代码块

### 基础代码块

```markdown
\`\`\`javascript
function greet(name) {
  console.log(`Hello, ${name}!`);
}

greet('World');
\`\`\`
```

### 实际展示效果

```javascript
function greet(name) {
  console.log(`Hello, ${name}!`);
}

greet('World');
```

### 支持的语言

- JavaScript/TypeScript
- Python
- HTML/CSS
- Bash/Shell
- JSON/YAML
- Markdown
- 以及其他多种语言

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

## 表格

```markdown
| 項目 | 説明 | 価格 |
|------|------|------|
| 商品A | 高品質な商品 | ¥1,000 |
| 商品B | お手頃価格 | ¥500 |
| 商品C | プレミアム | ¥2,000 |
```

| 项目 | 说明 | 价格 |
|------|------|------|
| 商品 A | 高品质商品 | ¥1,000 |
| 商品 B | 实惠价格 | ¥500 |
| 商品 C | 高级版 | ¥2,000 |

### 表格对齐

```markdown
| 左寄せ | 中央揃え | 右寄せ |
|:-------|:--------:|-------:|
| Left | Center | Right |
| L | C | R |
```

| 左对齐 | 居中对齐 | 右对齐 |
|:-------|:--------:|-------:|
| Left | Center | Right |
| L | C | R |

## 引用

```markdown
> これは引用文です。
> 複数行にわたって
> 引用することができます。

> **重要な引用**
> 
> 引用の中で**マークダウン記法**も使用できます。
```

> 这是引用文本。
> 可以跨多行
> 进行引用。

> **重要引用**
> 
> 在引用内部也可以使用 **Markdown 语法**。

## 链接与图片

### 基础链接

```markdown
[Cor.inc公式サイト](https://cor-jp.com)
[お問い合わせ](/contact)
```

[Cor.株式会社官方网站](https://cor-jp.com)
[联系我们](/contact)

### 图片

```markdown
![Alt text](/images/example.jpg)
![説明文](/images/example.jpg "タイトル")
```

## 数学公式（KaTeX）

### 行内公式

```markdown
円の面積は $A = \pi r^2$ で計算できます。
```

圆的面积可以通过 $A = \pi r^2$ 来计算。

### 块级公式

```markdown
$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$
```

$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$

### 复杂公式示例

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

## 富链接卡片

### 使用方法

只需单独写出 URL，系统就会自动生成精美的预览卡片。这看似神奇，实际上是 remark-link-card-plus 的功劳。

```markdown
https://cor-jp.com/

https://github.com

https://docs.astro.build
```

### 展示示例

https://cor-jp.com/

https://github.com

https://docs.astro.build

### 功能特性

- 自动获取元数据：自动获取标题、描述和网站图标（favicon）
- OG 图片展示：显示网站的缩略图
- 缓存功能：将已获取的信息缓存到本地
- 响应式设计：同时适配桌面端和移动端
- 深色模式：根据主题自动进行调整

## 水平分割线

```markdown
---
```

---

## 转义字符

如果不希望某些字符被解析为 Markdown 语法，请使用反斜杠进行转义。如果不知道这一点，可能会因为意料之外的显示效果而抓狂。

```markdown
\*これは斜体になりません\*
\`これはコードになりません\`
\# これは見出しになりません
```

\*这不会变成斜体\*
\`这不会变成代码\`
\# 这不会变成标题

## Frontmatter

在文章开头需要编写用于设置元数据的 Frontmatter。如果漏掉这部分，Astro 会抛出错误并报错。

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

### 分类列表

- `ai-driven-futures`: AI 驱动的未来
- `high-performance-engineering`: 高性能工程
- `founders-journey`: 创始人的轨迹
- `tech-lab-creativity`: 科技实验室的创造力

## 最佳实践

### 1. 结构化的标题

```markdown
# メインタイトル (H1は自動生成)

## 大きなセクション (H2)

### サブセクション (H3)

#### 詳細項目 (H4)
```

### 2. 易读的代码

- 为代码块指定合适的语言（语法高亮对读者的眼睛更友好）
- 将长代码按逻辑单元进行拆分（没有人想一口气读完 100 行代码）
- 通过注释添加说明（这是写给未来的自己的一封信）

### 3. 高效的链接卡片

- 仅将相关度高的 URL 做成链接卡片
- 在文章末尾设置“参考资料”章节
- 外部链接选择可靠的来源

### 4. 视觉要素

- 使用表格整理信息
- 使用引用强调关键要点
- 使用水平分割线区分章节

## 故障排查

### 常见问题

1. 链接卡片未显示
   - 确认 URL 是否单独成行
   - 确认是否以 HTTPS 开头
   - 确认该网站是否可以正常访问

2. 数学公式未显示
   - 确认 `$` 符号前后是否有空格
   - 确认特殊字符的转义是否正确

3. 代码高亮未生效
   - 确认语言名称拼写是否有误
   - 确认反引号（`）的数量是否正确

## 总结

利用本指南介绍的功能，您可以写出既易读又美观的博客文章。尤其是链接卡片，能以极具视觉吸引力的方式向读者呈现有价值的参考资料，是一项非常强大的功能。只需输入 URL 就能展示卡片，让人感觉自己就像魔法师一样。

在撰写文章时，请使用以下清单：

- [ ] Frontmatter 设置正确（避免 Astro 报错）
- [ ] 标题结构具有逻辑性（避免读者迷失方向）
- [ ] 代码块指定了合适的语言（以获得美观的高亮效果）
- [ ] 链接卡片正常显示（为了美观度）
- [ ] 数学公式正常显示（让数学家也感到满意）
- [ ] 设置了图片的 alt 属性（可访问性至关重要）
