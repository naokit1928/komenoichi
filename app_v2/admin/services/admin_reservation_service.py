from __future__ import annotations

import json
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple

from app_v2.admin.repository.admin_reservation_repo import (
    AdminReservationRepository,
)
from app_v2.admin.dto.admin_reservation_dtos import (
    AdminReservationListItemDTO,
)

from app_v2.admin.services.admin_items_formatter import (
    build_items_display,
    calc_amounts,
)

# FarmerReservation / Export と同じロジックを再利用（表示は禁止）
from app_v2.admin.services.admin_event_resolver import (
    parse_created_at,
    resolve_event,
)


class AdminReservationService:
    """
    /api/admin/reservations 用 Service。

    【重要な不変条件】
    - 表示の正は DB.reservations.pickup_display のみ
    - Admin 側での再計算・再解釈は禁止
    """

    def __init__(self, repo: Optional[AdminReservationRepository] = None) -> None:
        self.repo = repo or AdminReservationRepository()

    # ------------------------------------------------------------------
    # 一覧 API 用
    # ------------------------------------------------------------------
    def list_for_admin(
        self,
        *,
        limit: int = 200,
        offset: int = 0,
        farm_id: Optional[int] = None,
        reservation_id: Optional[int] = None,
        status: Optional[str] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        event_start: Optional[datetime] = None,
    ) -> Tuple[List[AdminReservationListItemDTO], int]:
        """
        管理画面一覧用の DTO 配列と total_count を返す。
        """

        # --- event_start フィルタモード ---
        if event_start is not None:
            raw_rows = self.repo.list_reservations(
                limit=10000,
                offset=0,
                farm_id=farm_id,
                reservation_id=reservation_id,
                status=status,
                date_from=None,
                date_to=None,
            )

            dtos: List[AdminReservationListItemDTO] = []

            for row in raw_rows:
                pickup_slot_code = str(row.get("pickup_slot_code") or "")
                if not pickup_slot_code:
                    continue

                created_at = parse_created_at(row.get("created_at"))

                row_event_start, _ = resolve_event(
                    created_at=created_at,
                    pickup_slot_code=pickup_slot_code,
                )

                if row_event_start != event_start:
                    continue

                dto = self._build_admin_dto(row)
                dtos.append(dto)

            return dtos, len(dtos)

        # --- 通常モード ---
        raw_rows = self.repo.list_reservations(
            limit=limit,
            offset=offset,
            farm_id=farm_id,
            reservation_id=reservation_id,
            status=status,
            date_from=date_from,
            date_to=date_to,
        )

        total_count = self.repo.count_reservations(
            farm_id=farm_id,
            reservation_id=reservation_id,
            status=status,
            date_from=date_from,
            date_to=date_to,
        )

        dtos: List[AdminReservationListItemDTO] = []
        for row in raw_rows:
            dto = self._build_admin_dto(row)
            dtos.append(dto)

        return dtos, total_count

    # ------------------------------------------------------------------
    # 受け渡しイベント（week）一覧
    # ------------------------------------------------------------------
    def list_weeks_for_farm(
        self,
        *,
        farm_id: int,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> List[Dict[str, Any]]:
        """
        FarmerReservationTable のヘッダ相当となる
        「受け渡しイベント一覧」を返す。
        """

        raw_rows = self.repo.list_reservations(
            limit=10000,
            offset=0,
            farm_id=farm_id,
            reservation_id=None,
            status=None,
            date_from=date_from,
            date_to=date_to,
        )

        grouped: Dict[Tuple[str, datetime], Dict[str, Any]] = {}

        for row in raw_rows:
            pickup_slot_code = str(row.get("pickup_slot_code") or "")
            if not pickup_slot_code:
                continue

            created_at = parse_created_at(row.get("created_at"))

            event_start, event_end = resolve_event(
                created_at=created_at,
                pickup_slot_code=pickup_slot_code,
            )

            key = (pickup_slot_code, event_start)

            if key not in grouped:
                grouped[key] = {
                    "farm_id": farm_id,
                    "pickup_slot_code": pickup_slot_code,
                    "event_start": event_start,
                    "event_end": event_end,
                    # ★ 表示は DB の値をそのまま使用
                    "pickup_display": row.get("pickup_display"),
                    "reservation_count": 0,
                    "pending_count": 0,
                    "confirmed_count": 0,
                    "cancelled_count": 0,
                    "rice_subtotal": 0,
                }

            g = grouped[key]
            g["reservation_count"] += 1

            status = str(row.get("status") or "")
            if status == "pending":
                g["pending_count"] += 1
            elif status == "confirmed":
                g["confirmed_count"] += 1
            elif status == "cancelled":
                g["cancelled_count"] += 1

            if status == "confirmed":
                g["rice_subtotal"] += int(row.get("rice_subtotal") or 0)

        items = list(grouped.values())
        items.sort(key=lambda x: (x["event_start"], x["pickup_slot_code"]))
        return items

    # ------------------------------------------------------------------
    # 内部ヘルパ
    # ------------------------------------------------------------------
    def _build_admin_dto(
        self,
        row: Dict[str, Any],
    ) -> AdminReservationListItemDTO:
        """
        reservations の生データから DTO を組み立てる。
        """

        pickup_slot_code = str(row.get("pickup_slot_code") or "")
        created_at = parse_created_at(row.get("created_at"))

        event_start, event_end = resolve_event(
            created_at=created_at,
            pickup_slot_code=pickup_slot_code,
        )

        # ★ 表示は DB.reservations.pickup_display のみ
        pickup_display = row.get("pickup_display")

        items_display = build_items_display(row.get("items_json"))
        rice_subtotal, service_fee, total_amount = calc_amounts(row)

        reservation_status = str(row.get("status") or "")
        payment_status = str(row.get("payment_status") or "")

        updated_raw = row.get("updated_at")
        updated_at = (
            parse_created_at(updated_raw)
            if updated_raw is not None
            else created_at
        )

        customer_user_id = int(row.get("customer_user_id") or row.get("user_id") or 0)

        owner_last_name = (row.get("owner_last_name") or "").strip()
        owner_first_name = (row.get("owner_first_name") or "").strip()
        owner_last_kana = (row.get("owner_last_kana") or "").strip()
        owner_first_kana = (row.get("owner_first_kana") or "").strip()

        farmer_postcode = (row.get("owner_postcode") or "").strip()
        addr_line = (row.get("owner_addr_line") or "").strip()

        pickup_place_name = (row.get("pickup_place_name") or "").strip()
        pickup_detail_memo = (row.get("pickup_notes") or "").strip()

        lat = row.get("pickup_lat")
        lng = row.get("pickup_lng")
        pickup_map_url = ""

        try:
            if lat is not None and lng is not None:
                pickup_map_url = self._build_google_maps_url(float(lat), float(lng))
        except (TypeError, ValueError):
            pickup_map_url = ""

        return AdminReservationListItemDTO(
            reservation_id=int(row["id"]),
            farm_id=int(row["farm_id"]),
            customer_user_id=customer_user_id,
            owner_last_name=owner_last_name or None,
            owner_first_name=owner_first_name or None,
            owner_last_kana=owner_last_kana or None,
            owner_first_kana=owner_first_kana or None,
            owner_postcode=farmer_postcode or None,
            owner_address_line=addr_line or None,
            owner_phone=(row.get("owner_phone") or "").strip() or None,
            pickup_start=event_start,
            pickup_end=event_end,
            pickup_display=pickup_display,
            pickup_place_name=pickup_place_name or None,
            pickup_map_url=pickup_map_url or None,
            pickup_detail_memo=pickup_detail_memo or None,
            items_display=items_display,
            rice_subtotal=rice_subtotal,
            service_fee=service_fee,
            total_amount=total_amount,
            reservation_status=reservation_status,
            created_at=created_at,
            updated_at=updated_at,
        )

    @staticmethod
    def _build_google_maps_url(lat: float, lng: float) -> str:
        return f"https://www.google.com/maps?q={lat},{lng}"
