# app_v2/admin_reservations/admin_reservation_service.py

from __future__ import annotations

import json
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple

from .admin_reservation_repo import AdminReservationRepository
from .dtos import (
    AdminReservationListItemDTO,
    NotificationStatusSummaryDTO,
)

# FarmerReservation / Export と同じロジックを再利用
from app_v2.customer_booking.services.reservation_expanded_service import (
    _parse_db_datetime,
    _calc_event_for_booking,
    _format_event_display_label,
)


class AdminReservationService:
    """
    /api/admin/reservations 用 Service。

    役割:
      - reservations + line_notification_jobs + farms + users から生データを取得
      - reservation_expanded_service のロジックを再利用して
        「本当の受け渡し日(event_start/event_end)」を計算
      - AdminReservationListItemDTO に整形して返す

    追加機能:
      - list_weeks_for_farm: 農家ごとの「受け渡しイベント一覧」（FarmerReservationTable のヘッダ相当）
      - list_for_admin の event_start フィルタ:
          /weeks で選んだ event_start に一致する予約だけに絞って一覧を返す
          event_start は reservation_expanded_service._calc_event_for_booking の
          戻り値と完全一致で比較するので、3時間前ルール等も含めて安全
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

        通常モード:
          - event_start が指定されていない場合
          - これまで通り reservations.created_at に対する date_from/date_to で絞り込み
          - limit / offset によるページングも有効

        event_start フィルタモード:
          - /api/admin/reservations/weeks で得た event_start をそのまま指定するケースを想定
          - farm_id と組み合わせて、
              「この農家の、この受け渡し回（FarmerReservationTable 1マス分）」に属する予約だけを返す
        """

        # --- event_start フィルタが指定されている場合は、メモリ上で絞り込みを行う ---
        if event_start is not None:
            # 対象となり得る予約を一気に取得（件数はまだ多くない前提）
            raw_rows = self.repo.list_reservations(
                limit=10000,
                offset=0,
                farm_id=farm_id,
                reservation_id=reservation_id,
                status=status,
                date_from=None,
                date_to=None,
            )
            reservation_ids = [row["id"] for row in raw_rows]
            jobs_by_reservation = self.repo.fetch_notification_jobs_by_reservation_ids(
                reservation_ids
            )

            dtos: List[AdminReservationListItemDTO] = []
            for row in raw_rows:
                pickup_slot_code = str(row.get("pickup_slot_code") or "")
                if not pickup_slot_code:
                    # V2 予約以外は一旦対象外
                    continue

                created_raw = row.get("created_at")
                if isinstance(created_raw, str):
                    created_at = _parse_db_datetime(created_raw)
                elif isinstance(created_raw, datetime):
                    created_at = created_raw
                else:
                    # 想定外フォーマットはスキップ
                    continue

                row_event_start, _ = _calc_event_for_booking(
                    created_at, pickup_slot_code
                )

                # 完全一致する受け渡し回だけ残す
                if row_event_start != event_start:
                    continue

                rid = row["id"]
                jobs = jobs_by_reservation.get(rid, [])
                dto = self._build_admin_dto(row, jobs)
                dtos.append(dto)

            # event_start モードの場合、total_count はメモリ上でフィルタした件数
            return dtos, len(dtos)

        # --- 通常モード: reservations.created_at ベースでページング ---
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

        reservation_ids = [row["id"] for row in raw_rows]
        jobs_by_reservation = self.repo.fetch_notification_jobs_by_reservation_ids(
            reservation_ids
        )

        dtos: List[AdminReservationListItemDTO] = []
        for row in raw_rows:
            rid = row["id"]
            jobs = jobs_by_reservation.get(rid, [])
            dto = self._build_admin_dto(row, jobs)
            dtos.append(dto)

        return dtos, total_count

    # ------------------------------------------------------------------
    # 受け渡しイベント(week) 一覧
    # ------------------------------------------------------------------
    def list_weeks_for_farm(
        self,
        *,
        farm_id: int,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> List[Dict[str, Any]]:
        """
        FarmerReservationTable のヘッダ相当となる「受け渡しイベント一覧」を返す。

        戻り値は素の dict を返し、API 層で Pydantic に乗せる。
        """
        # 対象農家の予約を一括取得
        raw_rows = self.repo.list_reservations(
            limit=10000,
            offset=0,
            farm_id=farm_id,
            reservation_id=None,
            status=None,
            date_from=date_from,
            date_to=date_to,
        )

        # pickup_slot_code + event_start 単位で集計
        grouped: Dict[Tuple[str, datetime], Dict[str, Any]] = {}

        for row in raw_rows:
            pickup_slot_code = str(row.get("pickup_slot_code") or "")
            if not pickup_slot_code:
                continue

            created_raw = row.get("created_at")
            if isinstance(created_raw, str):
                created_at = _parse_db_datetime(created_raw)
            elif isinstance(created_raw, datetime):
                created_at = created_raw
            else:
                continue

            event_start, event_end = _calc_event_for_booking(
                created_at, pickup_slot_code
            )
            key = (pickup_slot_code, event_start)

            if key not in grouped:
                grouped[key] = {
                    "farm_id": farm_id,
                    "pickup_slot_code": pickup_slot_code,
                    "event_start": event_start,
                    "event_end": event_end,
                    "pickup_display": _format_event_display_label(
                        event_start, event_end
                    ),
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

            rice_subtotal = int(row.get("rice_subtotal") or 0)
            if status == "confirmed":
                g["rice_subtotal"] += rice_subtotal

        # event_start 昇順でソート
        items = list(grouped.values())
        items.sort(key=lambda x: (x["event_start"], x["pickup_slot_code"]))
        return items

    # ------------------------------------------------------------------
    # 内部ヘルパ
    # ------------------------------------------------------------------
    def _build_admin_dto(
        self,
        row: Dict[str, Any],
        jobs: List[Dict[str, Any]],
    ) -> AdminReservationListItemDTO:
        """
        reservations + line_notification_jobs の生データから
        AdminReservationListItemDTO を組み立てる。
        """
        # --- event_start / event_end / pickup_display ---
        pickup_slot_code = str(row.get("pickup_slot_code") or "")
        created_raw = row.get("created_at")

        if isinstance(created_raw, str):
            created_at = _parse_db_datetime(created_raw)
        elif isinstance(created_raw, datetime):
            created_at = created_raw
        else:
            # ありえないはずだが、一応現在時刻を入れておく
            created_at = datetime.now()

        event_start, event_end = _calc_event_for_booking(created_at, pickup_slot_code)
        pickup_display = _format_event_display_label(event_start, event_end)

        # --- items_display / rice_subtotal / total_amount ---
        items_json = row.get("items_json")
        if isinstance(items_json, str):
            try:
                items = json.loads(items_json)
            except json.JSONDecodeError:
                items = []
        else:
            items = items_json or []

        # items_display: Export / Notification と同じロジック（10kg/5kg/25kg の内訳）
        # items は Confirm 時点の V2 予約 JSON と同じ形式を想定:
        #   [{"kind": "RICE_10KG", "quantity": 1}, ...]
        counts: Dict[str, int] = {"RICE_5KG": 0, "RICE_10KG": 0, "RICE_25KG": 0}
        for item in items:
            kind = item.get("kind")
            qty = int(item.get("quantity") or 0)
            if kind in counts:
                counts[kind] += qty

        parts: List[str] = []
        if counts["RICE_5KG"]:
            parts.append(f"5kg×{counts['RICE_5KG']}")
        if counts["RICE_10KG"]:
            parts.append(f"10kg×{counts['RICE_10KG']}")
        if counts["RICE_25KG"]:
            parts.append(f"25kg×{counts['RICE_25KG']}")
        items_display = " / ".join(parts) if parts else ""

        rice_subtotal = int(row.get("rice_subtotal") or 0)
        service_fee = int(row.get("service_fee") or 0)
        total_amount = rice_subtotal + service_fee

        # --- 予約ステータスなど ---
        reservation_status = str(row.get("status") or "")
        payment_status = str(row.get("payment_status") or "")
        payment_succeeded_at_raw = row.get("payment_succeeded_at")

        if isinstance(payment_succeeded_at_raw, str):
            payment_succeeded_at = _parse_db_datetime(payment_succeeded_at_raw)
        elif isinstance(payment_succeeded_at_raw, datetime):
            payment_succeeded_at = payment_succeeded_at_raw
        else:
            payment_succeeded_at = None

        created_at = created_at  # 上で計算済み
        updated_raw = row.get("updated_at")
        if isinstance(updated_raw, str):
            updated_at = _parse_db_datetime(updated_raw)
        elif isinstance(updated_raw, datetime):
            updated_at = updated_raw
        else:
            updated_at = None

        # --- 通知ステータス集約 ---
        notification_summary = self._build_notification_summary(
            jobs=jobs,
            reservation_status=reservation_status,
            created_at=created_at,
            event_start=event_start,
        )

        # ------------------------------------------------------------------
        # ここから「予約者ID＋農家情報＋受け渡し場所情報」の拡張フィールドを組み立てる
        # ------------------------------------------------------------------
        customer_user_id = int(row.get("customer_user_id") or row.get("user_id") or 0)

        # 農家オーナーの氏名 / フリガナ（Registration 由来）
        owner_last_name = (row.get("owner_last_name") or "").strip()
        owner_first_name = (row.get("owner_first_name") or "").strip()
        owner_last_kana = (row.get("owner_last_kana") or "").strip()
        owner_first_kana = (row.get("owner_first_kana") or "").strip()

        # フルネームは UI 側で owner_* から組み立ててもらえばよいが、
        # 将来の拡張のためにここで保持しておいてもよい。
        farmer_full_name = (owner_last_name + " " + owner_first_name).strip()
        farmer_full_name_kana = (owner_last_kana + " " + owner_first_kana).strip()

        # 住所（Registration の owner_* 系）
        farmer_postcode = (row.get("owner_postcode") or "").strip()
        pref = (row.get("owner_pref") or "").strip()
        city = (row.get("owner_city") or "").strip()
        addr_line = (row.get("owner_addr_line") or "").strip()

        # 受け渡し場所（Notification と同じ情報ソース）
        pickup_place_name = (row.get("pickup_place_name") or "").strip()
        pickup_detail_memo = (row.get("pickup_notes") or "").strip()

        lat = row.get("pickup_lat")
        lng = row.get("pickup_lng")
        pickup_map_url = ""
        try:
            if lat is not None and lng is not None:
                lat_f = float(lat)
                lng_f = float(lng)
                pickup_map_url = self._build_google_maps_url(lat_f, lng_f)
        except (TypeError, ValueError):
            pickup_map_url = ""

        return AdminReservationListItemDTO(
            # --- 識別子 / 紐付け ---
            reservation_id=int(row["id"]),
            farm_id=int(row["farm_id"]),
            # 予約者
            customer_user_id=customer_user_id,
            # --- 農家オーナー情報（Registration 生データそのまま） ---
            owner_last_name=owner_last_name or None,
            owner_first_name=owner_first_name or None,
            owner_last_kana=owner_last_kana or None,
            owner_first_kana=owner_first_kana or None,
            owner_postcode=farmer_postcode or None,
            owner_pref=pref or None,
            owner_city=city or None,
            owner_address_line=addr_line or None,
            owner_phone=(row.get("owner_phone") or "").strip() or None,
            # --- 受け渡し日時 ---
            pickup_start=event_start,
            pickup_end=event_end,
            pickup_display=pickup_display,
            # --- 受け渡し場所 ---
            pickup_place_name=pickup_place_name or None,
            pickup_map_url=pickup_map_url or None,
            pickup_detail_memo=pickup_detail_memo or None,
            # --- 内容 ---
            items_display=items_display,
            # --- 金額 ---
            rice_subtotal=rice_subtotal,
            service_fee=service_fee,
            total_amount=total_amount,
            # --- 予約ステータス ---
            reservation_status=reservation_status,
            # 支払いステータスは DTO に含めていない場合は無視される（extra=ignore）
            notification_summary=notification_summary,
            # --- メタ情報 ---
            created_at=created_at,
            updated_at=updated_at or created_at,
        )

    def _build_notification_summary(
        self,
        *,
        jobs: List[Dict[str, Any]],
        reservation_status: str,
        created_at: datetime,
        event_start: datetime,
    ) -> NotificationStatusSummaryDTO:
        """
        line_notification_jobs の配列から NotificationStatusSummaryDTO を構成。

        仕様:
          - confirmation: これまで通り（ジョブの有無だけで NONE / SENT / FAILED / PENDING）
          - reminder:
              * lead_time < 48h → 正常だからジョブは作られない想定 → "DASH"
              * lead_time >= 48h & ジョブあり → SENT / FAILED / PENDING
              * lead_time >= 48h & ジョブ無し → "NONE"
          - cancel_completed:
              * 未キャンセル (status != "cancelled") → "DASH"
              * キャンセル済み & ジョブあり → SENT / FAILED / PENDING
              * キャンセル済み & ジョブ無し → "NONE"（異常なので "-" ではなく NONE）
        """
        kinds = ["CONFIRMATION", "REMINDER", "CANCEL_COMPLETED"]

        # kind ごとに status を集計
        status_map: Dict[str, List[str]] = {k: [] for k in kinds}
        for job in jobs:
            kind = str(job.get("kind") or "")
            status = str(job.get("status") or "")
            if kind in status_map:
                status_map[kind].append(status)

        def summarize_status(statuses: List[str]) -> str:
            if not statuses:
                return "NONE"
            if any(s == "FAILED" for s in statuses):
                return "FAILED"
            if any(s == "PENDING" for s in statuses):
                return "PENDING"
            # SENT が1件以上あり、FAILED がない場合
            return "SENT"

        # --- confirmation: 仕様どおり「既存どおり」 ---
        confirmation = summarize_status(status_map["CONFIRMATION"])
        # --- reminder: 48時間ルールを適用 ---
        reminder_statuses = status_map["REMINDER"]
        is_cancelled = reservation_status == "cancelled"

        # キャンセル済みなら常に DASH
        if is_cancelled:
            reminder = "DASH"
        else:
            # lead_time（hours）を計算
            lead_time_hours: Optional[float]
            try:
                delta = event_start - created_at
                lead_time_hours = delta.total_seconds() / 3600.0
            except Exception:
                lead_time_hours = None

            if lead_time_hours is not None and lead_time_hours < 48:
                # 48時間未満 → 正常なのでジョブは作られない前提
                if reminder_statuses:
                    reminder = summarize_status(reminder_statuses)
                else:
                    reminder = "DASH"
            else:
                # 48時間以上 or lead_time を計算できない場合
                if reminder_statuses:
                    reminder = summarize_status(reminder_statuses)
                else:
                    reminder = "NONE"

   

        # --- cancel_completed: キャンセル状態＋ジョブ有無で分岐 ---
        cancel_completed_statuses = status_map["CANCEL_COMPLETED"]
        is_cancelled = reservation_status == "cancelled"

        if not is_cancelled:
            # 未キャンセル → DASH
            cancel_completed = "DASH"
        else:
            # キャンセル済み
            if cancel_completed_statuses:
                cancel_completed = summarize_status(cancel_completed_statuses)
            else:
                # キャンセル済みなのにジョブなし → 異常なので NONE
                cancel_completed = "NONE"

        

        return NotificationStatusSummaryDTO(
            confirmation=confirmation,
            reminder=reminder,
            cancel_completed=cancel_completed,
        )

    # NotificationService と同じルールで Google Map URL を作る
    @staticmethod
    def _build_google_maps_url(lat: float, lng: float) -> str:
        return f"https://www.google.com/maps?q={lat},{lng}"
