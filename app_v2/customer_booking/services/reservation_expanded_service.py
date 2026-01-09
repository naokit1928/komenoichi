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


def _parse_db_datetime(value: str) -> datetime:
    """
    SQLite に保存されている DATETIME 文字列を Python の datetime に変換する。

    - DB には UTC ("YYYY-MM-DD HH:MM:SS" など) で保存されている前提。
    - ここで UTC → JST(+09:00) に変換して扱う。
    """
    # "YYYY-MM-DD HH:MM:SS" / "YYYY-MM-DDTHH:MM:SS" / オフセット付き すべて対応
    dt = datetime.fromisoformat(value.replace(" ", "T"))

    # tzinfo が無い場合は UTC とみなす
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        # 何かしら tzinfo が付いている場合はいったん UTC に揃える
        dt = dt.astimezone(timezone.utc)

    # 最終的に JST に変換して返す
    return dt.astimezone(JST)


def _to_iso_jst(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=JST)
    else:
        dt = dt.astimezone(JST)
    return dt.isoformat()


def _decode_pickup_slot_code(code: str) -> Tuple[int, int, int]:
    """
    "SAT_10_11" → (5, 10, 11) のように、(weekday_index, start_hour, end_hour) を返す。

    weekday_index は Python の weekday() と同じ 0=Mon, 6=Sun。
    """
    try:
        weekday_str, start_str, end_str = code.split("_")
    except ValueError:
        raise ValueError(f"Invalid pickup_slot_code format: {code}")

    weekday_index = _WEEKDAY_CODE_TO_INDEX.get(weekday_str.upper())
    if weekday_index is None:
        raise ValueError(f"Unknown weekday in pickup_slot_code: {code}")

    start_hour = int(start_str)
    end_hour = int(end_str)
    return weekday_index, start_hour, end_hour


def _calc_base_week_event(base: datetime, pickup_slot_code: str) -> Tuple[datetime, datetime]:
    """
    指定した base が属する「週」（月曜はじまり）における
    pickup_slot_code の event_start / event_end を計算する。
    """
    base = base.astimezone(JST)
    weekday_index, start_hour, end_hour = _decode_pickup_slot_code(pickup_slot_code)

    week_start_date = base.date() - timedelta(days=base.weekday())
    event_date = week_start_date + timedelta(days=weekday_index)

    event_start = datetime.combine(event_date, time(hour=start_hour, tzinfo=JST))
    event_end = datetime.combine(event_date, time(hour=end_hour, tzinfo=JST))
    return event_start, event_end


def _calc_event_for_export(now: datetime, pickup_slot_code: str) -> Tuple[datetime, datetime]:
    """
    Export ページで「今週のイベント」を決めるロジック。

    仕様:
    - now(JST) を取得
    - pickup_slot_code をデコード
    - 直近の event_start / event_end を導出
    - now <= event_end + 12h → 今週のイベント
      now >  event_end + 12h → 次週のイベントに切り替え
    """
    base_event_start, base_event_end = _calc_base_week_event(now, pickup_slot_code)
    grace_until = base_event_end + timedelta(hours=3)

    if now <= grace_until:
        return base_event_start, base_event_end

    # すでに grace を過ぎている場合は次週へ
    next_event_start = base_event_start + timedelta(days=7)
    next_event_end = base_event_end + timedelta(days=7)
    return next_event_start, next_event_end


def _calc_event_for_booking(created_at: datetime, pickup_slot_code: str) -> Tuple[datetime, datetime]:
    """
    Confirm Page で予約したときに、「どの週のイベント扱いにするか」を決めるロジック。

    - event_start の 3時間前 までは「今週のイベント」
    - それ以降に入った予約は「次週のイベント」
    """
    base_event_start, base_event_end = _calc_base_week_event(created_at, pickup_slot_code)
    deadline = base_event_start - timedelta(hours=3)

    if created_at <= deadline:
        return base_event_start, base_event_end

    # 締切を過ぎている場合は次週のイベント
    next_event_start = base_event_start + timedelta(days=7)
    next_event_end = base_event_end + timedelta(days=7)
    return next_event_start, next_event_end


def _weekday_label(index: int) -> str:
    try:
        return _WEEKDAY_JP[index]
    except IndexError:
        return "?"


def _format_event_display_label(event_start: datetime, event_end: datetime) -> str:
    """
    "11月29日（土）10:00〜11:00" の形式に整形する。
    """
    event_start = event_start.astimezone(JST)
    event_end = event_end.astimezone(JST)

    month = event_start.month
    day = event_start.day
    weekday_jp = _weekday_label(event_start.weekday())
    start_str = event_start.strftime("%H:%M")
    end_str = event_end.strftime("%H:%M")
    return f"{month}月{day}日（{weekday_jp}）{start_str}〜{end_str}"


