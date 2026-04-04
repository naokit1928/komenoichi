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


# ============================================================
# DTOs
# ============================================================

class PenaltyHistoryItemDTO(BaseModel):
    reservation_id: int
    status: str           # 'no_show' or 'cancelled'
    is_late_cancel: int   # 1 = 遅延キャンセル（ペナルティ対象）
    created_at: str
    farm_name: Optional[str] = None


class PenaltySearchResponse(BaseModel):
    consumer_id: int
    email: str
    penalty_status: str        # "none" or "banned"
    penalty_count: int         # no_show + late_cancel の合算（過去1年）
    no_show_count: int         # 農家報告の no_show 件数
    late_cancel_count: int     # 受け渡し3時間以内キャンセル件数
    history: List[PenaltyHistoryItemDTO]


# ============================================================
# ペナルティ調査 API
# ============================================================

@router.get("/penalty-search", response_model=PenaltySearchResponse)
def search_penalty(
    email: Optional[str] = Query(None, description="予約者のメールアドレス"),
    reservation_id: Optional[int] = Query(None, description="システム照会ID"),
):
    if not email and not reservation_id:
        raise HTTPException(
            status_code=400,
            detail="メールアドレス または 照会ID を入力してください"
        )

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


# ============================================================
# ステータス強制変更 API（案A: 記録を書き換える）
#
# 用途:
#   - no_show → confirmed : 農家の誤報告を取り消す
#   - no_show → cancelled : no_show をキャンセル扱いに変更（ペナルティ解除）
# ============================================================

class RevertStatusRequest(BaseModel):
    new_status: str


@router.post("/reservations/{reservation_id}/revert-status")
def revert_reservation_status_api(
    reservation_id: int,
    payload: RevertStatusRequest,
    x_admin_secret: Optional[str] = Header(None),
):
    """
    農家の誤操作や冤罪ノーショーを救済するためステータスを強制変更する。

    no_show → confirmed : ペナルティカウントから外れる（予約が有効に戻る）
    no_show → cancelled : ペナルティカウントから外れる（キャンセル扱い）
    """
    expected_secret = os.getenv("ADMIN_SECRET")
    if expected_secret and x_admin_secret != expected_secret:
        raise HTTPException(status_code=403, detail="シークレットキーが間違っています。")

    if payload.new_status not in ["confirmed", "cancelled", "no_show"]:
        raise HTTPException(status_code=400, detail="無効なステータスです")

    svc = AdminConsumerService()
    svc.revert_reservation_status(reservation_id, payload.new_status)
    return {"ok": True}


# ============================================================
# 遅延キャンセルフラグ解除 API（案A）
#
# 用途:
#   - is_late_cancel = 1 → 0 に戻す
#   - status は cancelled のまま。ペナルティカウントから外れるだけ
#   - 管理者が「やむを得ない事情だった」と判断した場合に使用
# ============================================================

@router.post("/reservations/{reservation_id}/clear-late-cancel")
def clear_late_cancel_api(
    reservation_id: int,
    x_admin_secret: Optional[str] = Header(None),
):
    """
    遅延キャンセルフラグ（is_late_cancel）を解除する。
    キャンセル記録は残るがペナルティカウントから外れる。
    """
    expected_secret = os.getenv("ADMIN_SECRET")
    if expected_secret and x_admin_secret != expected_secret:
        raise HTTPException(status_code=403, detail="シークレットキーが間違っています。")

    svc = AdminConsumerService()
    svc.clear_late_cancel_flag(reservation_id)
    return {"ok": True}