from __future__ import annotations

import sqlite3
from typing import Any, Dict, Optional

from app_v2.db.core import resolve_db_path


class StateRepository:
    """
    Consumer の予約状態（pending / active）を取得する Repository
    """

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
    # BASIC FETCH
    # ==================================================
    def fetch_reservation_basic(
        self,
        *,
        reservation_id: int,
    ) -> Optional[Dict[str, Any]]:
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

    # ==================================================
    # ペナルティ情報の取得（ローリング計算）
    #
    # ■ 仕様（シンプル統一版）
    #   - no_show（農家報告）と is_late_cancel（3時間以内キャンセル）を合算
    #   - 過去1年間のカウントのみ対象（1年経過で自動的に消える）
    #   - 合計 3回以上 → banned
    #   - pardon（自己解除）制度なし
    # ==================================================
    def fetch_penalty_info(self, consumer_id: int) -> Dict[str, int]:
        conn = self.open_connection()
        try:
            # 1. 過去1年間の no_show 件数
            cnt_ns_row = conn.execute(
                """
                SELECT COUNT(*) as cnt
                FROM reservations
                WHERE consumer_id = ?
                  AND status = 'no_show'
                  AND created_at >= datetime('now', '-1 year')
                """,
                (consumer_id,)
            ).fetchone()
            ns_count = int(cnt_ns_row["cnt"]) if cnt_ns_row else 0

            # 2. 過去1年間の遅延キャンセル件数（受け渡し3時間以内のキャンセル）
            try:
                cnt_lc_row = conn.execute(
                    """
                    SELECT COUNT(*) as cnt
                    FROM reservations
                    WHERE consumer_id = ?
                      AND is_late_cancel = 1
                      AND created_at >= datetime('now', '-1 year')
                    """,
                    (consumer_id,)
                ).fetchone()
                lc_count = int(cnt_lc_row["cnt"]) if cnt_lc_row else 0
            except sqlite3.OperationalError:
                # is_late_cancel カラム未適用の場合は 0 扱い
                lc_count = 0

            return {
                "penalty_count": ns_count + lc_count,  # no_show + late_cancel の合算
                "no_show_count": ns_count,              # デバッグ・管理用
                "late_cancel_count": lc_count,          # デバッグ・管理用
            }
        finally:
            conn.close()

    # ==================================================
    # 遅延キャンセルフラグの書き込み（cancel_service.py から呼ばれる）
    # ==================================================
    def mark_late_cancel(self, reservation_id: int) -> None:
        conn = self.open_connection()
        try:
            conn.execute(
                "UPDATE reservations SET is_late_cancel = 1 WHERE reservation_id = ?",
                (reservation_id,)
            )
            conn.commit()
        finally:
            conn.close()

    # ==================================================
    # update_pardon_flag は pardon廃止により削除
    # consumers.no_show_pardon カラムはDBに残すが使用しない
    # ==================================================