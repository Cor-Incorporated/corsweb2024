import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// 同じ表に同じ列を足す migration が 2 つ在ると、後に当てた方が `duplicate column name` で途中まで当たって止まる。
// 番号を付け直しても列の名前は重なるので、列の単位で照らす。

interface AddedColumn {
  table: string;
  column: string;
  file: string;
}

const ADD_COLUMN = /ALTER\s+TABLE\s+([A-Za-z_][A-Za-z0-9_]*)\s+ADD\s+COLUMN\s+([A-Za-z_][A-Za-z0-9_]*)/gi;

function addedColumns(file: string, sql: string): AddedColumn[] {
  const withoutComments = sql.replace(/--[^\n]*/g, '');
  return Array.from(withoutComments.matchAll(ADD_COLUMN), (match) => ({
    table: match[1].toLowerCase(),
    column: match[2].toLowerCase(),
    file,
  }));
}

function duplicateColumns(files: ReadonlyArray<{ file: string; sql: string }>): string[] {
  const byKey = new Map<string, string[]>();
  for (const { file, sql } of files) {
    for (const added of addedColumns(file, sql)) {
      const key = `${added.table}.${added.column}`;
      byKey.set(key, [...(byKey.get(key) ?? []), added.file]);
    }
  }
  return Array.from(byKey.entries())
    .filter(([, owners]) => owners.length > 1)
    .map(([key, owners]) => `${key} は ${owners.join(' と ')} の両方が足す`);
}

function migrationFiles(): Array<{ file: string; sql: string }> {
  const dir = resolve(__dirname, '../../migrations');
  return readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((file) => ({ file, sql: readFileSync(resolve(dir, file), 'utf8') }));
}

describe('migration の列', () => {
  it('同じ表に同じ列を足す migration が 2 つ無い', () => {
    expect(duplicateColumns(migrationFiles())).toEqual([]);
  });

  it('反証: 資料請求の migration と同じ形（submission_intake に industry を足す）を足すと、表・列・2 つの file の名前を挙げて落ちる', () => {
    const accident = {
      file: '0006_document_request.sql',
      sql: "ALTER TABLE submission_intake ADD COLUMN industry TEXT NOT NULL DEFAULT '';",
    };
    expect(duplicateColumns([...migrationFiles(), accident])).toEqual([
      'submission_intake.industry は 0005_inquiry_context.sql と 0006_document_request.sql の両方が足す',
    ]);
  });
});
