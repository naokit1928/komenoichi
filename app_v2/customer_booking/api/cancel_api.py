# app_v2/customer_booking/api/cancel_api.py
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app_v2.customer_booking.utils.cancel_token import verify_cancel_token
from app_v2.customer_booking.services.cancel_service import (
    CancelService,
    CancelDomainError,
    InvalidTokenError,
    ReservationNotFoundError,
    AlreadyCancelledError,
    NotCancellableError,
)

router = APIRouter(prefix="/reservation", tags=["reservation-cancel"])


class CancelGetResponse(BaseModel):
    reservation_id: int
    pickup_display: str
    qty_5: int
    qty_10: int
    qty_25: int
    rice_subtotal: int
    is_cancellable: bool


class CancelPostRequest(BaseModel):
    token: str


class CancelPostResponse(BaseModel):
    reservation_id: int
    status: str


def _decode_token(token: str):
    try:
        return verify_cancel_token(token, allow_expired=False)
    except Exception as e:
        raise InvalidTokenError(str(e))


@router.get("/cancel", response_model=CancelGetResponse)
def get_cancel_page(token: str = Query(...)):

    service = CancelService()
    try:
        payload = _decode_token(token)
        data = service.build_cancel_page_data(payload)
        return CancelGetResponse(**data.__dict__)

    except InvalidTokenError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ReservationNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except AlreadyCancelledError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except CancelDomainError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/cancel", response_model=CancelPostResponse)
def post_cancel(req: CancelPostRequest):

    service = CancelService()
    try:
        payload = _decode_token(req.token)
        data = service.cancel_reservation(payload)
        return CancelPostResponse(
            reservation_id=data.reservation_id,
            status="cancelled",
        )

    except InvalidTokenError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ReservationNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except AlreadyCancelledError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except NotCancellableError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except CancelDomainError as e:
        raise HTTPException(status_code=400, detail=str(e))
