// @vitest-environment node
/**
 * Grok 検索応答から週次 Issue コメントを生成する処理のテスト（#454 A）
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { removePersonalNames, formatReactionComment } from '../voice/format-reaction.mjs';

const fixturesDir = path.join(import.meta.dirname, 'fixtures');

describe('voice-grok-reaction', () => {
  describe('removePersonalNames', () => {
    it('投稿者の名前を含む行を除去する', () => {
      const input = `記事への反応
   - 「良い記事だった」（https://example.com/post）
   - 投稿者: alice_dev さん
   - 種類: 肯定的`;

      const result = removePersonalNames(input);

      expect(result).not.toContain('投稿者:');
      expect(result).not.toContain('alice_dev');
      expect(result).toContain('記事への反応');
      expect(result).toContain('良い記事だった');
    });

    it('@username さん のパターンを除去する', () => {
      const input = `反響
   - @testuser さんのコメント
   - 良い記事`;

      const result = removePersonalNames(input);

      expect(result).not.toContain('@testuser');
      expect(result).toContain('良い記事');
    });

    it('複数の名前パターンを除去する', () => {
      const input = `反響
   - by: John Doe
   - アカウント: @user123
   - 「参考になった」`;

      const result = removePersonalNames(input);

      expect(result).not.toContain('by:');
      expect(result).not.toContain('アカウント:');
      expect(result).not.toContain('@user123');
      expect(result).toContain('参考になった');
    });
  });

  describe('formatReactionComment', () => {
    it('fixture から Issue コメントを生成する', () => {
      const fixturePath = path.join(fixturesDir, 'grok-reaction-response.json');
      const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8'));

      const comment = formatReactionComment(fixture);

      // 名前を含む行が除去されている
      expect(comment).not.toContain('投稿者:');
      expect(comment).not.toContain('アカウント:');
      expect(comment).not.toContain('ユーザー:');
      expect(comment).not.toContain('@testuser123'); // @ を含む行は除去
      
      // URL 内のアカウント名は許容（リンクを残すため）
      expect(comment).toContain('https://note.com/alice_dev/n/');
      expect(comment).toContain('https://qiita.com/engineer_taro/items/');

      // リンクと要約は残る
      expect(comment).toContain('https://cor-jp.com/blog/local-ai-setup/');
      expect(comment).toContain('分かりやすく、参考になった');
      expect(comment).toContain('種類:');
    });

    it('不正な応答でエラーを投げる', () => {
      expect(() => formatReactionComment({})).toThrow(/Invalid Grok response format/);
    });
  });

  describe('removePersonalNames を外すと名前が残る（red）', () => {
    it('名前除去処理を外すと fixture の名前がそのまま残る', () => {
      const fixturePath = path.join(fixturesDir, 'grok-reaction-response.json');
      const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8'));
      const content = fixture.choices[0].message.content;

      // removePersonalNames を呼ばずに直接使うと、名前を含む行が残る
      expect(content).toContain('投稿者:');
      expect(content).toContain('アカウント:');
      expect(content).toContain('@testuser123');

      // 除去処理を通すと、1行単位で消える
      const cleaned = removePersonalNames(content);
      expect(cleaned).not.toContain('投稿者:');
      expect(cleaned).not.toContain('アカウント:');
      expect(cleaned).not.toContain('@testuser123');
      
      // URL 内のアカウント名は残る
      expect(cleaned).toContain('alice_dev'); // URL 内
    });
  });
});
