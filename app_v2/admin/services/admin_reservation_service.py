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

# ★ 追加：通知ステータス集約は resolver に委譲
from app_v2.admin.services.admin_notification_resolver import (
    build_notification_summary,
)
from app_v2.admin.services.admin_items_formatter import (
    build_items_display,
    calc_amounts,
)
# FarmerReservation / Export と同じロジックを再利用
from app_v2.admin.services.admin_event_resolver import (
    parse_created_at,
    resolve_event,
    format_pickup_display,
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
                created_at = parse_created_at(created_raw)

                row_event_start, _ = resolve_event(
                    created_at=created_at,
                    pickup_slot_code=pickup_slot_code,
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
            created_at = parse_created_at(created_raw)

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
                    "pickup_display": format_pickup_display(
                        event_start=event_start,
                        event_end=event_end,
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
        created_at = parse_created_at(created_raw)


        event_start, event_end = resolve_event(
            created_at=created_at,
            pickup_slot_code=pickup_slot_code,
        )
        pickup_display = format_pickup_display(
            event_start=event_start,
            event_end=event_end,
        )


        # --- items_display / rice_subtotal / total_amount ---
        items_display = build_items_display(row.get("items_json"))
        rice_subtotal, service_fee, total_amount = calc_amounts(row)


        # --- 予約ステータスなど ---
        reservation_status = str(row.get("status") or "")
        payment_status = str(row.get("payment_status") or "")
        payment_succeeded_at_raw = row.get("payment_succeeded_at")

        if payment_succeeded_at_raw is not None:
            payment_succeeded_at = parse_created_at(payment_succeeded_at_raw)
        else:
            payment_succeeded_at = None


        created_at = created_at  # 上で計算済み
        updated_raw = row.get("updated_at")
        if updated_raw is not None:
         updated_at = parse_created_at(updated_raw)
        else:
            updated_at = None


        # --- 通知ステータス集約（★差し替え：resolver 呼び出し） ---
        notification_summary = build_notification_summary(
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
            # DTO に pref/city が無いので address_line に寄せる（既存仕様維持）
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

    # NotificationService と同じルールで Google Map URL を作る
    @staticmethod
    def _build_google_maps_url(lat: float, lng: float) -> str:
        return f"https://www.google.com/maps?q={lat},{lng}"
