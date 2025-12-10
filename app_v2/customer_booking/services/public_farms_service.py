from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from math import radians, sin, cos, asin, sqrt
from typing import List, Optional, Tuple
import json
import ast

from app_v2.customer_booking.dtos import PublicFarmCardDTO, PublicFarmListResponse
from app_v2.customer_booking.repository.public_farms_repo import (
    PublicFarmsRepository,
    PublicFarmRow,
)
from app_v2.customer_booking.utils.pickup_time_utils import (
    JST,
    compute_next_pickup,
    parse_slot_code,
)

PAGE_SIZE = 8

# 徳島中心（lat/lng）は仮の値。必要なら後で微調整。
DEFAULT_CENTER_LAT = 34.0703
DEFAULT_CENTER_LNG = 134.5548

WEEKDAY_JP = ["月", "火", "水", "木", "金", "土", "日"]
WEEKDAY_MAP = {
    "MON": 0,
    "TUE": 1,
    "WED": 2,
    "THU": 3,
    "FRI": 4,
    "SAT": 5,
    "SUN": 6,
}


@dataclass
class PublicFarmsService:
    repo: PublicFarmsRepository

    def get_public_farms(
        self,
        page: int,
        lat: Optional[float],
        lng: Optional[float],
    ) -> PublicFarmListResponse:
        """
        PublicFarmCardDTO の配列＋ページ情報を返すメイン処理。
        """

        # 中心位置（ユーザー位置 or 徳島中心）
        center_lat, center_lng = resolve_center(lat, lng)

        # 公開対象の farm をすべて取得
        rows: List[PublicFarmRow] = self.repo.fetch_publishable_farms()

        now = datetime.now(JST)
        enriched: List[Tuple[float, PublicFarmCardDTO]] = []

        for r in rows:
            # 距離計算
            distance_km = compute_distance_km(
                center_lat, center_lng, r.pickup_lat, r.pickup_lng
            )

            # 次回枠と締切
            start_dt, deadline_dt = compute_next_pickup(now, r.pickup_slot_code)
            display = format_next_pickup_display(start_dt, r.pickup_slot_code)

            # PR画像 URL 配列化
            pr_images = parse_pr_images(r.pr_images_raw)

            # オーナー名・ラベル
            owner_full_name = f"{r.owner_last_name}{r.owner_first_name}"
            owner_label = build_owner_label(r.owner_last_name, r.owner_first_name)
            owner_address_label = build_owner_address_label(r.owner_address)

            dto = PublicFarmCardDTO(
                farm_id=r.farm_id,
                owner_label=owner_label,
                owner_address_label=owner_address_label,
                owner_full_name=owner_full_name,
                price_10kg=r.price_10kg,
                face_image_url=r.face_image_url,
                pr_images=pr_images,
                pr_title=r.pr_title,
                pickup_slot_code=r.pickup_slot_code,
                next_pickup_display=display,
                next_pickup_start=start_dt.isoformat(),
                next_pickup_deadline=deadline_dt.isoformat(),
                pickup_lat=r.pickup_lat,
                pickup_lng=r.pickup_lng,
            )

            enriched.append((distance_km, dto))

        # 距離の近い順にソート
        enriched.sort(key=lambda x: x[0])
        sorted_dtos = [dto for _, dto in enriched]

        # 100km 以内に1件もなければフラグを立てる（UI 用）
        if enriched:
            no_farms_within_100km = all(dist > 100.0 for dist, _ in enriched)
        else:
            no_farms_within_100km = True

        # ページング
        total_count = len(sorted_dtos)
        start_idx = (page - 1) * PAGE_SIZE
        end_idx = start_idx + PAGE_SIZE
        page_items = sorted_dtos[start_idx:end_idx]
        has_next = end_idx < total_count

        return PublicFarmListResponse(
            page=page,
            page_size=PAGE_SIZE,
            total_count=total_count,
            has_next=has_next,
            no_farms_within_100km=no_farms_within_100km,
            farms=page_items,
        )

    def get_public_farms_for_map(
        self,
        min_lat: float,
        max_lat: float,
        min_lng: float,
        max_lng: float,
        limit: int = 200,
    ) -> List[PublicFarmCardDTO]:
        """
        地図表示用:
        - pickup_lat/lng がバウンディングボックス内の農家を最大 limit 件返す
        - PublicFarmCardDTO をそのまま返す（ページングラッパーは付けない）
        """

        # limit のクランプ（「重くない程度に多め」）
        if limit <= 0:
            limit = 100
        if limit > 500:
            limit = 500

        # min/max の正規化（万一逆で来た場合に備えて）
        if min_lat > max_lat:
            min_lat, max_lat = max_lat, min_lat
        if min_lng > max_lng:
            min_lng, max_lng = max_lng, min_lng

        rows: List[PublicFarmRow] = self.repo.fetch_publishable_farms_in_bounds(
            min_lat=min_lat,
            max_lat=max_lat,
            min_lng=min_lng,
            max_lng=max_lng,
            limit=limit,
        )

        now = datetime.now(JST)
        result: List[PublicFarmCardDTO] = []

        for r in rows:
            # 次回枠と締切
            start_dt, deadline_dt = compute_next_pickup(now, r.pickup_slot_code)
            display = format_next_pickup_display(start_dt, r.pickup_slot_code)

            # PR画像 URL 配列化
            pr_images = parse_pr_images(r.pr_images_raw)

            # オーナー名・ラベル
            owner_full_name = f"{r.owner_last_name}{r.owner_first_name}"
            owner_label = build_owner_label(r.owner_last_name, r.owner_first_name)
            owner_address_label = build_owner_address_label(r.owner_address)

            dto = PublicFarmCardDTO(
                farm_id=r.farm_id,
                owner_label=owner_label,
                owner_address_label=owner_address_label,
                owner_full_name=owner_full_name,
                price_10kg=r.price_10kg,
                face_image_url=r.face_image_url,
                pr_images=pr_images,
                pr_title=r.pr_title,
                pickup_slot_code=r.pickup_slot_code,
                next_pickup_display=display,
                next_pickup_start=start_dt.isoformat(),
                next_pickup_deadline=deadline_dt.isoformat(),
                pickup_lat=r.pickup_lat,
                pickup_lng=r.pickup_lng,
            )

            result.append(dto)

        return result


