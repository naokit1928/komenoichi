import os
from fastapi import APIRouter, Query, Depends, HTTPException, Header
from pydantic import BaseModel
from typing import List, Optional

from app_v2.admin.services.admin_consumer_service import AdminConsumerService
from app_v2.admin.dependencies import verify_admin_session

router = APIRouter(
    prefix="/api/admin/consumers",
    tags=["admin_consumers"],
    dependencies=[Depends(verify_admin_session)]
)

class PenaltyHistoryItemDTO(BaseModel):
    reservation_id: int
    status: str
    created_at: str
    farm_name: Optional[str] = None

class PenaltySearchResponse(BaseModel):
    consumer_id: int
    email: str
    penalty_status: str
    no_show_count: int
    cancel_count: int
    pardon_timestamp: int
    history: List[PenaltyHistoryItemDTO]

@router.get("/penalty-search", response_model=PenaltySearchResponse)
def search_penalty(
    email: Optional[str] = Query(None, description="予約者のメールアドレス"),
    reservation_id: Optional[int] = Query(None, description="システム照会ID")
):
    if not email and not reservation_id:
        raise HTTPException(status_code=400, detail="メールアドレス または 照会ID を入力してください")
        
    svc = AdminConsumerService()
    res = svc.search_penalty_info(email, reservation_id)
    
    if "_error" in res:
        err = res["_error"]
        if err == "RESERVATION_NOT_FOUND":
            raise HTTPException(status_code=404, detail=f"照会ID {reservation_id} の予約がデータベースに存在しません。")
        elif err == "NO_CONSUMER_LINKED":
            raise HTTPException(status_code=404, detail=f"照会ID {reservation_id} には消費者データが紐付いていません。")
        elif err == "CONSUMER_NOT_FOUND":
            raise HTTPException(status_code=404, detail="紐付く消費者データが削除されているか、存在しません。")
        elif err == "EMAIL_NOT_FOUND":
            raise HTTPException(status_code=404, detail=f"「{email}」は消費者として登録されていません。")
        else:
            raise HTTPException(status_code=404, detail="ユーザーの特定に失敗しました。")
        
    return res

@router.post("/{consumer_id}/reset-pardon")
def reset_pardon_api(consumer_id: int):
    svc = AdminConsumerService()
    svc.reset_pardon(consumer_id)
    return {"ok": True}

class RevertStatusRequest(BaseModel):
    new_status: str

@router.post("/reservations/{reservation_id}/revert-status")
def revert_reservation_status_api(
    reservation_id: int, 
    payload: RevertStatusRequest,
    x_admin_secret: Optional[str] = Header(None) # ★ 追加: シークレットキーの受け取り
):
    """農家の誤操作などを救済するため、ステータスを強制変更する"""
    
    # ★ 追加: シークレットキーの検証
    expected_secret = os.getenv("ADMIN_SECRET")
    if expected_secret and x_admin_secret != expected_secret:
        raise HTTPException(status_code=403, detail="シークレットキーが間違っています。")

    if payload.new_status not in ["confirmed", "cancelled", "no_show"]:
        raise HTTPException(status_code=400, detail="無効なステータスです")
        
    svc = AdminConsumerService()
    svc.revert_reservation_status(reservation_id, payload.new_status)
    return {"ok": True}