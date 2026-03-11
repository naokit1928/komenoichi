import sqlite3
from datetime import datetime
from typing import Optional

from app_v2.db.core import resolve_db_path


class MagicLinkRepository:
    """
    magic_link_tokens テーブル専用 Repository。

    責務:
    - token / email / reservation_id / consumer_id の保存・取得
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
        reservation_id: Optional[int],
        agreed: bool,
        expires_at: datetime,
        created_at: datetime,
        consumer_id: Optional[int] = None,
    ) -> None:
        """
        magic_link_tokens に新規トークンを保存する
        """
        conn = self._get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                """
                INSERT INTO magic_link_tokens (
                    token,
                    email,
                    reservation_id,
                    agreed,
                    expires_at,
                    created_at,
                    consumer_id
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    token,
                    email,
                    reservation_id,
                    1 if agreed else 0,
                    expires_at.isoformat(),
                    created_at.isoformat(),
                    consumer_id,
                ),
            )
            conn.commit()
        finally:
            if self._external_conn is None:
                conn.close()

    def attach_consumer_id(
        self,
        *,
        token: str,
        consumer_id: int,
    ) -> None:
        """
        magic_link_tokens に consumer_id を紐づける
        （Confirm フローで後付けする場合用）
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
    # consume (今回追加分)
    # =========================================================

    def get_token_record(self, token: str) -> Optional[dict]:
        """
        token に一致するレコードを取得する。
        """
        conn = self._get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT token, email, reservation_id, consumer_id, used, expires_at
                FROM magic_link_tokens
                WHERE token = ?
                LIMIT 1
                """,
                (token,),
            )
            row = cur.fetchone()
            return dict(row) if row else None
        finally:
            if self._external_conn is None:
                conn.close()

    def mark_used(self, *, token: str, used_at: datetime) -> None:
        """
        token を使用済み (used=1) に更新する。
        """
        conn = self._get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                """
                UPDATE magic_link_tokens
                SET used = 1, used_at = ?
                WHERE token = ?
                """,
                (used_at.isoformat(), token),
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