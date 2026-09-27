-- Keyed idempotency fingerprint. The HMAC input is constructed transiently by
-- the Worker; D1 stores only the digest and never a second plaintext PII copy.
ALTER TABLE submission_intake
  ADD COLUMN payload_fingerprint TEXT NOT NULL DEFAULT '';
