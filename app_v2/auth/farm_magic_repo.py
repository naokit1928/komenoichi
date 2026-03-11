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
# Read (Queries)
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
    """
    Service層で直接SQLを書いていた部分を移動。
    emailからfarm_idとowner_farmer_id(登録状態判定用)を取得。
    """
    conn = _get_conn()
    try:
        return conn.execute(
            "SELECT farm_id, owner_farmer_id FROM farms WHERE email = ?",
            (email,),
        ).fetchone()
    finally:
        conn.close()

def get_farm_owner_id(farm_id: int) -> Optional[int]:
    """farm_id から owner_farmer_id (登録済みか) を確認する"""
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
# Write (Commands)
# ---------------------------------------------------------

def insert_token(
    email: str,
    token: str,
    farm_id: int,
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
                farm_id,
                expires_at.isoformat(),
                created_at.isoformat(),
            ),
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
# Maintenance (Cleanup)
# ---------------------------------------------------------

def cleanup_expired_tokens(retention_days: int = 7) -> int:
    """
    期限切れ、または古いトークンを物理削除する。
    消費者モジュールの cleanup.py と同様のアプローチ。
    """
    conn = _get_conn()
    deleted_count = 0
    try:
        # expires_at が retention_days 以上前のものを削除
        # ※もし「使用済みか期限切れなら即消していい」なら条件はもっと厳しくできますが、
        #   トラブル調査用に7日程度残すのが安全です。
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