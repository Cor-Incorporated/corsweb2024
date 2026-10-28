// ログに出す文字列は、この一覧のコードだけ。
// error.message は URL、トークン、テナント、案件、送信 ID、氏名を含み得るので連結しない。

export const CONTACT_LOG_EVENTS = [
  'session_storage_failed',
  'llm_failed',
  'email_unconfigured',
  'submission_storage_failed',
  'notification_queue_unconfigured',
  'notification_enqueue_failed',
  'email_send_failed',
  'unhandled',
  'retention_cleanup_failed',
  'notification_failed',
  'body_too_large',
  'body_timeout',
] as const;

export type ContactLogEvent = (typeof CONTACT_LOG_EVENTS)[number];

const ALLOWED_EVENTS: ReadonlySet<string> = new Set(CONTACT_LOG_EVENTS);

export function logContactFailure(event: ContactLogEvent): void {
  if (!ALLOWED_EVENTS.has(event)) return;
  console.error(`contact-chat:${event}`);
}

export type NotificationFailureCode = 'notification_failed' | `provider_status_${string}`;

const SAFE_FAILURE_CODE = /^(?:notification_failed|provider_status_[1-5]\d{2})$/;
const PROVIDER_STATUS = /(?:^|\D)status\s+([1-5]\d{2})(?!\d)/;

// D1 の last_error に残してよい形へ落とす。原文は保存しない。
export function notificationFailureCode(error: unknown): NotificationFailureCode {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  if (SAFE_FAILURE_CODE.test(message)) return message as NotificationFailureCode;
  const status = PROVIDER_STATUS.exec(message)?.[1];
  if (status) return `provider_status_${status}`;
  return 'notification_failed';
}
