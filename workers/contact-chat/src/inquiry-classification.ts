import type { Classification } from './types';

/**
 * 受付の機械の分類。会話の応答の classification（genuine / sales / spam）とは別に、
 * 受付の記録と案件の写しに使う 3 値へ写す。写し方を変えたら版を上げる。
 *
 * - 値はサーバーが会話の応答から決める。ブラウザが送った値では決めない。
 * - 解析できない・未知の値・会話が無い、はすべて unknown（相談に倒さない）。
 * - spam も unknown にする。受付を捨てず、人が決める。
 */
export const INQUIRY_CLASSIFICATION_VERSION = 'inquiry-classification-v1' as const;

export const MACHINE_CLASSIFICATIONS = ['consult', 'sales', 'unknown'] as const;
export type MachineClassification = (typeof MACHINE_CLASSIFICATIONS)[number];

export const CLASSIFICATION_REASONS = [
  'model_genuine',
  'model_sales',
  'model_spam',
  'model_unparsed',
  'no_model_turn',
  'no_session',
] as const;
export type ClassificationReason = (typeof CLASSIFICATION_REASONS)[number];

export const CLASSIFICATION_ORIGINS = ['model', 'fallback'] as const;
export type ClassificationOrigin = (typeof CLASSIFICATION_ORIGINS)[number];

export interface InquiryClassification {
  value: MachineClassification;
  reason: ClassificationReason;
  origin: ClassificationOrigin;
  version: string;
}

const FROM_MODEL: Record<Classification, Pick<InquiryClassification, 'value' | 'reason'>> = {
  genuine: { value: 'consult', reason: 'model_genuine' },
  sales: { value: 'sales', reason: 'model_sales' },
  spam: { value: 'unknown', reason: 'model_spam' },
};

/** 会話の応答から読めた classification。読めなかったときは null を渡す。 */
export function classifyFromModel(model: Classification | null): InquiryClassification {
  if (model === null) return unclassified('model_unparsed');
  return { ...FROM_MODEL[model], origin: 'model', version: INQUIRY_CLASSIFICATION_VERSION };
}

/** モデルの判断が無いときの分類。 */
export function unclassified(
  reason: Extract<ClassificationReason, 'model_unparsed' | 'no_model_turn' | 'no_session'>,
): InquiryClassification {
  return { value: 'unknown', reason, origin: 'fallback', version: INQUIRY_CLASSIFICATION_VERSION };
}

function oneOf<T extends string>(allowed: readonly T[], raw: unknown): T | null {
  return typeof raw === 'string' && (allowed as readonly string[]).includes(raw) ? (raw as T) : null;
}

/**
 * 保存した列を読み戻す。どれか 1 つでも知らない値なら、全体を unknown として扱う
 * （欄ごとに混ぜると、値と理由が食い違う）。
 */
export function readStoredClassification(row: {
  machine_classification?: unknown;
  classification_reason?: unknown;
  classification_origin?: unknown;
  classification_version?: unknown;
}): InquiryClassification {
  const value = oneOf(MACHINE_CLASSIFICATIONS, row.machine_classification);
  const reason = oneOf(CLASSIFICATION_REASONS, row.classification_reason);
  const origin = oneOf(CLASSIFICATION_ORIGINS, row.classification_origin);
  const version = typeof row.classification_version === 'string' ? row.classification_version : '';
  if (!value || !reason || !origin || version !== INQUIRY_CLASSIFICATION_VERSION) {
    return unclassified('no_model_turn');
  }
  return { value, reason, origin, version };
}
