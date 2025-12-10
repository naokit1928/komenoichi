# app_v2/farmer/services/farmer_settings_service.py
from __future__ import annotations

import json
from datetime import datetime
from typing import Optional, List, Tuple, Any, Dict

from app.cloudinary_client import upload_bytes
from app_v2.farmer.dtos import FarmerSettingsDTO, PRImageDTO
from app_v2.farmer.repository.farmer_settings_repo import (
    FarmerSettingsRepository,
)


class FarmerSettingsService:
    """
    Farmer Settings v2 のビジネスロジック層（ORM 非依存版）。

    - repository は生SQLで DB を読む・書く
    - この service が DTO 変換・自動計算・公開条件チェックを担当する
    """

    def __init__(self, db: Any | None = None) -> None:
        # db は互換用引数として受け取るが使用しない
        self.repo = FarmerSettingsRepository()

    # ===============================================================
    # 公開条件チェック（is_ready_to_publish / missing_fields）
    # ===============================================================

    def _compute_missing_fields(
        self,
        farm: Dict[str, Any],
        profile: Dict[str, Any],
        pr_images_list: List[dict],
    ) -> List[str]:
        """
        公開に必要な項目が揃っているかをチェックし、
        不足している項目を missing_fields として返す。

        organize_data.md の V2 公開条件に対応：
          - rice_variety_label
          - price_10kg
          - pr_title
          - cover_image_url
          - face_image_url
          - pr_images が 1枚以上
          - pickup_lat / pickup_lng / pickup_time
        """
        missing: List[str] = []

        if not farm.get("rice_variety_label"):
            missing.append("rice_variety_label")

        if farm.get("price_10kg") is None:
            missing.append("price_10kg")

        if not profile.get("pr_title"):
            missing.append("pr_title")

        if not profile.get("cover_image_url"):
            missing.append("cover_image_url")

        if not profile.get("face_image_url"):
            missing.append("face_image_url")

        if not pr_images_list:
            missing.append("pr_images")

        if farm.get("pickup_lat") is None:
            missing.append("pickup_lat")
        if farm.get("pickup_lng") is None:
            missing.append("pickup_lng")
        if not farm.get("pickup_time"):
            missing.append("pickup_time")

        return missing

    # ===============================================================
    # 価格自動計算
    # ===============================================================

    def _round_to_100(self, value: Optional[int]) -> Optional[int]:
        """
        100円単位で四捨五入するヘルパー。
        例）6789 → 6800
        """
        if value is None:
            return None

        v = int(value)
        sign = 1
        if v < 0:
            sign = -1
            v = -v

        q, r = divmod(v, 100)
        if r >= 50:
            q += 1
        return sign * q * 100

    def _auto_calc_prices(
        self,
        price_10kg: Optional[int],
    ) -> Tuple[Optional[int], Optional[int]]:
        """
        5kg, 25kg の価格を 10kg をベースに自動算出。

        5kg: 10kg の 52%
        25kg: 10kg の 240%

        10kg・5kg・25kg すべて 100円単位で四捨五入する。
        """
        if price_10kg is None:
            return None, None

        base_10kg = self._round_to_100(price_10kg)

        raw_5kg = (base_10kg * 52 + 50) // 100
        price_5kg = self._round_to_100(raw_5kg)

        raw_25kg = (base_10kg * 240 + 50) // 100
        price_25kg = self._round_to_100(raw_25kg)

        return price_5kg, price_25kg

    # ===============================================================
    # harvest_year 計算
    # ===============================================================

    def _calc_harvest_year(self) -> int:
        """
        収穫年度の自動計算。
        9–12月 → 当年産
        1–8月  → 前年産
        """
        now = datetime.now()
        if now.month >= 9:
            return now.year
        return now.year - 1

    # ===============================================================
    # アップロード制限リセット（monthly_upload_bytes / next_reset_at）
    # ===============================================================

    def _calc_next_reset_at(self, base: Optional[datetime] = None) -> datetime:
        """
        「次の月初 00:00」を返す。
        例）2025-11-20 → 2025-12-01 00:00:00
        """
        if base is None:
            base = datetime.now()

        year = base.year
        month = base.month

        if month == 12:
            return datetime(year + 1, 1, 1, 0, 0, 0)
        return datetime(year, month + 1, 1, 0, 0, 0)

    def _ensure_monthly_upload_quota(
        self,
        farm_id: int,
    ) -> Dict[str, Any]:
        """
        monthly_upload_bytes / next_reset_at をチェックし、
        必要であればリセットする。

        戻り値は更新後の FarmerProfile 行(dict)。
        """
        profile = self.repo.get_monthly_upload_state(farm_id)

        now = datetime.now()
        raw_next = profile.get("next_reset_at")
        next_reset_dt: Optional[datetime] = None

        if raw_next is None:
            next_reset_dt = None
        elif isinstance(raw_next, datetime):
            next_reset_dt = raw_next
        elif isinstance(raw_next, str):
            try:
                next_reset_dt = datetime.fromisoformat(raw_next)
            except ValueError:
                next_reset_dt = None
        else:
            next_reset_dt = None

        changed = False
        if next_reset_dt is None:
            next_reset_dt = self._calc_next_reset_at(now)
            self.repo.set_monthly_upload_state(
                farm_id,
                next_reset_at=next_reset_dt,
            )
            changed = True
        elif next_reset_dt <= now:
            next_reset_dt = self._calc_next_reset_at(now)
            self.repo.set_monthly_upload_state(
                farm_id,
                monthly_upload_bytes=0,
                next_reset_at=next_reset_dt,
            )
            profile["monthly_upload_bytes"] = 0
            changed = True

        if changed:
            profile["next_reset_at"] = next_reset_dt.isoformat()

        return profile

    # ===============================================================
    # PR画像 JSON のロード／保存（旧 _load/_save のラッパ）
    # ===============================================================

    def _load_pr_images_list(
        self,
        farm_id: int,
    ) -> List[dict]:
        return self.repo.load_pr_images_list(farm_id)

    def _save_pr_images_list(
        self,
        farm_id: int,
        pr_list: List[dict],
    ) -> None:
        self.repo.save_pr_images_list(farm_id, pr_list)

    # ===============================================================
    # Cloudinary アップロード共通処理
    # ===============================================================

    def _upload_single_image_with_quota(
        self,
        farm_id: int,
        file_bytes: bytes,
        *,
        filename: str,
    ) -> dict:
        """
        Cloudinary へ 1枚アップロードし、monthly_upload_bytes を更新する共通処理。

        - file_bytes が空なら ValueError
        - 月間上限（monthly_upload_limit, デフォルト 50,000,000 bytes）を超える場合も ValueError
        """
        if not file_bytes:
            raise ValueError("empty file")

        profile = self._ensure_monthly_upload_quota(farm_id)

        used = int(profile.get("monthly_upload_bytes") or 0)
        limit = int(profile.get("monthly_upload_limit") or 50_000_000)

        if used + len(file_bytes) > limit:
            raise ValueError(
                f"monthly upload limit exceeded: used={used}, "
                f"size={len(file_bytes)}, limit={limit}"
            )

        result = upload_bytes(file_bytes, filename=filename)

        stored_bytes = int(result.get("bytes") or 0) or len(file_bytes)
        new_used = used + stored_bytes

        self.repo.set_monthly_upload_state(
            farm_id,
            monthly_upload_bytes=new_used,
        )

        return result

    # ===============================================================
    # 顔画像アップロード
    # ===============================================================

    def upload_face_image_from_bytes(
        self,
        farm_id: int,
        file_bytes: bytes,
        *,
        filename: Optional[str] = None,
    ) -> FarmerSettingsDTO:
        """
        顔写真を Cloudinary にアップロードし、face_image_url と monthly_upload_bytes を更新。
        """
        farm = self.repo.get_farm(farm_id)
        if not farm:
            raise ValueError(f"farm_id={farm_id} not found")

        profile = self.repo.get_profile(farm_id)
        if not profile:
            self.repo.create_initial_profile(farm_id)

        result = self._upload_single_image_with_quota(
            farm_id,
            file_bytes,
            filename=filename or "face_image",
        )

        url = result.get("secure_url") or result.get("url")
        if url:
            self.repo.update_profile_fields(farm_id, face_image_url=url)

        return self.load_settings(farm_id)

    def upload_cover_image_from_bytes(
        self,
        farm_id: int,
        *,
        file_bytes: bytes,
        filename: Optional[str] = None,
    ) -> FarmerSettingsDTO:
        """
        カバー画像を Cloudinary にアップロードし、cover_image_url と monthly_upload_bytes を更新。
        """
        farm = self.repo.get_farm(farm_id)
        if not farm:
            raise ValueError(f"farm_id={farm_id} not found")

        profile = self.repo.get_profile(farm_id)
        if not profile:
            self.repo.create_initial_profile(farm_id)

        result = self._upload_single_image_with_quota(
            farm_id,
            file_bytes,
            filename=filename or "cover_image",
        )
        url = result.get("secure_url") or result.get("url")
        if url:
            self.repo.update_profile_fields(farm_id, cover_image_url=url)

        return self.load_settings(farm_id)

    # ===============================================================
    # PR 画像アップロード
    # ===============================================================

    def upload_pr_images_from_bytes(
        self,
        farm_id: int,
        files: List[Tuple[bytes, str]],
    ) -> FarmerSettingsDTO:
        """
        PR 画像を複数枚アップロードする。
        """
        farm = self.repo.get_farm(farm_id)
        if not farm:
            raise ValueError(f"farm_id={farm_id} not found")

        profile = self.repo.get_profile(farm_id)
        if not profile:
            self.repo.create_initial_profile(farm_id)

        self._ensure_monthly_upload_quota(farm_id)

        pr_list = self._load_pr_images_list(farm_id)

        for file_bytes, fname in files:
            result = self._upload_single_image_with_quota(
                farm_id,
                file_bytes,
                filename=fname,
            )
            url = result.get("secure_url") or result.get("url")
            public_id = result.get("public_id") or fname

            pr_list.append(
                {
                    "id": public_id,
                    "url": url,
                    "order": len(pr_list),
                }
            )

        # 既に cover_image_url が無い場合は 先頭 PR をカバーとして補完
        profile = self.repo.get_profile(farm_id) or {}
        cover = profile.get("cover_image_url")
        if not cover and pr_list:
            first = sorted(pr_list, key=lambda x: int(x.get("order", 0)))[0]
            first_url = first.get("url")
            if first_url:
                self.repo.update_profile_fields(farm_id, cover_image_url=first_url)

        self._save_pr_images_list(farm_id, pr_list)

        return self.load_settings(farm_id)

    # ===============================================================
    # PR 画像の並び替え
    # ===============================================================

    def reorder_pr_images(
        self,
        farm_id: int,
        image_ids: List[str],
    ) -> FarmerSettingsDTO:
        """
        PR 画像の並び順を更新する。
        """
        farm = self.repo.get_farm(farm_id)
        if not farm:
            raise ValueError(f"farm_id={farm_id} not found")

        pr_list = self._load_pr_images_list(farm_id)

        mapping = {item.get("id"): item for item in pr_list if item.get("id")}

        new_list: List[dict] = []
        for img_id in image_ids:
            item = mapping.get(img_id)
            if item:
                new_list.append(item)

        for item in pr_list:
            img_id = item.get("id")
            if not img_id:
                continue
            if img_id in image_ids:
                continue
            new_list.append(item)

        for idx, item in enumerate(new_list):
            item["order"] = idx

        self._save_pr_images_list(farm_id, new_list)

        return self.load_settings(farm_id)

    # ===============================================================
    # PR 画像の削除
    # ===============================================================

    def delete_pr_image(
        self,
        farm_id: int,
        image_id: str,
    ) -> FarmerSettingsDTO:
        """
        PR 画像を1枚削除する。
        """
        farm = self.repo.get_farm(farm_id)
        if not farm:
            raise ValueError(f"farm_id={farm_id} not found")

        pr_list = self._load_pr_images_list(farm_id)
        new_list: List[dict] = []
        for item in pr_list:
            if item.get("id") == image_id:
                continue
            new_list.append(item)

        for idx, item in enumerate(new_list):
            item["order"] = idx

        self._save_pr_images_list(farm_id, new_list)

        return self.load_settings(farm_id)

    # ===============================================================
    # DTO 生成（load_settings）
    # ===============================================================

    def load_settings(self, farm_id: int) -> FarmerSettingsDTO:
        """
        Farm + FarmerProfile + PR画像 を読み込み、
        FarmerSettingsDTO にまとめて返す。
        """
        farm = self.repo.get_farm(farm_id)
        if not farm:
            raise ValueError(f"farm_id={farm_id} not found")

        profile = self.repo.get_profile(farm_id)
        if not profile:
            profile = self.repo.create_initial_profile(farm_id)

        profile = self._ensure_monthly_upload_quota(farm_id)

        pr_list = self._load_pr_images_list(farm_id)
        pr_list_sorted = sorted(pr_list, key=lambda x: int(x.get("order", 0)))

        computed_cover_url: Optional[str] = None
        if pr_list_sorted:
            computed_cover_url = pr_list_sorted[0].get("url")

        pr_dtos: List[PRImageDTO] = [
            PRImageDTO(
                id=item.get("id"),
                url=item.get("url"),
                order=int(item.get("order", 0)),
            )
            for item in pr_list_sorted
        ]

        price_10kg = farm.get("price_10kg")
        price_5kg = farm.get("price_5kg")
        price_25kg = farm.get("price_25kg")

        if price_10kg is not None and (price_5kg is None or price_25kg is None):
            price_5kg, price_25kg = self._auto_calc_prices(price_10kg)

        harvest_year = self._calc_harvest_year()
        thumbnail_url = self._compute_thumbnail_url(profile, pr_list)
        missing_fields = self._compute_missing_fields(farm, profile, pr_list)
        is_ready = len(missing_fields) == 0
        active_flag = int(farm.get("active_flag", 1) or 1)

        dto = FarmerSettingsDTO(
            is_accepting_reservations=bool(
                farm.get("is_accepting_reservations", False)
            ),
            is_ready_to_publish=is_ready,
            active_flag=active_flag,
            rice_variety_label=farm.get("rice_variety_label"),
            pr_title=profile.get("pr_title"),
            pr_text=profile.get("pr_text"),
            price_10kg=price_10kg,
            price_5kg=price_5kg,
            price_25kg=price_25kg,
            face_image_url=profile.get("face_image_url"),
            cover_image_url=computed_cover_url,
            pr_images=pr_dtos,
            harvest_year=harvest_year,
            monthly_upload_bytes=int(profile.get("monthly_upload_bytes") or 0),
            monthly_upload_limit=int(profile.get("monthly_upload_limit") or 50_000_000),
            next_reset_at=profile.get("next_reset_at"),
            missing_fields=missing_fields,
            thumbnail_url=thumbnail_url,
        )

        return dto

    # ===============================================================
    # 保存（POST /farmer/settings-v2）
    # ===============================================================

    def save_settings(
        self,
        farm_id: int,
        *,
        is_accepting_reservations: Optional[bool] = None,
        rice_variety_label: Optional[str] = None,
        pr_title: Optional[str] = None,
        pr_text: Optional[str] = None,
        price_10kg: Optional[int] = None,
        face_image_url: Optional[str] = None,
        cover_image_url: Optional[str] = None,
    ) -> FarmerSettingsDTO:
        """
        フロントからの設定変更を反映し、DTO を返す。
        """
        farm = self.repo.get_farm(farm_id)
        if not farm:
            raise ValueError(f"farm_id={farm_id} not found")

        profile = self.repo.get_profile(farm_id)
        if not profile:
            profile = self.repo.create_initial_profile(farm_id)

        farm_updates: Dict[str, Any] = {}
        profile_updates: Dict[str, Any] = {}

        if is_accepting_reservations is not None:
            farm_updates["is_accepting_reservations"] = bool(
                is_accepting_reservations
            )

        if rice_variety_label is not None:
            farm_updates["rice_variety_label"] = rice_variety_label

        if price_10kg is not None:
            rounded_10kg = self._round_to_100(price_10kg)

            if rounded_10kg < 5000:
                rounded_10kg = 5000
            elif rounded_10kg > 9900:
                rounded_10kg = 9900

            farm_updates["price_10kg"] = rounded_10kg

            price_5kg, price_25kg = self._auto_calc_prices(rounded_10kg)
            farm_updates["price_5kg"] = price_5kg
            farm_updates["price_25kg"] = price_25kg

        if pr_title is not None:
            profile_updates["pr_title"] = pr_title

        if pr_text is not None:
            profile_updates["pr_text"] = pr_text

        if face_image_url is not None:
            profile_updates["face_image_url"] = face_image_url

        if cover_image_url is not None:
            profile_updates["cover_image_url"] = cover_image_url

        if farm_updates:
            self.repo.update_farm_fields(farm_id, **farm_updates)
        if profile_updates:
            self.repo.update_profile_fields(farm_id, **profile_updates)

        return self.load_settings(farm_id)

    # ===============================================================
    # active_flag を admin から直接変更
    # ===============================================================

    def set_active_flag_for_admin(
        self,
        farm_id: int,
        active_flag: int,
    ) -> FarmerSettingsDTO:
        """
        admin 用：active_flag を 0/1 で更新する。
        BAN(0) の場合は is_accepting_reservations も False にする。
        """
        farm = self.repo.get_farm(farm_id)
        if not farm:
            raise ValueError(f"farm_id={farm_id} not found")

        updates: Dict[str, Any] = {"active_flag": int(active_flag)}
        if active_flag == 0:
            updates["is_accepting_reservations"] = False

        self.repo.update_farm_fields(farm_id, **updates)

        return self.load_settings(farm_id)

    # ===============================================================
    # サムネイル URL の計算
    # ===============================================================

    def _compute_thumbnail_url(
        self,
        profile: Dict[str, Any],
        pr_list: List[dict],
    ) -> Optional[str]:
        """
        サムネイル用の URL を決定する。

        優先順位：
        1. PR 画像の先頭
        2. カバー画像
        3. 顔写真
        """
        if pr_list:
            first = sorted(pr_list, key=lambda x: int(x.get("order", 0)))[0]
            url = first.get("url")
            if url:
                return url

        cover_url = profile.get("cover_image_url")
        if cover_url:
            return cover_url

        face_url = profile.get("face_image_url")
        if face_url:
            return face_url

        return None
