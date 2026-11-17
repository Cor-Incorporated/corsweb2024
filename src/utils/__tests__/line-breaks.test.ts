import { describe, expect, it } from 'vitest';
import { groupClauses, groupSentences, splitClauses, splitSentences } from '../line-breaks';

describe('splitSentences', () => {
  it.each([
    {
      name: '日本語は文の終わりで分ける',
      text: '必要な情報は電子カルテにある。いつも使っている書式もある。',
      locale: 'ja',
      expected: ['必要な情報は電子カルテにある。', 'いつも使っている書式もある。'],
    },
    {
      name: '文の終わりの直後の閉じ括弧は前の文に付ける',
      text: 'これは例です。）明日は休みます。',
      locale: 'ja',
      expected: ['これは例です。）', '明日は休みます。'],
    },
    {
      name: '中国語も文の終わりで分ける',
      text: '必要な情報は電子カルテにある。書式もある。',
      locale: 'zh',
      expected: ['必要な情報は電子カルテにある。', '書式もある。'],
    },
    {
      name: '丸括弧の中の句点では文を分けない（法務の文）',
      text: 'Cor.株式会社（以下「当社」といいます。）は、当社が取り扱う個人情報の重要性を認識し、適正に取り扱います。当社は、以下の方針に基づき個人情報を保護します。',
      locale: 'ja',
      expected: [
        'Cor.株式会社（以下「当社」といいます。）は、当社が取り扱う個人情報の重要性を認識し、適正に取り扱います。',
        '当社は、以下の方針に基づき個人情報を保護します。',
      ],
    },
    {
      name: '丸括弧の中の句点では文を分けない（基本方針の文は 1 文）',
      text: 'Cor.株式会社（以下、「当社」という。）は、「競争ではなく共創を通じて未来を切り拓き、幸福な社会を実現する」という経営理念のもと、事業を展開しています。',
      locale: 'ja',
      expected: [
        'Cor.株式会社（以下、「当社」という。）は、「競争ではなく共創を通じて未来を切り拓き、幸福な社会を実現する」という経営理念のもと、事業を展開しています。',
      ],
    },
    {
      name: 'かぎ括弧の中の句点では文を分けない',
      text: '彼は「行きます。」と言った。次の日に来た。',
      locale: 'ja',
      expected: ['彼は「行きます。」と言った。', '次の日に来た。'],
    },
    {
      name: '「！」「？」で終わる文も分ける',
      text: '本当ですか？はい、そうです！また会いましょう。',
      locale: 'ja',
      expected: ['本当ですか？', 'はい、そうです！', 'また会いましょう。'],
    },
    {
      name: '文の終わりに続く閉じ括弧は前の文に付ける（全角）',
      text: 'これは例です。）次の文です。',
      locale: 'ja',
      expected: ['これは例です。）', '次の文です。'],
    },
    {
      name: '文の終わりに続く閉じ括弧は前の文に付ける（半角）',
      text: 'これは例です。)次の文です。',
      locale: 'ja',
      expected: ['これは例です。)', '次の文です。'],
    },
    {
      name: '英語の本文は分けない',
      text: 'Hello world. This is a test.',
      locale: 'en',
      expected: ['Hello world. This is a test.'],
    },
    {
      name: '空の文字列は 0 個',
      text: '',
      locale: 'ja',
      expected: [],
    },
  ])('$name', ({ text, locale, expected }) => {
    expect(splitSentences(text, locale)).toEqual(expected);
  });
});

