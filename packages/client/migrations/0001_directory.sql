-- Signed server directory (DECISION-0056/0057). One row per server, replaced on every announce.
CREATE TABLE IF NOT EXISTS records (
  server_id TEXT PRIMARY KEY,        -- base64url ed25519 public key (self-certifying)
  seq INTEGER NOT NULL,              -- strictly increasing, part of the signed message
  ip TEXT NOT NULL,
  udp_port INTEGER NOT NULL,
  fingerprint TEXT NOT NULL,         -- "sha-256 AA:BB:..." of the server's DTLS certificate
  ws_url TEXT NOT NULL DEFAULT '',   -- optional tunnel fallback
  claim_hash TEXT NOT NULL DEFAULT '',
  claim_proof TEXT NOT NULL DEFAULT '',
  sig TEXT NOT NULL,
  src TEXT NOT NULL,                 -- salted hash of the announcing address (rate limit only)
  created_at INTEGER NOT NULL,       -- ms
  updated_at INTEGER NOT NULL,       -- ms
  claim_expires_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS records_claim ON records (claim_hash);
CREATE INDEX IF NOT EXISTS records_src ON records (src, created_at);
CREATE INDEX IF NOT EXISTS records_updated ON records (updated_at);
