function send(res, status, body) {
  res.status(status).setHeader("Cache-Control", "no-store").json(body);
}
function requireAppKey(req, res) {
  const expected = process.env.GOSENTE_APP_API_KEY;
  if (!expected) { send(res, 503, { error: "API authentication is not configured" }); return false; }
  const supplied = req.headers["x-api-key"];
  if (!supplied || supplied !== expected) { send(res, 401, { error: "Unauthorized" }); return false; }
  return true;
}
module.exports = { send, requireAppKey };