def _generate_pickup_code(reservation_id: int, consumer_id: int) -> str:
    """
    既存の PIN 生成ロジックと互換性を保つための 4桁コード生成。
    """
    code = ((reservation_id * 104729) ^ (consumer_id * 179) ^ _PICKUP_SALT) % 10000
    return f"{code:04d}"


@dataclass
class _BundleAccumulator:
    total_quantity: int = 0
    total_kg: int = 0
    rice_subtotal: int = 0


class ReservationExpandedService:
    """
    ExportBluePrint に定義された ViewModel を構築する Service 層。
    """

    def __init__(self, repo: Optional[ReservationExpandedRepository] = None) -> None:
        self.repo = repo or ReservationExpandedRepository()

    def build_export_view(self, farm_id: int) -> ExportReservationsResponseDTO:
        farm: Optional[FarmRecord] = self.repo.get_farm(farm_id)

        # farm が存在しない場合
        if farm is None:
            return ExportReservationsResponseDTO(
                ok=True,
                event_meta=None,
                rows=[],
                bundle_summary=ExportBundleSummaryDTO(items=[], total_rice_subtotal=0),
            )

        # BAN 中 or pickup_time 未設定
        if farm.active_flag == 0 or not farm.pickup_time:
            return ExportReservationsResponseDTO(
                ok=True,
                event_meta=None,
                rows=[],
                bundle_summary=ExportBundleSummaryDTO(items=[], total_rice_subtotal=0),
            )

        pickup_slot_code = farm.pickup_time
        


        # DB から confirmed 予約を取得
        reservation_records: List[ReservationRecord] = self.repo.get_confirmed_reservations_for_farm(
            farm_id=farm_id,
            pickup_slot_code=pickup_slot_code,
        )

        print("DEBUG records from repo:", [r.id for r in reservation_records])


        now = datetime.now(JST)
        export_event_start, export_event_end = _calc_event_for_export(now, pickup_slot_code)

        # export 用 event_meta を構築
        deadline = export_event_start - timedelta(hours=3)
        grace_until = export_event_end + timedelta(hours=12)
        event_meta = ExportEventMetaDTO(
            pickup_slot_code=pickup_slot_code,
            event_start=_to_iso_jst(export_event_start),
            event_end=_to_iso_jst(export_event_end),
            deadline=_to_iso_jst(deadline),
            grace_until=_to_iso_jst(grace_until),
            display_label=_format_event_display_label(export_event_start, export_event_end),
        )

        rows: List[ExportReservationRowDTO] = []
        bundle_acc: Dict[int, _BundleAccumulator] = defaultdict(_BundleAccumulator)

        for rec in reservation_records:
            if not rec.created_at:
                continue

            try:
                created_at_dt = _parse_db_datetime(rec.created_at)
            except Exception:
                # created_at が壊れている場合はスキップ
                continue

            # この予約がどのイベントに属するかを created_at ベースで判定
            booking_event_start, _ = _calc_event_for_booking(created_at_dt, pickup_slot_code)
            if booking_event_start.date() != export_event_start.date():
                # 今週表示対象のイベントと違う週の予約は除外
                continue

            # items_json をパース
            items: List[ExportReservationItemDTO] = []
            rice_subtotal_from_items = 0

            if rec.items_json:
                try:
                    raw_items = json.loads(rec.items_json)
                except json.JSONDecodeError:
                    raw_items = []

                # dict 一発だけ入っているケースにも対応
                if isinstance(raw_items, dict):
                    raw_items = [raw_items]

                for raw in raw_items:
                    if not isinstance(raw, dict):
                        continue

                    # size_kg / quantity / line_total(or subtotal) / unit_price のキー名ゆらぎに対応
                    size_raw = raw.get("size_kg") or raw.get("sizeKg")
                    quantity_raw = raw.get("quantity")
                    line_total_raw = (
                        raw.get("line_total")
                        if "line_total" in raw
                        else raw.get("subtotal")
                    )
                    unit_price_raw = raw.get("unit_price")

                    if size_raw is None or quantity_raw is None or line_total_raw is None:
                        continue

                    try:
                        size_kg = int(size_raw)
                        quantity = int(quantity_raw)
                        line_total = int(line_total_raw)
                        if unit_price_raw is not None:
                            unit_price = int(unit_price_raw)
                        else:
                            # items_json に単価が無い場合は小計 ÷ 数量 で復元
                            unit_price = int(line_total // quantity) if quantity > 0 else 0
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

            # DB の rice_subtotal があればそれを優先、なければ items から算出
            if rec.rice_subtotal is not None:
                rice_subtotal = int(rec.rice_subtotal)
            else:
                rice_subtotal = rice_subtotal_from_items

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

        # confirmed 予約ゼロなら event_meta も null にする
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
