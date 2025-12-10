from fastapi import APIRouter, Response, Request, HTTPException
from fastapi.responses import RedirectResponse, JSONResponse
from urllib.parse import urlencode, urlparse, parse_qs, urlunparse
import os
import hmac
import hashlib
import base64
import json
import time
import urllib.request
from datetime import datetime, UTC
import sqlite3  # ★ ORM の代わりに sqlite3 を使用

# ★ tags を "line_v2" に変更（Swagger で V2 と分かるように）
router = APIRouter(prefix="/api/line", tags=["line_v2"])

FRONT_BASE = os.getenv(
    "FRONTEND_BASE_URL",
    os.getenv("VITE_FRONTEND_BASE_URL", "http://localhost:5173"),
)

LINE_CHANNEL_ID = os.getenv("LINE_CHANNEL_ID", "")
LINE_CHANNEL_SECRET = os.getenv("LINE_CHANNEL_SECRET", "")
LINE_REDIRECT_URI = os.getenv("LINE_REDIRECT_URI")
if not LINE_REDIRECT_URI:
    raise RuntimeError("LINE_REDIRECT_URI is not set")

LINE_AUTHORIZE_URL = "https://access.line.me/oauth2/v2.1/authorize"
LINE_TOKEN_URL = "https://api.line.me/oauth2/v2.1/token"
LINE_VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify"

LINKED_COOKIE = "line_linked"

# DB パス（他の V2 コードと同様に app.db を前提。必要なら .env で上書き可能）
DB_PATH = os.getenv("DB_PATH", "app.db")


