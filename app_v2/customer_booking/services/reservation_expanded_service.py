from __future__ import annotations

import json
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, time, timezone
from typing import Dict, List, Optional, Tuple

from app_v2.customer_booking.dtos import (
    ExportBundleItemSummaryDTO,
    ExportBundleSummaryDTO,
    ExportEventMetaDTO,
    ExportReservationItemDTO,
    ExportReservationRowDTO,
    ExportReservationsResponseDTO,
)
from app_v2.customer_booking.repository.reservation_expanded_repo import (
    ReservationExpandedRepository,
    ReservationRecord,
    FarmRecord,
)

# ============================================================
# pickup_slot_code utilities（ロジック専用・表示禁止）
# ============================================================

_WEEKDAY_CODE_TO_INDEX: Dict[str, int] = {
    "MON": 0,
    "TUE": 1,
    "WED": 2,
    "THU": 3,
    "FRI": 4,
    "SAT": 5,
    "SUN": 6,
}

_PICKUP_SALT = 7919


# ============================================================
# datetime utilities（UTC only / 表示禁止）
# ============================================================

def _parse_db_datetime(value: str) -> datetime:
    """
    SQLite に保存されている DATETIME 文字列を
    UTC aware datetime に正規化する。
    """
    dt = datetime.fromisoformat(value.replace(" ", "T"))
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _decode_pickup_slot_code(code: str) -> Tuple[int, int, int]:
    """
    "SAT_10_11" → (weekday_index, start_hour, end_hour)
    """
    try:
        weekday_str, start_str, end_str = code.split("_")
    except ValueError:
        raise ValueError(f"Invalid pickup_slot_code format: {code}")

    weekday_index = _WEEKDAY_CODE_TO_INDEX.get(weekday_str.upper())
    if weekday_index is None:
        raise ValueError(f"Unknown weekday in pickup_slot_code: {code}")

    return weekday_index, int(start_str), int(end_str)


def _calc_base_week_event(
    base: datetime,
    pickup_slot_code: str,
) -> Tuple[datetime, datetime]:
    """
    base(UTC) が属する週における
    pickup_slot_code の event_start / event_end を UTC で計算する。
    ※ ロジック専用（表示には使わない）
    """
    base = base.astimezone(timezone.utc)
    weekday_index, start_hour, end_hour = _decode_pickup_slot_code(pickup_slot_code)

    week_start_date = base.date() - timedelta(days=base.weekday())
    event_date = week_start_date + timedelta(days=weekday_index)

    event_start = datetime.combine(
        event_date,
        time(hour=start_hour),
        tzinfo=timezone.utc,
    )
    event_end = datetime.combine(
        event_date,
        time(hour=end_hour),
        tzinfo=timezone.utc,
    )
    return event_start, event_end


def _calc_event_for_export(
    now: datetime,
    pickup_slot_code: str,
) -> Tuple[datetime, datetime]:
    """
    Export ページで「今週 or 来週」を判定するためのロジック（UTC）。
    ※ filtering 用。表示には使わない。
    """
    base_event_start, base_event_end = _calc_base_week_event(now, pickup_slot_code)
    grace_until = base_event_end + timedelta(hours=3)

    if now <= grace_until:
        return base_event_start, base_event_end

    return (
        base_event_start + timedelta(days=7),
        base_event_end + timedelta(days=7),
    )


def _calc_event_for_booking(
    created_at: datetime,
    pickup_slot_code: str,
) -> Tuple[datetime, datetime]:
    """
    予約がどの週のイベントに属するかを決める（UTC）。
    ※ filtering 用。表示には使わない。
    """
    base_event_start, base_event_end = _calc_base_week_event(
        created_at,
        pickup_slot_code,
    )
    deadline = base_event_start - timedelta(hours=3)

    if created_at <= deadline:
        return base_event_start, base_event_end

    return (
        base_event_start + timedelta(days=7),
        base_event_end + timedelta(days=7),
    )


# ============================================================
# pickup code（既存仕様踏襲）
# ============================================================

def _generate_pickup_code(reservation_id: int, consumer_id: int) -> str:
    code = ((reservation_id * 104729) ^ (consumer_id * 179) ^ _PICKUP_SALT) % 10000
    return f"{code:04d}"


# ============================================================
# Bundle accumulator
# ============================================================

@dataclass
class _BundleAccumulator:
    total_quantity: int = 0
    total_kg: int = 0
    rice_subtotal: int = 0


# ============================================================
# Service
# ============================================================

