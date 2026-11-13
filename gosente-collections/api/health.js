const { send } = require("../lib/http");
module.exports = async function handler(req, res) {
  if (req.method !== "GET") return send(res, 405, { error: "Method not allowed" });
  const configured = ["DATABASE_URL","GOSENTEPAY_API_KEY","GOSENTEPAY_SECRET_KEY","GOSENTEPAY_CALLBACK_URL","GOSENTE_APP_API_KEY"].every(k => !!process.env[k]);
  return send(res, configured ? 200 : 503, {
    service: "Gosente Collections", status: configured ? "configured" : "configuration_required",
    provider: "GosentePay", methods: ["MTN Uganda", "Airtel Uganda"],
    missingConfiguration: ["DATABASE_URL","GOSENTEPAY_API_KEY","GOSENTEPAY_SECRET_KEY","GOSENTEPAY_CALLBACK_URL","GOSENTE_APP_API_KEY"].filter(k => !process.env[k])
  });
};