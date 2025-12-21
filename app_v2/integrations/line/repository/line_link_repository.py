from __future__ import annotations

import sqlite3
from datetime import datetime, UTC
from typing import Optional

from app_v2.db.core import resolve_db_path


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(resolve_db_path())
    conn.row_factory = sqlite3.Row
    return conn


# ============================================================
# Consumer（購入者）
# ============================================================

def ensure_consumer_by_line_user_id(line_user_id: str) -> None:
    """
    consumers に line_consumer_id が存在しなければ作成する。
    """
    conn = _get_conn()
    try:
        cur = conn.cursor()

        cur.execute(
            """
            SELECT consumer_id
            FROM consumers
            WHERE line_consumer_id = ?
            LIMIT 1
            """,
            (line_user_id,),
        )
        row = cur.fetchone()

        if not row:
            cur.execute(
                """
                INSERT INTO consumers (line_consumer_id, created_at)
                VALUES (?, ?)
                """,
                (line_user_id, datetime.now(UTC).isoformat()),
            )
            conn.commit()

    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ============================================================
# User（農家ユーザー）
# ============================================================

def get_user_by_line_user_id(line_user_id: str) -> Optional[int]:
    conn = _get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id FROM users WHERE line_user_id = ? LIMIT 1",
            (line_user_id,),
        )
        row = cur.fetchone()
        return int(row["id"]) if row else None
    finally:
        conn.close()


def create_farmer_user(line_user_id: str) -> int:
    conn = _get_conn()
    try:
        cur = conn.cursor()
        now = datetime.now(UTC).isoformat()

        cur.execute(
            """
            INSERT INTO users (name, role, line_user_id, created_at)
            VALUES (?, ?, ?, ?)
            """,
            ("LINEユーザー", "farmer", line_user_id, now),
        )
        conn.commit()
        return int(cur.lastrowid)

    except sqlite3.IntegrityError:
        conn.rollback()
        raise
    finally:
        conn.close()


# ============================================================
# Farm
# ============================================================

def get_owned_farm_id(user_id: int, farm_id: int) -> Optional[int]:
    conn = _get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id FROM farms
            WHERE id = ? AND user_id = ?
            LIMIT 1
            """,
            (farm_id, user_id),
        )
        row = cur.fetchone()
        return int(row["id"]) if row else None
    finally:
        conn.close()


def create_farm(user_id: int) -> int:
    conn = _get_conn()
    try:
        cur = conn.cursor()

        cur.execute(
            """
            INSERT INTO farms (user_id, name, postal_code, active_flag)
            VALUES (?, ?, ?, ?)
            """,
            (user_id, "未設定の農園", "0000000", 0),
        )
        conn.commit()
        farm_id = int(cur.lastrowid)

        _ensure_farmer_profile(cur, farm_id)
        conn.commit()

        return farm_id

    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _ensure_farmer_profile(cur: sqlite3.Cursor, farm_id: int) -> None:
    """
    farmer_profiles があれば空で作る。
    無くても致命的でないため例外は握りつぶす。
    """
    now = datetime.now(UTC).isoformat()
    try:
        cur.execute(
            """
            INSERT INTO farmer_profiles (
                farm_id,
                pr_title,
                pr_text,
                face_image_url,
                cover_image_url,
                pr_images_json,
                created_at,
                updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (farm_id, "", "", "", "", "[]", now, now),
        )
    except sqlite3.OperationalError:
        pass
