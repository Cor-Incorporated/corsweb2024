---
title: "完全マークダウンガイド：ブログ記事作成のすべて"
description: "Cor.株式会社のブログで使えるマークダウン記法とリッチコンテンツ機能の完全ガイド。リンクカード、数式、コードハイライトなど、美しい記事を書くための機能をすべて網羅"
summary: "Cor.株式会社のブログで使えるマークダウン記法と、リンクカード、数式、コードハイライトなどの機能を、書き方と表示例でまとめた。URLを単体で書けばリンクカードになる。記事を書くときは、フロントマターや見出し構造などをチェックリストで確かめる。"
pubDate: 2025-01-21
updatedDate: 2026-10-23
author: "Terisuke"
category: "lab"
tags: ["Markdown", "ブログ", "執筆", "技術文書", "ガイド"]
lang: "ja"
featured: true
---

# 完全マークダウンガイド：ブログ記事作成のすべて

このガイドではCor.株式会社のブログで使えるマークダウン記法とリッチコンテンツ機能を、すべて紹介する。美しく読みやすい記事を書くためのテクニックを、これでもかというほど詰め込んだ。マークダウンマスターへの道はここから始まる。

## 基本的なマークダウン記法

### 見出し

```markdown
# 見出し1 (H1)
## 見出し2 (H2)
### 見出し3 (H3)
#### 見出し4 (H4)
```

### テキスト装飾

```markdown
**太字テキスト**
*斜体テキスト*
~~取り消し線~~
`インラインコード`
```

**太字テキスト**
*斜体テキスト*
~~取り消し線~~
`インラインコード`

### リスト

#### 順序なしリスト

```markdown
- 項目1
- 項目2
  - サブ項目2.1
  - サブ項目2.2
- 項目3
```

- 項目1
- 項目2
  - サブ項目2.1
  - サブ項目2.2
- 項目3

#### 順序付きリスト

```markdown
1. 最初の項目
2. 二番目の項目
3. 三番目の項目
```

1. 最初の項目
2. 二番目の項目
3. 三番目の項目

#### タスクリスト

```markdown
- [x] 完了したタスク
- [ ] 未完了のタスク
- [ ] 別の未完了タスク
```

- [x] 完了したタスク
- [ ] 未完了のタスク
- [ ] 別の未完了タスク

## コードブロック

### 基本的なコードブロック

```markdown
\`\`\`javascript
function greet(name) {
  console.log(`Hello, ${name}!`);
}

greet('World');
\`\`\`
```

### 実際の表示例

```javascript
function greet(name) {
  console.log(`Hello, ${name}!`);
}

greet('World');
```

### 対応言語

- JavaScript/TypeScript
- Python
- HTML/CSS
- Bash/Shell
- JSON/YAML
- Markdown
- その他多数

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

## 表（テーブル）

```markdown
| 項目 | 説明 | 価格 |
|------|------|------|
| 商品A | 高品質な商品 | ¥1,000 |
| 商品B | お手頃価格 | ¥500 |
| 商品C | プレミアム | ¥2,000 |
```

| 項目 | 説明 | 価格 |
|------|------|------|
| 商品A | 高品質な商品 | ¥1,000 |
| 商品B | お手頃価格 | ¥500 |
| 商品C | プレミアム | ¥2,000 |

### 表の整列

```markdown
| 左寄せ | 中央揃え | 右寄せ |
|:-------|:--------:|-------:|
| Left | Center | Right |
| L | C | R |
```

| 左寄せ | 中央揃え | 右寄せ |
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

> これは引用文です。
> 複数行にわたって
> 引用することができます。

> **重要な引用**
> 
> 引用の中で**マークダウン記法**も使用できます。

## リンクと画像

### 基本的なリンク

```markdown
[Cor.inc公式サイト](https://cor-jp.com)
[お問い合わせ](/contact)
```

