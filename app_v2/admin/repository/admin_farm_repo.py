from __future__ import annotations

import sqlite3
from datetime import datetime
from collections import defaultdict
from typing import Any, Dict, List

from app_v2.db.core import resolve_db_path


class AdminFarmRepository:
    def __init__(self) -> None:
        self.conn = sqlite3.connect(resolve_db_path())
        self.conn.row_factory = sqlite3.Row

    def find_farms_by_owner_kana(
        self,
        *,
        owner_kana_query: str,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        like_query = f"%{owner_kana_query}%"
        sql = """
            SELECT
                f.farm_id AS farm_id,
                f.last_name || ' ' || f.first_name AS owner_full_name,
                f.last_kana || ' ' || f.first_kana AS owner_full_kana,
                f.postal_code AS owner_postcode,
                f.address AS owner_address_line,
                f.phone AS owner_phone
            FROM farms AS f
            WHERE
                f.last_kana LIKE ?
                OR f.first_kana LIKE ?
                OR (f.last_kana || f.first_kana) LIKE ?
            ORDER BY f.farm_id
            LIMIT ?
        """
        cur = self.conn.execute(sql, (like_query, like_query, like_query, limit))
        return [dict(row) for row in cur.fetchall()]

    def list_all_farms(self, *, limit: int = 200) -> list:
        """全農家一覧（管理画面用）+ 過去6ヶ月の実績 + 正味稼働時間の計算"""
        sql = """
            SELECT
                f.farm_id AS farm_id,
                f.last_name || ' ' || f.first_name AS owner_full_name,
                f.last_kana || ' ' || f.first_kana AS owner_full_kana,
                f.email AS owner_email,
                f.phone AS owner_phone,
                f.address AS owner_address_line,
                f.is_accepting_reservations AS is_accepting_reservations,
                f.is_public AS is_public,
                f.registration_status AS registration_status,
                COALESCE(f.active_flag, 1) AS active_flag,
                MIN(r.created_at) AS first_reservation_at,
                COALESCE(SUM(CASE WHEN r.status IN ('CONFIRMED', 'confirmed') AND r.event_start_at >= datetime('now', '-6 month') THEN 1 ELSE 0 END), 0) AS total_confirmed_6m,
                COALESCE(SUM(CASE WHEN r.status IN ('CANCELLED', 'cancelled', 'NO_SHOW', 'no_show') AND r.event_start_at >= datetime('now', '-6 month') THEN 1 ELSE 0 END), 0) AS total_cancelled_6m,
                COALESCE(SUM(CASE WHEN r.status IN ('CONFIRMED', 'confirmed') AND r.event_start_at >= datetime('now', '-6 month') THEN r.rice_subtotal ELSE 0 END), 0) AS total_sales_6m,
                (SELECT COUNT(*) FROM farm_status_logs sub WHERE sub.farm_id = f.farm_id AND sub.is_accepting = 0 AND sub.reason = 'A' AND sub.created_at >= datetime('now', '-1 year')) AS cancel_count_a,
                (SELECT COUNT(*) FROM farm_status_logs sub WHERE sub.farm_id = f.farm_id AND sub.is_accepting = 0 AND sub.reason = 'B' AND sub.created_at >= datetime('now', '-1 year')) AS cancel_count_b
            FROM farms AS f
            LEFT JOIN reservations AS r ON f.farm_id = r.farm_id
            GROUP BY f.farm_id
            ORDER BY f.farm_id DESC
            LIMIT ?
        """
        cur = self.conn.execute(sql, (limit,))
        farms = [dict(row) for row in cur.fetchall()]

        log_sql = """
            SELECT farm_id, is_accepting, created_at
            FROM farm_status_logs
            ORDER BY farm_id, created_at ASC
        """
        log_rows = self.conn.execute(log_sql).fetchall()

        logs_by_farm = defaultdict(list)
        for r in log_rows:
            logs_by_farm[r["farm_id"]].append(dict(r))

        now_utc = datetime.utcnow()

        for f in farms:
            farm_id = f["farm_id"]
            farm_logs = logs_by_farm[farm_id]

            total_seconds = 0.0
            last_on_time = None

            for log in farm_logs:
                dt_str = log["created_at"]
                try:
                    dt = datetime.strptime(dt_str, "%Y-%m-%d %H:%M:%S")
                except ValueError:
                    dt = datetime.fromisoformat(dt_str)

                if log["is_accepting"] == 1:
                    if last_on_time is None:
                        last_on_time = dt
                else:
                    if last_on_time is not None:
                        total_seconds += (dt - last_on_time).total_seconds()
                        last_on_time = None

            if last_on_time is not None:
                total_seconds += (now_utc - last_on_time).total_seconds()

            f["net_active_hours"] = total_seconds / 3600.0

        return farms

    # ==================================================
    # ★ 追加: 今週スロット別の予約農家一覧
    # ==================================================

    def get_distinct_active_slot_codes(self) -> List[str]:
        """
        farms テーブルに登録されている pickup_time の一覧を取得する。
        将来スロットが増減しても動的に対応できる。
        """
        cur = self.conn.execute(
            """
            SELECT DISTINCT pickup_time
            FROM farms
            WHERE pickup_time IS NOT NULL
              AND pickup_time != ''
              AND active_flag = 1
            ORDER BY pickup_time
            """
        )
        return [row[0] for row in cur.fetchall()]

    def get_farm_ids_with_reservations_for_event(
        self,
        *,
        slot_code: str,
        event_start_iso: str,
    ) -> List[int]:
        """
        特定スロット・特定イベント開始時刻に、confirmed予約を持つ farm_id 一覧を返す。

        event_start_at は UTC の ISO文字列で格納されているため
        DATETIME() で正規化して比較する。
        """
        cur = self.conn.execute(
            """
            SELECT DISTINCT farm_id
            FROM reservations
            WHERE pickup_slot_code = ?
              AND DATETIME(event_start_at) = DATETIME(?)
              AND status IN ('confirmed', 'CONFIRMED')
            ORDER BY farm_id
            """,
            (slot_code, event_start_iso),
        )
        return [row[0] for row in cur.fetchall()]