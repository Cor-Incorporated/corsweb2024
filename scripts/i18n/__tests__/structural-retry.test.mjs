// @vitest-environment node
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { TARGET_LANGS } from '../config.mjs';
import { bodyCore, parseDocument } from '../frontmatter.mjs';
import { protect } from '../markdown.mjs';
import { translateDocument, TranslationError } from '../translate.mjs';
import {
  createMockClient,
  createTempRepo,
  fakeTranslate,
  FIXED_NOW,
  JA_BLOG,
  runCli,
} from './helpers.mjs';

const source = parseDocument(JA_BLOG);
const protectedSource = protect(bodyCore(source.body)).text;
const validBody = fakeTranslate(protectedSource);
const mergeParagraphs = (text) =>
  text.replace('\n\nSecond paragraph stays in English.', ' Second paragraph stays in English.');
const mergedBody = mergeParagraphs(validBody);
const blockError = '段落などのブロック数が一致しません（ja 13 / 翻訳 12）';

// Script the body responses independently of the repair-prompt format. Metadata still uses the
// ordinary mock; no model call is made and no request is silently treated as a valid repair.
function scriptedClient(bodyResponse) {
  const fieldsClient = createMockClient();
  const calls = [];
  let bodyCalls = 0;
  return {
    model: fieldsClient.model,
    calls,
    async generate(request) {
      calls.push(request);
      if (request.jsonSchema) return fieldsClient.generate(request);
      bodyCalls += 1;
      return { text: bodyResponse(bodyCalls, request), finishReason: 'STOP' };
    },
  };
}

const bodyRequests = (client) => client.calls.filter((request) => !request.jsonSchema);
const run = (client, options = {}) =>
  translateDocument({
    collection: 'blog',
    lang: 'en',
    source,
    client,
    now: FIXED_NOW,
    attempts: 2,
    ...options,
  });

