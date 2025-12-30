from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel
import sqlite3

from app_v2.db.core import resolve_db_path

router = APIRouter(
    prefix="/farmer",
    tags=["farmer"],
)


class FarmerMeResponse(BaseModel):
    farm_id: int
    is_registered: bool
    email: str | None


@router.get(
    "/me",
    response_model=FarmerMeResponse,
)
def get_farmer_me(request: Request) -> FarmerMeResponse:
    """
    ログイン済み農家の状態を返す API

    - 未ログイン → 401
    - email 登録のみ → is_registered = False
    - registration 完了 → is_registered = True

    ※ 判定の唯一の正は DB
    """

    # ① 認証チェック（session）
    farm_id = request.session.get("farm_id")
    if not farm_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="not authenticated",
        )

    # ② DB から email / registration 状態を取得
    conn = sqlite3.connect(resolve_db_path())
    try:
        row = conn.execute(
            """
            SELECT
                email,
                owner_farmer_id
            FROM farms
            WHERE farm_id = ?
            """,
            (farm_id,),
        ).fetchone()
    finally:
        conn.close()

    if row is None:
        # セッションはあるが farm が存在しない（基本的には起きない想定）
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="farm not found",
        )

    email, owner_farmer_id = row
    is_registered = owner_farmer_id is not None

    return FarmerMeResponse(
        farm_id=farm_id,
        is_registered=is_registered,
        email=email,
    )
