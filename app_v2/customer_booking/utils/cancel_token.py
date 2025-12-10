# app_v2/customer_booking/utils/cancel_token.py

import os
import json
import base64
import hmac
import hashlib
import time
from dataclasses import dataclass

from fastapi import HTTPException


@dataclass
class CancelTokenPayload:
    """
    予約キャンセル用リンクに埋め込むペイロード。

    - reservation_id: 対象の予約ID
    - line_user_id: 予約したユーザーの LINE User ID
    - exp: トークン有効期限（Unixタイム秒）
    - sub: 用途を識別するサブジェクト（固定値 "cancel_reservation"）
    """
    reservation_id: int
    line_user_id: str
    exp: int
    sub: str = "cancel_reservation"


def _get_secret_key() -> bytes:
    """
    HMAC 署名に使うシークレットキーを取得する。

    環境変数 CANCEL_TOKEN_SECRET を優先し、
    なければ開発用の固定値を使う。
    """
    secret = os.getenv("CANCEL_TOKEN_SECRET")
    if not secret:
        # 将来、本番環境では必ず環境変数で上書きする想定。
        secret = "dev-cancel-token-secret"
    return secret.encode("utf-8")


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _b64url_decode(data_str: str) -> bytes:
    # padding を補完
    padding = "=" * (-len(data_str) % 4)
    return base64.urlsafe_b64decode(data_str + padding)


def create_cancel_token(payload: CancelTokenPayload) -> str:
    """
    キャンセルリンクに埋め込むためのトークン生成。
    base64url(JSON) + "." + base64url(HMAC署名) という形式にする。

    - ペイロード例:
        {
          "reservation_id": 123,
          "line_user_id": "Uxxxx",
          "exp": 1732939200,
          "sub": "cancel_reservation"
        }
    """
    body_dict = {
        "reservation_id": payload.reservation_id,
        "line_user_id": payload.line_user_id,
        "exp": payload.exp,
        "sub": payload.sub,
    }

    body_json = json.dumps(body_dict, separators=(",", ":"), sort_keys=True).encode("utf-8")
    body_b64 = _b64url_encode(body_json)

    secret = _get_secret_key()
    sig = hmac.new(secret, body_json, hashlib.sha256).digest()
    sig_b64 = _b64url_encode(sig)

    return f"{body_b64}.{sig_b64}"


def verify_cancel_token(token: str, *, allow_expired: bool = False) -> CancelTokenPayload:
    """
    トークン検証。

    - 形式チェック（"." で2分割できるか）
    - HMAC署名検証
    - JSONパース
    - sub == "cancel_reservation" チェック
    - exp（Unix秒）と現在時刻の比較（allow_expired に応じて挙動を変える）

    allow_expired:
        False -> exp を過ぎていたら 400 "Cancellation deadline passed" を投げる
        True  -> exp を過ぎていても payload は返す（呼び出し側で is_cancellable 判定用）
    """
    if not token or "." not in token:
        raise HTTPException(status_code=400, detail="Invalid cancel token format")

    body_b64, sig_b64 = token.split(".", 1)

    try:
        body_json = _b64url_decode(body_b64)
        sig = _b64url_decode(sig_b64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid cancel token encoding")

    # 署名検証
    secret = _get_secret_key()
    expected_sig = hmac.new(secret, body_json, hashlib.sha256).digest()
    if not hmac.compare_digest(sig, expected_sig):
        raise HTTPException(status_code=400, detail="Invalid cancel token signature")

    # JSON パース
    try:
        data = json.loads(body_json.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid cancel token payload")

    # sub チェック
    if data.get("sub") != "cancel_reservation":
        raise HTTPException(status_code=400, detail="Invalid cancel token subject")

    # exp チェック
    try:
        exp = int(data.get("exp"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid cancel token exp")

    now_ts = int(time.time())
    if not allow_expired and now_ts > exp:
        # キャンセル期限を過ぎている
        raise HTTPException(status_code=400, detail="Cancellation deadline passed")

    # 最終的なペイロードオブジェクトにして返却
    try:
        reservation_id = int(data.get("reservation_id"))
        line_user_id = str(data.get("line_user_id"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid cancel token payload fields")

    return CancelTokenPayload(
        reservation_id=reservation_id,
        line_user_id=line_user_id,
        exp=exp,
        sub=data.get("sub", "cancel_reservation"),
    )
