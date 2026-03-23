from fastapi import APIRouter, Request
import sqlite3
import os # ★ 追加

from app_v2.db.core import resolve_db_path

router = APIRouter(
    prefix="/consumers",
    tags=["consumers"],
)

@router.get("/identity")
def get_consumer_identity(request: Request):
    """
    consumer identity API（フロー判定用・正解版）

    ルール:
    - 本当に「ログイン済み」と言えるのは
        session.consumer_id があり
        かつ consumers.email が存在する場合のみ
    - それ以外（MagicLink直後 / 壊れたsession / 未ログイン）は
        is_logged_in = False
    """

    consumer_id = request.session.get("consumer_id")
    farm_id = request.session.get("farm_id") # ★ 農家セッションも取得

    # session が無い → 未ログイン
    if not consumer_id:
        return {
            "is_logged_in": False,
            "email": None,
            "is_farmer": False,
            "own_farm_id": None,
            "is_admin": False, # ★ 追加
        }

    try:
        consumer_id_int = int(consumer_id)
    except Exception:
        # session が壊れている
        return {
            "is_logged_in": False,
            "email": None,
            "is_farmer": False,
            "own_farm_id": None,
            "is_admin": False, # ★ 追加
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

    # email が無い = MagicLink途中 or 未確定 → 未ログイン扱い
    if not email:
        return {
            "is_logged_in": False,
            "email": None,
            "is_farmer": False,
            "own_farm_id": None,
            "is_admin": False, # ★ 追加
        }

    # ★ 追加: 管理者かどうかの判定
    admin_emails_env = os.getenv("ADMIN_EMAILS", "")
    allowed_emails = [e.strip().lower() for e in admin_emails_env.split(",") if e.strip()]
    is_admin = bool(email and email.lower() in allowed_emails)

    # ここに来たときだけ「ログイン済み」
    return {
        "is_logged_in": True,
        "email": email,
        "is_farmer": farm_id is not None,
        "own_farm_id": farm_id,
        "is_admin": is_admin, # ★ 追加してフロントに返す
    }