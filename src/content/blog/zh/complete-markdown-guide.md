---
title: "完全Markdown指南：博客文章撰写的全部"
description: "本指南将介绍Cor.inc博客中可用的所有Markdown语法和富内容功能。我们将为您提供大量创建美观、易于阅读的文章的技巧。通往Markdown大师之路由此开始。"
pubDate: 2025-01-21
author: "Terisuke"
category: "lab"
tags: ["Markdown", "ブログ", "執筆", "技術文書", "ガイド"]
lang: "zh"
featured: true
translationSourceHash: "dbecd1e75a0534d9b057e76963572d2d50d8a1ffc53ee3eb506947308821ccd1"
translatedAt: "2026-09-28T06:09:16.009Z"
translationModel: "adopted-legacy"
---

# 完全Markdown指南：博客文章撰写的全部

本指南将介绍Cor.inc博客中可用的所有Markdown语法和富内容功能。我们将为您提供大量创建美观、易于阅读的文章的技巧。通往Markdown大师之路由此开始。

## 基本Markdown语法

### 标题

```markdown
# 标题1 (H1)
## 标题2 (H2)
### 标题3 (H3)
#### 标题4 (H4)
```

### 文本装饰

```markdown
**粗体文本**
*斜体文本*
~~删除线~~
`行内代码`
```

**粗体文本**
*斜体文本*
~~删除线~~
`行内代码`

### 列表

#### 无序列表

```markdown
- 项目1
- 项目2
  - 子项目2.1
  - 子项目2.2
- 项目3
```

- 项目1
- 项目2
  - 子项目2.1
  - 子项目2.2
- 项目3

#### 有序列表

```markdown
1. 第一项
2. 第二项
3. 第三项
```

1. 第一项
2. 第二项
3. 第三项

#### 任务列表

```markdown
- [x] 已完成任务
- [ ] 未完成任务
- [ ] 另一个未完成任务
```

- [x] 已完成任务
- [ ] 未完成任务
- [ ] 另一个未完成任务

## 代码块

### 基本代码块

```markdown
\`\`\`javascript
function greet(name) {
  console.log(`Hello, ${name}!`);
}

greet('World');
\`\`\`
```

### 实际显示示例

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
- 以及更多

```python
# Python示例
def calculate_fibonacci(n):
    if n <= 1:
        return n
    return calculate_fibonacci(n-1) + calculate_fibonacci(n-2)

print(calculate_fibonacci(10))
```

```bash
# Bash示例
#!/bin/bash
npm run build
npm run deploy
```

## 表格

```markdown
| 项目 | 说明 | 价格 |
|------|------|------|
| 商品A | 高品质商品 | ¥1,000 |
| 商品B | 实惠价格 | ¥500 |
| 商品C | 优质 | ¥2,000 |
```

| 项目 | 说明 | 价格 |
|------|------|------|
| 商品A | 高品质商品 | ¥1,000 |
| 商品B | 实惠价格 | ¥500 |
| 商品C | 优质 | ¥2,000 |

### 表格对齐

```markdown
| 左对齐 | 居中对齐 | 右对齐 |
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
> 这是引用文本。
> 可以跨越多行
> 进行引用。

> **重要引用**
> 
> 引用内部也可以使用**Markdown语法**。
```

> 这是引用文本。
> 可以跨越多行
> 进行引用。

> **重要引用**
> 
> 引用内部也可以使用**Markdown语法**。

## 链接和图片

### 基本链接

```markdown
[Cor.inc官方网站](https://cor-jp.com)
[联系我们](/contact)
```

