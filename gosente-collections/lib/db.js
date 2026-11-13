const { Pool } = require("pg");

let pool;
function db() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  if (!pool) pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000
  });
  return pool;
}

async function ensureSchema() {
  await db().query(`
    CREATE TABLE IF NOT EXISTS gosente_payments (
      id BIGSERIAL PRIMARY KEY,
      ref TEXT NOT NULL UNIQUE,
      gateway_reference TEXT,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      amount BIGINT NOT NULL CHECK (amount >= 500),
      currency TEXT NOT NULL DEFAULT 'UGX',
      purpose TEXT NOT NULL DEFAULT 'collection',
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','successful','failed','cancelled')),
      channel TEXT,
      provider_response JSONB,
      verified_at TIMESTAMPTZ,
      app_id TEXT,
      device_id TEXT,
      plan_id TEXT,
      plan_duration_days INTEGER,
      plan_name TEXT,
      idempotency_key TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE gosente_payments
      ADD COLUMN IF NOT EXISTS app_id TEXT,
      ADD COLUMN IF NOT EXISTS device_id TEXT,
      ADD COLUMN IF NOT EXISTS plan_id TEXT,
      ADD COLUMN IF NOT EXISTS plan_duration_days INTEGER,
      ADD COLUMN IF NOT EXISTS plan_name TEXT,
      ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

    CREATE TABLE IF NOT EXISTS subscription_plans (
      id BIGSERIAL PRIMARY KEY,
      app_id TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      amount BIGINT NOT NULL CHECK (amount >= 500),
      currency TEXT NOT NULL DEFAULT 'UGX',
      duration_days INTEGER NOT NULL CHECK (duration_days > 0 AND duration_days <= 3650),
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(app_id, plan_id)
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id BIGSERIAL PRIMARY KEY,
      app_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      payment_ref TEXT NOT NULL UNIQUE REFERENCES gosente_payments(ref),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','revoked')),
      starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS gosente_payments_created_at_idx ON gosente_payments(created_at DESC);
    CREATE INDEX IF NOT EXISTS gosente_payments_status_idx ON gosente_payments(status);
    CREATE INDEX IF NOT EXISTS subscription_plans_app_active_idx ON subscription_plans(app_id, active);
    CREATE INDEX IF NOT EXISTS subscriptions_device_lookup_idx ON subscriptions(app_id, device_id, status, expires_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS gosente_payments_idempotency_idx
      ON gosente_payments(app_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
  `);
}
module.exports = { db, ensureSchema };