def _get_db_connection() -> sqlite3.Connection:
    """
    app.db への接続を返す。
    基本的な CRUD に使うだけなので非常に薄いヘルパー。
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _append_query(url: str, extra: dict) -> str:
    parts = list(urlparse(url))
    qs = parse_qs(parts[4], keep_blank_values=True)
    for k, v in extra.items():
        qs[k] = [str(v)]
    parts[4] = urlencode({k: v[0] for k, v in qs.items()})
    return urlunparse(parts)


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64url_decode(s: str) -> bytes:
    pad = "=" * ((4 - len(s) % 4) % 4)
    return base64.urlsafe_b64decode(s + pad)


def _sign(payload: dict) -> str:
    raw = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    sig = hmac.new(LINE_CHANNEL_SECRET.encode("utf-8"), raw, hashlib.sha256).digest()
    return _b64url(sig) + "." + _b64url(raw)


def _verify(state: str) -> dict:
    try:
        sig_b64, raw_b64 = state.split(".", 1)
        raw = _b64url_decode(raw_b64)
        expect_sig = hmac.new(
            LINE_CHANNEL_SECRET.encode("utf-8"), raw, hashlib.sha256
        ).digest()
        if _b64url(expect_sig) != sig_b64:
            raise ValueError("bad signature")
        payload = json.loads(raw.decode("utf-8"))
        if abs(int(time.time()) - int(payload.get("ts", 0))) > 300:
            raise ValueError("state expired")
        return payload
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"invalid state: {e}")


def _post_form(url: str, data: dict) -> dict:
    body = urlencode(data).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


@router.get("/login")
def line_login(return_to: str):
    if not return_to:
        raise HTTPException(status_code=400, detail="return_to is required")
    if not LINE_CHANNEL_ID or not LINE_CHANNEL_SECRET or not LINE_REDIRECT_URI:
        raise HTTPException(status_code=500, detail="LINE env not configured")

    state = _sign({"return_to": return_to, "ts": int(time.time())})
    params = {
        "response_type": "code",
        "client_id": LINE_CHANNEL_ID,
        "redirect_uri": LINE_REDIRECT_URI,
        "state": state,
        "scope": "openid profile",
        "bot_prompt": "normal",
        "prompt": "consent",
    }
    return RedirectResponse(
        f"{LINE_AUTHORIZE_URL}?{urlencode(params)}", status_code=302
    )


def _extract_farm_id_from_url(url: str | None) -> int | None:
    if not url:
        return None
    try:
        qs = parse_qs(urlparse(url).query)
        s = qs.get("farm_id", [None])[0]
        return int(s) if s and str(s).isdigit() else None
    except Exception:
        return None


@router.get("/callback")
def line_callback(
    response: Response,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
):
    if error:
        raise HTTPException(status_code=400, detail=f"LINE error: {error}")
    if not code or not state:
        raise HTTPException(status_code=400, detail="code/state missing")

    # 1) state 検証 & return_to 復元
    payload = _verify(state)
    return_to = payload.get("return_to") or f"{FRONT_BASE}/farmer/settings"

    # return_to から「購入者フロー」か「農家フロー」かを判定
    parsed = urlparse(return_to)
    path = parsed.path or ""
    is_consumer_flow = path.startswith("/farms/")  # 例: /farms/{id}/confirm ...

    # 2) code → access_token & id_token → line_user_id
    try:
        token_res = _post_form(
            LINE_TOKEN_URL,
            {
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": LINE_REDIRECT_URI,
                "client_id": LINE_CHANNEL_ID,
                "client_secret": LINE_CHANNEL_SECRET,
            },
        )
        id_token = token_res.get("id_token")
        if not id_token:
            raise RuntimeError(f"id_token missing: {token_res}")
        verify_res = _post_form(
            LINE_VERIFY_URL,
            {
                "id_token": id_token,
                "client_id": LINE_CHANNEL_ID,
            },
        )
        line_user_id = verify_res.get("sub")
        if not line_user_id:
            raise RuntimeError(f"sub missing: {verify_res}")
    except Exception as e:
        raise HTTPException(
            status_code=400, detail=f"token exchange/verify failed: {e}"
        )

    # ★★ 購入者フロー：Farmを作らず、そのまま return_to に返す ★★
    if is_consumer_flow:
        # 予約者側：ConfirmPage に戻すだけ
        final_return = return_to
        resp = RedirectResponse(final_return, status_code=302)
        resp.set_cookie(
            key=LINKED_COOKIE,
            value="1",
            max_age=60 * 60 * 24 * 30,
            httponly=True,
            secure=False,
            samesite="Lax",
            path="/",
        )
        return resp

    # ★★ 農家フロー：従来どおり User+Farm を作って /farmer/settings に飛ばす ★★
    intended_farm_id = _extract_farm_id_from_url(return_to)
    conn = _get_db_connection()
    try:
        cur = conn.cursor()

        # 3-1) 既に同じ LINE が他ユーザーに付いていないか
        cur.execute(
            "SELECT * FROM users WHERE line_user_id = ? LIMIT 1", (line_user_id,)
        )
        existing = cur.fetchone()

        now_iso = datetime.now(UTC).isoformat()

        if existing:
            user_id = existing["id"]
        else:
            # 新規User作成（農家用）
            try:
                cur.execute(
                    """
                    INSERT INTO users (name, role, line_user_id, created_at)
                    VALUES (?, ?, ?, ?)
                    """,
                    ("LINEユーザー", "farmer", line_user_id, now_iso),
                )
                conn.commit()
            except sqlite3.IntegrityError:
                # line_user_id UNIQUE 制約違反 → 409
                conn.rollback()
                raise HTTPException(
                    status_code=409,
                    detail="this LINE account is already linked to another user",
                )

            user_id = cur.lastrowid

        # 3-2) return_to に farm_id があり本人所有ならそれを採用
        target_farm_id: int | None = None
        if intended_farm_id is not None:
            cur.execute(
                """
                SELECT id FROM farms
                WHERE id = ? AND user_id = ?
                LIMIT 1
                """,
                (intended_farm_id, user_id),
            )
            owned = cur.fetchone()
            if owned:
                target_farm_id = owned["id"]
            else:
                # 他人の farm_id は無視
                intended_farm_id = None

        # 3-3) farm_id が無ければ「必ず新規Farmを発行」
        if intended_farm_id is None:
            cur.execute(
                """
                INSERT INTO farms (user_id, name, postal_code, active_flag)
                VALUES (?, ?, ?, ?)
                """,
                (user_id, "未設定の農園", "0000000", 0),
            )
            conn.commit()
            target_farm_id = cur.lastrowid

            # FarmerProfile があれば空で作成（任意）
            # テーブルが存在しない or カラム不足ならエラーを握りつぶす
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
                    (
                        target_farm_id,
                        "",
                        "",
                        "",
                        "",
                        "[]",
                        now_iso,
                        now_iso,
                    ),
                )
                conn.commit()
            except sqlite3.OperationalError:
                # farmer_profiles テーブルが無い / カラムが違う場合など → 無視
                conn.rollback()
            except Exception:
                # 何かあっても FarmerProfile なので致命的ではない。ロールバックして続行。
                conn.rollback()

    except HTTPException:
        # 上で raise した HTTPException はそのまま再スロー
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(
            status_code=500, detail=f"failed to ensure user/farm: {e}"
        )
    finally:
        conn.close()

    # 4) クッキー設定＋リダイレクト（農家用：従来どおり settings へ）
    final_return = f"{FRONT_BASE}/farmer/settings?farm_id={target_farm_id}"
    resp = RedirectResponse(
        _append_query(final_return, {"autopay": "1"}), status_code=302
    )
    resp.set_cookie(
        key=LINKED_COOKIE,
        value="1",
        max_age=60 * 60 * 24 * 30,
        httponly=True,
        secure=False,
        samesite="Lax",
        path="/",
    )
    return resp


@router.get("/linked")
def line_linked(request: Request):
    linked = request.cookies.get(LINKED_COOKIE) == "1"
    return JSONResponse({"linked": linked})


@router.get("/reset")
def line_reset(return_to: str = "/"):
    resp = RedirectResponse(url=return_to, status_code=302)
    resp.delete_cookie(key=LINKED_COOKIE, path="/")
    return resp


@router.get("/reset_to_farm/{farm_id}")
def line_reset_to_farm(farm_id: int):
    url = f"{FRONT_BASE}/farms/{farm_id}"
    resp = RedirectResponse(url=url, status_code=302)
    resp.delete_cookie(key=LINKED_COOKIE, path="/")
    return resp
