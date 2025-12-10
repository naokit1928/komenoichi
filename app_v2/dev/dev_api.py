# app_v2/dev/dev_api.py
"""
V2 用 DEV ツール API

/dev/test_login
/dev/friendship_override
/dev/reset_user

本番では DEV_MODE=1 でない限り 404 を返すだけ。
"""

import os
import sqlite3
import traceback
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

DEV_MODE = os.getenv("DEV_MODE", "0") == "1"
DB_PATH = os.getenv("DB_PATH", "app.db")

router = APIRouter(tags=["dev"])



# --------------------------------------------------
# 共通ユーティリティ
# --------------------------------------------------
def require_dev_access():
  if not DEV_MODE:
    # 本番など DEV_MODE=0 のときは存在しないことにする
    raise HTTPException(status_code=404, detail="Not Found")


def get_connection() -> sqlite3.Connection:
  con = sqlite3.connect(DB_PATH)
  con.row_factory = sqlite3.Row
  return con


def ensure_user_row(
  con: sqlite3.Connection,
  line_user_id: str,
  nickname: Optional[str] = None,
) -> int:
  """
  users テーブルに line_user_id を持つ行が存在しなければ挿入し、
  そのユーザー ID を返す。

  NOT NULL カラムがあっても落ちないように PRAGMA でスキーマを見て
  それなりのダミー値を詰める。
  """
  cur = con.execute(
    "SELECT id FROM users WHERE line_user_id = ?",
    (line_user_id,),
  )
  row = cur.fetchone()
  if row is not None:
    return int(row["id"])

  # スキーマ確認
  cur = con.execute("PRAGMA table_info(users)")
  cols_info = cur.fetchall()
  if not cols_info:
    raise HTTPException(status_code=500, detail="users table not found")

  # name -> {name, type, notnull, dflt_value, pk}
  cols: Dict[str, Dict[str, Any]] = {}
  for c in cols_info:
    cols[str(c["name"])] = {
      "type": str(c["type"] or "").upper(),
      "notnull": int(c["notnull"] or 0),
      "dflt": c["dflt_value"],
      "pk": int(c["pk"] or 0),
    }

  if "line_user_id" not in cols:
    raise HTTPException(
      status_code=500,
      detail="users.line_user_id column not found",
    )

  # 挿入する値を準備
  vals: Dict[str, Any] = {}

  # 必須: line_user_id
  vals["line_user_id"] = line_user_id

  # 名前っぽい列があれば埋める
  nickname_val = nickname or "dev-user"
  for candidate in ("display_name", "nickname", "name", "user_name"):
    if candidate in cols and candidate not in vals:
      vals[candidate] = nickname_val
      break

  # NOT NULL かつ default 無しの列には適当な値を入れておく
  for name, info in cols.items():
    if name in vals:
      continue
    if info["pk"]:
      # AUTOINCREMENT 主キーは飛ばす
      continue
    if info["notnull"] and info["dflt"] is None:
      t = info["type"]
      if "CHAR" in t or "TEXT" in t or "CLOB" in t:
        vals[name] = ""
      elif "INT" in t or "REAL" in t or "NUM" in t or "DEC" in t:
        vals[name] = 0
      else:
        vals[name] = None  # 最後の手段

  col_names = list(vals.keys())
  placeholders = ",".join(["?"] * len(col_names))
  sql = f'INSERT INTO users ({",".join(col_names)}) VALUES ({placeholders})'
  con.execute(sql, [vals[c] for c in col_names])

  cur = con.execute("SELECT last_insert_rowid()")
  uid = int(cur.fetchone()[0])
  return uid


# --------------------------------------------------
# Pydantic モデル
# --------------------------------------------------
class TestLoginBody(BaseModel):
  line_user_id: str
  nickname: Optional[str] = "dev-user"


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
  return {"ok": True, "mode": "DEV", "db": DB_PATH}


@router.post("/test_login")
def dev_test_login(
  body: TestLoginBody,
  _: None = Depends(require_dev_access),
):
  """
  開発用ログインエミュレータ。
  - users に line_user_id を持つ行を作成/再利用
  - registration_status を 'line_verified' にする
  - next: "/farmer/registration" を返す
  """
  con = get_connection()
  try:
    uid = ensure_user_row(con, body.line_user_id, body.nickname)

    # registration_status を line_verified に
    try:
      con.execute(
        "UPDATE users "
        "SET registration_status = 'line_verified', "
        "    is_friend = COALESCE(is_friend, 0) "
        "WHERE id = ?",
        (uid,),
      )
    except Exception:
      # カラムが無い場合は無視（古いスキーマ用）
      pass

    con.commit()

    return {
      "ok": True,
      "user_id": uid,
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
  LINE 友だち状態を強制的に切り替える。
  - is_friend = 1/0 をセット
  """
  con = get_connection()
  try:
    uid = ensure_user_row(con, body.line_user_id, "dev-user")

    try:
      con.execute(
        "UPDATE users SET is_friend = ? WHERE id = ?",
        (1 if body.is_friend else 0, uid),
      )
    except Exception:
      # is_friend カラムが無いスキーマでも落ちないように
      pass

    con.commit()
    return {
      "ok": True,
      "user_id": uid,
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
  開発用ユーザーを「登録前」の状態に戻す。
  - owner_user_id=該当ユーザー かつ active_flag=0 の farms を削除
  - users.registration_status を NULL に戻す
  """
  con = get_connection()
  try:
    cur = con.execute(
      "SELECT id FROM users WHERE line_user_id = ?",
      (body.line_user_id,),
    )
    row = cur.fetchone()
    if row is None:
      return {"ok": True, "user_not_found": True}

    uid = int(row["id"])

    # 下書き farm を削除（active_flag=0 想定）
    try:
      con.execute(
        "DELETE FROM farms WHERE owner_user_id = ? AND active_flag = 0",
        (uid,),
      )
    except Exception:
      # farms が無い / カラムが違う場合でも落とさない
      pass

    # registration_status をだけ初期化（LINE 紐付けは残す）
    try:
      con.execute(
        "UPDATE users SET registration_status = NULL WHERE id = ?",
        (uid,),
      )
    except Exception:
      pass

    con.commit()
    return {"ok": True, "user_id": uid, "cleared_draft_farms": True}
  except Exception as e:
    con.rollback()
    tb = traceback.format_exc()
    raise HTTPException(
      status_code=500,
      detail=f"/dev/reset_user failed: {e}\n{tb}",
    )
  finally:
    con.close()
