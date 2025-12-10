# app_v2/farmer/api/geocode_api.py

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app_v2.farmer.services.location_service import (
    GeocodeResult,
    geocode_address,
)

router = APIRouter(
    prefix="/geocode",
    tags=["geocode-v2"],
)


class GeocodeRequest(BaseModel):
    """
    /api/geocode のリクエスト DTO（V1 と互換の形）。
    """

    address: str
    region: str | None = "jp"


class GeocodeResponse(BaseModel):
    """
    /api/geocode のレスポンス DTO（V1 と互換の形）。
    """

    ok: bool
    lat: float | None = None
    lng: float | None = None
    status: str
    error_message: str | None = None


@router.post("", response_model=GeocodeResponse)
def geocode(req: GeocodeRequest) -> GeocodeResponse:
    """
    V2 版 /api/geocode エンドポイント。
    - 実処理は location_service.geocode_address() に委譲する。
    - V1 の geocoding.py と同じ JSON 形式を返す。
    - APIキー未設定やネットワークエラー時は HTTP エラーとして扱い、
      それ以外（住所が曖昧など）は 200 OK + ok=False で返す。
    """
    result: GeocodeResult = geocode_address(
        address=req.address,
        region=req.region or "jp",
    )

    # APIキー未設定 → サーバー設定ミスとして 500
    if result.status == "NO_API_KEY":
        raise HTTPException(
            status_code=500,
            detail=result.error_message or "GOOGLE_GEOCODING_API_KEY is not configured",
        )

    # ネットワークエラーなど → 上流の問題として 502
    if result.status == "NETWORK_ERROR":
        raise HTTPException(
            status_code=502,
            detail=result.error_message or "failed to call Google Geocoding API",
        )

    # それ以外は、住所不明・ZERO_RESULTS・PARSE_ERROR なども含めて
    # 200 OK で JSON を返す（V1 と同じ扱い）。
    return GeocodeResponse(
        ok=result.ok,
        lat=result.lat,
        lng=result.lng,
        status=result.status,
        error_message=result.error_message,
    )
