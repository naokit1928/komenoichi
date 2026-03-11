from fastapi import APIRouter, Request, HTTPException, status
from fastapi.responses import JSONResponse
import traceback

from app_v2.customer_booking.services.consumer_delete_service import (
    ConsumerDeleteService,
    ConsumerHasActiveReservationsError,
)

router = APIRouter(tags=["consumer-delete"])
_service = ConsumerDeleteService()

@router.post("/consumers/me/delete")
def delete_consumer_account(request: Request):
    consumer_id = request.session.get("consumer_id")
    if not consumer_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    try:
        _service.delete_account(consumer_id)
        request.session.clear()
        return JSONResponse(content={"ok": True}, status_code=200)
    except ConsumerHasActiveReservationsError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"サーバーエラー: {str(e)}"
        )