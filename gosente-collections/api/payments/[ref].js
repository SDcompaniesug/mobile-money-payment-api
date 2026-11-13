const { db, ensureSchema } = require("../../lib/db");
const { checkStatus } = require("../../lib/gosente");
const { activateSubscription } = require("../../lib/subscriptions");
const { send, requireAppKey } = require("../../lib/http");

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  if (!requireAppKey(req, res)) return;
  const ref = String(req.query.ref || "");
  if (!/^GSC-[A-F0-9]{32}$/.test(ref)) return send(res, 400, { error: "Invalid reference" });
  try {
    await ensureSchema();
    const found = await db().query(
      "SELECT ref, amount, currency, purpose, status, app_id, device_id, plan_id, created_at FROM gosente_payments WHERE ref=$1",
      [ref]
    );
    if (!found.rowCount) return send(res, 404, { error: "Payment not found" });
    let payment = found.rows[0];

    if (payment.status === "pending") {
      const provider = await checkStatus(ref);
      const providerStatus = String(provider.transaction_status || "").toLowerCase();
      const verified = provider.status === "success" && provider.type === "deposit" &&
        providerStatus === "successful" && Number(provider.amount) === Number(payment.amount);
      if (verified) {
        await db().query(
          "UPDATE gosente_payments SET status='successful', verified_at=NOW(), provider_response=$2, updated_at=NOW() WHERE ref=$1 AND status='pending' AND amount=$3",
          [ref, JSON.stringify(provider), payment.amount]
        );
      } else if (["failed","cancelled","canceled","rejected","expired"].includes(providerStatus)) {
        await db().query(
          "UPDATE gosente_payments SET status=$2, provider_response=$3, updated_at=NOW() WHERE ref=$1 AND status='pending'",
          [ref, providerStatus === "cancelled" || providerStatus === "canceled" ? "cancelled" : "failed", JSON.stringify(provider)]
        );
      }
    }

    const latest = await db().query(
      "SELECT ref, amount, currency, purpose, status, app_id, device_id, plan_id, created_at, verified_at FROM gosente_payments WHERE ref=$1",
      [ref]
    );
    payment = latest.rows[0];
    let subscription = null;
    if (payment.status === "successful") subscription = await activateSubscription(ref);

    return send(res, 200, {
      payment: { ref: payment.ref, amount: Number(payment.amount), currency: payment.currency,
        purpose: payment.purpose, status: payment.status, created_at: payment.created_at,
        verified_at: payment.verified_at },
      accessGranted: payment.status === "successful" && !!subscription,
      subscription
    });
  } catch (e) {
    console.error("status verification failed", e.message);
    return send(res, 502, { error: "Unable to verify payment right now; keep access locked", accessGranted: false });
  }
};