class ReservationExpandedService:
    """
    Export（農家用）ページの ViewModel を構築する Service。

    【重要な不変条件】
    - 表示日時は DB.reservations.pickup_display のみ
    - Service / Frontend での再計算・再解釈は禁止
    - datetime は filtering / grouping の内部ロジック専用
    """

    def __init__(
        self,
        repo: Optional[ReservationExpandedRepository] = None,
    ) -> None:
        self.repo = repo or ReservationExpandedRepository()

    def build_export_view(self, farm_id: int) -> ExportReservationsResponseDTO:
        farm: Optional[FarmRecord] = self.repo.get_farm(farm_id)

        if farm is None or farm.active_flag == 0 or not farm.pickup_time:
            return ExportReservationsResponseDTO(
                ok=True,
                event_meta=None,
                rows=[],
                bundle_summary=ExportBundleSummaryDTO(items=[], total_rice_subtotal=0),
            )

        pickup_slot_code = farm.pickup_time

        reservation_records: List[ReservationRecord] = (
            self.repo.get_confirmed_reservations_for_farm(
                farm_id=farm_id,
                pickup_slot_code=pickup_slot_code,
            )
        )

        now = datetime.now(timezone.utc)
        export_event_start, _ = _calc_event_for_export(
            now,
            pickup_slot_code,
        )

        rows: List[ExportReservationRowDTO] = []
        bundle_acc: Dict[int, _BundleAccumulator] = defaultdict(_BundleAccumulator)

        for rec in reservation_records:
            if not rec.created_at:
                continue

            try:
                created_at_dt = _parse_db_datetime(rec.created_at)
            except Exception:
                continue

            booking_event_start, _ = _calc_event_for_booking(
                created_at_dt,
                pickup_slot_code,
            )

            # 今回の export 対象イベント以外は除外
            if booking_event_start.date() != export_event_start.date():
                continue

            items: List[ExportReservationItemDTO] = []
            rice_subtotal_from_items = 0

            if rec.items_json:
                try:
                    raw_items = json.loads(rec.items_json)
                except json.JSONDecodeError:
                    raw_items = []

                if isinstance(raw_items, dict):
                    raw_items = [raw_items]

                for raw in raw_items:
                    if not isinstance(raw, dict):
                        continue

                    size_raw = raw.get("size_kg") or raw.get("sizeKg")
                    quantity_raw = raw.get("quantity")
                    line_total_raw = raw.get("line_total") or raw.get("subtotal")
                    unit_price_raw = raw.get("unit_price")

                    if size_raw is None or quantity_raw is None or line_total_raw is None:
                        continue

                    try:
                        size_kg = int(size_raw)
                        quantity = int(quantity_raw)
                        line_total = int(line_total_raw)
                        unit_price = (
                            int(unit_price_raw)
                            if unit_price_raw is not None
                            else int(line_total // quantity) if quantity > 0 else 0
                        )
                    except (ValueError, TypeError):
                        continue

                    items.append(
                        ExportReservationItemDTO(
                            size_kg=size_kg,
                            quantity=quantity,
                            unit_price=unit_price,
                            line_total=line_total,
                        )
                    )

                    rice_subtotal_from_items += line_total

                    acc = bundle_acc[size_kg]
                    acc.total_quantity += quantity
                    acc.total_kg += size_kg * quantity
                    acc.rice_subtotal += line_total

            rice_subtotal = (
                int(rec.rice_subtotal)
                if rec.rice_subtotal is not None
                else rice_subtotal_from_items
            )

            pickup_code = _generate_pickup_code(rec.id, rec.consumer_id)

            rows.append(
                ExportReservationRowDTO(
                    reservation_id=rec.id,
                    pickup_code=pickup_code,
                    created_at=rec.created_at,  # 表示目的では使わない
                    items=items,
                    rice_subtotal=rice_subtotal,
                )
            )

        if not rows:
            return ExportReservationsResponseDTO(
                ok=True,
                event_meta=None,
                rows=[],
                bundle_summary=ExportBundleSummaryDTO(items=[], total_rice_subtotal=0),
            )

        bundle_items: List[ExportBundleItemSummaryDTO] = []
        total_rice_subtotal = 0

        for size_kg in sorted(bundle_acc.keys()):
            acc = bundle_acc[size_kg]
            bundle_items.append(
                ExportBundleItemSummaryDTO(
                    size_kg=size_kg,
                    total_quantity=acc.total_quantity,
                    total_kg=acc.total_kg,
                    rice_subtotal=acc.rice_subtotal,
                )
            )
            total_rice_subtotal += acc.rice_subtotal

        bundle_summary = ExportBundleSummaryDTO(
            items=bundle_items,
            total_rice_subtotal=total_rice_subtotal,
        )

        
        pickup_display: Optional[str] = None
        for rec in reservation_records:
            if rec.pickup_display:
                pickup_display = rec.pickup_display
                break

        if pickup_display is None:
           event_meta = None
        else:
           event_meta = ExportEventMetaDTO(
             pickup_slot_code=pickup_slot_code,
             pickup_display=pickup_display,
           )


        return ExportReservationsResponseDTO(
            ok=True,
            event_meta=event_meta,
            rows=rows,
            bundle_summary=bundle_summary,
        )