describe('splitClauses', () => {
  it.each([
    {
      name: '題を読点で 2 つの塊に分ける',
      text: '医療機関のAI導入を、記録の整理と書類づくりから。',
      locale: 'ja',
      expected: ['医療機関のAI導入を、', '記録の整理と書類づくりから。'],
    },
    {
      name: '「まずは、」は次の塊と 1 つにする',
      text: 'まずは、いま考えていることをお送りください。',
      locale: 'ja',
      expected: ['まずは、いま考えていることをお送りください。'],
    },
    {
      name: '「AIで、」は次の塊と 1 つにする',
      text: 'AIで、人間が判断すべきことに集中できる環境を作る。',
      locale: 'ja',
      expected: ['AIで、人間が判断すべきことに集中できる環境を作る。'],
    },
    {
      name: '「Cor.は、」は次の塊と 1 つにする',
      text: 'Cor.は、いまのデータと仕事の進め方を調べます。',
      locale: 'ja',
      expected: ['Cor.は、いまのデータと仕事の進め方を調べます。'],
    },
    {
      name: '中国語は「，」と「、」で分ける',
      text: '医療機関のAI導入を，記録の整理から。',
      locale: 'zh',
      expected: ['医療機関のAI導入を，', '記録の整理から。'],
    },
    {
      name: '丸括弧の中の読点では塊を切らない（法務の文）',
      text: 'Cor.株式会社（以下「当社」といいます。）は、当社が取り扱う個人情報の重要性を認識し、適正に取り扱います。',
      locale: 'ja',
      expected: [
        'Cor.株式会社（以下「当社」といいます。）は、',
        '当社が取り扱う個人情報の重要性を認識し、',
        '適正に取り扱います。',
      ],
    },
    {
      name: '丸括弧の中の読点では切らず、かぎ括弧の中の読点では切る',
      text: 'Cor.株式会社（以下、「当社」という。）は、「競争ではなく共創を通じて未来を切り拓き、幸福な社会を実現する」という経営理念のもと、事業を展開しています。',
      locale: 'ja',
      expected: [
        'Cor.株式会社（以下、「当社」という。）は、',
        '「競争ではなく共創を通じて未来を切り拓き、',
        '幸福な社会を実現する」という経営理念のもと、',
        '事業を展開しています。',
      ],
    },
    {
      name: '角括弧の中の読点でも塊を切らない',
      text: '補足【これは、一つの塊です。】の後で、続けます。',
      locale: 'ja',
      expected: ['補足【これは、一つの塊です。】の後で、', '続けます。'],
    },
    {
      name: '短い出だしは最初の 2 つだけを 1 つにし、2 つ目以降は続けない',
      text: 'はい、いいえ、はい。',
      locale: 'ja',
      expected: ['はい、いいえ、', 'はい。'],
    },
    {
      name: '英語の題は「: 」と「 — 」の後でも分ける',
      text: 'Grift: from git history — a record of work.',
      locale: 'en',
      expected: ['Grift: ', 'from git history — ', 'a record of work.'],
    },
    {
      name: '英語の題は「, 」の後で分ける',
      text: 'Reliable AI, from records to documents.',
      locale: 'en',
      expected: ['Reliable AI, ', 'from records to documents.'],
    },
    {
      name: '空の文字列は 0 個',
      text: '',
      locale: 'ja',
      expected: [],
    },
  ])('$name', ({ text, locale, expected }) => {
    expect(splitClauses(text, locale)).toEqual(expected);
  });
});

