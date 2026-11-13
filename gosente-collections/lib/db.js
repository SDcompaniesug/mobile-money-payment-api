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
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS gosente_payments_created_at_idx ON gosente_payments(created_at DESC);
    CREATE INDEX IF NOT EXISTS gosente_payments_status_idx ON gosente_payments(status);
  `);
}
module.exports = { db, ensureSchema };