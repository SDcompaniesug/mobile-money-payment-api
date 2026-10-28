# Mobile Money Payment API

Backend API for a unified Airtel Money and MTN Mobile Money collection service.

## Endpoints

- `GET /health`
- `POST /api/payments/collect`
- `GET /api/payments/{transactionId}`
- `POST /api/webhooks/airtel`
- `POST /api/webhooks/mtn`

## Security

Provider secrets belong only in server environment variables. Customer mobile-money PINs are never collected, transmitted, or stored by this service.

## Airtel setup

1. Register the application in the Airtel Uganda developer portal.
2. Add Collection-APIs for Uganda.
3. Obtain the approved sandbox/production credentials.
4. Add the backend server's public egress IP to Airtel's Server IP Allowed List.
5. Configure the Airtel callback URL to `/api/webhooks/airtel`.

The provider adapter must only be enabled after the exact Airtel account credentials and approved API configuration are supplied.
