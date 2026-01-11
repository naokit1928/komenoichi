import json
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, time, timezone
from typing import Dict, List, Optional, Tuple

from zoneinfo import ZoneInfo

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
# 表示専用（JST）
# ============================================================
JST = ZoneInfo("Asia/Tokyo")

# "SAT_10_11" を weekday / hour に変換するためのマップ
_WEEKDAY_CODE_TO_INDEX: Dict[str, int] = {
    "MON": 0,
    "TUE": 1,
    "WED": 2,
    "THU": 3,
    "FRI": 4,
    "SAT": 5,
    "SUN": 6,
}

_WEEKDAY_JP = ["月", "火", "水", "木", "金", "土", "日"]

# 予約PIN生成用のソルト（既存実装と揃える）
_PICKUP_SALT = 7919


# ============================================================
# datetime ユーティリティ（UTC統一）
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


def _to_iso_jst(dt: datetime) -> str:
    """
    表示用：UTC datetime → JST ISO 文字列
    """
    return dt.astimezone(JST).isoformat()


# ============================================================
# pickup_slot_code utilities
# ============================================================
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


# ============================================================
# イベント計算（UTCのみ）
# ============================================================
def _calc_base_week_event(
    base: datetime,
    pickup_slot_code: str,
) -> Tuple[datetime, datetime]:
    """
    base(UTC) が属する週における
    pickup_slot_code の event_start / event_end を UTC で計算する。
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
    Export ページで「今週のイベント」を決めるロジック（UTC）。
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
    予約時にどの週のイベントに属するかを決める（UTC）。
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
# 表示ラベル生成（JSTのみ）
# ============================================================
def _weekday_label(index: int) -> str:
    try:
        return _WEEKDAY_JP[index]
    except IndexError:
        return "?"


def _format_event_display_label(
    event_start: datetime,
    event_end: datetime,
) -> str:
    """
    "11月29日（土）10:00〜11:00"
    """
    event_start_jst = event_start.astimezone(JST)
    event_end_jst = event_end.astimezone(JST)

    month = event_start_jst.month
    day = event_start_jst.day
    weekday_jp = _weekday_label(event_start_jst.weekday())
    start_str = event_start_jst.strftime("%H:%M")
    end_str = event_end_jst.strftime("%H:%M")
    return f"{month}月{day}日（{weekday_jp}）{start_str}〜{end_str}"


# ============================================================
# その他
# ============================================================
def _generate_pickup_code(reservation_id: int, consumer_id: int) -> str:
    code = ((reservation_id * 104729) ^ (consumer_id * 179) ^ _PICKUP_SALT) % 10000
    return f"{code:04d}"


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
    ExportBluePrint に定義された ViewModel を構築する Service 層。
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
        export_event_start, export_event_end = _calc_event_for_export(
            now,
            pickup_slot_code,
        )

        deadline = export_event_start - timedelta(hours=3)
        grace_until = export_event_end + timedelta(hours=12)

        event_meta = ExportEventMetaDTO(
            pickup_slot_code=pickup_slot_code,
            event_start=_to_iso_jst(export_event_start),
            event_end=_to_iso_jst(export_event_end),
            deadline=_to_iso_jst(deadline),
            grace_until=_to_iso_jst(grace_until),
            display_label=_format_event_display_label(
                export_event_start,
                export_event_end,
            ),
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
                    created_at=_to_iso_jst(created_at_dt),
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

        return ExportReservationsResponseDTO(
            ok=True,
            event_meta=event_meta,
            rows=rows,
            bundle_summary=bundle_summary,
        )
