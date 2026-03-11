from __future__ import annotations

import sqlite3
from typing import Any, Dict, Optional

from app_v2.db.core import resolve_db_path


class StateRepository:
    """
    Consumer の予約状態（pending / active）を取得する Read-only Repository

    方針（長期安定）:
      - この Repo は DB の「事実」だけを返す
      - 時刻比較や "active 判定" のロジックは持たない
      - confirmed の候補選定や expire 判定は Service 側で既存ロジックに委譲する
    """

    # ==================================================
    # DB connection
    # ==================================================
    def open_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(resolve_db_path())
        conn.row_factory = sqlite3.Row
        return conn

    # ==================================================
    # PENDING
    # ==================================================
    def fetch_pending_reservation(
        self,
        *,
        consumer_id: int,
    ) -> Optional[Dict[str, Any]]:
        """
        この consumer の PENDING 予約を 1 件取得する

        仕様:
          - status = 'PENDING'
          - consumer_id 一致
          - 最大 1 件（Confirm に進める唯一のドラフト）
        """
        conn = self.open_connection()
        try:
            row = conn.execute(
                """
                SELECT reservation_id, farm_id
                FROM reservations
                WHERE consumer_id = ?
                  AND status = 'PENDING'
                ORDER BY reservation_id DESC
                LIMIT 1
                """,
                (consumer_id,),
            ).fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    # ==================================================
    # BASIC FETCH (for active id -> farm_id)
    # ==================================================
    def fetch_reservation_basic(
        self,
        *,
        reservation_id: int,
    ) -> Optional[Dict[str, Any]]:
        """
        reservation_id から state 表示に必要な最小情報を取る
        （判定ロジックはしない）
        """
        conn = self.open_connection()
        try:
            row = conn.execute(
                """
                SELECT reservation_id, farm_id, status, event_start_at, event_end_at
                FROM reservations
                WHERE reservation_id = ?
                LIMIT 1
                """,
                (reservation_id,),
            ).fetchone()
            return dict(row) if row else None
        finally:
            conn.close()
