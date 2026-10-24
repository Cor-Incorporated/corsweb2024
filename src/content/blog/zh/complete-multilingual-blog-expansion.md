---
title: "【完全支持5种语言】将仅有日英双语的博客扩展至中韩西语的风暴般3小时实战纪实"
description: "本以为支持5种语言，实际上却只有2种语言的惊人事实。与Claude Code携手极速实现中文、韩文、西班牙语支持的全程记录"
summary: "本应支持5种语言的网站，却只有博客仅支持日英文。与Claude Code合作在约3小时内创建了中文、韩文、西班牙语页面，通过Gemini API翻译了现存的8篇文章，并修复了构建错误。所谓的“支持”，不实际查验是不会了解其真貌的。"
pubDate: 2025-09-25
updatedDate: 2026-10-23
author: "Terisuke"
category: "engineering"
tags: ["多言語化", "i18n", "Astro", "Claude Code", "自動化", "Gemini API"]
image:
  url: "/images/blog/ko-404.avif"
  alt: "韩语博客404页面"
lang: "zh"
featured: true
isDraft: false
translationSourceHash: "772589688a81666ca3dff4dff9d0215ef52dad0a70360fe768f0873b4d940fc3"
translatedAt: "2026-10-23T06:19:02.485Z"
translationModel: "gemini-3.8-flash"
---

# 【完全支持5种语言】将仅有日英双语的博客扩展至中韩西语的风暴般3小时实战纪实

“不是写着支持5种语言吗！”

周四下午，我随意查看网站Develop分支的实现情况时发生了这一幕。正如向Cursor Agent要求的那样，语言切换按钮上确实排列着5面国旗。然而，当我尝试用中文打开博客页面时。

![显示404错误的中文博客页面](/images/blog/404.avif)

**404 Not Found**。

经过调查，发现了一个惊人的事实。

## 名为支持5种语言、实则仅支持2种语言

```typescript
// utils/i18n.ts には確かに5言語の翻訳が...
export type Locale = 'ja' | 'en' | 'zh' | 'ko' | 'es';
```

从i18n的设置来看，确实支持5种语言。首页、公司简介全部都已妥善翻译。但是，当我查看博客页面的目录时。

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

**唯独博客只支持日文和英文**。

![确认目录结构的场景](/images/blog/keyboardclasher.avif)

## 与Claude Code展开高速实现

既然如此，只能将剩下的3种语言也实现出来了。幸运的是，有Claude Code在。我立刻开始了实现工作。

### 步骤1：复制并修改博客页面

首先复制英文版的博客页面，并针对各语言进行修改。

```bash
# 中国語、韓国語、スペイン語のディレクトリを作成
for lang in zh ko es; do
  mkdir -p src/pages/$lang/blog/
  cp -r src/pages/en/blog/* src/pages/$lang/blog/
done
```

但是，仅凭这些还无法运行。需要修改各个文件内的语言过滤器。

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

### 步骤2：编写翻译脚本

手动翻译8篇日文文章并不现实。因此，我创建了一个使用Gemini API的自动翻译脚本。

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

### 步骤3：与错误展开死战

运行翻译脚本后，我意气风发地准备确认网站。

```bash
$ npm run build
✘ [ERROR] Expected "}" but found "."
  script:/ProductsTable.astro:3:33:
    3 │   buttonTexts: {t.buttonTexts},
      ╵                ^
```

**迎来了构建错误的狂风暴雨**。

![堆积如山的错误日志](/images/blog/naniittenda.avif)

## 接连不断的Bug修复

### 问题1：ProductsTable.astro中莫名其妙的调试代码

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

通过删除这行调试代码解决了问题。

### 问题2：CategoryBadge遗漏了多语言支持

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

### 问题3：PostCard的链接全部跳转到了英文版

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

### 问题4：虽已翻译但标题依然是日文

这是最棘手的问题。翻译脚本本应正常运行，但frontmatter中的title和description却依然是日文。

```yaml
# 中国語の記事なのに...
---
title: "【爆速15分】MCPサーバーでMCPサーバーを作る！"  # 日本語！
description: "LT中止の絶望から生まれた奇跡..."  # 日本語！
lang: "zh"
---

# 【闪电15分钟】用MCP服务器构建MCP服务器！  # 本文は中国語
```

调查原因后发现，翻译脚本的解析处理中存在Bug。于是另写了一个修复脚本来进行处理。

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

## 激战3小时的成果

从最初发现错误起经过了约3小时。终于解决了所有问题。

### 实现的功能一览

- 创建中文、韩文、西班牙文博客页面
- 分类页面支持5种语言
- 标签页面支持5种语言
- RSS Feed支持5种语言
- 支付成功/取消页面支持5种语言
- 既有8篇文章×3种语言＝24篇文章的自动翻译
- 解决所有TypeScript错误
- 构建成功（317个页面）

![制作完成的中文博客](/images/blog/zh.avif)
![制作完成的韩文博客](/images/blog/ko.avif)
![制作完成的西班牙文博客](/images/blog/es.avif)


### 翻译质量

Gemini API呈现的翻译质量超乎想象。

```text
日本語: 「いい感じにアレしとくアプリ」開発秘話
中国語: "随心所欲处理应用"开发秘辛
韓国語: '적당히 알아서 해주는 앱' 개발 비화
スペイン語: La historia detrás de la aplicación 'Hazlo bien y ya'
```

准确捕捉了各语言的细微语感，是非常自然的翻译。

## 心得体会

### 1. “支持”的定义是模糊的

即使宣称“支持5种语言”，实际上支持到了什么程度，不仔细调查也是无从得知的。像这次一样首页支持了但博客不支持的情况，意外地很可能发生。

### 2. 与Claude Code协同作战的威力

能在3小时内完成5种语言×8篇文章的实现，Claude Code的功劳功不可没。特别是在以下几点上给予了极大帮助。

- 从错误信息中瞬间定位原因
- 学习修改模式并批量应用相同的修改
- 高效实现翻译脚本的逻辑

### 3. 自动化脚本就是正义

如果手动翻译24篇文章，恐怕要花上长得多的时间。即使花1小时去编写自动化脚本，带来的回报也远超于此。

### 4. 错误是一座宝藏

这次遇到的众多错误，是发现系统潜在问题的好机会。特别是CategoryBadge遗漏多语言支持这一点，迟早都会变成问题。

## 总结：迈向真正的多语言支持

最初以为“已支持5种语言”的网站，实际上竟然是“伪5种语言支持”，这一事实令人震惊。但是，在与Claude Code并肩作战的3小时里，我们实现了真正的5语言支持。

现在，无论是中文、韩文还是西班牙文，都能正常显示博客文章。404错误再也不会出现了。

这才是真正的多语言支持。

---

*实现的代码已在GitHub上公开。翻译脚本应该也可以用于其他Astro项目。*

https://github.com/Cor-Incorporated/corsweb2024

*与Claude Code并肩作战的3小时，既紧张激烈，又非常充实。*
