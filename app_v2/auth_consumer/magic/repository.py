import sqlite3
from datetime import datetime
from typing import Optional

from app_v2.db.core import resolve_db_path


class MagicLinkRepository:
    """
    magic_link_tokens テーブル専用 Repository。

    責務:
    - token と reservation_id の保存・取得
    - SQL のみ（ロジックなし）
    """

    def __init__(self, conn: Optional[sqlite3.Connection] = None) -> None:
        self._external_conn = conn

    # =========================================================
    # internal
    # =========================================================

    def _get_conn(self) -> sqlite3.Connection:
        if self._external_conn is not None:
            return self._external_conn

        db_path = resolve_db_path()
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        return conn

    # =========================================================
    # send
    # =========================================================

    def insert_token(
        self,
        *,
        token: str,
        email: str,
        reservation_id: int,
        agreed: bool,
        expires_at: datetime,
        created_at: datetime,
    ) -> None:
        """
        magic_link_tokens に 1 レコード INSERT

        NOTE:
        - confirm_context_json は旧仕様互換のため "{}" を入れる
        - NOT NULL 制約回避が目的
        """

        conn = self._get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                """
                INSERT INTO magic_link_tokens (
                    token,
                    email,
                    confirm_context_json,
                    reservation_id,
                    agreed,
                    used,
                    expires_at,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, 0, ?, ?)
                """,
                (
                    token,
                    email,
                    "{}",  # ← 旧仕様互換用ダミー
                    reservation_id,
                    1 if agreed else 0,
                    expires_at.isoformat(),
                    created_at.isoformat(),
                ),
            )
            conn.commit()
        finally:
            if self._external_conn is None:
                conn.close()

    # =========================================================
    # consume
    # =========================================================

    def get_by_token(self, token: str) -> Optional[dict]:
        """
        token で magic_link_tokens を 1 件取得
        """

        conn = self._get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT
                    id,
                    token,
                    email,
                    reservation_id,
                    agreed,
                    used,
                    expires_at,
                    created_at,
                    used_at
                FROM magic_link_tokens
                WHERE token = ?
                LIMIT 1
                """,
                (token,),
            )
            row = cur.fetchone()
            if not row:
                return None

            return {
                "id": row["id"],
                "token": row["token"],
                "email": row["email"],
                "reservation_id": row["reservation_id"],
                "agreed": bool(row["agreed"]),
                "used": bool(row["used"]),
                "expires_at": row["expires_at"],
                "created_at": row["created_at"],
                "used_at": row["used_at"],
            }
        finally:
            if self._external_conn is None:
                conn.close()

    def mark_used(self, token: str, used_at: datetime) -> None:
        """
        token を使用済みにする
        """

        conn = self._get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                """
                UPDATE magic_link_tokens
                SET used = 1,
                    used_at = ?
                WHERE token = ?
                  AND used = 0
                """,
                (
                    used_at.isoformat(),
                    token,
                ),
            )
            conn.commit()
        finally:
            if self._external_conn is None:
                conn.close()

    # =========================================================
    # attach consumer  ★今回追加
    # =========================================================

    def attach_consumer_id(
        self,
        *,
        token: str,
        consumer_id: int,
    ) -> None:
        """
        magic_link_tokens に consumer_id を紐づける
        """

        conn = self._get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                """
                UPDATE magic_link_tokens
                SET consumer_id = ?
                WHERE token = ?
                """,
                (consumer_id, token),
            )
            conn.commit()
        finally:
            if self._external_conn is None:
                conn.close()

    # =========================================================
    # fetch by reservation
    # =========================================================

    def get_email_by_reservation_id(
        self,
        reservation_id: int,
    ) -> Optional[str]:
        """
        reservation_id に紐づく最新の email を取得する
        （Magic Link 発行時点で確定している email）
        """

        conn = self._get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT email
                FROM magic_link_tokens
                WHERE reservation_id = ?
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (reservation_id,),
            )
            row = cur.fetchone()
            if not row:
                return None
            return row["email"]
        finally:
            if self._external_conn is None:
                conn.close()
