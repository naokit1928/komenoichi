# app_v2/farmer/api/registration_api.py
from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app_v2.farmer.services.registration_service import (
    RegistrationService,
    OwnerAlreadyHasFarmError,
    OwnerUserNotFoundError,
    RegistrationError,
)


router = APIRouter(
    prefix="/farmer/registration",
    tags=["farmer-registration-v2"],
)


# ============================================================
# Pydantic Schemas (Request / Response)
# ============================================================


class RegistrationRequest(BaseModel):
    """
    Farmer Registration Page から送られてくる JSON 本体。

    - フロントは owner_user_id / farm_id は送らない（サーバ側で解決・発行する）
    - OWNER 情報 + 初期 Pickup 情報のみを送る
    """

    # --- LINE / User 識別 ---
    line_user_id: str = Field(..., description="LINE ログイン済みユーザーの line_user_id")

    # --- Owner 情報（氏名・住所・電話） ---
    owner_last_name: str = Field(..., description="姓（例: 山田）")
    owner_first_name: str = Field(..., description="名（例: 太郎）")
    owner_last_kana: str = Field(..., description="姓かな（例: やまだ）")
    owner_first_kana: str = Field(..., description="名かな（例: たろう）")

    owner_postcode: str = Field(..., description="郵便番号7桁（ハイフンなしを推奨）")
    owner_pref: str = Field(..., description="都道府県名")
    owner_city: str = Field(..., description="市区町村＋町域")
    owner_addr_line: str = Field(..., description="番地・建物名など")

    owner_phone: str = Field(..., description="携帯電話番号")

    # --- 初期 Pickup 情報 ---
    pickup_lat: float = Field(..., description="受け渡し場所の緯度")
    pickup_lng: float = Field(..., description="受け渡し場所の経度")
    pickup_place_name: str = Field(..., description="受け渡し場所の名称（例: 自宅前の納屋）")
    pickup_notes: str | None = Field(
        None,
        description="受け渡し補足メモ（駐車場の案内など。未入力可）",
    )
    pickup_time: str = Field(
        ...,
        description='受け渡し時間スロット（例: "WED_19_20" / "SAT_10_11" など）',
    )


class RegistrationResponse(BaseModel):
    """
    Registration 完了時のレスポンス。

    v1 の finish_registration と互換性のある形：
    {
      "ok": true,
      "farm_id": 19,
      "owner_user_id": 24,
      "settings_url_hint": "/farmer/settings?farm_id=19",
      "note": "Step3 registration successful (User + Farm saved)"
    }
    """

    ok: bool = True
    farm_id: int
    owner_user_id: int
    settings_url_hint: str
    note: str


# ============================================================
# Endpoint
# ============================================================


@router.post(
    "/finish_registration",
    response_model=RegistrationResponse,
    summary="Farmer Registration (Owner + Farm 初期登録)",
)
def finish_registration(
    payload: RegistrationRequest,
) -> RegistrationResponse:
    """
    Registration Page の「登録を完了する」ボタンから呼ばれる最終エンドポイント。
    """
    # ここで SQLAlchemy の Session / get_db には一切依存しない
    service = RegistrationService()

    try:
        result = service.register_new_farm(
            line_user_id=payload.line_user_id,
            owner_last_name=payload.owner_last_name,
            owner_first_name=payload.owner_first_name,
            owner_last_kana=payload.owner_last_kana,
            owner_first_kana=payload.owner_first_kana,
            owner_postcode=payload.owner_postcode,
            owner_pref=payload.owner_pref,
            owner_city=payload.owner_city,
            owner_addr_line=payload.owner_addr_line,
            owner_phone=payload.owner_phone,
            pickup_lat=payload.pickup_lat,
            pickup_lng=payload.pickup_lng,
            pickup_place_name=payload.pickup_place_name,
            pickup_notes=payload.pickup_notes,
            pickup_time=payload.pickup_time,
        )

    except OwnerUserNotFoundError:
        # v1 と同じ 403 + "line login required"
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="line login required",
        )

    except OwnerAlreadyHasFarmError as e:
        # v1 と同じ 409 エラー表現に合わせる
        detail_msg = f"farm already exists for owner_user_id={e.owner_user_id}"
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=detail_msg,
        )

    except RegistrationError as e:
        # v1: friendship などのドメインエラーは 403
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )

    except Exception:
        # 想定外のエラーは 500
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="registration failed",
        )

    return RegistrationResponse(
        ok=True,
        farm_id=result.farm_id,
        owner_user_id=result.owner_user_id,
        settings_url_hint=result.settings_url_hint,
        note=result.note,
    )
