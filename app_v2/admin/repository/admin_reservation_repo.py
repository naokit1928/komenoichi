# app_v2/admin/repository/admin_reservation_repo.py
from __future__ import annotations

import sqlite3
from datetime import date
from typing import Any, Dict, List, Optional

from app_v2.db.core import resolve_db_path


class AdminReservationRepository:
    def __init__(self) -> None:
        self.conn = sqlite3.connect(resolve_db_path())
        self.conn.row_factory = sqlite3.Row

    # ------------------------------------------------------------------
    # 共通SELECT句（DTOに必要なカラムを網羅）
    # ------------------------------------------------------------------
    BASE_SELECT = """
        SELECT
            r.reservation_id AS id,
            r.farm_id AS farm_id,
            r.consumer_id AS customer_user_id,
            r.pickup_slot_code AS pickup_slot_code,
            r.guest_key AS guest_key, -- ★ 私が汚したエイリアスを削除し、本来の形に復元
            r.pickup_display AS pickup_display,
            r.items_json AS items_json,
            r.rice_subtotal AS rice_subtotal,
            r.service_fee AS service_fee,
            r.currency AS currency,
            r.status AS status,
            r.payment_status AS payment_status,
            r.payment_succeeded_at AS payment_succeeded_at,
            r.created_at AS created_at,
            
            r.payment_intent_id AS payment_intent_id,
            r.confirm_session_id AS confirm_session_id,
            c.email AS consumer_email,

            f.last_name AS owner_last_name,
            f.first_name AS owner_first_name,
            f.last_kana AS owner_last_kana,
            f.first_kana AS owner_first_kana,
            f.postal_code AS owner_postcode,
            f.address AS owner_addr_line,
            f.phone AS owner_phone,
            f.email AS owner_email,

            f.pickup_place_name AS pickup_place_name,
            f.pickup_notes AS pickup_notes,
            f.pickup_lat AS pickup_lat,
            f.pickup_lng AS pickup_lng

        FROM reservations AS r
        LEFT JOIN farms AS f ON r.farm_id = f.farm_id
        LEFT JOIN consumers AS c ON r.consumer_id = c.consumer_id
    """

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
            {self.BASE_SELECT}
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

    def fetch_reservation_by_id(self, reservation_id: int) -> Optional[Dict[str, Any]]:
        sql = f"""
            {self.BASE_SELECT}
            WHERE r.reservation_id = ?
        """
        row = self.conn.execute(sql, (reservation_id,)).fetchone()
        return dict(row) if row else None

    def list_payment_anomalies(self, limit: int = 50) -> List[Dict[str, Any]]:
        sql = f"""
            {self.BASE_SELECT}
            WHERE r.payment_status = 'succeeded' 
              AND r.status = 'PENDING'
            ORDER BY r.created_at DESC
            LIMIT ?
        """
        cur = self.conn.execute(sql, (limit,))
        return [dict(row) for row in cur.fetchall()]

    def list_zombie_reservations(self, hours_old: int = 1, limit: int = 50) -> List[Dict[str, Any]]:
        sql = f"""
            {self.BASE_SELECT}
            WHERE r.status = 'PENDING'
              AND r.created_at < datetime('now', '-{hours_old} hours')
            ORDER BY r.created_at ASC
            LIMIT ?
        """
        cur = self.conn.execute(sql, (limit,))
        return [dict(row) for row in cur.fetchall()]