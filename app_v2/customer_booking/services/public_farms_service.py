from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from math import radians, sin, cos, asin, sqrt
from typing import List, Optional, Tuple
import json
import ast

from app_v2.customer_booking.dtos import (
    PublicFarmCardDTO,
    PublicFarmListResponse,
)
from app_v2.customer_booking.repository.public_farms_repo import (
    PublicFarmsRepository,
    PublicFarmRow,
)
from app_v2.customer_booking.utils.pickup_time_utils import (
    JST,
    compute_next_pickup,
    parse_slot_code,
)

# ============================================================
# 定数
# ============================================================

PAGE_SIZE = 8

# 徳島中心（フォールバック用）
DEFAULT_CENTER_LAT = 34.0703
DEFAULT_CENTER_LNG = 134.5548

WEEKDAY_JP = ["月", "火", "水", "木", "金", "土", "日"]


# ============================================================
# Service 本体
# ============================================================

@dataclass
class PublicFarmsService:
    """
    Public Page（一覧 / 地図）専用 Service

    - 書き込みなし（read-only）
    - 表示ロジック集約
    - DB / SQL を一切持たない
    """
    repo: PublicFarmsRepository

    # --------------------------------------------------------
    # 一覧ページ用
    # --------------------------------------------------------
    def get_public_farms(
        self,
        page: int,
        lat: Optional[float],
        lng: Optional[float],
    ) -> PublicFarmListResponse:

        center_lat, center_lng = _resolve_center(lat, lng)

        rows: List[PublicFarmRow] = self.repo.fetch_publishable_farms()

        now = datetime.now(JST)
        enriched: List[Tuple[float, PublicFarmCardDTO]] = []

        for r in rows:
            distance_km = _compute_distance_km(
                center_lat, center_lng, r.pickup_lat, r.pickup_lng
            )

            start_dt, deadline_dt = compute_next_pickup(now, r.pickup_slot_code)
            display = _format_next_pickup_display(start_dt, r.pickup_slot_code)

            dto = _build_card_dto(r, start_dt, deadline_dt, display)
            enriched.append((distance_km, dto))

        enriched.sort(key=lambda x: x[0])
        sorted_dtos = [dto for _, dto in enriched]

        total_count = len(sorted_dtos)
        start_idx = (page - 1) * PAGE_SIZE
        end_idx = start_idx + PAGE_SIZE

        page_items = sorted_dtos[start_idx:end_idx]
        has_next = end_idx < total_count

        no_farms_within_100km = (
            all(dist > 100.0 for dist, _ in enriched) if enriched else True
        )

        return PublicFarmListResponse(
            page=page,
            page_size=PAGE_SIZE,
            total_count=total_count,
            has_next=has_next,
            no_farms_within_100km=no_farms_within_100km,
            farms=page_items,
        )

    # --------------------------------------------------------
    # 地図表示用
    # --------------------------------------------------------
    def get_public_farms_for_map(
        self,
        min_lat: float,
        max_lat: float,
        min_lng: float,
        max_lng: float,
        limit: int = 200,
    ) -> List[PublicFarmCardDTO]:

        limit = max(1, min(limit, 500))

        if min_lat > max_lat:
            min_lat, max_lat = max_lat, min_lat
        if min_lng > max_lng:
            min_lng, max_lng = max_lng, min_lng

        rows = self.repo.fetch_publishable_farms_in_bounds(
            min_lat=min_lat,
            max_lat=max_lat,
            min_lng=min_lng,
            max_lng=max_lng,
            limit=limit,
        )

        now = datetime.now(JST)
        result: List[PublicFarmCardDTO] = []

        for r in rows:
            start_dt, deadline_dt = compute_next_pickup(now, r.pickup_slot_code)
            display = _format_next_pickup_display(start_dt, r.pickup_slot_code)
            dto = _build_card_dto(r, start_dt, deadline_dt, display)
            result.append(dto)

        return result


# ============================================================
# 内部ユーティリティ（Service 専用）
# ============================================================

def _resolve_center(
    lat: Optional[float],
    lng: Optional[float],
) -> Tuple[float, float]:
    if lat is not None and lng is not None:
        if -90.0 <= lat <= 90.0 and -180.0 <= lng <= 180.0:
            return lat, lng
    return DEFAULT_CENTER_LAT, DEFAULT_CENTER_LNG


def _compute_distance_km(
    lat1: float, lng1: float, lat2: float, lng2: float
) -> float:
    R = 6371.0
    d_lat = radians(lat2 - lat1)
    d_lng = radians(lng2 - lng1)
    a = sin(d_lat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(
        d_lng / 2
    ) ** 2
    return 2 * R * asin(sqrt(a))


def _format_next_pickup_display(start_dt: datetime, slot_code: str) -> str:
    weekday_idx, start_hour, end_hour = parse_slot_code(slot_code)
    return (
        f"{start_dt.month}/{start_dt.day}"
        f"（{WEEKDAY_JP[weekday_idx]}）"
        f"{start_hour:02d}:00–{end_hour:02d}:00"
    )


def _parse_pr_images(raw: Optional[str]) -> List[str]:
    if not raw:
        return []

    try:
        data = json.loads(raw)
    except Exception:
        try:
            data = ast.literal_eval(raw)
        except Exception:
            return []

    if isinstance(data, dict):
        items = [data]
    elif isinstance(data, list):
        items = data
    else:
        return []

    return [str(i["url"]) for i in items if isinstance(i, dict) and i.get("url")]


def _build_card_dto(
    r: PublicFarmRow,
    start_dt: datetime,
    deadline_dt: datetime,
    display: str,
) -> PublicFarmCardDTO:
    owner_full_name = f"{r.owner_last_name}{r.owner_first_name}"
    return PublicFarmCardDTO(
        farm_id=r.farm_id,
        owner_label=f"{owner_full_name}さんのお米",
        owner_address_label=_build_owner_address_label(r.owner_address),
        owner_full_name=owner_full_name,
        price_10kg=r.price_10kg,
        face_image_url=r.face_image_url,
        pr_images=_parse_pr_images(r.pr_images_raw),
        pr_title=r.pr_title,
        pickup_slot_code=r.pickup_slot_code,
        next_pickup_display=display,
        next_pickup_start=start_dt.isoformat(),
        next_pickup_deadline=deadline_dt.isoformat(),
        pickup_lat=r.pickup_lat,
        pickup_lng=r.pickup_lng,
    )


def _build_owner_address_label(address: str) -> str:
    base = (address or "").strip()
    for i, ch in enumerate(base):
        if ch.isdigit():
            base = base[:i].rstrip()
            break
    return f"{base}の農家" if base else "農家"
