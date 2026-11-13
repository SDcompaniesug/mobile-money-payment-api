const { db, ensureSchema } = require("../../lib/db");
const { checkStatus } = require("../../lib/gosente");
const { activateSubscription } = require("../../lib/subscriptions");
const { send } = require("../../lib/http");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  const ref = String((req.body || {}).ref || "");
  if (!/^GSC-[A-F0-9]{32}$/.test(ref)) return send(res, 200, { received: true });
  try {
    await ensureSchema();
    const found = await db().query("SELECT amount, status FROM gosente_payments WHERE ref=$1", [ref]);
    if (!found.rowCount) return send(res, 200, { received: true });
    if (found.rows[0].status === "pending") {
      // Treat the webhook as a notification only; independently verify with GosentePay.
      const provider = await checkStatus(ref);
      const status = String(provider.transaction_status || "").toLowerCase();
      if (provider.status === "success" && provider.type === "deposit" && status === "successful" &&
          Number(provider.amount) === Number(found.rows[0].amount)) {
        await db().query(
          "UPDATE gosente_payments SET status='successful', verified_at=NOW(), provider_response=$2, updated_at=NOW() WHERE ref=$1 AND status='pending' AND amount=$3",
          [ref, JSON.stringify(provider), found.rows[0].amount]
        );
      } else if (["failed","cancelled","canceled","rejected","expired"].includes(status)) {
        await db().query(
          "UPDATE gosente_payments SET status=$2, provider_response=$3, updated_at=NOW() WHERE ref=$1 AND status='pending'",
          [ref, status === "cancelled" || status === "canceled" ? "cancelled" : "failed", JSON.stringify(provider)]
        );
      }
    }
    const latest = await db().query("SELECT status FROM gosente_payments WHERE ref=$1", [ref]);
    if (latest.rows[0] && latest.rows[0].status === "successful") await activateSubscription(ref);
    return send(res, 200, { received: true });
  } catch (e) {
    console.error("webhook processing failed", e.message);
    return send(res, 200, { received: true, verification: "deferred" });
  }
};
