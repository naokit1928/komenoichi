from fastapi import APIRouter, Request, HTTPException, status
from fastapi.responses import JSONResponse
import traceback

from app_v2.farmer.services.farmer_delete_service import (
    FarmerDeleteService,
    FarmerHasActiveReservationsError,
)

router = APIRouter(tags=["farmer-delete"])
_service = FarmerDeleteService()

@router.post("/farmer/me/delete")
def delete_farmer_account(request: Request):
    farm_id = request.session.get("farm_id")
    if not farm_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    try:
        _service.delete_account(farm_id)
        request.session.clear()
        return JSONResponse(content={"ok": True}, status_code=200)
    except FarmerHasActiveReservationsError as e:
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