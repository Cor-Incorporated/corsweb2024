---
title: "Complete Markdown Guide: Everything for Blog Post Creation"
description: "A complete guide to Markdown syntax and rich content features usable on Cor.inc blogs. Covers all features for creating beautiful articles, including link cards, mathematical formulas, and code highlighting."
pubDate: 2025-01-21
author: "Terisuke"
category: "lab"
tags: ["Markdown", "ブログ", "執筆", "技術文書", "ガイド"]
lang: "en"
featured: true
translationSourceHash: "dbecd1e75a0534d9b057e76963572d2d50d8a1ffc53ee3eb506947308821ccd1"
translatedAt: "2026-09-28T06:09:16.001Z"
translationModel: "adopted-legacy"
---

# The Complete Markdown Guide: Everything for Blog Post Creation

This guide introduces all the Markdown syntax and rich content features available on the Cor.inc blog. We've packed it with techniques to create beautiful and easy-to-read articles. Your journey to becoming a Markdown master starts here.

## Basic Markdown Syntax

### Headings

```markdown
# Heading 1 (H1)
## Heading 2 (H2)
### Heading 3 (H3)
#### Heading 4 (H4)
```

### Text Formatting

```markdown
**Bold text**
*Italic text*
~~Strikethrough~~
`Inline code`
```

**Bold text**
*Italic text*
~~Strikethrough~~
`Inline code`

### Lists

#### Unordered Lists

```markdown
- Item 1
- Item 2
  - Sub-item 2.1
  - Sub-item 2.2
- Item 3
```

- Item 1
- Item 2
  - Sub-item 2.1
  - Sub-item 2.2
- Item 3

#### Ordered Lists

```markdown
1. First item
2. Second item
3. Third item
```

1. First item
2. Second item
3. Third item

#### Task Lists

```markdown
- [x] Completed task
- [ ] Incomplete task
- [ ] Another incomplete task
```

- [x] Completed task
- [ ] Incomplete task
- [ ] Another incomplete task

## Code Blocks

### Basic Code Block

```markdown
\`\`\`javascript
function greet(name) {
  console.log(`Hello, ${name}!`);
}

greet('World');
\`\`\`
```

### Actual Display Example

```javascript
function greet(name) {
  console.log(`Hello, ${name}!`);
}

greet('World');
```

### Supported Languages

- JavaScript/TypeScript
- Python
- HTML/CSS
- Bash/Shell
- JSON/YAML
- Markdown
- And many more

```python
# Python example
def calculate_fibonacci(n):
    if n <= 1:
        return n
    return calculate_fibonacci(n-1) + calculate_fibonacci(n-2)

print(calculate_fibonacci(10))
```

```bash
# Bash example
#!/bin/bash
npm run build
npm run deploy
```

## Tables

```markdown
| Item | Description | Price |
|------|-------------|-------|
| Product A | High-quality product | ¥1,000 |
| Product B | Affordable price | ¥500 |
| Product C | Premium | ¥2,000 |
```

| Item | Description | Price |
|------|-------------|-------|
| Product A | High-quality product | ¥1,000 |
| Product B | Affordable price | ¥500 |
| Product C | Premium | ¥2,000 |

### Table Alignment

```markdown
| Left Align | Center Align | Right Align |
|:-----------|:------------:|------------:|
| Left | Center | Right |
| L | C | R |
```

| Left Align | Center Align | Right Align |
|:-----------|:------------:|------------:|
| Left | Center | Right |
| L | C | R |

## Blockquotes

```markdown
> This is a quote.
> It can span multiple lines.

> **Important Quote**
> 
> **Markdown syntax** can also be used within quotes.
```

> This is a quote.
> It can span multiple lines.

> **Important Quote**
> 
> **Markdown syntax** can also be used within quotes.

## Links and Images

### Basic Links

```markdown
[Cor.inc Official Website](https://cor-jp.com)
[Contact Us](/contact)
```

