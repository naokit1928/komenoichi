import sqlite3
from typing import Optional, Dict, Any
from datetime import datetime

from app_v2.db.core import resolve_db_path


# ======================================================
# DB Connection
# ======================================================

def _get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(resolve_db_path())
    conn.row_factory = sqlite3.Row
    return conn


# ======================================================
# OTP 発行
# ======================================================

def insert_otp(
    *,
    email: str,
    code: str,
    expires_at: datetime,
    created_at: datetime,
) -> None:
    conn = _get_connection()
    try:
        conn.execute(
            """
            INSERT INTO email_otp_tokens (
                email,
                code,
                expires_at,
                created_at
            ) VALUES (?, ?, ?, ?)
            """,
            (
                email,
                code,
                expires_at.isoformat(),
                created_at.isoformat(),
            ),
        )
        conn.commit()
    finally:
        conn.close()


# ======================================================
# OTP 取得（検証用）
# ======================================================

def find_latest_valid_otp(
    *,
    email: str,
    code: str,
) -> Optional[Dict[str, Any]]:
    """
    指定 email + code の未使用 OTP を最新優先で1件取得
    """
    conn = _get_connection()
    try:
        row = conn.execute(
            """
            SELECT
                otp_id,
                email,
                code,
                expires_at,
                consumed_at,
                attempt_count,
                created_at
            FROM email_otp_tokens
            WHERE email = ?
              AND code = ?
              AND consumed_at IS NULL
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (email, code),
        ).fetchone()

        return dict(row) if row else None
    finally:
        conn.close()


# ======================================================
# OTP 状態更新
# ======================================================

def mark_otp_consumed(
    *,
    otp_id: int,
    consumed_at: datetime,
) -> None:
    conn = _get_connection()
    try:
        conn.execute(
            """
            UPDATE email_otp_tokens
            SET consumed_at = ?
            WHERE otp_id = ?
            """,
            (
                consumed_at.isoformat(),
                otp_id,
            ),
        )
        conn.commit()
    finally:
        conn.close()


def increment_attempt_count(
    *,
    otp_id: int,
) -> None:
    conn = _get_connection()
    try:
        conn.execute(
            """
            UPDATE email_otp_tokens
            SET attempt_count = attempt_count + 1
            WHERE otp_id = ?
            """,
            (otp_id,),
        )
        conn.commit()
    finally:
        conn.close()


# ======================================================
# メンテナンス（任意）
# ======================================================

def delete_expired_otps(
    *,
    before: datetime,
) -> int:
    """
    指定日時より前に expires_at を過ぎた OTP を削除
    戻り値: 削除件数
    """
    conn = _get_connection()
    try:
        cur = conn.execute(
            """
            DELETE FROM email_otp_tokens
            WHERE expires_at < ?
            """,
            (before.isoformat(),),
        )
        conn.commit()
        return cur.rowcount
    finally:
        conn.close()
