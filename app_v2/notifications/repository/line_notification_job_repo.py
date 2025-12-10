# app_v2/notifications/repository/line_notification_job_repo.py

from __future__ import annotations

import sqlite3
from datetime import datetime
from typing import Any, Dict, List, Optional

DB_PATH = "app.db"


def _row_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    return dict(row)


class LineNotificationJobRepository:
    """
    line_notification_jobs テーブル用の Repository（sqlite3 版）。
    """

    def __init__(self, db_path: str = DB_PATH) -> None:
        self.db_path = db_path

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    # --------------------------------------------------
    # 初期化
    # --------------------------------------------------
    def ensure_table(self) -> None:
        with self._get_conn() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS line_notification_jobs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    reservation_id INTEGER NOT NULL,
                    farm_id INTEGER NOT NULL,
                    customer_line_user_id TEXT NOT NULL,
                    kind TEXT NOT NULL,
                    scheduled_at TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'PENDING',
                    message_text TEXT NOT NULL,
                    attempt_count INTEGER NOT NULL DEFAULT 0,
                    last_error TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_line_notification_jobs_status_scheduled
                ON line_notification_jobs (status, scheduled_at)
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_line_notification_jobs_reservation
                ON line_notification_jobs (reservation_id)
                """
            )

    # --------------------------------------------------
    # INSERT
    # --------------------------------------------------
    def insert_job(
        self,
        *,
        reservation_id: int,
        farm_id: int,
        customer_line_user_id: str,
        kind: str,
        scheduled_at: datetime,
        message_text: str,
    ) -> Dict[str, Any]:
        now_iso = datetime.now().isoformat()

        with self._get_conn() as conn:
            cur = conn.execute(
                """
                INSERT INTO line_notification_jobs (
                    reservation_id,
                    farm_id,
                    customer_line_user_id,
                    kind,
                    scheduled_at,
                    status,
                    message_text,
                    attempt_count,
                    created_at,
                    updated_at
                )
                VALUES (?, ?, ?, ?, ?, 'PENDING', ?, 0, ?, ?)
                """,
                (
                    reservation_id,
                    farm_id,
                    customer_line_user_id,
                    kind,
                    scheduled_at.isoformat(),
                    message_text,
                    now_iso,
                    now_iso,
                ),
            )
            job_id = cur.lastrowid
            cur = conn.execute(
                "SELECT * FROM line_notification_jobs WHERE id = ?",
                (job_id,),
            )
            row = cur.fetchone()
            if not row:
                raise RuntimeError("failed to insert line_notification_job")
            return _row_to_dict(row)

    # --------------------------------------------------
    # SELECT
    # --------------------------------------------------
    def list_pending_jobs(self, *, before: datetime) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            cur = conn.execute(
                """
                SELECT *
                FROM line_notification_jobs
                WHERE status = 'PENDING'
                  AND scheduled_at <= ?
                ORDER BY scheduled_at ASC, id ASC
                """,
                (before.isoformat(),),
            )
            return [_row_to_dict(r) for r in cur.fetchall()]

    def get_jobs_by_reservation(self, reservation_id: int) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            cur = conn.execute(
                """
                SELECT *
                FROM line_notification_jobs
                WHERE reservation_id = ?
                ORDER BY scheduled_at ASC
                """,
                (reservation_id,),
            )
            return [_row_to_dict(r) for r in cur.fetchall()]

    def get_job(self, job_id: int) -> Optional[Dict[str, Any]]:
        with self._get_conn() as conn:
            cur = conn.execute(
                "SELECT * FROM line_notification_jobs WHERE id = ?",
                (job_id,),
            )
            row = cur.fetchone()
            return _row_to_dict(row) if row else None

    # --------------------------------------------------
    # UPDATE
    # --------------------------------------------------
    def update_status(
        self,
        job_id: int,
        *,
        status: str,
        last_error: Optional[str] = None,
        increment_attempt: bool = False,
    ) -> None:
        now_iso = datetime.now().isoformat()

        with self._get_conn() as conn:
            if increment_attempt:
                conn.execute(
                    """
                    UPDATE line_notification_jobs
                    SET status = ?, last_error = ?, attempt_count = attempt_count + 1,
                        updated_at = ?
                    WHERE id = ?
                    """,
                    (status, last_error, now_iso, job_id),
                )
            else:
                conn.execute(
                    """
                    UPDATE line_notification_jobs
                    SET status = ?, last_error = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (status, last_error, now_iso, job_id),
                )

    # --------------------------------------------------
    # DELETE（今回追加）
    # --------------------------------------------------
    def delete_pending_reminder_jobs(self, reservation_id: int) -> int:
        """
        キャンセル時に REMINDER（PENDING）だけ安全に削除する。
        戻り値：削除した件数
        """
        with self._get_conn() as conn:
            cur = conn.execute(
                """
                DELETE FROM line_notification_jobs
                WHERE reservation_id = ?
                  AND kind = 'REMINDER'
                  AND status = 'PENDING'
                """,
                (reservation_id,),
            )
            return cur.rowcount
