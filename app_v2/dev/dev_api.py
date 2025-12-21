"""
V2 用 DEV ツール API（consumers 対応版）

/dev/test_login
/dev/friendship_override
/dev/reset_user

役割：
- LINEログイン完了状態を疑似的に生成する
- 本番では LINE OAuth / Webhook がこの役割を担う
- DEV_MODE=1 のときのみ有効
"""

import os
import sqlite3
import traceback
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app_v2.db.core import resolve_db_path


DEV_MODE = os.getenv("DEV_MODE", "0") == "1"

router = APIRouter(tags=["dev"])


# --------------------------------------------------
# 共通ユーティリティ
# --------------------------------------------------
def require_dev_access():
    if not DEV_MODE:
        raise HTTPException(status_code=404, detail="Not Found")


def get_connection() -> sqlite3.Connection:
    """
    DEV 用 DB 接続生成。

    - 本番コードと同じく resolve_db_path() を唯一の正とする
    - DEV 専用だが、DB 入口ルールは例外にしない
    """
    con = sqlite3.connect(resolve_db_path())
    con.row_factory = sqlite3.Row
    return con


def ensure_consumer_row(
    con: sqlite3.Connection,
    line_consumer_id: str,
) -> int:
    """
    consumers テーブルに line_consumer_id を持つ行が存在しなければ作成し、
    consumer_id を返す。
    """

    cur = con.execute(
        "SELECT consumer_id FROM consumers WHERE line_consumer_id = ?",
        (line_consumer_id,),
    )
    row = cur.fetchone()
    if row is not None:
        return int(row["consumer_id"])

    con.execute(
        """
        INSERT INTO consumers (
            line_consumer_id,
            is_friend,
            registration_status
        ) VALUES (?, ?, ?)
        """,
        (
            line_consumer_id,
            1,                 # dev 前提：友だちになっている
            "line_verified",   # dev 前提：LINE認証済み
        ),
    )

    cur = con.execute("SELECT last_insert_rowid()")
    consumer_id = int(cur.fetchone()[0])
    return consumer_id


# --------------------------------------------------
# Pydantic モデル
# --------------------------------------------------
class TestLoginBody(BaseModel):
    line_user_id: str  # フロント互換のため名称は維持


class FriendshipOverrideBody(BaseModel):
    line_user_id: str
    is_friend: bool


class ResetUserBody(BaseModel):
    line_user_id: str


# --------------------------------------------------
# エンドポイント
# --------------------------------------------------
@router.get("/ping")
def ping(_: None = Depends(require_dev_access)):
    return {"ok": True, "mode": "DEV"}


@router.post("/test_login")
def dev_test_login(
    body: TestLoginBody,
    _: None = Depends(require_dev_access),
):
    """
    開発用ログインエミュレータ（consumers 版）

    - consumers に line_consumer_id を作成/再利用
    - registration_status = 'line_verified'
    - is_friend = 1
    - next: "/farmer/registration"
    """
    con = get_connection()
    try:
        consumer_id = ensure_consumer_row(con, body.line_user_id)

        # 念のため状態を上書き
        con.execute(
            """
            UPDATE consumers
            SET registration_status = 'line_verified',
                is_friend = 1
            WHERE consumer_id = ?
            """,
            (consumer_id,),
        )

        con.commit()

        return {
            "ok": True,
            "consumer_id": consumer_id,
            "line_user_id": body.line_user_id,
            "next": "/farmer/registration",
        }

    except Exception as e:
        con.rollback()
        tb = traceback.format_exc()
        raise HTTPException(
            status_code=500,
            detail=f"/dev/test_login failed: {e}\n{tb}",
        )
    finally:
        con.close()


@router.post("/friendship_override")
def dev_friendship_override(
    body: FriendshipOverrideBody,
    _: None = Depends(require_dev_access),
):
    """
    LINE 友だち状態を強制的に切り替える（consumers 版）
    """
    con = get_connection()
    try:
        consumer_id = ensure_consumer_row(con, body.line_user_id)

        con.execute(
            """
            UPDATE consumers
            SET is_friend = ?
            WHERE consumer_id = ?
            """,
            (1 if body.is_friend else 0, consumer_id),
        )

        con.commit()

        return {
            "ok": True,
            "consumer_id": consumer_id,
            "line_user_id": body.line_user_id,
            "is_friend": body.is_friend,
        }

    except Exception as e:
        con.rollback()
        tb = traceback.format_exc()
        raise HTTPException(
            status_code=500,
            detail=f"/dev/friendship_override failed: {e}\n{tb}",
        )
    finally:
        con.close()


@router.post("/reset_user")
def dev_reset_user(
    body: ResetUserBody,
    _: None = Depends(require_dev_access),
):
    """
    開発用 consumer を「登録前」の状態に戻す

    - owner_user_id = consumer_id かつ active_flag = 0 の farms を削除
    - consumers.registration_status を NULL に戻す
    """
    con = get_connection()
    try:
        cur = con.execute(
            "SELECT consumer_id FROM consumers WHERE line_consumer_id = ?",
            (body.line_user_id,),
        )
        row = cur.fetchone()
        if row is None:
            return {"ok": True, "consumer_not_found": True}

        consumer_id = int(row["consumer_id"])

        # 下書き farm を削除
        con.execute(
            """
            DELETE FROM farms
            WHERE owner_user_id = ?
              AND active_flag = 0
            """,
            (consumer_id,),
        )

        # registration_status を初期化
        con.execute(
            """
            UPDATE consumers
            SET registration_status = NULL
            WHERE consumer_id = ?
            """,
            (consumer_id,),
        )

        con.commit()

        return {
            "ok": True,
            "consumer_id": consumer_id,
            "cleared_draft_farms": True,
        }

    except Exception as e:
        con.rollback()
        tb = traceback.format_exc()
        raise HTTPException(
            status_code=500,
            detail=f"/dev/reset_user failed: {e}\n{tb}",
        )
    finally:
        con.close()
