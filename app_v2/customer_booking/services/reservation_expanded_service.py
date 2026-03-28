# app_v2/customer_booking/services/reservation_expanded_service.py
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
# Constants
# ============================================================

_WEEKDAY_CODE_TO_INDEX: Dict[str, int] = {
    "MON": 0, "TUE": 1, "WED": 2, "THU": 3, "FRI": 4, "SAT": 5, "SUN": 6,
}

_PICKUP_SALT = 7919
JST = timezone(timedelta(hours=9), "JST")

# ============================================================
# UTC Domain Logic (タイムゾーンの境界を厳密に管理)
# ============================================================

def _parse_db_datetime(value: str) -> datetime:
    """SQLiteのDATETIME文字列(UTC)を純粋な UTC aware datetime に変換"""
    dt = datetime.fromisoformat(value.replace(" ", "T"))
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

def _resolve_slot_to_utc_event(base_utc: datetime, pickup_slot_code: str) -> Tuple[datetime, datetime]:
    """基準時間(UTC) と ローカルルール(WED_19_20) を組み合わせて、絶対時間である「イベント開始(UTC)」と「イベント終了(UTC)」を返す。"""
    try:
        w_str, s_str, e_str = pickup_slot_code.split("_")
        weekday_index = _WEEKDAY_CODE_TO_INDEX[w_str.upper()]
        start_hour, end_hour = int(s_str), int(e_str)
    except Exception:
        raise ValueError(f"Invalid pickup_slot_code: {pickup_slot_code}")

    base_jst = base_utc.astimezone(JST)
    week_start_date = base_jst.date() - timedelta(days=base_jst.weekday())
    event_date = week_start_date + timedelta(days=weekday_index)

    event_start_jst = datetime.combine(event_date, time(hour=start_hour), tzinfo=JST)
    event_end_jst = datetime.combine(event_date, time(hour=end_hour), tzinfo=JST)
    
    return event_start_jst.astimezone(timezone.utc), event_end_jst.astimezone(timezone.utc)

def _calc_event_for_export(now_utc: datetime, pickup_slot_code: str) -> Tuple[datetime, datetime]:
    """現在の「基準となる週」を決定する。"""
    base_start_utc, base_end_utc = _resolve_slot_to_utc_event(now_utc, pickup_slot_code)
    
    # 終了時刻＋「1時間」を切り替えの閾値とする（1時間後に「先週」へ移動）
    rollover_threshold = base_end_utc + timedelta(hours=1)
    
    if now_utc < rollover_threshold:
        return base_start_utc, base_end_utc
    return (base_start_utc + timedelta(days=7), base_end_utc + timedelta(days=7))

def _calc_event_for_booking(created_at_utc: datetime, pickup_slot_code: str) -> Tuple[datetime, datetime]:
    """予約の所属先判定: ドキュメント通り3時間前ルールを適用 (ALL UTC)"""
    base_start_utc, base_end_utc = _resolve_slot_to_utc_event(created_at_utc, pickup_slot_code)
    
    deadline_utc = base_start_utc - timedelta(hours=3)
    if created_at_utc <= deadline_utc:
        return base_start_utc, base_end_utc
    return (base_start_utc + timedelta(days=7), base_end_utc + timedelta(days=7))

# ============================================================
# Display Formatters
# ============================================================

