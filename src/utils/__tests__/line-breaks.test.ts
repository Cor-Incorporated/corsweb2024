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
      text: '「今日は行きます。」明日は休みます。',
      locale: 'ja',
      expected: ['「今日は行きます。」', '明日は休みます。'],
    },
    {
      name: '中国語も文の終わりで分ける',
      text: '必要な情報は電子カルテにある。書式もある。',
      locale: 'zh',
      expected: ['必要な情報は電子カルテにある。', '書式もある。'],
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

  it('題は句点でも切る', () => {
    const clauses = groupClauses([{ text: '工事日報の転記を減らす。元請ごとの書式に、今ある情報をつなぐ。' }], 'ja');
    expect(clauses.map((clause) => clause.map((part) => part.text).join(''))).toEqual([
      '工事日報の転記を減らす。',
      '元請ごとの書式に、',
      '今ある情報をつなぐ。',
    ]);
  });
});
