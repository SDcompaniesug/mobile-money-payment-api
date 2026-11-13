const { db, ensureSchema } = require("../../lib/db");
const { send } = require("../../lib/http");

function authorized(req) {
  const expected = process.env.GOSENTE_ADMIN_KEY;
  return !!expected && req.headers["x-admin-key"] === expected;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  if (!authorized(req)) return send(res, 401, { error: "Unauthorized" });
  try {
    await ensureSchema();
    if (req.method === "GET") {
      const appId = String(req.query.app_id || "").trim();
      if (!appId) return send(res, 400, { error: "app_id is required" });
      const rows = await db().query(
        "SELECT app_id, plan_id, name, description, amount, currency, duration_days, active FROM subscription_plans WHERE app_id=$1 ORDER BY id",
        [appId]
      );
      return send(res, 200, { plans: rows.rows });
    }
    const body = req.body || {};
    const appId = String(body.app_id || "").trim();
    const planId = String(body.plan_id || "").trim();
    const name = String(body.name || "").trim();
    const description = String(body.description || "");
    const amount = Number(body.amount);
    const durationDays = Number(body.duration_days);
    const active = body.active !== false;
    if (!appId || appId.length > 120 || !planId || planId.length > 120 || !name ||
        name.length > 120 || !Number.isSafeInteger(amount) || amount < 500 || amount > 50000000 ||
        !Number.isInteger(durationDays) || durationDays < 1 || durationDays > 3650) {
      return send(res, 400, { error: "app_id, plan_id, name, valid UGX amount and duration_days (1–3650) are required" });
    }
    const saved = await db().query(
      `INSERT INTO subscription_plans(app_id, plan_id, name, description, amount, currency, duration_days, active)
       VALUES($1,$2,$3,$4,$5,'UGX',$6,$7)
       ON CONFLICT(app_id, plan_id) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description,
         amount=EXCLUDED.amount, currency='UGX', duration_days=EXCLUDED.duration_days,
         active=EXCLUDED.active, updated_at=NOW()
       RETURNING app_id, plan_id, name, description, amount, currency, duration_days, active`,
      [appId, planId, name, description.slice(0,500), amount, durationDays, active]
    );
    return send(res, 200, { plan: saved.rows[0] });
  } catch (e) {
    console.error("plan save failed", e.message);
    return send(res, 500, { error: "Unable to save plan" });
  }
};
