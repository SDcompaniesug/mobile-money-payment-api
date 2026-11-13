const { ensureSchema } = require("../../lib/db");
const { send, requireAppKey } = require("../../lib/http");
const { getSubscription } = require("../../lib/subscriptions");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return send(res, 405, { error: "Method not allowed" });
  if (!requireAppKey(req, res)) return;
  const appId = String(req.query.app_id || "").trim();
  const deviceId = String(req.query.device_id || "").trim();
  if (!appId || !deviceId || appId.length > 120 || deviceId.length > 200) {
    return send(res, 400, { error: "app_id and device_id are required" });
  }
  try {
    await ensureSchema();
    const subscription = await getSubscription(appId, deviceId);
    return send(res, 200, {
      active: !!subscription,
      status: subscription ? "ACTIVE" : "INACTIVE",
      subscription
    });
  } catch (e) {
    console.error("subscription lookup failed", e.message);
    return send(res, 500, { error: "Unable to load subscription" });
  }
};