[Cor.inc Official Website](https://cor-jp.com)
[Contact Us](/contact)

### Images

```markdown
![Alt text](/images/example.jpg)
![Description](/images/example.jpg "Title")
```

## Mathematical Formulas (KaTeX)

### Inline Formulas

```markdown
The area of a circle can be calculated as $A = \pi r^2$.
```

The area of a circle can be calculated as $A = \pi r^2$.

### Block Formulas

```markdown
$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$
```

$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$

### Complex Formula Example

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

## Rich Link Cards

### How to Use

Simply write a URL on its own line, and a rich preview card will be automatically generated. It's magical, but it's actually the work of `remark-link-card-plus`:

```markdown
https://cor-jp.com/

https://github.com

https://docs.astro.build
```

### Display Example

https://cor-jp.com/

https://github.com

https://docs.astro.build

### Features

- **Automatic Metadata Retrieval**: Automatically fetches title, description, and favicon.
- **OG Image Display**: Shows the website's thumbnail image.
- **Caching Function**: Caches retrieved information locally.
- **Responsive**: Adaptable to both desktop and mobile.
- **Dark Mode**: Adjusts automatically based on the theme.

## Horizontal Rule

```markdown
---
```

---

## Escape Characters

Characters that you don't want to be interpreted as Markdown syntax can be escaped with a backslash. Not knowing this will lead to unintended displays and sadness:

```markdown
\*This won't be italicized\*
\`This won't be code\`
\# This won't be a heading
```

\*This won't be italicized\*
\`This won't be code\`
\# This won't be a heading

## Front Matter

At the beginning of an article, write the front matter to set metadata. Forgetting this will make Astro throw an error:

```yaml
---
title: "Article Title"
description: "Article description"
pubDate: 2025-01-21
author: "Terisuke"
category: "lab"
tags: ["tag1", "tag2", "tag3"]
# image:
#   url: "/images/blog/example.avif"
#   alt: "Image description"
lang: "ja"
featured: true
---
```

### Category List

- `ai-driven-futures`: AI-Driven Futures
- `high-performance-engineering`: High-Performance Engineering
- `founders-journey`: Founder's Journey
- `tech-lab-creativity`: Tech Lab Creativity

## Best Practices

### 1. Structured Headings

```markdown
# Main Title (H1 is auto-generated)

## Major Section (H2)

### Subsection (H3)

#### Detailed Item (H4)
```

### 2. Readable Code

- Use appropriate language specification for code blocks (syntax highlighting is easy on the eyes).
- Split long code into logical units (nobody wants to read 100 lines of code at once).
- Add comments for explanations (it's a letter to your future self).

### 3. Effective Link Cards

- Link card only relevant URLs.
- Create a "Reference Links" section at the end of the article.
- Choose reliable sources for external links.

### 4. Visual Elements

- Use tables to organize information.
- Emphasize important points with quotes.
- Separate sections with horizontal rules.

## Troubleshooting

### Common Issues

1. **Link cards not displaying**
   - Ensure the URL is on its own line.
   - Ensure it starts with HTTPS.
   - Check if the website is accessible.

2. **Mathematical formulas not displaying**
   - Check for spaces before and after the `$` symbol.
   - Check for escaped special characters.

3. **Code highlighting not working**
   - Check for typos in the language name.
   - Check the number of backticks (`).

## Conclusion

By utilizing the features introduced in this guide, you can create readable and beautiful blog posts. The link card feature, in particular, is a powerful tool that provides readers with useful reference materials in a visually appealing format. Seeing a card appear just by writing a URL feels like being a magician.

Use the following checklist when creating articles:

- [ ] Front matter is correctly configured (to avoid Astro errors).
- [ ] Heading structure is logical (so readers don't get lost).
- [ ] Code blocks have appropriate language specifications (for beautiful highlighting).
- [ ] Link cards display correctly (for aesthetics).
- [ ] Mathematical formulas display correctly (to satisfy mathematicians).
- [ ] Image `alt` attributes are set (accessibility is important).

---

*If you have any questions about this guide, please contact us via [Contact](/contact). Let's walk the path to becoming a Markdown master together.*