describe('body retry with structural feedback', () => {
  it.each(TARGET_LANGS)(
    '%s: keeps the first request and accepts a complete, valid repair',
    async (lang) => {
      const ordinaryClient = createMockClient();
      const ordinary = await run(ordinaryClient, { lang });
      const client = scriptedClient((attempt) => (attempt === 1 ? mergedBody : validBody));
      const repaired = await run(client, { lang });
      const requests = bodyRequests(client);

      expect(requests).toHaveLength(2);
      expect(requests[0]).toEqual(bodyRequests(ordinaryClient)[0]);
      expect(JSON.parse(requests[1].prompt)).toEqual({
        sourceMarkdown: protectedSource,
        previousTranslation: mergedBody,
        validationErrors: [blockError],
      });
      expect(requests[1].prompt).not.toMatch(/https?:\/\/|console\.log|```/);
      expect(requests[1].system).toContain('refer only to sourceMarkdown');
      expect(requests[1].system).toContain(
        'Match each source block to its translated block in the same order'
      );
      expect(requests[1].system).toContain('Never strengthen or weaken claims');
      // Compare the full document, not just block counts: metadata, protected content, order and all
      // paragraphs must equal the accepted control translation.
      expect(repaired.text).toBe(ordinary.text);
    }
  );

  it.each([
    ['heading', (text) => text.replace('## lorem\n\n', ''), /見出し H2 の数が一致しません/],
    ['list item', (text) => text.replace('- Third item\n', ''), /リスト項目の数が一致しません/],
    ['table row', (text) => text.replace('| A | lorem |\n', ''), /表の行数が一致しません/],
    [
      'table cell',
      (text) => text.replace('| A | lorem |', '| A |'),
      /表の 3 行目のセルの数が一致しません/,
    ],
  ])('passes a safe %s count diagnostic to the retry', async (_kind, mutate, expectedError) => {
    const rejected = mutate(validBody);
    expect(rejected).not.toBe(validBody);
    const client = scriptedClient((attempt) => (attempt === 1 ? rejected : validBody));
    await run(client);
    const repair = JSON.parse(bodyRequests(client)[1].prompt);
    expect(repair.sourceMarkdown).toBe(protectedSource);
    expect(repair.previousTranslation).toBe(rejected);
    expect(repair.validationErrors.some((error) => expectedError.test(error))).toBe(true);
  });

  it('uses the latest rejected response without accumulating earlier drafts or changing the source', async () => {
    const missingParagraph = validBody.replace('Second paragraph stays in English.\n\n', '');
    const responses = [mergedBody, missingParagraph, validBody];
    const client = scriptedClient((attempt) => responses[attempt - 1]);
    await run(client, { attempts: 3 });
    const repair = JSON.parse(bodyRequests(client)[2].prompt);
    expect(repair).toEqual({
      sourceMarkdown: protectedSource,
      previousTranslation: missingParagraph,
      validationErrors: [blockError],
    });
  });

  it.each([1, 2, 3])(
    'does not exceed the configured %i body attempts when the repair still fails',
    async (attempts) => {
      const client = scriptedClient(() => mergedBody);
      const error = await run(client, { attempts }).catch((caught) => caught);
      expect(error).toBeInstanceOf(TranslationError);
      expect(error.errors).toEqual(
        Array.from({ length: attempts }, (_, index) => `#${index + 1} ${blockError}`)
      );
      expect(bodyRequests(client)).toHaveLength(attempts);
    }
  );

  it('does not send restored source URLs through diagnostics and retains all errors in the failure report', async () => {
    // Keep the token present, but move it into a link title so the restored destination is wrong.
    const rejected = mergedBody.replace(
      /\[lorem\]\((⟦P\d+⟧)\)/,
      '[lorem](https://changed.example "$1")'
    );
    expect(rejected).not.toBe(mergedBody);
    const client = scriptedClient(() => rejected);
    const error = await run(client).catch((caught) => caught);
    expect(error).toBeInstanceOf(TranslationError);
    expect(error.errors.join('\n')).toContain('https://cor-jp.com');
    const repairRequest = bodyRequests(client)[1];
    expect(JSON.parse(repairRequest.prompt).validationErrors).toEqual([blockError]);
    expect(repairRequest.prompt).not.toContain('https://cor-jp.com');
    expect(repairRequest.prompt).not.toContain('console.log');
  });

  it('uses the ordinary retry when no allowlisted count diagnostic is available', async () => {
    const rejected = validBody.replace(
      /\[lorem\]\((⟦P\d+⟧)\)/,
      '[lorem](https://changed.example "$1")'
    );
    const client = scriptedClient((attempt) => (attempt === 1 ? rejected : validBody));
    await run(client);
    const requests = bodyRequests(client);
    expect(requests).toHaveLength(2);
    expect(requests[1]).toEqual(requests[0]);
  });

  it('still rejects a repair that drops a protected token', async () => {
    const client = scriptedClient((attempt) =>
      attempt === 1 ? mergedBody : validBody.replace(/⟦P\d+⟧/, '')
    );
    const error = await run(client).catch((caught) => caught);
    expect(error).toBeInstanceOf(TranslationError);
    expect(error.errors[0]).toBe(`#1 ${blockError}`);
    expect(error.errors.join('\n')).toMatch(/#2 プレースホルダ ⟦P\d+⟧ が欠落しています/);
    expect(bodyRequests(client)).toHaveLength(2);
  });

  it('still rejects a repair that swaps link destinations', async () => {
    const twoLinks = parseDocument(
      JA_BLOG.replace(
        '[公式サイト](https://cor-jp.com)',
        '[公式サイト](https://cor-jp.com) と [GitHub](https://github.com/Cor-Incorporated)'
      )
    );
    const correct = fakeTranslate(protect(bodyCore(twoLinks.body)).text);
    const [first, second] = [...correct.matchAll(/\]\(⟦(P\d+)⟧\)/g)].map((match) => match[1]);
    const swapped = correct.replace(
      new RegExp(`⟦(${first}|${second})⟧`, 'g'),
      (_match, id) => `⟦${id === first ? second : first}⟧`
    );
    const client = scriptedClient((attempt) =>
      attempt === 1 ? mergeParagraphs(correct) : swapped
    );
    const error = await run(client, { source: twoLinks }).catch((caught) => caught);
    expect(error).toBeInstanceOf(TranslationError);
    expect(error.errors.join('\n')).toMatch(
      /#2 リンク・画像などの行き先の順序が ja と一致しません/
    );
    expect(bodyRequests(client)).toHaveLength(2);
  });

  it.each(['missing', 'stale'])(
    '%s: writes nothing when the structural repair remains invalid',
    async (status) => {
      const previous = await run(createMockClient());
      const currentJa = JA_BLOG.replace('これは', '追加の説明です。これは');
      const files = { 'blog/ja/alpha.md': currentJa };
      if (status === 'stale') files['blog/en/alpha.md'] = previous.text;
      const repo = await createTempRepo(files);
      try {
        const currentSource = parseDocument(currentJa);
        const rejected = mergeParagraphs(fakeTranslate(protect(bodyCore(currentSource.body)).text));
        const client = scriptedClient(() => rejected);
        const result = await runCli(repo.root, ['--write', '--langs', 'en'], { client });
        expect(result.code).toBe(1);
        expect(bodyRequests(client)).toHaveLength(2);
        expect(JSON.parse(bodyRequests(client)[1].prompt).validationErrors).toEqual([blockError]);
        const target = path.join(repo.root, 'src/content/blog/en/alpha.md');
        if (status === 'stale') expect(await readFile(target, 'utf8')).toBe(previous.text);
        else expect(existsSync(target)).toBe(false);
        expect(await readFile(path.join(repo.root, 'src/content/blog/ja/alpha.md'), 'utf8')).toBe(
          currentJa
        );
      } finally {
        await repo.cleanup();
      }
    }
  );
});
