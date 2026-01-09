from fastapi import APIRouter, Request
import sqlite3

from app_v2.db.core import resolve_db_path

router = APIRouter(
    prefix="/consumers",
    tags=["consumers"],
)


@router.get("/identity")
def get_consumer_identity(request: Request):
    """
    consumer identity API（表示専用・確定版）

    - consumer セッションがある場合のみ email を返す
    - email は consumers.email を唯一の正とする（人格）
    - 未ログイン時は email = null
    - 業務ロジック・分岐には一切使用しない
    """

    consumer_id = request.session.get("consumer_id")

    # 未ログイン
    if not consumer_id:
        return {
            "is_logged_in": False,
            "email": None,
        }

    try:
        consumer_id_int = int(consumer_id)
    except Exception:
        # session が壊れている場合も表示しない
        return {
            "is_logged_in": False,
            "email": None,
        }

    db_path = resolve_db_path()
    conn = sqlite3.connect(db_path)

    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT email
            FROM consumers
            WHERE consumer_id = ?
            LIMIT 1
            """,
            (consumer_id_int,),
        )
        row = cur.fetchone()
        email = row[0] if row else None
    finally:
        conn.close()

    # ログインはしているが email 未設定（理論上は初回直後のみ）
    if not email:
        return {
            "is_logged_in": True,
            "email": None,
        }

    return {
        "is_logged_in": True,
        "email": email,
    }
