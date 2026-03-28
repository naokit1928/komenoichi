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
                -- ★ 修正: no_show もキャンセル件数として合算する
                COALESCE(SUM(CASE WHEN r.status IN ('CANCELLED', 'cancelled', 'NO_SHOW', 'no_show') AND r.event_start_at >= datetime('now', '-6 month') THEN 1 ELSE 0 END), 0) AS total_cancelled_6m,
                COALESCE(SUM(CASE WHEN r.status IN ('CONFIRMED', 'confirmed') AND r.event_start_at >= datetime('now', '-6 month') THEN r.rice_subtotal ELSE 0 END), 0) AS total_sales_6m
            FROM farms AS f
            LEFT JOIN reservations AS r ON f.farm_id = r.farm_id
            GROUP BY f.farm_id
            ORDER BY f.farm_id DESC
            LIMIT ?
        """
        cur = self.conn.execute(sql, (limit,))
        farms = [dict(row) for row in cur.fetchall()]

        # =========================================================
        # 正味稼働時間（Net Active Hours）の計算ロジック
        # =========================================================
        log_sql = """
            SELECT farm_id, is_accepting, created_at
            FROM farm_status_logs
            ORDER BY farm_id, created_at ASC
        """
        log_rows = self.conn.execute(log_sql).fetchall()

        logs_by_farm = defaultdict(list)
        for r in log_rows:
            logs_by_farm[r["farm_id"]].append(dict(r))

        # SQLiteの datetime('now') はUTCで記録されるため、現在時刻もUTCで取得して計算する
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
                    # ONになった時間を記録（すでにONの場合は無視）
                    if last_on_time is None:
                        last_on_time = dt
                else:
                    # OFFになったら、ONだった期間の秒数を足してリセット
                    if last_on_time is not None:
                        total_seconds += (dt - last_on_time).total_seconds()
                        last_on_time = None

            # ループを抜けた後、現在もONのままなら「最後にONにした時間〜今まで」を足す
            if last_on_time is not None:
                total_seconds += (now_utc - last_on_time).total_seconds()

            # 秒数を時間（Hours）に変換して格納
            f["net_active_hours"] = total_seconds / 3600.0

        return farms