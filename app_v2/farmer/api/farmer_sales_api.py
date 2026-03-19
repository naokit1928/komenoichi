from fastapi import APIRouter, Request, HTTPException, status, Query

# ★ dtos.py からインポートするように変更
from app_v2.farmer.dtos import MonthlySalesResponseDTO
from app_v2.farmer.services.farmer_sales_service import FarmerSalesService

router = APIRouter(tags=["farmer-sales"])
_service = FarmerSalesService()

@router.get(
    "/api/farmer/sales",
    response_model=MonthlySalesResponseDTO,
)
def get_farmer_monthly_sales(
    request: Request,
    year: int = Query(..., description="取得対象の年"),
    month: int = Query(..., ge=1, le=12, description="取得対象の月(1-12)"),
) -> MonthlySalesResponseDTO:
    """
    指定した年月の売上・予約実績を取得するAPI。
    """
    farm_id = request.session.get("farm_id")
    if not farm_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    return _service.get_monthly_sales(farm_id=farm_id, year=year, month=month)