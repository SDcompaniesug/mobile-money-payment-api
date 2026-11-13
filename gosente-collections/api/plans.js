const { db, ensureSchema } = require("../lib/db");
const { send, requireAppKey } = require("../lib/http");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return send(res, 405, { error: "Method not allowed" });
  if (!requireAppKey(req, res)) return;
  const appId = String(req.query.app_id || "").trim();
  if (!appId || appId.length > 120) return send(res, 400, { error: "app_id is required" });
  try {
    await ensureSchema();
    const result = await db().query(
      `SELECT plan_id AS id, name, description, amount AS price, currency,
              duration_days AS "durationDays", active
       FROM subscription_plans WHERE app_id=$1 AND active=TRUE ORDER BY amount ASC, id ASC`,
      [appId]
    );
    return send(res, 200, { plans: result.rows });
  } catch (e) {
    console.error("plan listing failed", e.message);
    return send(res, 500, { error: "Unable to load plans" });
  }
};