[Cor.inc官方网站](https://cor-jp.com)
[联系我们](/contact)

### 图片

```markdown
![替代文本](/images/example.jpg)
![说明文字](/images/example.jpg "标题")
```

## 数学公式（KaTeX）

### 行内公式

```markdown
圆的面积可以通过 $A = \pi r^2$ 计算。
```

圆的面积可以通过 $A = \pi r^2$ 计算。

### 块级公式

```markdown
$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$
```

$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$

### 复杂数学公式示例

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

只需单独写下URL，即可自动生成精美的预览卡片。这看似魔法，实则得益于remark-link-card-plus：

```markdown
https://cor-jp.com/

https://github.com

https://docs.astro.build
```

### 显示示例

https://cor-jp.com/

https://github.com

https://docs.astro.build

### 功能

- **自动获取元数据**：自动获取标题、描述、favicon。
- **显示OG图像**：显示网站的缩略图。
- **缓存功能**：一次获取的信息将缓存在本地。
- **响应式设计**：同时支持桌面和移动端。
- **暗黑模式**：根据主题自动调整。

## 水平线

```markdown
---
```

---

## 转义字符

不想被解释为Markdown语法的字符，需要用反斜杠进行转义。如果不了解这一点，可能会导致显示意外，令人沮丧：

```markdown
\*这个不会变成斜体\*
\`这个不会变成代码\`
\# 这个不会变成标题
```

\*这个不会变成斜体\*
\`这个不会变成代码\`
\# 这个不会变成标题

## 前置元数据（Front Matter）

在文章的开头，需要写上用于设置元数据的YAML格式的Front Matter。如果忘记写，Astro会报错：

```yaml
---
title: "文章标题"
description: "文章的描述"
pubDate: 2025-01-21
author: "Terisuke"
category: "lab"
tags: ["tag1", "tag2", "tag3"]
# image:
#   url: "/images/blog/example.avif"
#   alt: "图片的描述"
lang: "ja"
featured: true
---
```

### 分类列表

- `ai-driven-futures`: AI驱动的未来
- `high-performance-engineering`: 高性能工程
- `founders-journey`: 创业者历程
- `tech-lab-creativity`: 技术实验室的创造力

## 最佳实践

### 1. 结构化的标题

```markdown
# 主标题 (H1会自动生成)

## 大章节 (H2)

### 子章节 (H3)

#### 详细项目 (H4)
```

### 2. 易于阅读的代码

- 为代码块指定合适的语言（语法高亮对读者更友好）
- 将长代码分成逻辑单元（没有人想一次性阅读100行代码）
- 使用注释添加说明（这是给未来自己的信）

### 3. 有效的链接卡片

- 只对相关的URL生成链接卡片
- 在文章末尾设置参考链接部分
- 外部链接选择可靠的来源

### 4. 视觉元素

- 使用表格整理信息
- 用引用强调要点
- 使用水平线分隔章节

## 故障排除

### 常见问题

1. **链接卡片未显示**
   - 确认URL是否单独占一行。
   - 确认URL是否以HTTPS开头。
   - 确认网站是否可访问。

2. **数学公式未显示**
   - 检查`$`符号前后是否有空格。
   - 检查特殊字符是否已转义。

3. **代码高亮无效**
   - 检查语言名称拼写是否错误。
   - 检查反引号（`）的数量是否正确。

## 总结

利用本指南中介绍的功能，您可以创建易于阅读且美观的博客文章。特别是链接卡片功能，它是一种强大的功能，可以以视觉上吸引人的方式为读者提供有用的参考资料。只需写下URL即可出现卡片，感觉就像成为了一名魔法师。

撰写文章时，请参考以下清单：

- [ ] Front Matter是否已正确设置（避免Astro报错）。
- [ ] 标题结构是否符合逻辑（避免读者迷失）。
- [ ] 代码块是否指定了正确的语言（实现美观的高亮）。
- [ ] 链接卡片是否正确显示（为了美观）。
- [ ] 数学公式是否正确显示（让数学家也满意）。
- [ ] 图片是否设置了alt属性（可访问性很重要）。

---

*如果您对本指南有任何疑问，请通过[联系我们](/contact)与我联系。让我们一起走向Markdown大师之路。*
