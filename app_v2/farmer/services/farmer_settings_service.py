from __future__ import annotations

from datetime import datetime
from typing import Optional, List, Tuple, Dict, Any

from app_v2.common.client import upload_bytes
from app_v2.farmer.dtos import FarmerSettingsDTO, PRImageDTO
from app_v2.farmer.repository.farmer_settings_repo import (
    FarmerSettingsRepository,
)


class FarmerSettingsService:
    """
    Farmer Settings service 層。

    方針（確定）：
    - カバーフォト = PR画像の先頭
    - カバー決定の責務は farmer_settings のみ
    - public / detail 側では一切再計算しない
    """

    def __init__(self) -> None:
        self.repo = FarmerSettingsRepository()

    # ============================================================
    # 内部ヘルパ
    # ============================================================

    def _round_to_100(self, value: Optional[int]) -> Optional[int]:
        if value is None:
            return None
        v = int(value)
        q, r = divmod(abs(v), 100)
        if r >= 50:
            q += 1
        return q * 100 if v >= 0 else -q * 100

    def _auto_calc_prices(
        self,
        price_10kg: Optional[int],
    ) -> tuple[Optional[int], Optional[int]]:
        if price_10kg is None:
            return None, None

        base = self._round_to_100(price_10kg)
        price_5kg = self._round_to_100(base * 52 // 100)
        price_25kg = self._round_to_100(base * 240 // 100)
        return price_5kg, price_25kg

    def _calc_harvest_year(self) -> int:
        now = datetime.now()
        return now.year if now.month >= 9 else now.year - 1

    # ============================================================
    # 公開条件チェック（UI 用）
    # ============================================================

    def _compute_missing_fields(
        self,
        farm: Dict[str, Any],
        profile: Dict[str, Any],
        pr_images: List[dict],
    ) -> List[str]:
        missing: List[str] = []

        if not farm.get("rice_variety_label"):
            missing.append("rice_variety_label")
        if farm.get("price_10kg") is None:
            missing.append("price_10kg")
        if not profile.get("pr_title"):
            missing.append("pr_title")
        if not profile.get("face_image_url"):
            missing.append("face_image_url")

        # PR画像が必須（＝カバー必須）
        if not pr_images:
            missing.append("pr_images")

        if farm.get("pickup_lat") is None or farm.get("pickup_lng") is None:
            missing.append("pickup_location")
        if not farm.get("pickup_time"):
            missing.append("pickup_time")

        return missing

    # ============================================================
    # Settings 読み込み（中核）
    # ============================================================

    def load_settings(self, farm_id: int) -> FarmerSettingsDTO:
        farm = self.repo.get_farm(farm_id)
        if not farm:
            raise ValueError(f"farm_id={farm_id} not found")

        profile = self.repo.get_profile(farm_id) or self.repo.create_initial_profile(
            farm_id
        )

        pr_raw = self.repo.load_pr_images_list(farm_id)
        pr_sorted = sorted(pr_raw, key=lambda x: int(x.get("order", 0)))

        pr_images = [
            PRImageDTO(
                id=item.get("id"),
                url=item.get("url"),
                order=int(item.get("order", 0)),
            )
            for item in pr_sorted
        ]

        # ===== カバー決定（唯一の場所） =====
        cover_image_url = pr_images[0].url if pr_images else None

        price_10kg = farm.get("price_10kg")
        price_5kg = farm.get("price_5kg")
        price_25kg = farm.get("price_25kg")

        if price_10kg is not None and (price_5kg is None or price_25kg is None):
            price_5kg, price_25kg = self._auto_calc_prices(price_10kg)

        missing = self._compute_missing_fields(farm, profile, pr_raw)

        return FarmerSettingsDTO(
            is_accepting_reservations=bool(farm.get("is_accepting_reservations")),
            active_flag=int(farm.get("active_flag") or 1),
            is_ready_to_publish=len(missing) == 0,
            missing_fields=missing,
            rice_variety_label=farm.get("rice_variety_label"),
            pr_title=profile.get("pr_title"),
            pr_text=profile.get("pr_text"),
            price_10kg=price_10kg,
            price_5kg=price_5kg,
            price_25kg=price_25kg,
            face_image_url=profile.get("face_image_url"),
            cover_image_url=cover_image_url,
            pr_images=pr_images,
            harvest_year=self._calc_harvest_year(),
            monthly_upload_bytes=int(profile.get("monthly_upload_bytes") or 0),
            monthly_upload_limit=int(profile.get("monthly_upload_limit") or 50_000_000),
            next_reset_at=profile.get("next_reset_at"),
            thumbnail_url=cover_image_url,
        )

    # ============================================================
    # 保存（PR 以外）
    # ============================================================

    def save_settings(
        self,
        *,
        farm_id: int,
        is_accepting_reservations: Optional[bool] = None,
        rice_variety_label: Optional[str] = None,
        pr_title: Optional[str] = None,
        pr_text: Optional[str] = None,
        price_10kg: Optional[int] = None,
        face_image_url: Optional[str] = None,
    ) -> FarmerSettingsDTO:
        farm = self.repo.get_farm(farm_id)
        if not farm:
            raise ValueError(f"farm_id={farm_id} not found")

        farm_updates: Dict[str, Any] = {}
        profile_updates: Dict[str, Any] = {}

        if is_accepting_reservations is not None:
            farm_updates["is_accepting_reservations"] = bool(
                is_accepting_reservations
            )

        if rice_variety_label is not None:
            farm_updates["rice_variety_label"] = rice_variety_label

        if price_10kg is not None:
            rounded = max(5000, min(9900, self._round_to_100(price_10kg)))
            farm_updates["price_10kg"] = rounded
            farm_updates["price_5kg"], farm_updates["price_25kg"] = (
                self._auto_calc_prices(rounded)
            )

        if pr_title is not None:
            profile_updates["pr_title"] = pr_title
        if pr_text is not None:
            profile_updates["pr_text"] = pr_text
        if face_image_url is not None:
            profile_updates["face_image_url"] = face_image_url

        if farm_updates:
            self.repo.update_farm_fields(farm_id, **farm_updates)
        if profile_updates:
            self.repo.update_profile_fields(farm_id, **profile_updates)

        return self.load_settings(farm_id)

    # ============================================================
    # PR images（★ここで cover を永続化）
    # ============================================================

    def upload_pr_images_from_bytes(
        self,
        *,
        farm_id: int,
        files: List[Tuple[bytes, str]],
    ) -> FarmerSettingsDTO:
        state = self.repo.get_monthly_upload_state(farm_id)
        used = int(state.get("monthly_upload_bytes") or 0)
        limit = int(state.get("monthly_upload_limit") or 0)

        pr_list = self.repo.load_pr_images_list(farm_id)
        next_order = max([int(x.get("order", 0)) for x in pr_list], default=0) + 1

        for content, filename in files:
            size = len(content)
            if used + size > limit:
                raise ValueError("monthly upload limit exceeded")

            result = upload_bytes(
                content,
                filename=filename,
                folder=f"farms/{farm_id}/pr_images",
            )

            pr_list.append(
                {
                    "id": result["public_id"],
                    "url": result["url"],
                    "order": next_order,
                }
            )
            next_order += 1
            used += size

        self.repo.save_pr_images_list(farm_id, pr_list)
        self.repo.set_monthly_upload_state(
            farm_id,
            monthly_upload_bytes=used,
        )

        # ★ cover 永続化
        pr_sorted = sorted(pr_list, key=lambda x: int(x.get("order", 0)))
        if pr_sorted:
            self.repo.update_farm_fields(
                farm_id,
                cover_image_url=pr_sorted[0]["url"],
            )

        return self.load_settings(farm_id)

    def reorder_pr_images(
        self,
        *,
        farm_id: int,
        image_ids: List[str],
    ) -> FarmerSettingsDTO:
        pr_list = self.repo.load_pr_images_list(farm_id)
        mapping = {x.get("id"): x for x in pr_list}

        if set(mapping.keys()) != set(image_ids):
            raise ValueError("image_ids mismatch")

        new_list = []
        for idx, image_id in enumerate(image_ids, start=1):
            item = mapping[image_id]
            item["order"] = idx
            new_list.append(item)

        self.repo.save_pr_images_list(farm_id, new_list)

        # ★ cover 永続化
        if new_list:
            self.repo.update_farm_fields(
                farm_id,
                cover_image_url=new_list[0]["url"],
            )

        return self.load_settings(farm_id)

    def delete_pr_image(
        self,
        *,
        farm_id: int,
        image_id: str,
    ) -> FarmerSettingsDTO:
        pr_list = self.repo.load_pr_images_list(farm_id)

        # ★ 制約：PR画像は最低1枚必須（= カバー必須）
        if len(pr_list) <= 1:
            raise ValueError("at least one pr image is required")

        new_list = [x for x in pr_list if x.get("id") != image_id]

        if len(new_list) == len(pr_list):
            raise ValueError("image not found")

        for idx, item in enumerate(new_list, start=1):
            item["order"] = idx

        self.repo.save_pr_images_list(farm_id, new_list)

        # ★ cover 永続化（必ず new_list[0] が存在）
        self.repo.update_farm_fields(
            farm_id,
            cover_image_url=new_list[0]["url"],
        )

        return self.load_settings(farm_id)



    # ============================================================
    # Face image
    # ============================================================

    def upload_face_image_from_bytes(
        self,
        *,
        farm_id: int,
        file_bytes: bytes,
        filename: str,
    ) -> FarmerSettingsDTO:
        state = self.repo.get_monthly_upload_state(farm_id)
        used = int(state.get("monthly_upload_bytes") or 0)
        limit = int(state.get("monthly_upload_limit") or 0)

        size = len(file_bytes)
        if used + size > limit:
            raise ValueError("monthly upload limit exceeded")

        result = upload_bytes(
            file_bytes,
            filename=filename,
            folder=f"farms/{farm_id}/face_image",
        )

        self.repo.update_profile_fields(
            farm_id,
            face_image_url=result["url"],
        )

        self.repo.set_monthly_upload_state(
            farm_id,
            monthly_upload_bytes=used + size,
        )

        return self.load_settings(farm_id)
