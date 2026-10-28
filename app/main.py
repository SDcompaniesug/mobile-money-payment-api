from datetime import datetime, timezone
from enum import Enum
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from pydantic import BaseModel, Field

from .config import settings

app = FastAPI(title=settings.app_name, version="0.1.0")

class Provider(str, Enum):
    airtel = "airtel"
    mtn = "mtn"

class PaymentStatus(str, Enum):
    pending = "PENDING"
    successful = "SUCCESSFUL"
    failed = "FAILED"

class CollectRequest(BaseModel):
    provider: Provider
    amount: float = Field(gt=0)
    currency: str = "UGX"
    customer_phone: str = Field(min_length=8, max_length=20)
    reference: str = Field(min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=200)

payments: dict[str, dict] = {}


def require_api_key(x_api_key: str | None = Header(default=None)):
    if not settings.api_key or x_api_key != settings.api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")

@app.get("/health")
def health():
    return {"status": "ok", "service": settings.app_name}

@app.post("/api/payments/collect", dependencies=[Depends(require_api_key)])
def collect_payment(payload: CollectRequest):
    transaction_id = "TXN-" + uuid4().hex.upper()
    payment = {
        "transactionId": transaction_id,
        "provider": payload.provider.value,
        "amount": payload.amount,
        "currency": payload.currency,
        "customerPhone": payload.customer_phone,
        "reference": payload.reference,
        "description": payload.description,
        "status": PaymentStatus.pending.value,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    payments[transaction_id] = payment

    # Provider adapters are intentionally separated from the public API.
    # The real Airtel/MTN request is enabled after production/sandbox credentials
    # and the provider's approved callback configuration are supplied.
    return {
        "success": True,
        "transactionId": transaction_id,
        "status": PaymentStatus.pending.value,
        "message": "Payment request created; provider authorization is pending.",
    }

@app.get("/api/payments/{transaction_id}", dependencies=[Depends(require_api_key)])
def get_payment(transaction_id: str):
    payment = payments.get(transaction_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return payment

@app.post("/api/webhooks/airtel")
async def airtel_webhook(request: Request):
    body = await request.json()
    # Verify Airtel's callback signature/authentication before changing state.
    return {"received": True}

@app.post("/api/webhooks/mtn")
async def mtn_webhook(request: Request):
    body = await request.json()
    # Verify MTN's callback authentication before changing state.
    return {"received": True}
