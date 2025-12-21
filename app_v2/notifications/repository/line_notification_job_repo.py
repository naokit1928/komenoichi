from __future__ import annotations

import sqlite3
from datetime import datetime
from typing import Any, Dict, List, Optional

from app_v2.db.core import resolve_db_path


def _row_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    return dict(row)


class LineNotificationJobRepository:
    """
    notification_jobs テーブル専用 Repository（V2 最終形）

    責務：
      - notification_jobs の CRUD のみ
      - 状態判断・送信判断は一切行わない

    方針：
      - DB パスは resolve_db_path() を唯一の正とする
      - Service / Scheduler / Dispatcher からは黒箱として扱う
    """

    # ==================================================
    # DB connection
    # ==================================================
    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(resolve_db_path())
        conn.row_factory = sqlite3.Row
        return conn

    # --------------------------------------------------
    # INSERT
    # --------------------------------------------------
    def insert_job(
        self,
        *,
        reservation_id: int,
        kind: str,
        scheduled_at: datetime,
    ) -> Dict[str, Any]:
        """
        通知ジョブを1件登録する（status=PENDING）。
        """
        now_iso = datetime.now().isoformat()

        with self._get_conn() as conn:
            cur = conn.execute(
                """
                INSERT INTO notification_jobs (
                    reservation_id,
                    kind,
                    scheduled_at,
                    status,
                    attempt_count,
                    created_at,
                    updated_at
                )
                VALUES (?, ?, ?, 'PENDING', 0, ?, ?)
                """,
                (
                    reservation_id,
                    kind,
                    scheduled_at.isoformat(),
                    now_iso,
                    now_iso,
                ),
            )
            job_id = cur.lastrowid

            row = conn.execute(
                "SELECT * FROM notification_jobs WHERE job_id = ?",
                (job_id,),
            ).fetchone()
            if not row:
                raise RuntimeError("failed to insert notification_job")

            return _row_to_dict(row)

    # --------------------------------------------------
    # SELECT
    # --------------------------------------------------
    def list_pending_jobs(self, *, before: datetime) -> List[Dict[str, Any]]:
        """
        scheduled_at <= before かつ PENDING の job を古い順に取得する。
        cron / dispatcher 用。
        """
        with self._get_conn() as conn:
            cur = conn.execute(
                """
                SELECT *
                FROM notification_jobs
                WHERE status = 'PENDING'
                  AND scheduled_at <= ?
                ORDER BY scheduled_at ASC, job_id ASC
                """,
                (before.isoformat(),),
            )
            return [_row_to_dict(r) for r in cur.fetchall()]

    def get_jobs_by_reservation(self, reservation_id: int) -> List[Dict[str, Any]]:
        """
        特定 reservation_id に紐づく全 job を取得する（admin / debug 用）。
        """
        with self._get_conn() as conn:
            cur = conn.execute(
                """
                SELECT *
                FROM notification_jobs
                WHERE reservation_id = ?
                ORDER BY scheduled_at ASC
                """,
                (reservation_id,),
            )
            return [_row_to_dict(r) for r in cur.fetchall()]

    def get_job(self, job_id: int) -> Optional[Dict[str, Any]]:
        """
        job_id で単一 job を取得する。
        """
        with self._get_conn() as conn:
            row = conn.execute(
                "SELECT * FROM notification_jobs WHERE job_id = ?",
                (job_id,),
            ).fetchone()
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
        """
        job の status を更新する。

        ルール：
        - SENT 更新は status='PENDING' の場合のみ（重複送信防止）
        - FAILED 等は attempt_count を増やす
        """
        now_iso = datetime.now().isoformat()

        with self._get_conn() as conn:
            if increment_attempt:
                conn.execute(
                    """
                    UPDATE notification_jobs
                    SET status = ?,
                        last_error = ?,
                        attempt_count = attempt_count + 1,
                        updated_at = ?
                    WHERE job_id = ?
                    """,
                    (status, last_error, now_iso, job_id),
                )
            else:
                conn.execute(
                    """
                    UPDATE notification_jobs
                    SET status = ?,
                        last_error = ?,
                        updated_at = ?
                    WHERE job_id = ?
                      AND status = 'PENDING'
                    """,
                    (status, last_error, now_iso, job_id),
                )

    # --------------------------------------------------
    # DELETE
    # --------------------------------------------------
    def delete_pending_reminder_jobs(self, reservation_id: int) -> int:
        """
        キャンセル時に REMINDER（PENDING）のみ安全に削除する。
        戻り値：削除件数
        """
        with self._get_conn() as conn:
            cur = conn.execute(
                """
                DELETE FROM notification_jobs
                WHERE reservation_id = ?
                  AND kind = 'REMINDER'
                  AND status = 'PENDING'
                """,
                (reservation_id,),
            )
            return cur.rowcount
