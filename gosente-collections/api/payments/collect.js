const { randomUUID } = require("crypto");
const { db, ensureSchema } = require("../../lib/db");
const { initiateDeposit } = require("../../lib/gosente");
const { send, requireAppKey } = require("../../lib/http");
module.exports = async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  if (!requireAppKey(req, res)) return;
  const { phone, email, amount, purpose } = req.body || {};
  const value = Number(amount);
  const rawPhone = String(phone || "").replace(/[\s-]/g, "");
  if (!/^(\+?256|0)?[0-9]{9,10}$/.test(rawPhone) ||
      !email || !/^\S+@\S+\.\S+$/.test(String(email)) ||
      !Number.isSafeInteger(value) || value < 500 || value > 50000000) {
    return send(res, 400, { error: "Valid Uganda phone, email and amount (UGX 500–50,000,000) are required" });
  }
  const normalizedPhone = rawPhone.replace(/^\+/, "").replace(/^0/, "256");
  const ref = "GSC-" + randomUUID().replace(/-/g, "").toUpperCase();
  try {
    await ensureSchema();
    await db().query(
      "INSERT INTO gosente_payments(ref, phone, email, amount, purpose, status) VALUES($1,$2,$3,$4,$5,'pending')",
      [ref, normalizedPhone, String(email).trim(), value, String(purpose || "collection").slice(0,120)]
    );
    const provider = await initiateDeposit({ ref, phone: normalizedPhone, email: String(email).trim(), amount: value });
    await db().query("UPDATE gosente_payments SET gateway_reference=$2, channel=$3, provider_response=$4, updated_at=NOW() WHERE ref=$1",
      [ref, provider.gateway_reference || null, provider.channel || null, JSON.stringify(provider)]);
    return send(res, 202, { status: "pending", ref, amount: value, currency: "UGX", channel: provider.channel || "mobile_money", message: "Approve the mobile-money prompt. Payment access remains locked until server verification succeeds." });
  } catch (e) {
    console.error("collection initiation failed", e.message);
    // A network timeout can happen after the provider accepted the deposit. Keep it pending
    // so a later server-side status lookup can safely resolve it; never unlock on this error.
    await db().query("UPDATE gosente_payments SET provider_response=$2, updated_at=NOW() WHERE ref=$1 AND status='pending'",
      [ref, JSON.stringify({ initiation_error: String(e.message || "unknown").slice(0, 300) })]).catch(()=>{});
    return send(res, 502, { error: "Payment initiation could not be confirmed. Access remains locked; check this reference again before retrying.", ref, accessGranted: false });
  }
};