[Cor.inc公式サイト](https://cor-jp.com)
[お問い合わせ](/contact)

### 画像

```markdown
![Alt text](/images/example.jpg)
![説明文](/images/example.jpg "タイトル")
```

## 数式（KaTeX）

### インライン数式

```markdown
円の面積は $A = \pi r^2$ で計算できます。
```

円の面積は $A = \pi r^2$ で計算できます。

### ブロック数式

```markdown
$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$
```

$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$

### 複雑な数式例

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

## リッチリンクカード

### 使用方法

URLを単体で書くだけで、リッチなプレビューカードが自動で作られる。魔法のようだが、実はremark-link-card-plusの仕業だ。

```markdown
https://cor-jp.com/

https://github.com

https://docs.astro.build
```

### 表示例

https://cor-jp.com/

https://github.com

https://docs.astro.build

### 機能

- 自動メタデータ取得: タイトル、説明文、ファビコンを自動で取得する
- OG画像表示: ウェブサイトのサムネイル画像を表示する
- キャッシュ機能: 一度取得した情報はローカルにキャッシュする
- レスポンシブ: デスクトップとモバイルの両方に対応する
- ダークモード: テーマに合わせて自動で調整する

## 水平線

```markdown
---
```

---

## エスケープ文字

マークダウン記法として解釈されたくない文字は、バックスラッシュでエスケープする。これを知らないと、意図しない表示になって泣くことになる。

```markdown
\*これは斜体になりません\*
\`これはコードになりません\`
\# これは見出しになりません
```

\*これは斜体になりません\*
\`これはコードになりません\`
\# これは見出しになりません

## フロントマター

記事の冒頭にはメタデータを設定するフロントマターを書く。これを忘れると、Astroがエラーを吐いて怒る。

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

### カテゴリ一覧

- `ai-driven-futures`: AI駆動の未来
- `high-performance-engineering`: 高性能エンジニアリング
- `founders-journey`: 創業者の軌跡
- `tech-lab-creativity`: テックラボの創造性

## ベストプラクティス

### 1. 構造化された見出し

```markdown
# メインタイトル (H1は自動生成)

## 大きなセクション (H2)

### サブセクション (H3)

#### 詳細項目 (H4)
```

### 2. 読みやすいコード

- コードブロックには適切な言語を指定する（シンタックスハイライトは読者の目に優しい）
- 長いコードは論理的な単位で分割する（誰も100行のコードを一気に読みたくない）
- コメントで説明を追加する（未来の自分への手紙だ）

### 3. 効果的なリンクカード

- 関連性の高いURLだけをリンクカードにする
- 記事の最後に「参考資料」の節を設ける
- 外部リンクは信頼できるソースを選ぶ

### 4. 視覚的な要素

- 表を使って情報を整理する
- 引用で重要なポイントを強調する
- 水平線でセクションを区切る

## トラブルシューティング

### よくある問題

1. リンクカードが表示されない
   - URLが単独行にあることを確認
   - HTTPSで始まることを確認
   - ウェブサイトにアクセスできるか確認

2. 数式が表示されない
   - `$`記号の前後にスペースがないか確認
   - 特殊文字のエスケープを確認

3. コードハイライトが効かない
   - 言語名のスペルミスを確認
   - バッククォート（`）の数を確認

## まとめ

このガイドで紹介した機能を使えば、読みやすく美しいブログ記事を書ける。特にリンクカードは読者に役立つ参考資料を見た目にも魅力的な形で示せる、強力な機能だ。URLを書くだけでカードが出てくるなんて、まるで魔法使いになった気分だ。

記事を書くときは、次のチェックリストを使おう。

- [ ] フロントマターが正しく設定されている（Astroに怒られないために）
- [ ] 見出し構造が論理的である（読者が迷子にならないために）
- [ ] コードブロックに適切な言語指定がある（美しいハイライトのために）
- [ ] リンクカードが正しく表示される（おしゃれのために）
- [ ] 数式が正しく表示される（数学者も満足）
- [ ] 画像のalt属性が設定されている（アクセシビリティは大事）
