from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app_v2.customer_booking.services.cancel_service import (
    CancelService,
    InvalidTokenError,
    ReservationNotFoundError,
    AlreadyCancelledError,
    NotCancellableError,
)
from app_v2.customer_booking.utils.cancel_token import (
    verify_cancel_token,
    CancelTokenPayload,
)

router = APIRouter(
    prefix="/reservation/cancel",
    tags=["reservation_cancel"],
)

service = CancelService()


# =================================================
# Request DTO（POST 用）
# =================================================
class CancelRequest(BaseModel):
    token: str


# =================================================
# GET /reservation/cancel/page
# キャンセル確認ページ（表示専用）
# =================================================
@router.get("/page")
def get_cancel_page(
    token: str = Query(..., description="cancel token"),
):
    try:
        payload: CancelTokenPayload = verify_cancel_token(token)
        return service.build_cancel_page_data(payload)

    except InvalidTokenError as e:
        raise HTTPException(status_code=400, detail=str(e))

    except ReservationNotFoundError:
        raise HTTPException(status_code=404, detail="Reservation not found")

    except AlreadyCancelledError:
        raise HTTPException(status_code=400, detail="Already cancelled")

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# =================================================
# POST /reservation/cancel
# キャンセル確定（body token のみ）
# =================================================
@router.post("")
def post_cancel_reservation(
    body: CancelRequest,
):
    try:
        payload: CancelTokenPayload = verify_cancel_token(body.token)
        return service.cancel_reservation(payload)

    except InvalidTokenError as e:
        raise HTTPException(status_code=400, detail=str(e))

    except ReservationNotFoundError:
        raise HTTPException(status_code=404, detail="Reservation not found")

    except AlreadyCancelledError:
        raise HTTPException(status_code=400, detail="Already cancelled")

    except NotCancellableError:
        raise HTTPException(status_code=400, detail="Cancellation deadline passed")

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
