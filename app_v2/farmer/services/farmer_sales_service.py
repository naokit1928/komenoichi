import json
from collections import defaultdict
from typing import Dict, Optional

# ★ dtos.py からインポートするように変更
from app_v2.farmer.dtos import DailySalesDTO, MonthlySalesResponseDTO
from app_v2.farmer.repository.farmer_sales_repo import FarmerSalesRepository, SalesReservationRecord
from app_v2.customer_booking.services.reservation_expanded_service import (
    _parse_db_datetime,
    _calc_event_for_booking,
    JST
)

class FarmerSalesService:
    def __init__(self, repo: Optional[FarmerSalesRepository] = None) -> None:
        self.repo = repo or FarmerSalesRepository()

    def get_monthly_sales(self, farm_id: int, year: int, month: int) -> MonthlySalesResponseDTO:
        records = self.repo.get_confirmed_reservations_around_month(farm_id, year, month)

        daily_agg: Dict[str, dict] = defaultdict(lambda: {"sales": 0, "kg": 0, "count": 0, "display": ""})

        total_sales = 0
        total_kg = 0
        wdays = ["月", "火", "水", "木", "金", "土", "日"]

        for rec in records:
            if not rec.created_at or not rec.pickup_slot_code:
                continue

            try:
                created_at_utc = _parse_db_datetime(rec.created_at)
            except Exception:
                continue

            # 過去の設定から実際の受け渡し日時を逆算
            event_start_utc, _ = _calc_event_for_booking(created_at_utc, rec.pickup_slot_code)
            event_start_jst = event_start_utc.astimezone(JST)

            if event_start_jst.year != year or event_start_jst.month != month:
                continue

            kg_sum = 0
            rice_subtotal = 0

            if rec.items_json:
                try:
                    raw_items = json.loads(rec.items_json)
                    if isinstance(raw_items, dict):
                        raw_items = [raw_items]
                    
                    for item in raw_items:
                        if not isinstance(item, dict):
                            continue
                        s_kg = int(item.get("size_kg") or item.get("sizeKg") or 0)
                        qty = int(item.get("quantity") or 0)
                        line_tot = int(item.get("line_total") or item.get("subtotal") or 0)
                        
                        kg_sum += s_kg * qty
                        rice_subtotal += line_tot
                except Exception:
                    pass

            if rec.rice_subtotal is not None:
                rice_subtotal = int(rec.rice_subtotal)

            date_key = event_start_jst.strftime("%Y-%m-%d")
            
            daily_agg[date_key]["sales"] += rice_subtotal
            daily_agg[date_key]["kg"] += kg_sum
            daily_agg[date_key]["count"] += 1
            daily_agg[date_key]["display"] = f"{event_start_jst.month}月{event_start_jst.day}日({wdays[event_start_jst.weekday()]})"

            total_sales += rice_subtotal
            total_kg += kg_sum

        daily_sales_list = []
        for d_key in sorted(daily_agg.keys()):
            agg = daily_agg[d_key]
            daily_sales_list.append(
                DailySalesDTO(
                    date=d_key,
                    display_date=agg["display"],
                    sales=agg["sales"],
                    kg=agg["kg"],
                    reservation_count=agg["count"]
                )
            )

        return MonthlySalesResponseDTO(
            ok=True,
            year=year,
            month=month,
            total_sales=total_sales,
            total_kg=total_kg,
            daily_sales=daily_sales_list
        )