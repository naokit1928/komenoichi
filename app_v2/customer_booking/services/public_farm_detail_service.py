from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from app_v2.customer_booking.dtos import PublicFarmDetailDTO
from app_v2.customer_booking.repository.public_farm_detail_repo import (
    PublicFarmDetailRepository,
    PublicFarmDetailRow,
)

from app_v2.customer_booking.utils.pickup_time_utils import (
    JST,
    compute_next_pickup,
)

from app_v2.customer_booking.services.public_farms_service import (
    _format_next_pickup_display,
    _parse_pr_images,
    _build_owner_address_label,
)


# ============================================================
# 内部ユーティリティ
# ============================================================

def calc_harvest_year_from_date(now: datetime) -> int:
    """
    収穫年度の自動計算ルール
    - 9月1日〜12月31日 → 当年産
    - 1月1日〜8月31日 → 前年産
    """
    return now.year if now.month >= 9 else now.year - 1


# ============================================================
# Service
# ============================================================

@dataclass
class PublicFarmDetailService:
    repo: PublicFarmDetailRepository

    def get_public_farm_detail(
        self,
        farm_id: int,
    ) -> Optional[PublicFarmDetailDTO]:
        """
        公開用 農家詳細取得

        【画像仕様（最終合意）】
        - cover_image_url は farmer_settings_service が決定済み
        - 本 Service では「判定・再選択・フォールバック」を一切行わない
        - DTO が必須なら upstream の値をそのまま流す
        """

        row: PublicFarmDetailRow | None = (
            self.repo.fetch_publishable_farm_detail(farm_id=farm_id)
        )
        if row is None:
            return None

        now = datetime.now(JST)

        # -------------------------
        # 次回受け渡し
        # -------------------------
        start_dt, deadline_dt = compute_next_pickup(
            now,
            row.pickup_slot_code,
        )

        next_pickup_display = _format_next_pickup_display(
            start_dt,
            row.pickup_slot_code,
        )

        # -------------------------
        # PR画像（順序そのまま）
        # -------------------------
        pr_images = _parse_pr_images(row.pr_images_raw)

        # -------------------------
        # オーナー情報
        # -------------------------
        owner_full_name = f"{row.owner_last_name}{row.owner_first_name}"

        owner_label = f"{owner_full_name}さんのお米"

        owner_address_label = _build_owner_address_label(
            row.owner_address
        )

        pickup_address_label = _build_owner_address_label(
            row.owner_address
        )

        # -------------------------
        # 収穫年度
        # -------------------------
        harvest_year = calc_harvest_year_from_date(now)

        # -------------------------
        # DTO（表示専用：決定しない）
        # -------------------------
        return PublicFarmDetailDTO(
            farm_id=row.farm_id,

            owner_full_name=owner_full_name,
            owner_label=owner_label,
            owner_address_label=owner_address_label,
            pickup_address_label=pickup_address_label,

            face_image_url=row.face_image_url,
            cover_image_url=row.cover_image_url,  # ★ farmer_settings 決定値をそのまま使用
            pr_images=pr_images,                  # ★ 並び順そのまま

            rice_variety_label=row.rice_variety_label,
            harvest_year=harvest_year,

            price_5kg=row.price_5kg,
            price_10kg=row.price_10kg,
            price_25kg=row.price_25kg,

            pr_title=row.pr_title,
            pr_text=row.pr_text,

            pickup_slot_code=row.pickup_slot_code,
            next_pickup_display=next_pickup_display,
            next_pickup_start=start_dt.isoformat(),
            next_pickup_deadline=deadline_dt.isoformat(),

            pickup_place_name=row.pickup_place_name,
            pickup_notes=row.pickup_notes,
            pickup_lat=row.pickup_lat,
            pickup_lng=row.pickup_lng,
        )
