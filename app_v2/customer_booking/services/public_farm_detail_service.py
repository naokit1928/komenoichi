# app_v2/customer_booking/services/public_farm_detail_service.py
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from app_v2.customer_booking.dtos import PublicFarmDetailDTO
from app_v2.customer_booking.repository.public_farm_detail_repo import (
    PublicFarmDetailRepository,
    PublicFarmDetailRow,
)

# ← ここを修正：pickup_time_utils から取得
from app_v2.customer_booking.utils.pickup_time_utils import (
    JST,
    compute_next_pickup,
)

# public_farms_service 側にある表示・ラベル系はそのまま import 継続
from app_v2.customer_booking.services.public_farms_service import (
    format_next_pickup_display,
    parse_pr_images,
    build_owner_label,
    build_owner_address_label,
)


def calc_harvest_year_from_date(now: datetime) -> int:
    """
    収穫年度の自動計算:
    - 9月1日〜12月31日 → その年産
    - 1月1日〜8月31日 → 前年産
    """
    year = now.year
    month = now.month
    return year if month >= 9 else year - 1


@dataclass
class PublicFarmDetailService:
    repo: PublicFarmDetailRepository

    def get_public_farm_detail(
        self,
        farm_id: int,
    ) -> Optional[PublicFarmDetailDTO]:
        """
        PublicFarmDetailDTO 1件を返すメイン処理。
        公開条件を満たさない / 存在しない場合は None を返す。
        """

        row: PublicFarmDetailRow | None = self.repo.fetch_publishable_farm_detail(
            farm_id=farm_id
        )
        if row is None:
            return None

        now = datetime.now(JST)

        # 次回枠と締切（utils 版に統一）
        start_dt, deadline_dt = compute_next_pickup(now, row.pickup_slot_code)
        next_pickup_display = format_next_pickup_display(start_dt, row.pickup_slot_code)

        # PR画像 URL 配列化
        pr_images = parse_pr_images(row.pr_images_raw)

        # オーナー名・ラベル
        owner_full_name = f"{row.owner_last_name}{row.owner_first_name}"
        owner_label = build_owner_label(row.owner_last_name, row.owner_first_name)
        owner_address_label = build_owner_address_label(row.owner_address)

        # 現状は owner_address と同じロジックで pickup_address_label も作る
        pickup_address_label = build_owner_address_label(row.owner_address)

        # ★ 収穫年度（毎回現在日時から計算：DBは一切見ない）
        harvest_year = calc_harvest_year_from_date(now)

        dto = PublicFarmDetailDTO(
            farm_id=row.farm_id,
            owner_full_name=owner_full_name,
            owner_label=owner_label,
            owner_address_label=owner_address_label,
            pickup_address_label=pickup_address_label,
            face_image_url=row.face_image_url,
            cover_image_url=row.cover_image_url,
            pr_images=pr_images,
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

        return dto
