import { logContactFailure } from './log';
import {
  claimDocumentCaseSync,
  readDocumentRequestSyncSource,
  setDocumentCaseSyncStatus,
} from './storage';
import type {
  DocumentRequestSyncAuth,
  DocumentRequestSyncDisposition,
  DocumentRequestSyncResult,
  DocumentRequestSyncSource,
  Env,
} from './types';

const TERMINAL: readonly DocumentRequestSyncDisposition[] = [
  'accepted',
  'ack_unknown',
  'quarantined',
  'conflict',
  'lease_held',
  'auth_rejected',
];

export async function syncSourceDigest(source: DocumentRequestSyncSource): Promise<string> {
  const canonical = JSON.stringify({
    consentVersion: source.consentVersion,
    documentId: source.documentId,
    industry: source.industry,
    intakeStatus: source.intakeStatus,
    receiptId: source.receiptId,
    recordedAt: source.recordedAt,
  });
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function toSource(row: {
  receiptId: string;
  documentId: string;
  industry: string | null;
  consentVersion: string;
  recordedAt: string;
  intakeStatus: 'stored';
}): DocumentRequestSyncSource {
  return {
    receiptId: row.receiptId,
    documentId: row.documentId,
    industry: row.industry,
    consentVersion: row.consentVersion,
    recordedAt: row.recordedAt,
    intakeStatus: 'stored',
  };
}

/** mock かつ専用資格かつ binding があるときだけ開く。live や鍵の流用では開かない。 */
export function documentCaseSyncReady(env: Env): boolean {
  if (env.DOCUMENT_REQUEST_CASE_SYNC_MODE !== 'mock') return false;
  if (!env.DOCUMENT_REQUEST_CASE_SYNC) return false;
  const principalId = env.DOCUMENT_REQUEST_SYNC_PRINCIPAL_ID?.trim() || '';
  const syncToken = env.DOCUMENT_REQUEST_SYNC_TOKEN?.trim() || '';
  if (!principalId || !syncToken) return false;
  const ownerKeys = [env.PII_ENCRYPTION_KEY, env.PII_HMAC_KEY].filter((value): value is string => Boolean(value));
  if (ownerKeys.includes(principalId) || ownerKeys.includes(syncToken)) return false;
  return true;
}

async function authFor(env: Env, source: DocumentRequestSyncSource): Promise<DocumentRequestSyncAuth | null> {
  if (!documentCaseSyncReady(env)) return null;
  const principalId = env.DOCUMENT_REQUEST_SYNC_PRINCIPAL_ID?.trim() || '';
  const syncToken = env.DOCUMENT_REQUEST_SYNC_TOKEN?.trim() || '';
  return { principalId, syncToken, digest: await syncSourceDigest(source) };
}

function dispositionOf(result: DocumentRequestSyncResult | null | undefined): DocumentRequestSyncDisposition | null {
  const value = result?.disposition;
  switch (value) {
    case 'accepted':
    case 'retry_scheduled':
    case 'ack_unknown':
    case 'quarantined':
    case 'conflict':
    case 'lease_held':
    case 'auth_rejected':
      return value;
    default:
      return null;
  }
}

async function remember(env: Env, receiptId: string, disposition: DocumentRequestSyncDisposition | 'sync_failed'): Promise<void> {
  await setDocumentCaseSyncStatus(env, receiptId, disposition);
}

/**
 * 保存後の同期。失敗しても投げない。受付の status は変えない。
 * retry_scheduled 以外では retry を呼ばない。
 */
export async function syncStoredDocumentRequest(env: Env, receiptId: string): Promise<void> {
  try {
    const row = await readDocumentRequestSyncSource(env, receiptId);
    if (!row) return;
    if (!documentCaseSyncReady(env)) return;
    if (row.caseSyncStatus !== '') return;
    if (!await claimDocumentCaseSync(env, receiptId, '')) return;
    const source = toSource(row);
    const auth = await authFor(env, source);
    const binding = env.DOCUMENT_REQUEST_CASE_SYNC;
    if (!auth || !binding) {
      await remember(env, receiptId, 'sync_failed');
      return;
    }
    const result = await binding.acceptStored(auth, source);
    const disposition = dispositionOf(result);
    await remember(env, receiptId, disposition ?? 'sync_failed');
    if (!disposition || (disposition !== 'accepted' && disposition !== 'retry_scheduled')) {
      logContactFailure('document_case_sync_failed');
    }
  } catch {
    logContactFailure('document_case_sync_failed');
    try {
      await remember(env, receiptId, 'sync_failed');
    } catch {
      logContactFailure('document_case_sync_failed');
    }
  }
}

/** 明示の再送。状態が retry_scheduled のときだけ retry(auth, receiptId) を呼ぶ。 */
export async function retryStoredDocumentRequest(env: Env, receiptId: string): Promise<'retried' | 'left'> {
  const row = await readDocumentRequestSyncSource(env, receiptId);
  if (!row || row.caseSyncStatus !== 'retry_scheduled') return 'left';
  if (!documentCaseSyncReady(env)) return 'left';
  if (!await claimDocumentCaseSync(env, receiptId, 'retry_scheduled')) return 'left';
  const source = toSource(row);
  const auth = await authFor(env, source);
  const binding = env.DOCUMENT_REQUEST_CASE_SYNC;
  if (!auth || !binding) {
    await remember(env, receiptId, 'retry_scheduled');
    return 'left';
  }
  try {
    const result = await binding.retry(auth, receiptId);
    const disposition = dispositionOf(result);
    await remember(env, receiptId, disposition ?? 'sync_failed');
    return disposition ? 'retried' : 'left';
  } catch {
    logContactFailure('document_case_sync_failed');
    await remember(env, receiptId, 'sync_failed');
    return 'left';
  }
}

export function syncDispositionStopsRetry(disposition: string): boolean {
  return (TERMINAL as readonly string[]).includes(disposition);
}
