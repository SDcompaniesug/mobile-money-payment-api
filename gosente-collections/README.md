# Gosente Collections

Standalone Vercel API for MTN Uganda and Airtel Uganda collections using GosentePay.

## Routes
- GET /api/health
- POST /api/admin/setup (x-admin-key)
- POST /api/payments/collect (x-api-key)
- GET /api/payments/:ref (x-api-key)
- POST /api/webhooks/gosente (GosentePay callback)

## Environment variables
Set DATABASE_URL, GOSENTEPAY_API_KEY, GOSENTEPAY_SECRET_KEY, GOSENTEPAY_CALLBACK_URL, GOSENTE_APP_API_KEY and GOSENTE_ADMIN_KEY in Vercel. Never commit credentials.

## Setup
1. Provision a dedicated PostgreSQL database and set DATABASE_URL.
2. Set fresh GosentePay API credentials (rotate any credentials previously exposed).
3. Deploy to Vercel.
4. Set GOSENTEPAY_CALLBACK_URL to https://<deployment-domain>/api/webhooks/gosente and redeploy.
5. Call POST /api/admin/setup with x-admin-key to create the schema.
6. Test with a low-value payment and verify status using GET /api/payments/:ref.

## Security model
The app secret and GosentePay credentials are server-only. The webhook is treated as an untrusted notification: every callback triggers a server-to-server transaction-status lookup. A payment becomes successful only when provider status is successful, type is deposit, and the amount matches the locally stored order. The client must still grant access only when accessGranted is true.

GosentePay's published API documentation does not describe a signed webhook, so callback authenticity is not assumed. Rate limiting, merchant settlement checks and provider-side production approval should be completed before broad production use.