# -----------------------
# ユーティリティ関数群
# -----------------------


def resolve_center(
    lat: Optional[float],
    lng: Optional[float],
) -> Tuple[float, float]:
    """
    中心座標の決定。
    - 引数に有効な lat/lng があればそれを採用
    - それ以外は徳島中心にフォールバック
    """
    if lat is not None and lng is not None:
        if -90.0 <= lat <= 90.0 and -180.0 <= lng <= 180.0:
            return lat, lng
    return DEFAULT_CENTER_LAT, DEFAULT_CENTER_LNG


def compute_distance_km(
    lat1: float, lng1: float, lat2: float, lng2: float
) -> float:
    """
    Haversine で距離(km)を計算。
    """
    R = 6371.0
    d_lat = radians(lat2 - lat1)
    d_lng = radians(lng2 - lng1)
    a = sin(d_lat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(
        d_lng / 2
    ) ** 2
    c = 2 * asin(sqrt(a))
    return R * c


def format_next_pickup_display(start_dt: datetime, slot_code: str) -> str:
    """
    例:
      start_dt=2025-11-27 19:00, slot_code="WED_19_20"
        -> "11/27（木）19:00–20:00"
    """
    weekday_idx, start_hour, end_hour = parse_slot_code(slot_code)

    month = start_dt.month
    day = start_dt.day
    weekday = WEEKDAY_JP[weekday_idx]

    return f"{month}/{day}（{weekday}）{start_hour:02d}:00–{end_hour:02d}:00"


def parse_pr_images(pr_images_raw: str | None) -> List[str]:
    """
    farmer_profiles.pr_images_json に保存されている情報から
    「画像URLの配列」を取り出す。

    想定する raw のパターン:
      1) JSON 文字列:
         '[{"id": "...", "url": "https://...", "order": 0}, ...]'
      2) Python リテラル風:
         "[{'id': '...', 'url': 'https://...', 'order': 0}, ...]"
         または "{'id': '...', 'url': 'https://...', 'order': 0}"
    """
    if not pr_images_raw:
        return []

    data = None

    # 1) まず JSON として解釈を試みる
    try:
        data = json.loads(pr_images_raw)
    except Exception:
        # 2) ダメなら Python リテラルとして解釈を試みる
        try:
            data = ast.literal_eval(pr_images_raw)
        except Exception:
            # どちらもダメなら諦めて空配列
            return []

    # data を list[dict] に正規化
    if isinstance(data, dict):
        items = [data]
    elif isinstance(data, list):
        items = data
    else:
        return []

    urls: List[str] = []
    for item in items:
        if isinstance(item, dict) and "url" in item:
            url = str(item["url"])
            if url:
                urls.append(url)

    return urls


def build_owner_label(last_name: str, first_name: str) -> str:
    full_name = f"{last_name}{first_name}"
    return f"{full_name}さんのお米"


def build_owner_address_label(address: str) -> str:
    """
    users.address（フル住所）から「番地・建物名」を落として、
    町域までのラベルを作る。

    方針:
      - address の最初の「アラビア数字（0-9）」が出る位置で切る
        例:
          "徳島県徳島市仲之町2丁目32"
            -> "徳島県徳島市仲之町"
          "徳島県阿南市見能林町1-2-3 アーバンコート201号室"
            -> "徳島県阿南市見能林町"
      - 数字が一切含まれない場合は、そのまま全体を使う
    """
    base = (address or "").strip()
    if not base:
        return "農家"

    first_digit_idx: Optional[int] = None
    for idx, ch in enumerate(base):
        if ch.isdigit():
            first_digit_idx = idx
            break

    if first_digit_idx is not None:
        base = base[:first_digit_idx].rstrip()

    return f"{base}の農家" if base else "農家"
