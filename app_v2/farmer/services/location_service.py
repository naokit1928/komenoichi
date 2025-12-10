# app_v2/farmer/services/location_service.py

from __future__ import annotations

import json
import math
import os
from dataclasses import dataclass
from typing import Optional
from urllib.parse import urlencode
from urllib.request import urlopen

# V2 共通：受け渡し地点の標準半径（400mルール）
DEFAULT_PICKUP_RADIUS_METERS: int = 400

# .env からキーを読む（V1 geocoding.py と同じ優先順位）
GEOCODING_API_KEY: Optional[str] = os.getenv("GOOGLE_GEOCODING_API_KEY") or os.getenv(
    "GOOGLE_MAPS_API_KEY"
)


@dataclass
class GeocodeResult:
    """
    住所 → 緯度経度 変換の結果。
    FastAPI / Pydantic に依存しない純粋な結果オブジェクト。
    """

    ok: bool
    lat: Optional[float]
    lng: Optional[float]
    status: str
    error_message: Optional[str] = None


def geocode_address(address: str, region: str = "jp", timeout_sec: float = 5.0) -> GeocodeResult:
    """
    Google Geocoding API を使って、住所から (lat, lng) を取得する。

    - HTTP エラーやネットワークエラーの場合も Exception は投げず、
      GeocodeResult(ok=False, status=..., error_message=...) を返す。
    - FastAPI の HTTPException はここでは使わない（API 層で wrap する）。
    """
    addr = (address or "").strip()
    if not addr:
        return GeocodeResult(
            ok=False,
            lat=None,
            lng=None,
            status="INVALID_ARGUMENT",
            error_message="address is empty",
        )

    if not GEOCODING_API_KEY:
        return GeocodeResult(
            ok=False,
            lat=None,
            lng=None,
            status="NO_API_KEY",
            error_message="GOOGLE_GEOCODING_API_KEY (or GOOGLE_MAPS_API_KEY) is not configured",
        )

    params: dict[str, str] = {
        "address": addr,
        "key": GEOCODING_API_KEY,
    }
    if region:
        params["region"] = region

    url = "https://maps.googleapis.com/maps/api/geocode/json?" + urlencode(params)

    try:
        with urlopen(url, timeout=timeout_sec) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        return GeocodeResult(
            ok=False,
            lat=None,
            lng=None,
            status="NETWORK_ERROR",
            error_message=f"failed to call Google Geocoding API: {e}",
        )

    status = str(data.get("status") or "")
    error_message = data.get("error_message")
    results = data.get("results") or []

    # ジオコーディング失敗（住所があいまい／見つからない等）
    if status != "OK" or not results:
        return GeocodeResult(
            ok=False,
            lat=None,
            lng=None,
            status=status or "ZERO_RESULTS",
            error_message=error_message or "no results",
        )

    try:
        loc = results[0]["geometry"]["location"]
        lat = float(loc["lat"])
        lng = float(loc["lng"])
    except Exception as e:
        return GeocodeResult(
            ok=False,
            lat=None,
            lng=None,
            status="PARSE_ERROR",
            error_message=f"failed to parse geocoding response: {e}",
        )

    return GeocodeResult(
        ok=True,
        lat=lat,
        lng=lng,
        status=status,
        error_message=error_message,
    )


def haversine_distance_m(
    lat1: float,
    lng1: float,
    lat2: float,
    lng2: float,
) -> float:
    """
    2点間の距離（メートル）をハバースイン（球面三角法）で求める。

    - pickup_lat/lng と owner_lat/lng の距離を測るときなどに利用する。
    - 地球半径は 6,371,000 m とする（十分な精度）。
    """
    # ラジアンに変換
    rlat1 = math.radians(lat1)
    rlng1 = math.radians(lng1)
    rlat2 = math.radians(lat2)
    rlng2 = math.radians(lng2)

    dlat = rlat2 - rlat1
    dlng = rlng2 - rlng1

    a = math.sin(dlat / 2) ** 2 + math.cos(rlat1) * math.cos(rlat2) * math.sin(dlng / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    earth_radius_m = 6_371_000.0
    return earth_radius_m * c
