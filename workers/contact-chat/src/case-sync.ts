import { logContactFailure } from './log';
import {
  claimDocumentCaseSync,
  readDocumentRequestSyncSource,
  setDocumentCaseSyncStatus,
} from './storage';
import type {
  DocumentRequestSyncAuth,
  DocumentRequestSyncResult,
  DocumentRequestSyncSource,
  Env,
} from './types';

const PRINCIPAL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RememberedSync =
  | 'recorded'
  | 'retry_scheduled'
  | 'ack_unknown'
  | 'quarantined'
  | 'conflict'
  | 'lease_held'
  | 'rejected'
  | 'not_connected'
  | 'sync_failed';

function toSource(row: {
  receiptId: string;
  documentId: string;
  industry: DocumentRequestSyncSource['industry'];
  consentVersion: string;
  recordedAt: string;
}): DocumentRequestSyncSource {
  return {
    receiptId: row.receiptId,
    documentId: 'company-deck',
    industry: row.industry,
    consentVersion: row.consentVersion,
    recordedAt: row.recordedAt,
    intakeStatus: 'stored',
  };
}

/**
 * mock かつ専用資格かつ binding があるときだけ開く。
 * live、未設定、資格不足、PII 鍵の流用では開かない。DB は見ない。
 */
export function documentCaseSyncReady(env: Env): boolean {
  if (env.DOCUMENT_REQUEST_CASE_SYNC_MODE !== 'mock') return false;
  if (!env.DOCUMENT_REQUEST_CASE_SYNC) return false;
  const principalId = env.DOCUMENT_REQUEST_SYNC_PRINCIPAL_ID?.trim() || '';
  const syncToken = env.DOCUMENT_REQUEST_SYNC_TOKEN?.trim() || '';
  if (!PRINCIPAL_UUID.test(principalId)) return false;
  if (syncToken.length < 16 || syncToken.length > 200) return false;
  const ownerKeys = [env.PII_ENCRYPTION_KEY, env.PII_HMAC_KEY].filter((value): value is string => Boolean(value));
  if (ownerKeys.includes(principalId) || ownerKeys.includes(syncToken)) return false;
  return true;
}

function authFor(env: Env): DocumentRequestSyncAuth | null {
  if (!documentCaseSyncReady(env)) return null;
  return {
    principalId: env.DOCUMENT_REQUEST_SYNC_PRINCIPAL_ID?.trim() || '',
    syncToken: env.DOCUMENT_REQUEST_SYNC_TOKEN?.trim() || '',
  };
}

/** conflict は syncStatus が recorded でも成功にしない。not_connected は recorded にしない。 */
export function rememberSyncResult(result: DocumentRequestSyncResult | null | undefined): RememberedSync {
  if (!result) return 'sync_failed';
  switch (result.outcome) {
    case 'recorded':
      return 'recorded';
    case 'retry_scheduled':
      return 'retry_scheduled';
    case 'ack_unknown':
      return 'ack_unknown';
    case 'quarantined':
      return 'quarantined';
    case 'conflict':
      return 'conflict';
    case 'lease_held':
      return 'lease_held';
    case 'rejected':
      return 'rejected';
    case 'not_connected':
      return 'not_connected';
    default: {
      const unexpected: never = result.outcome;
      void unexpected;
      return 'sync_failed';
    }
  }
}

function shouldLog(status: RememberedSync): boolean {
  return status !== 'recorded' && status !== 'retry_scheduled';
}

async function remember(env: Env, receiptId: string, status: RememberedSync): Promise<void> {
  await setDocumentCaseSyncStatus(env, receiptId, status);
}

/**
 * 保存後の同期。準備ができないときは DB を読まない。
 * 失敗しても投げない。受付の status は変えない。retry はここでは呼ばない。
 */
export async function syncStoredDocumentRequest(env: Env, receiptId: string): Promise<void> {
  if (!documentCaseSyncReady(env)) return;
  try {
    const row = await readDocumentRequestSyncSource(env, receiptId);
    if (!row || row.caseSyncStatus !== '') return;
    if (!await claimDocumentCaseSync(env, receiptId, '')) return;
    const source = toSource(row);
    const auth = authFor(env);
    const binding = env.DOCUMENT_REQUEST_CASE_SYNC;
    if (!auth || !binding) {
      await remember(env, receiptId, 'sync_failed');
      return;
    }
    const result = await binding.acceptStored(auth, source);
    const status = rememberSyncResult(result);
    await remember(env, receiptId, status);
    if (shouldLog(status)) logContactFailure('document_case_sync_failed');
  } catch {
    logContactFailure('document_case_sync_failed');
    try {
      await remember(env, receiptId, 'sync_failed');
    } catch {
      logContactFailure('document_case_sync_failed');
    }
  }
}

/** 明示の再送。保存状態が retry_scheduled のときだけ retry(auth, receiptId) を呼ぶ。 */
export async function retryStoredDocumentRequest(env: Env, receiptId: string): Promise<'retried' | 'left'> {
  if (!documentCaseSyncReady(env)) return 'left';
  const row = await readDocumentRequestSyncSource(env, receiptId);
  if (!row || row.caseSyncStatus !== 'retry_scheduled') return 'left';
  if (!await claimDocumentCaseSync(env, receiptId, 'retry_scheduled')) return 'left';
  const auth = authFor(env);
  const binding = env.DOCUMENT_REQUEST_CASE_SYNC;
  if (!auth || !binding) {
    await remember(env, receiptId, 'retry_scheduled');
    return 'left';
  }
  try {
    const result = await binding.retry(auth, receiptId);
    const status = rememberSyncResult(result);
    await remember(env, receiptId, status);
    if (shouldLog(status)) logContactFailure('document_case_sync_failed');
    return status === 'sync_failed' ? 'left' : 'retried';
  } catch {
    logContactFailure('document_case_sync_failed');
    await remember(env, receiptId, 'sync_failed');
    return 'left';
  }
}
