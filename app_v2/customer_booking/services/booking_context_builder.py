from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, Tuple
from zoneinfo import ZoneInfo

from app_v2.customer_booking.dtos import BookingContextDTO

# 既存ロジックをそのまま再利用（重要）
from app_v2.customer_booking.services.reservation_expanded_service import (
    _calc_event_for_booking,
    _format_event_display_label,
    _generate_pickup_code,
)

JST = ZoneInfo("Asia/Tokyo")


class BookingContextBuilder:
    """
    Booking Context Builder
    -----------------------
    責務：
      - reservation / user / farm の生データから
      - ReservationBooked（予約完了ページ）専用 Context を生成する

    設計方針（重要）：
      - pickup_map_url は pickup 設定で指定された lat/lng のみを使用
      - 住所フォールバックは禁止（ピン指定の正確性を最優先）
    """

    # ==========================================================
    # Public API
    # ==========================================================

    def build(
        self,
        *,
        reservation: Dict[str, Any],
        user: Dict[str, Any],
        farm: Dict[str, Any],
    ) -> Tuple[
        BookingContextDTO,
        datetime,  # event_start (JST)
        datetime,  # event_end (JST)
        datetime,  # confirmed_at (JST)
    ]:
        """
        ReservationBooked 用 Context を生成する
        """

        created_at = self._parse_db_utc_to_jst(reservation.get("created_at"))

        event_start, event_end = _calc_event_for_booking(
            created_at=created_at,
            pickup_slot_code=str(reservation.get("pickup_slot_code") or ""),
        )

        pickup_display = _format_event_display_label(event_start, event_end)

        pickup_code = _generate_pickup_code(
            reservation_id=int(reservation["reservation_id"]),
            consumer_id=int(user["consumer_id"]),
        )

        items = self._parse_items(reservation.get("items_json") or "[]")
        qty_5, qty_10, qty_25, s5, s10, s25 = self._aggregate_rice_items(items)

        confirmed_at = self._parse_db_utc_to_jst(
            reservation.get("payment_succeeded_at")
            or reservation.get("created_at")
        )

        ctx = BookingContextDTO(
            reservation_id=int(reservation["reservation_id"]),
            pickup_display=pickup_display,
            pickup_place_name=farm.get("pickup_place_name") or "",
            pickup_map_url=self._build_pickup_map_url_from_latlng(farm),
            pickup_detail_memo=farm.get("pickup_notes") or "",
            pickup_code=pickup_code,
            qty_5=qty_5,
            qty_10=qty_10,
            qty_25=qty_25,
            rice_subtotal=reservation.get("rice_subtotal")
            or (s5 + s10 + s25),
            label_5kg="5kg",
            label_10kg="10kg",
            label_25kg="25kg",
        )

        return ctx, event_start, event_end, confirmed_at

    # ==========================================================
    # Internal helpers（純粋関数群）
    # ==========================================================

    def _build_pickup_map_url_from_latlng(self, farm: Dict[str, Any]) -> str:
        """
        pickup 設定で指定された正確な lat/lng から
        Google Maps URL を生成する。

        ※ 住所フォールバックは禁止
        """
        lat = farm.get("pickup_lat")
        lng = farm.get("pickup_lng")

        if lat is None or lng is None:
            return ""

        try:
            lat_f = float(lat)
            lng_f = float(lng)
        except (TypeError, ValueError):
            return ""

        return (
            "https://www.google.com/maps/search/?api=1&query="
            f"{lat_f},{lng_f}"
        )

    def _parse_items(self, items_json: str):
        try:
            return json.loads(items_json)
        except Exception:
            return []

    def _aggregate_rice_items(self, items: Any):
        qty_5 = qty_10 = qty_25 = 0
        s5 = s10 = s25 = 0

        if not isinstance(items, list):
            return qty_5, qty_10, qty_25, s5, s10, s25

        for i in items:
            try:
                size = int(i.get("size_kg"))
                q = int(i.get("quantity") or 0)
                s = int(i.get("subtotal") or 0)
            except Exception:
                continue

            if size == 5:
                qty_5 += q
                s5 += s
            elif size == 10:
                qty_10 += q
                s10 += s
            elif size == 25:
                qty_25 += q
                s25 += s

        return qty_5, qty_10, qty_25, s5, s10, s25

    def _parse_db_utc_to_jst(self, value: Any) -> datetime:
        if value is None:
            return datetime.now(tz=JST)

        if isinstance(value, datetime):
            dt = value
        else:
            dt = datetime.fromisoformat(str(value).replace(" ", "T"))

        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)

        return dt.astimezone(JST)
