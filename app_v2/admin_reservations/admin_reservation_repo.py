# app_v2/admin_reservations/admin_reservation_repo.py

from __future__ import annotations

import os
import sqlite3
from datetime import date
from typing import Any, Dict, List, Optional, Sequence


def _get_db_path() -> str:
    env_path = os.getenv("APP_DB_PATH")
    return env_path if env_path else "app.db"


class AdminReservationRepository:
    """
    フェーズ2対応・確定版

    - users 参照なし
    - reservations.reservation_id を正
    - farms.farm_id を正
    - admin repo は「事実取得のみ」
    - 通知ステータス（– / NONE）の意味付けは service 層で行う
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

        where_clauses: List[str] = ["r.items_json IS NOT NULL"]
        params: List[Any] = []

        if farm_id is not None:
            where_clauses.append("r.farm_id = ?")
            params.append(farm_id)

        if reservation_id is not None:
            where_clauses.append("r.reservation_id = ?")
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

        where_sql = "WHERE " + " AND ".join(where_clauses)

        sql = f"""
            SELECT
                r.reservation_id AS id,
                r.farm_id AS farm_id,
                r.consumer_id AS customer_user_id,
                r.pickup_slot_code AS pickup_slot_code,
                r.items_json AS items_json,
                r.rice_subtotal AS rice_subtotal,
                r.service_fee AS service_fee,
                r.currency AS currency,
                r.status AS status,
                r.payment_status AS payment_status,
                r.payment_succeeded_at AS payment_succeeded_at,
                r.created_at AS created_at,

                f.last_name AS owner_last_name,
                f.first_name AS owner_first_name,
                f.last_kana AS owner_last_kana,
                f.first_kana AS owner_first_kana,
                f.postal_code AS owner_postcode,
                '' AS owner_pref,
                '' AS owner_city,
                f.address AS owner_addr_line,
                f.phone AS owner_phone,

                f.pickup_place_name AS pickup_place_name,
                f.pickup_notes AS pickup_notes,
                f.pickup_lat AS pickup_lat,
                f.pickup_lng AS pickup_lng

            FROM reservations AS r
            LEFT JOIN farms AS f ON r.farm_id = f.farm_id
            {where_sql}
            ORDER BY r.created_at DESC, r.reservation_id DESC
            LIMIT ? OFFSET ?
        """

        cur = self.conn.execute(sql, params + [limit, offset])
        return [dict(row) for row in cur.fetchall()]

    def count_reservations(
        self,
        *,
        farm_id: Optional[int] = None,
        reservation_id: Optional[int] = None,
        status: Optional[str] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> int:

        where_clauses: List[str] = ["r.items_json IS NOT NULL"]
        params: List[Any] = []

        if farm_id is not None:
            where_clauses.append("r.farm_id = ?")
            params.append(farm_id)

        if reservation_id is not None:
            where_clauses.append("r.reservation_id = ?")
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

        sql = f"""
            SELECT COUNT(*) AS cnt
            FROM reservations AS r
            WHERE {" AND ".join(where_clauses)}
        """
        row = self.conn.execute(sql, params).fetchone()
        return int(row["cnt"]) if row else 0

    # ------------------------------------------------------------------
    # 単一予約
    # ------------------------------------------------------------------
    def fetch_reservation_by_id(self, reservation_id: int) -> Optional[Dict[str, Any]]:
        sql = """
            SELECT
                r.reservation_id AS id,
                r.farm_id AS farm_id,
                r.consumer_id AS customer_user_id,
                r.pickup_slot_code AS pickup_slot_code,
                r.items_json AS items_json,
                r.rice_subtotal AS rice_subtotal,
                r.service_fee AS service_fee,
                r.currency AS currency,
                r.status AS status,
                r.payment_status AS payment_status,
                r.payment_succeeded_at AS payment_succeeded_at,
                r.created_at AS created_at,

                f.last_name AS owner_last_name,
                f.first_name AS owner_first_name,
                f.last_kana AS owner_last_kana,
                f.first_kana AS owner_first_kana,
                f.postal_code AS owner_postcode,
                '' AS owner_pref,
                '' AS owner_city,
                f.address AS owner_addr_line,
                f.phone AS owner_phone,

                f.pickup_place_name AS pickup_place_name,
                f.pickup_notes AS pickup_notes,
                f.pickup_lat AS pickup_lat,
                f.pickup_lng AS pickup_lng

            FROM reservations AS r
            LEFT JOIN farms AS f ON r.farm_id = f.farm_id
            WHERE r.reservation_id = ?
        """
        row = self.conn.execute(sql, (reservation_id,)).fetchone()
        return dict(row) if row else None

    # ------------------------------------------------------------------
    # notification_jobs（新設計）
    # ------------------------------------------------------------------
    def fetch_notification_jobs_by_reservation_ids(
        self, reservation_ids: Sequence[int]
    ) -> Dict[int, List[Dict[str, Any]]]:
        """
        reservation_id ごとに notification_jobs を取得する。

        ※ ここでは一切の意味付けを行わない
        ※ – / NONE / PENDING などの判定は service 層の責務
        """

        if not reservation_ids:
            return {}

        placeholders = ",".join("?" for _ in reservation_ids)
        sql = f"""
            SELECT
                job_id,
                reservation_id,
                kind,
                scheduled_at,
                status,
                attempt_count,
                last_error,
                created_at
            FROM notification_jobs
            WHERE reservation_id IN ({placeholders})
            ORDER BY reservation_id, scheduled_at, job_id
        """

        rows = self.conn.execute(sql, list(reservation_ids)).fetchall()

        result: Dict[int, List[Dict[str, Any]]] = {}
        for row in rows:
            rid = int(row["reservation_id"])
            result.setdefault(rid, []).append(dict(row))
        return result