describe('括弧を含む文', () => {
  const examples = [
    'Cor.株式会社（以下「当社」といいます。）は、当社が取り扱う個人情報の重要性を認識し、適正に取り扱います。当社は、以下の方針に基づき個人情報を保護します。',
    'Cor.株式会社（以下、「当社」という。）は、「競争ではなく共創を通じて未来を切り拓き、幸福な社会を実現する」という経営理念のもと、事業を展開しています。',
    '彼は「行きます。」と言った。次の日に来た。',
    'これは例です。）次の文です。',
    '補足【これは、一つの塊です。】の後で、続けます。',
  ];

  it.each(examples)('塊を繋いだ文字が元と同じ: %s', (text) => {
    expect(splitSentences(text, 'ja').join('')).toBe(text);
    expect(splitClauses(text, 'ja').join('')).toBe(text);
    const sentences = groupSentences([{ text }], 'ja');
    expect(sentences.map((sentence) => sentence.map((clause) => clause.map((part) => part.text).join('')).join('')).join('')).toBe(
      text,
    );
  });

  it('法務の文の最初の塊は、括弧を閉じた後の読点で切れる', () => {
    const text =
      'Cor.株式会社（以下「当社」といいます。）は、当社が取り扱う個人情報の重要性を認識し、適正に取り扱います。';
    const sentences = groupSentences([{ text }], 'ja');
    expect(sentences).toHaveLength(1);
    expect(sentences[0].map((clause) => clause.map((part) => part.text).join(''))[0]).toBe(
      'Cor.株式会社（以下「当社」といいます。）は、',
    );
  });

  // 閉じの無い開き括弧の後ろは、今は文の終わりまで行を替えない（深さが 0 に戻らないため）。
  // 字を欠かさず、落ちず、後ろを勝手に切らない事だけを留める。
  it('閉じの無い開き括弧の後ろは、文の終わりまで切らず、文字を欠かさない', () => {
    const text = 'これは例です（未定です。次の文です。';
    expect(splitSentences(text, 'ja')).toEqual([text]);
    expect(splitClauses(text, 'ja')).toEqual([text]);
    const sentences = groupSentences([{ text }], 'ja');
    expect(sentences).toHaveLength(1);
    expect(sentences[0]).toHaveLength(1);
    expect(sentences[0][0].map((part) => part.text).join('')).toBe(text);
  });
});

describe('groupSentences', () => {
  it('文の中に塊を作り、link をまたいでも文字を変えない', () => {
    const parts = [
      { text: '必要な情報は電子カルテにある。いつも使っている' },
      { text: '書式', href: '/security/' },
      { text: 'もある。' },
    ];
    const sentences = groupSentences(parts, 'ja');
    expect(sentences).toHaveLength(2);
    expect(sentences.map((sentence) => sentence.map((clause) => clause.map((part) => part.text).join('')).join(''))).toEqual([
      '必要な情報は電子カルテにある。',
      'いつも使っている書式もある。',
    ]);
  });

  it('link の途中では切らない（区切りは link の終わりへ寄せる）', () => {
    const parts = [{ text: 'これは、' }, { text: '長い、名前のリンク', href: '/x/' }, { text: 'です。' }];
    const sentences = groupSentences(parts, 'ja');
    const clauses = sentences[0];
    expect(clauses.map((clause) => clause.map((part) => part.text).join(''))).toEqual([
      'これは、長い、名前のリンク',
      'です。',
    ]);
    // link の文字は 1 つの塊の中にそのまま残る
    expect(clauses[0].find((part) => part.href === '/x/')?.text).toBe('長い、名前のリンク');
  });

  it('英語の本文は 1 文 1 塊', () => {
    const sentences = groupSentences([{ text: 'Hello. World.' }], 'en');
    expect(sentences).toHaveLength(1);
    expect(sentences[0]).toHaveLength(1);
  });
});

describe('groupClauses', () => {
  it('題を塊に分ける', () => {
    const clauses = groupClauses([{ text: '医療機関のAI導入を、記録の整理と書類づくりから。' }], 'ja');
    expect(clauses.map((clause) => clause.map((part) => part.text).join(''))).toEqual([
      '医療機関のAI導入を、',
      '記録の整理と書類づくりから。',
    ]);
  });

  it('題は、長い括弧を折るため、括弧の中の読点でも切る', () => {
    const clauses = groupClauses([{ text: '(2) 员工（含董事、兼职、定期合同、实习生）' }], 'zh');
    expect(clauses.map((clause) => clause.map((part) => part.text).join(''))).toEqual([
      '(2) 员工（含董事、',
      '兼职、',
      '定期合同、',
      '实习生）',
    ]);
  });

  it('題は句点でも切る', () => {
    const clauses = groupClauses([{ text: '工事日報の転記を減らす。元請ごとの書式に、今ある情報をつなぐ。' }], 'ja');
    expect(clauses.map((clause) => clause.map((part) => part.text).join(''))).toEqual([
      '工事日報の転記を減らす。',
      '元請ごとの書式に、',
      '今ある情報をつなぐ。',
    ]);
  });
});
