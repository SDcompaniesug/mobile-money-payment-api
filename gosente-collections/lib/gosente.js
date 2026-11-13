const BASE = "https://api.gosentepay.com/v1";
let tokenCache = { token: null, expiresAt: 0 };

async function getToken() {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt - 60000) return tokenCache.token;
  const apiKey = process.env.GOSENTEPAY_API_KEY;
  if (!apiKey) throw new Error("GOSENTEPAY_API_KEY is not configured");
  const response = await fetch(BASE + "/authorization_token", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.status !== "success" || !data.token) {
    throw new Error("GosentePay token request failed: " + (data.message || response.status));
  }
  tokenCache = { token: data.token, expiresAt: Date.now() + Math.min(Number(data.expires_in || 86400), 86400) * 1000 };
  return tokenCache.token;
}
async function api(path, body) {
  const token = await getToken();
  const response = await fetch(BASE + path, {
    method: "POST",
    headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || data.status || "GosentePay request failed");
    error.status = response.status; error.provider = data; throw error;
  }
  return data;
}
async function initiateDeposit(payment) {
  const secret = process.env.GOSENTEPAY_SECRET_KEY;
  if (!secret) throw new Error("GOSENTEPAY_SECRET_KEY is not configured");
  const callback = process.env.GOSENTEPAY_CALLBACK_URL;
  if (!callback) throw new Error("GOSENTEPAY_CALLBACK_URL is not configured");
  return api("/deposit", {
    secret_key: secret, phone: payment.phone, amount: payment.amount,
    email: payment.email, ref: payment.ref, callback, currency: "UGX"
  });
}
async function checkStatus(ref) {
  return api("/transaction-status", { ref });
}
module.exports = { initiateDeposit, checkStatus };