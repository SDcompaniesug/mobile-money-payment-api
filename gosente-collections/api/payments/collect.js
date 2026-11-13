const { randomUUID } = require("crypto");
const { db, ensureSchema } = require("../../lib/db");
const { initiateDeposit } = require("../../lib/gosente");
const { send, requireAppKey } = require("../../lib/http");
module.exports = async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  if (!requireAppKey(req, res)) return;
  const { phone, email, amount, purpose } = req.body || {};
  const value = Number(amount);
  if (!/^(\+?256|0)?[0-9]{9,10}$/.test(String(phone || "").replace(/[\\s-]/g, "")) ||
      !email || !/^\\S+@\\S+\\.\\S+$/.test(String(email)) ||
      !Number.isSafeInteger(value) || value < 500 || value > 50000000) {
    return send(res, 400, { error: "Valid Uganda phone, email and amount (UGX 500–50,000,000) are required" });
  }
  const normalizedPhone = String(phone).replace(/[\\s-]/g, "").replace(/^\\+/, "").replace(/^0/, "256");
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
    await db().query("UPDATE gosente_payments SET status='failed', updated_at=NOW() WHERE ref=$1 AND status='pending'", [ref]).catch(()=>{});
    return send(res, 502, { error: "Could not initiate payment", ref });
  }
};