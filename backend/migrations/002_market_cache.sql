-- 002_market_cache.sql
-- Purpose: Adds persistent cache tables for static asset metadata
-- and time-stamped price data. Replaces live Finnhub calls on every request.

-- Static data that never changes for a given ticker.
-- Populated once from getProfile(), kept forever.
CREATE TABLE IF NOT EXISTS asset_metadata (
  ticker       TEXT PRIMARY KEY,
  name         TEXT NOT NULL DEFAULT '',
  asset_type   TEXT NOT NULL DEFAULT 'stock',
  exchange     TEXT NOT NULL DEFAULT '',
  currency     TEXT NOT NULL DEFAULT '',
  logo         TEXT NOT NULL DEFAULT '',
  description  TEXT NOT NULL DEFAULT '',
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Latest known price for each ticker.
-- Overwritten on every successful Finnhub quote fetch.
CREATE TABLE IF NOT EXISTS price_cache (
  ticker          TEXT PRIMARY KEY,
  price           REAL NOT NULL DEFAULT 0,
  change          REAL NOT NULL DEFAULT 0,
  change_percent  REAL NOT NULL DEFAULT 0,
  high            REAL NOT NULL DEFAULT 0,
  low             REAL NOT NULL DEFAULT 0,
  open            REAL NOT NULL DEFAULT 0,
  previous_close  REAL NOT NULL DEFAULT 0,
  volume          REAL NOT NULL DEFAULT 0,
  asset_type      TEXT NOT NULL DEFAULT 'stock',
  fetched_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_price_cache_fetched_at ON price_cache(fetched_at);
CREATE INDEX IF NOT EXISTS idx_asset_metadata_type    ON asset_metadata(asset_type);