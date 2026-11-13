import type { IndustrySlug } from './industry-context';
import type { MachineClassification } from './inquiry-classification';
import { readStoredClassification } from './inquiry-classification';
import { readStoredEntryContext } from './inquiry-context';

/**
 * 問い合わせの受付を、案件の側へ渡すための写し。個人情報を持たない。
 *
 * - 欄はこの 6 つだけ。名前・メール・会社・電話・本文・要約・会話の抜粋は持たない。
 * - 送る口はこの file に無い。作るだけで、どこにも送らない。
 * - 欄を足すときは、試験の欄の一覧も同じ commit で直す（個人情報の欄を足すと試験が落ちる）。
 */
export interface InquiryCaseCopy {
  receiptId: string;
  industry: IndustrySlug | '';
  entryPath: string;
  classification: MachineClassification;
  classificationVersion: string;
  createdAt: string;
}

/** 写しの元になる列。暗号文の列は受け取らない。 */
export interface InquiryCaseCopySource {
  receipt_id: string;
  industry?: unknown;
  entry_path?: unknown;
  machine_classification?: unknown;
  classification_reason?: unknown;
  classification_origin?: unknown;
  classification_version?: unknown;
  created_at: number;
}

export function buildInquiryCaseCopy(row: InquiryCaseCopySource): InquiryCaseCopy {
  const entry = readStoredEntryContext(row);
  const classification = readStoredClassification(row);
  return {
    receiptId: row.receipt_id,
    industry: entry.industry,
    entryPath: entry.entryPath,
    classification: classification.value,
    classificationVersion: classification.version,
    createdAt: new Date(row.created_at * 1000).toISOString(),
  };
}