def _generate_pickup_display_fallback(event_start_utc: datetime, event_end_utc: datetime) -> str:
    st_jst = event_start_utc.astimezone(JST)
    ed_jst = event_end_utc.astimezone(JST)
    wdays = ["月", "火", "水", "木", "金", "土", "日"]
    w = wdays[st_jst.weekday()]
    return f"{st_jst.month}/{st_jst.day}（{w}） {st_jst.strftime('%H:%M')}–{ed_jst.strftime('%H:%M')}"

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
    def __init__(self, repo: Optional[ReservationExpandedRepository] = None) -> None:
        self.repo = repo or ReservationExpandedRepository()

    def build_export_view(self, farm_id: int, offset: int = 0) -> ExportReservationsResponseDTO:
        farm: Optional[FarmRecord] = self.repo.get_farm(farm_id)
        if farm is None or farm.active_flag == 0 or not farm.pickup_time:
            return ExportReservationsResponseDTO(
                ok=True, event_meta=None, rows=[],
                bundle_summary=ExportBundleSummaryDTO(items=[], total_rice_subtotal=0),
            )

        pickup_slot_code = farm.pickup_time
        reservation_records = self.repo.get_confirmed_reservations_for_farm(
            farm_id=farm_id, pickup_slot_code=pickup_slot_code
        )

        now_utc = datetime.now(timezone.utc)
        current_start_utc, current_end_utc = _calc_event_for_export(now_utc, pickup_slot_code)
        export_start_utc = current_start_utc + timedelta(days=7 * offset)
        export_end_utc = current_end_utc + timedelta(days=7 * offset)

        rows: List[ExportReservationRowDTO] = []
        bundle_acc: Dict[int, _BundleAccumulator] = defaultdict(_BundleAccumulator)
        valid_pickup_displays: List[str] = []

        for rec in reservation_records:
            if not rec.created_at:
                continue

            try:
                created_at_utc = _parse_db_datetime(rec.created_at)
            except Exception:
                continue

            booking_start_utc, _ = _calc_event_for_booking(created_at_utc, pickup_slot_code)
            if booking_start_utc != export_start_utc:
                continue

            if rec.pickup_display:
                valid_pickup_displays.append(rec.pickup_display)

            items: List[ExportReservationItemDTO] = []
            rice_subtotal_from_items = 0

            if rec.items_json:
                try:
                    raw_items = json.loads(rec.items_json)
                    if isinstance(raw_items, dict):
                        raw_items = [raw_items]
                except json.JSONDecodeError:
                    continue

                for raw in raw_items:
                    if not isinstance(raw, dict):
                        continue

                    size_raw = raw.get("size_kg") or raw.get("sizeKg")
                    qty_raw = raw.get("quantity")
                    line_total_raw = raw.get("line_total") or raw.get("subtotal")
                    unit_price_raw = raw.get("unit_price") or raw.get("unitPrice")

                    if size_raw is None or qty_raw is None:
                        continue

                    try:
                        size_kg = int(size_raw)
                        quantity = int(qty_raw)

                        if line_total_raw is not None:
                            line_total = int(line_total_raw)
                            unit_price = int(unit_price_raw) if unit_price_raw is not None else (line_total // quantity if quantity > 0 else 0)
                        elif unit_price_raw is not None:
                            unit_price = int(unit_price_raw)
                            line_total = unit_price * quantity
                        else:
                            continue

                    except (ValueError, TypeError):
                        continue

                    items.append(ExportReservationItemDTO(
                        size_kg=size_kg, quantity=quantity, unit_price=unit_price, line_total=line_total
                    ))
                    rice_subtotal_from_items += line_total
                    acc = bundle_acc[size_kg]
                    acc.total_quantity += quantity
                    acc.total_kg += size_kg * quantity
                    acc.rice_subtotal += line_total

            rice_subtotal = int(rec.rice_subtotal) if rec.rice_subtotal is not None else rice_subtotal_from_items
            rows.append(ExportReservationRowDTO(
                reservation_id=rec.id,
                pickup_code=_generate_pickup_code(rec.id, rec.consumer_id),
                created_at=rec.created_at,
                items=items,
                rice_subtotal=rice_subtotal,
                status=rec.status or "confirmed",
            ))

        fallback_display = _generate_pickup_display_fallback(export_start_utc, export_end_utc)

        if not rows:
            event_meta = ExportEventMetaDTO(
                pickup_slot_code=pickup_slot_code, 
                pickup_display=fallback_display,
                event_end_at=export_end_utc.isoformat()
            )
            return ExportReservationsResponseDTO(
                ok=True, event_meta=event_meta, rows=[],
                bundle_summary=ExportBundleSummaryDTO(items=[], total_rice_subtotal=0),
            )

        bundle_items = [
            ExportBundleItemSummaryDTO(
                size_kg=s, total_quantity=bundle_acc[s].total_quantity,
                total_kg=bundle_acc[s].total_kg, rice_subtotal=bundle_acc[s].rice_subtotal
            ) for s in sorted(bundle_acc.keys())
        ]
        
        pickup_display = valid_pickup_displays[0] if valid_pickup_displays else fallback_display
        event_meta = ExportEventMetaDTO(
            pickup_slot_code=pickup_slot_code, 
            pickup_display=pickup_display,
            event_end_at=export_end_utc.isoformat()
        )

        return ExportReservationsResponseDTO(
            ok=True, event_meta=event_meta, rows=rows,
            bundle_summary=ExportBundleSummaryDTO(items=bundle_items, total_rice_subtotal=sum(b.rice_subtotal for b in bundle_items)),
        )