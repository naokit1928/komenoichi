from __future__ import annotations

import secrets
from datetime import datetime, timedelta, UTC
from typing import Optional

from fastapi import Request, Response

from app_v2.db.core import resolve_db_path
import sqlite3


# ============================================================
# 定数
# ============================================================

COOKIE_NAME = "consumer_session"
SESSION_DAYS = 60  # 有効期限（60日）


# ============================================================
# Service
# ============================================================

class ConsumerSessionService:
    """
    Consumer セッション管理サービス

    責務：
      - consumer_session の発行
      - cookie へのセット
      - request からの取得・検証

    方針：
      - httpOnly cookie
      - DB 永続
      - 軽量・最小構成
    """

    # -------------------------
    # internal
    # -------------------------
    def _open_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(resolve_db_path())
        conn.row_factory = sqlite3.Row
        return conn

    # -------------------------
    # 発行
    # -------------------------
    def issue_cookie(
        self,
        *,
        response: Response,
        consumer_id: int,
    ) -> None:
        """
        consumer_session を発行し、cookie にセットする
        """

        token = secrets.token_urlsafe(32)
        now = datetime.now(UTC)
        expires_at = now + timedelta(days=SESSION_DAYS)

        conn = self._open_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                """
                INSERT INTO consumer_sessions (
                    session_token,
                    consumer_id,
                    expires_at,
                    created_at
                ) VALUES (?, ?, ?, ?)
                """,
                (
                    token,
                    consumer_id,
                    expires_at.isoformat(),
                    now.isoformat(),
                ),
            )
            conn.commit()
        finally:
            conn.close()

        # cookie 発行
        response.set_cookie(
            key=COOKIE_NAME,
            value=token,
            httponly=True,
            secure=False,   # 本番で True にする
            samesite="lax",
            max_age=SESSION_DAYS * 24 * 60 * 60,
        )

    # -------------------------
    # 取得
    # -------------------------
    def get_session_from_request(
        self,
        request: Request,
    ) -> Optional[dict]:
        """
        request から consumer_session を取得・検証
        """

        token = request.cookies.get(COOKIE_NAME)
        if not token:
            return None

        now = datetime.now(UTC)

        conn = self._open_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT
                    session_token,
                    consumer_id,
                    expires_at
                FROM consumer_sessions
                WHERE session_token = ?
                LIMIT 1
                """,
                (token,),
            )
            row = cur.fetchone()
            if not row:
                return None

            expires_at = datetime.fromisoformat(row["expires_at"])
            if expires_at < now:
                return None

            return {
                "session_token": row["session_token"],
                "consumer_id": row["consumer_id"],
                "expires_at": row["expires_at"],
            }
        finally:
            conn.close()
