const { randomUUID } = require("crypto");
const { db, ensureSchema } = require("../../lib/db");
const { initiateDeposit } = require("../../lib/gosente");
const { send, requireAppKey } = require("../../lib/http");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  if (!requireAppKey(req, res)) return;

  const body = req.body || {};
  const appId = String(body.app_id || "").trim();
  const deviceId = String(body.device_id || "").trim();
  const planId = String(body.plan_id || "").trim();
  const email = String(body.email || "").trim();
  const rawPhone = String(body.phone || "").replace(/[\s-]/g, "");
  const idempotencyKey = String(body.idempotency_key || "").trim();

  if (!appId || appId.length > 120 || !deviceId || deviceId.length > 200 || !planId || planId.length > 120 ||
      !/^(\+?256|0)?[0-9]{9,10}$/.test(rawPhone) ||
      !email || !/^\S+@\S+\.\S+$/.test(email) ||
      (idempotencyKey && idempotencyKey.length > 160)) {
    return send(res, 400, { error: "app_id, device_id, plan_id, valid Uganda phone and email are required" });
  }

  const normalizedPhone = rawPhone.replace(/^\+/, "").replace(/^0/, "256");
  let ref;
  try {
    await ensureSchema();

    if (idempotencyKey) {
      const existing = await db().query(
        "SELECT ref, status, amount FROM gosente_payments WHERE app_id=$1 AND idempotency_key=$2",
        [appId, idempotencyKey]
      );
      if (existing.rowCount) {
        return send(res, 200, {
          status: existing.rows[0].status, ref: existing.rows[0].ref,
          amount: Number(existing.rows[0].amount), currency: "UGX",
          message: "Existing payment attempt returned for this idempotency key."
        });
      }
    }

    const planResult = await db().query(
      "SELECT plan_id, name, amount, currency, duration_days FROM subscription_plans WHERE app_id=$1 AND plan_id=$2 AND active=TRUE",
      [appId, planId]
    );
    if (!planResult.rowCount) return send(res, 404, { error: "Selected subscription plan is unavailable" });
    const plan = planResult.rows[0];
    const amount = Number(plan.amount);
    if (!Number.isSafeInteger(amount) || amount < 500) return send(res, 409, { error: "Subscription plan has an invalid amount" });

    ref = "GSC-" + randomUUID().replace(/-/g, "").toUpperCase();
    await db().query(
      `INSERT INTO gosente_payments
       (ref, phone, email, amount, currency, purpose, status, app_id, device_id, plan_id, plan_duration_days, plan_name, idempotency_key)
       VALUES($1,$2,$3,$4,'UGX',$5,'pending',$6,$7,$8,$9,$10,$11)`,
      [ref, normalizedPhone, email, amount, "Subscription: " + plan.name, appId, deviceId, planId, plan.duration_days, plan.name, idempotencyKey || null]
    );

    const provider = await initiateDeposit({ ref, phone: normalizedPhone, email, amount });
    await db().query(
      "UPDATE gosente_payments SET gateway_reference=$2, channel=$3, provider_response=$4, updated_at=NOW() WHERE ref=$1",
      [ref, provider.gateway_reference || null, provider.channel || null, JSON.stringify(provider)]
    );
    return send(res, 202, {
      status: "pending", ref, amount, currency: "UGX", plan_id: planId,
      channel: provider.channel || "mobile_money",
      message: "Approve the mobile-money prompt. Access remains locked until server verification succeeds."
    });
  } catch (e) {
    console.error("subscription payment initiation failed", e.message);
    if (ref) {
      await db().query(
        "UPDATE gosente_payments SET provider_response=$2, updated_at=NOW() WHERE ref=$1 AND status='pending'",
        [ref, JSON.stringify({ initiation_error: String(e.message || "unknown").slice(0, 300) })]
      ).catch(()=>{});
    }
    return send(res, 502, {
      error: "Payment initiation could not be confirmed. Access remains locked; check this reference before retrying.",
      ...(ref ? { ref } : {}), accessGranted: false
    });
  }
};
