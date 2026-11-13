const { db } = require("./db");

async function activateSubscription(ref) {
  const pool = db();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      "SELECT ref, app_id, device_id, plan_id, plan_duration_days, status FROM gosente_payments WHERE ref=$1 FOR UPDATE",
      [ref]
    );
    if (!result.rowCount || result.rows[0].status !== "successful") {
      await client.query("ROLLBACK");
      return null;
    }
    const p = result.rows[0];
    if (!p.app_id || !p.device_id || !p.plan_id || !p.plan_duration_days) {
      await client.query("ROLLBACK");
      return null;
    }
    await client.query(
      `INSERT INTO subscriptions(app_id, device_id, plan_id, payment_ref, status, starts_at, expires_at)
       VALUES($1,$2,$3,$4,'active',NOW(),NOW() + ($5::int * INTERVAL '1 day'))
       ON CONFLICT(payment_ref) DO NOTHING`,
      [p.app_id, p.device_id, p.plan_id, p.ref, p.plan_duration_days]
    );
    const active = await client.query(
      "SELECT app_id, device_id, plan_id, payment_ref, status, starts_at, expires_at FROM subscriptions WHERE payment_ref=$1",
      [p.ref]
    );
    await client.query("COMMIT");
    return active.rows[0] || null;
  } catch (e) {
    await client.query("ROLLBACK").catch(()=>{});
    throw e;
  } finally {
    client.release();
  }
}

async function getSubscription(appId, deviceId) {
  const result = await db().query(
    `UPDATE subscriptions SET status='expired', updated_at=NOW()
     WHERE app_id=$1 AND device_id=$2 AND status='active' AND expires_at <= NOW()`,
    [appId, deviceId]
  );
  const active = await db().query(
    `SELECT s.app_id, s.device_id, s.plan_id, s.payment_ref, s.status,
            s.starts_at, s.expires_at, p.name AS plan_name
     FROM subscriptions s
     LEFT JOIN subscription_plans p ON p.app_id=s.app_id AND p.plan_id=s.plan_id
     WHERE s.app_id=$1 AND s.device_id=$2 AND s.status='active' AND s.expires_at > NOW()
     ORDER BY s.expires_at DESC LIMIT 1`,
    [appId, deviceId]
  );
  return active.rows[0] || null;
}

module.exports = { activateSubscription, getSubscription };
