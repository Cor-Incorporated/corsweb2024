-- Receipts contain identifiers only and are written after verified reconciliation.
CREATE TABLE billing_notification_receipts (
  customer_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  completed_at_ms INTEGER NOT NULL,
  PRIMARY KEY (customer_id, event_id)
) STRICT;

-- One active reconciliation per customer, shared by notifications and the periodic job.
CREATE TABLE billing_reconciliation_leases (
  customer_id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  expires_at_ms INTEGER NOT NULL
) STRICT;
