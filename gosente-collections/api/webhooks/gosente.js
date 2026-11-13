const { db, ensureSchema } = require("../../lib/db");
const { checkStatus } = require("../../lib/gosente");
const { send } = require("../../lib/http");
module.exports = async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  const ref = String((req.body || {}).ref || "");
  if (!/^GSC-[A-F0-9]{32}$/.test(ref)) return send(res, 200, { received: true });
  try {
    await ensureSchema();
    const found = await db().query("SELECT amount, status FROM gosente_payments WHERE ref=$1", [ref]);
    if (!found.rowCount || found.rows[0].status !== "pending") return send(res, 200, { received: true });
    // Callback is only a notification. Never trust its status/amount as proof of payment.
    const provider = await checkStatus(ref);
    const p = provider.transaction_status && String(provider.transaction_status).toLowerCase();
    if (provider.status === "success" && provider.type === "deposit" && p === "successful" &&
        Number(provider.amount) === Number(found.rows[0].amount)) {
      await db().query("UPDATE gosente_payments SET status='successful', verified_at=NOW(), provider_response=$2, updated_at=NOW() WHERE ref=$1 AND status='pending' AND amount=$3",
        [ref, JSON.stringify(provider), found.rows[0].amount]);
    } else if (["failed","cancelled","canceled","rejected","expired"].includes(p)) {
      await db().query("UPDATE gosente_payments SET status=$2, provider_response=$3, updated_at=NOW() WHERE ref=$1 AND status='pending'",
        [ref, p === "cancelled" || p === "canceled" ? "cancelled" : "failed", JSON.stringify(provider)]);
    }
    return send(res, 200, { received: true });
  } catch (e) {
    console.error("webhook processing failed", e.message);
    return send(res, 200, { received: true, verification: "deferred" });
  }
};