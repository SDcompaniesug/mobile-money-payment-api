const { send } = require("../lib/http");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return send(res, 405, { error: "Method not allowed" });
  }

  return send(res, 200, {
    service: "Gosente Collections API",
    status: "online",
    provider: "GosentePay",
    supportedNetworks: ["MTN Uganda", "Airtel Uganda"],
    endpoints: {
      health: "GET /api/health",
      initializeDatabase: "POST /api/admin/setup",
      collectPayment: "POST /api/payments/collect",
      paymentStatus: "GET /api/payments/:ref",
      providerWebhook: "POST /api/webhooks/gosente"
    },
    documentation: "https://github.com/SDcompaniesug/mobile-money-payment-api/tree/main/gosente-collections"
  });
};
