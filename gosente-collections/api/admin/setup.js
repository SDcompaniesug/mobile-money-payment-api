const { send } = require("../../lib/http");
const { ensureSchema } = require("../../lib/db");
module.exports = async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  const key = process.env.GOSENTE_ADMIN_KEY;
  if (!key || req.headers["x-admin-key"] !== key) return send(res, 401, { error: "Unauthorized" });
  try { await ensureSchema(); return send(res, 200, { status: "ready", database: "gosente_payments" }); }
  catch (e) { console.error("schema setup failed", e.message); return send(res, 500, { error: "Database setup failed" }); }
};