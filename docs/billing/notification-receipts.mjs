import { randomUUID } from 'node:crypto';

const leaseMs = 120_000;

export function createD1NotificationReceipts(db, { now = Date.now } = {}) {
  const ownerCheck = 'customer_id = ? AND owner = ?';
  function release(customer, owner) {
    return db.prepare(`DELETE FROM billing_reconciliation_leases WHERE ${ownerCheck}`).bind(customer, owner);
  }
  return {
    async reserve(customer, eventId) {
      const time = now();
      const owner = randomUUID();
      const [receipt, lock] = await db.batch([
        db.prepare('SELECT event_id FROM billing_notification_receipts WHERE customer_id = ? AND event_id = ?')
          .bind(customer, eventId),
        db.prepare(`INSERT INTO billing_reconciliation_leases(customer_id, owner, expires_at_ms)
          SELECT ?, ?, ? WHERE NOT EXISTS (
            SELECT 1 FROM billing_notification_receipts WHERE customer_id = ? AND event_id = ?
          ) ON CONFLICT(customer_id) DO UPDATE SET owner = excluded.owner, expires_at_ms = excluded.expires_at_ms
          WHERE billing_reconciliation_leases.expires_at_ms <= ?`)
          .bind(customer, owner, time + leaseMs, customer, eventId, time),
      ]);
      if (receipt.results.length) return { state: 'duplicate' };
      return lock.meta.changes ? { state: 'reserved', owner } : { state: 'busy' };
    },
    async complete(customer, eventId, owner) {
      const time = now();
      const statement = eventId ? db.prepare(`INSERT INTO billing_notification_receipts
        (customer_id, event_id, completed_at_ms) SELECT ?, ?, ? WHERE EXISTS (
          SELECT 1 FROM billing_reconciliation_leases WHERE ${ownerCheck} AND expires_at_ms > ?
        )`).bind(customer, eventId, time, customer, owner, time) :
        db.prepare(`UPDATE billing_reconciliation_leases SET expires_at_ms = expires_at_ms
          WHERE ${ownerCheck} AND expires_at_ms > ?`).bind(customer, owner, time);
      const [result] = await db.batch([statement, release(customer, owner)]);
      if (result.meta.changes !== 1) throw new Error('Billing reconciliation lease was lost');
    },
    async abandon(customer, owner) {
      await release(customer, owner).run();
    },
  };
}
