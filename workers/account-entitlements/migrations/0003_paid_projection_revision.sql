-- Reject a stale synchronizer without changing the existing read contract.
ALTER TABLE paid_contract_snapshots ADD COLUMN observed_at_ms INTEGER NOT NULL DEFAULT 0;
ALTER TABLE paid_contract_snapshots ADD COLUMN sync_id TEXT NOT NULL DEFAULT '';
