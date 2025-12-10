from __future__ import annotations

import os
import sqlite3
from datetime import date
from typing import Any, Dict, List, Optional, Sequence


def _get_db_path() -> str:
    """
    BackendV2 共通ルールに合わせた DB パス解決。
    APP_DB_PATH があればそれを優先、なければ ./app.db。
    """
    env_path = os.getenv("APP_DB_PATH")
    return env_path if env_path else "app.db"


class AdminReservationRepository:
    """
    /admin/reservations 用の READ ONLY Repository。

    役割:
      - reservations テーブルから「予約タイムライン用の生データ」を取得する
      - line_notification_jobs から予約IDごとのジョブ一覧を取得する
      - 農家オーナー情報(users)・受け渡し場所情報(farms)を join して返す

    ここでは Pydantic DTO にはせず、dict ベースで返す。
    DTO への変換・表示用の整形は Service 側の責務。
    """

    def __init__(self) -> None:
        self.conn = sqlite3.connect(_get_db_path())
        self.conn.row_factory = sqlite3.Row

    # ------------------------------------------------------------------
    # reservations 一覧
    # ------------------------------------------------------------------
    def list_reservations(
        self,
        *,
        limit: int,
        offset: int = 0,
        farm_id: Optional[int] = None,
        reservation_id: Optional[int] = None,
        status: Optional[str] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> List[Dict[str, Any]]:
        """
        管理画面一覧用に reservations を取得する。

        フィルタ条件:
          - items_json IS NOT NULL で V2 予約のみ対象
          - farm_id: 特定農家の予約だけ絞り込み
          - reservation_id: 指定されていればその1件だけ（他条件と併用されてもよい）
          - status: 'pending' / 'confirmed' / 'cancelled' など
          - date_from/date_to: DATE(reservations.created_at) の範囲絞り込み（暫定）

        並び順:
          - reservations.created_at DESC, reservations.id DESC
        """
        where_clauses: List[str] = ["r.items_json IS NOT NULL"]
        params: List[Any] = []

        if farm_id is not None:
            where_clauses.append("r.farm_id = ?")
            params.append(farm_id)

        if reservation_id is not None:
            where_clauses.append("r.id = ?")
            params.append(reservation_id)

        if status is not None:
            where_clauses.append("r.status = ?")
            params.append(status)

        if date_from is not None:
            where_clauses.append("DATE(r.created_at) >= ?")
            params.append(date_from.isoformat())

        if date_to is not None:
            where_clauses.append("DATE(r.created_at) <= ?")
            params.append(date_to.isoformat())

        where_sql = ""
        if where_clauses:
            where_sql = "WHERE " + " AND ".join(where_clauses)

        # reservations + farms + users(owner) を join して、
        # Service 側で必要とする基本列 + 拡張列をすべて返す
        sql = f"""
            SELECT
                -- reservations 本体
                r.id AS id,
                r.farm_id AS farm_id,
                r.user_id AS user_id,
                r.pickup_slot_code AS pickup_slot_code,
                r.items_json AS items_json,
                r.rice_subtotal AS rice_subtotal,
                r.service_fee AS service_fee,
                r.currency AS currency,
                r.status AS status,
                r.payment_status AS payment_status,
                r.payment_succeeded_at AS payment_succeeded_at,
                r.created_at AS created_at,

                -- 予約者ID（一覧に出したいので別名も用意）
                r.user_id AS customer_user_id,

                 -- 農家オーナー(users)
                owner.id AS owner_user_id,
                owner.last_name AS owner_last_name,
                owner.first_name AS owner_first_name,
                owner.last_kana AS owner_last_kana,
                owner.first_kana AS owner_first_kana,
                owner.postal_code AS owner_postcode,
                '' AS owner_pref,
                '' AS owner_city,
                owner.address AS owner_addr_line,


                -- 受け渡し場所情報(farms)
                f.pickup_place_name AS pickup_place_name,
                f.pickup_notes AS pickup_notes,
                f.pickup_lat AS pickup_lat,
                f.pickup_lng AS pickup_lng
            FROM reservations AS r
            LEFT JOIN farms AS f ON r.farm_id = f.id
            LEFT JOIN users AS owner ON f.owner_user_id = owner.id
            {where_sql}
            ORDER BY r.created_at DESC, r.id DESC
            LIMIT ? OFFSET ?
        """

        params_with_paging = params + [limit, offset]
        cur = self.conn.execute(sql, params_with_paging)
        rows = cur.fetchall()
        return [dict(row) for row in rows]

    def count_reservations(
        self,
        *,
        farm_id: Optional[int] = None,
        reservation_id: Optional[int] = None,
        status: Optional[str] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> int:
        """
        list_reservations と同じフィルタで件数だけ返す。
        """
        where_clauses: List[str] = ["r.items_json IS NOT NULL"]
        params: List[Any] = []

        if farm_id is not None:
            where_clauses.append("r.farm_id = ?")
            params.append(farm_id)

        if reservation_id is not None:
            where_clauses.append("r.id = ?")
            params.append(reservation_id)

        if status is not None:
            where_clauses.append("r.status = ?")
            params.append(status)

        if date_from is not None:
            where_clauses.append("DATE(r.created_at) >= ?")
            params.append(date_from.isoformat())

        if date_to is not None:
            where_clauses.append("DATE(r.created_at) <= ?")
            params.append(date_to.isoformat())

        where_sql = ""
        if where_clauses:
            where_sql = "WHERE " + " AND ".join(where_clauses)

        sql = f"""
            SELECT COUNT(*) AS cnt
            FROM reservations AS r
            {where_sql}
        """
        cur = self.conn.execute(sql, params)
        row = cur.fetchone()
        return int(row["cnt"]) if row else 0

    # ------------------------------------------------------------------
    # 単一予約 + 通知ジョブ
    # ------------------------------------------------------------------
    def fetch_reservation_by_id(self, reservation_id: int) -> Optional[Dict[str, Any]]:
        """
        1件の予約＋関連するオーナー情報・受け渡し場所情報を取得する。
        """
        sql = """
            SELECT
                -- reservations 本体
                r.id AS id,
                r.farm_id AS farm_id,
                r.user_id AS user_id,
                r.pickup_slot_code AS pickup_slot_code,
                r.items_json AS items_json,
                r.rice_subtotal AS rice_subtotal,
                r.service_fee AS service_fee,
                r.currency AS currency,
                r.status AS status,
                r.payment_status AS payment_status,
                r.payment_succeeded_at AS payment_succeeded_at,
                r.created_at AS created_at,
        

                r.user_id AS customer_user_id,

                
                 - 農家オーナー(users) 情報（Registration 由来）
                owner.id AS owner_user_id,
                owner.last_name AS owner_last_name,
                owner.first_name AS owner_first_name,
                owner.last_kana AS owner_last_kana,
                owner.first_kana AS owner_first_kana,
                owner.postal_code AS owner_postcode,
                '' AS owner_pref,
                '' AS owner_city,
                owner.address AS owner_addr_line,


                -- 受け渡し場所(farms)
                f.pickup_place_name AS pickup_place_name,
                f.pickup_notes AS pickup_notes,
                f.pickup_lat AS pickup_lat,
                f.pickup_lng AS pickup_lng
            FROM reservations AS r
            LEFT JOIN farms AS f ON r.farm_id = f.id
            LEFT JOIN users AS owner ON f.owner_user_id = owner.id
            WHERE r.id = ?
        """
        cur = self.conn.execute(sql, (reservation_id,))
        row = cur.fetchone()
        return dict(row) if row else None

    def fetch_notification_jobs_by_reservation_ids(
        self, reservation_ids: Sequence[int]
    ) -> Dict[int, List[Dict[str, Any]]]:
        """
        line_notification_jobs から、対象予約IDのジョブ一覧を reservation_id ごとに返す。
        """
        if not reservation_ids:
            return {}

        placeholders = ",".join("?" for _ in reservation_ids)
        sql = f"""
            SELECT
                id,
                reservation_id,
                farm_id,
                customer_line_user_id,
                kind,
                scheduled_at,
                status,
                attempt_count,
                last_error,
                created_at
            FROM line_notification_jobs
            WHERE reservation_id IN ({placeholders})
            ORDER BY reservation_id, id
        """
        cur = self.conn.execute(sql, list(reservation_ids))
        rows = cur.fetchall()

        by_reservation: Dict[int, List[Dict[str, Any]]] = {}
        for row in rows:
            rid = int(row["reservation_id"])
            by_reservation.setdefault(rid, []).append(dict(row))
        return by_reservation
