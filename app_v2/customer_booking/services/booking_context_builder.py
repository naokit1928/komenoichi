from __future__ import annotations

import json
from typing import Any, Dict
from zoneinfo import ZoneInfo

from app_v2.customer_booking.dtos import BookingContextDTO
from app_v2.customer_booking.services.reservation_expanded_service import (
    _generate_pickup_code,
)

JST = ZoneInfo("Asia/Tokyo")


class BookingContextBuilder:
    """
    BookingContextBuilder（責務縮退・固定版）
    ========================================

    【この Builder の存在意義】
    - reservation / user / farm の「生データ」から
    - **表示専用の BookingContextDTO を組み立てる** ことだけを行う

    【明示的に“やらないこと”】【重要】
    - event_start_at / event_end_at に関する計算・補正・変換は一切しない
    - キャンセル期限・状態判定などの業務ロジックは一切持たない
    - DB に保存された値を「正」とする（Single Source of Truth を侵さない）

    【設計上の位置づけ】
    - Service 層：業務ロジック・判断・時刻の正を担う
    - Builder 層：UI 表示に必要な派生データのみを生成する
      （items 集計 / pickup_code / map URL など）

    ※ もし今後、業務的な判断や時刻ロジックが必要になった場合は
       この Builder に追加せず、必ず Service 層へ戻すこと。
    """

    def build(
        self,
        *,
        reservation: Dict[str, Any],
        user: Dict[str, Any],
        farm: Dict[str, Any],
    ) -> BookingContextDTO:
        """
        ReservationBooked 画面向けの表示 Context を生成する。

        前提：
        - reservation / user / farm はすでに Service 層で取得・検証済み
        - 本メソッド内では「正しさの判断」は行わない
        """

        # 表示専用の pickup_code（業務状態には影響しない）
        pickup_code = _generate_pickup_code(
            reservation_id=int(reservation["reservation_id"]),
            consumer_id=int(user["consumer_id"]),
        )

        # items_json は表示用に集計するのみ（価格・正否判断はしない）
        items = self._parse_items(reservation.get("items_json") or "[]")
        qty_5, qty_10, qty_25, s5, s10, s25 = self._aggregate_rice_items(items)

        ctx = BookingContextDTO(
            reservation_id=int(reservation["reservation_id"]),
            pickup_display=reservation.get("pickup_display") or "",
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

        return ctx

    # -------------------------------------------------
    # Internal helpers（すべて表示用・副作用なし）
    # -------------------------------------------------

    def _build_pickup_map_url_from_latlng(self, farm: Dict[str, Any]) -> str:
        """
        緯度・経度から Google Maps 検索 URL を生成する。
        表示補助のみ。失敗時は空文字を返す。
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
        """
        items_json を list として読み取る。
        失敗した場合は空配列を返す（表示を壊さないため）。
        """
        try:
            return json.loads(items_json)
        except Exception:
            return []

    def _aggregate_rice_items(self, items: Any):
        """
        米のサイズ別数量・小計を集計する（表示専用）。
        """
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
