import sqlite3
import logging
from datetime import datetime
from typing import Optional

from app_v2.db.core import resolve_db_path

logger = logging.getLogger("uvicorn")

def _get_conn():
    conn = sqlite3.connect(resolve_db_path())
    conn.row_factory = sqlite3.Row
    return conn

# ---------------------------------------------------------
# Read
# ---------------------------------------------------------

def find_token(token: str) -> Optional[sqlite3.Row]:
    conn = _get_conn()
    try:
        return conn.execute(
            "SELECT * FROM farm_magic_link_tokens WHERE token = ?",
            (token,),
        ).fetchone()
    finally:
        conn.close()

def get_farm_by_email(email: str) -> Optional[sqlite3.Row]:
    conn = _get_conn()
    try:
        return conn.execute(
            "SELECT farm_id, owner_farmer_id FROM farms WHERE email = ?",
            (email,),
        ).fetchone()
    finally:
        conn.close()

def get_farm_owner_id(farm_id: int) -> Optional[int]:
    conn = _get_conn()
    try:
        row = conn.execute(
            "SELECT owner_farmer_id FROM farms WHERE farm_id = ?",
            (farm_id,),
        ).fetchone()
        if row and row["owner_farmer_id"] is not None:
            return int(row["owner_farmer_id"])
        return None
    finally:
        conn.close()

# ---------------------------------------------------------
# Write
# ---------------------------------------------------------

def insert_token(
    email: str,
    token: str,
    farm_id: Optional[int],
    expires_at: datetime,
    created_at: datetime,
):
    conn = _get_conn()
    try:
        conn.execute(
            """
            INSERT INTO farm_magic_link_tokens
                (email, token, farm_id, used, expires_at, created_at)
            VALUES (?, ?, ?, 0, ?, ?)
            """,
            (
                email,
                token,
                farm_id,  # ★ None の場合は NULL で入る
                expires_at.isoformat(),
                created_at.isoformat(),
            ),
        )
        conn.commit()
    finally:
        conn.close()

def update_token_farm_id(token_id: int, farm_id: int):
    """★ 新規登録 consume 時に farm_id を後から書き込む"""
    conn = _get_conn()
    try:
        conn.execute(
            "UPDATE farm_magic_link_tokens SET farm_id = ? WHERE id = ?",
            (farm_id, token_id),
        )
        conn.commit()
    finally:
        conn.close()

def mark_used(token_id: int, used_at: datetime):
    conn = _get_conn()
    try:
        conn.execute(
            """
            UPDATE farm_magic_link_tokens
            SET used = 1, used_at = ?
            WHERE id = ?
            """,
            (used_at.isoformat(), token_id),
        )
        conn.commit()
    finally:
        conn.close()

def create_placeholder_farm(email: str) -> int:
    conn = _get_conn()
    try:
        cur = conn.execute(
            """
            INSERT INTO farms (email, registration_status, active_flag)
            VALUES (?, 'magic_link_pending', 0)
            """,
            (email,),
        )
        farm_id = cur.lastrowid
        conn.commit()
        return farm_id
    finally:
        conn.close()

# ---------------------------------------------------------
# Maintenance
# ---------------------------------------------------------

def cleanup_expired_tokens(retention_days: int = 7) -> int:
    conn = _get_conn()
    deleted_count = 0
    try:
        sql = f"""
            DELETE FROM farm_magic_link_tokens
            WHERE expires_at < datetime('now', '-{retention_days} days')
        """
        cur = conn.execute(sql)
        deleted_count = cur.rowcount
        conn.commit()
        if deleted_count > 0:
            logger.info(f"🧹 [FarmAuth GC] Cleaned up {deleted_count} expired tokens.")
    except Exception as e:
        logger.error(f"⚠️ [FarmAuth GC] Failed to cleanup tokens: {e}")
    finally:
        conn.close()
    return deleted_count