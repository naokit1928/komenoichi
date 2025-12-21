from __future__ import annotations

import hmac
import hashlib
import base64
import json
import time
from typing import Dict, Any


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("utf-8")


def _b64url_decode(s: str) -> bytes:
    pad = "=" * ((4 - len(s) % 4) % 4)
    return base64.urlsafe_b64decode(s + pad)


def sign_state(
    payload: Dict[str, Any],
    *,
    secret: str,
    expires_in_sec: int = 300,
) -> str:
    """
    state 用署名を生成する。

    payload に自動的に ts（現在時刻）を付与する。
    """
    body = dict(payload)
    body["ts"] = int(time.time())

    raw = json.dumps(
        body,
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode("utf-8")

    sig = hmac.new(
        secret.encode("utf-8"),
        raw,
        hashlib.sha256,
    ).digest()

    return f"{_b64url(sig)}.{_b64url(raw)}"


def verify_state(
    state: str,
    *,
    secret: str,
    expires_in_sec: int = 300,
) -> Dict[str, Any]:
    """
    state を検証し、payload を返す。

    - 署名不一致 → ValueError
    - 有効期限切れ → ValueError
    """
    try:
        sig_b64, raw_b64 = state.split(".", 1)
        raw = _b64url_decode(raw_b64)

        expected_sig = hmac.new(
            secret.encode("utf-8"),
            raw,
            hashlib.sha256,
        ).digest()

        if _b64url(expected_sig) != sig_b64:
            raise ValueError("bad signature")

        payload = json.loads(raw.decode("utf-8"))

        ts = int(payload.get("ts", 0))
        if abs(int(time.time()) - ts) > expires_in_sec:
            raise ValueError("state expired")

        return payload

    except Exception as e:
        raise ValueError(f"invalid state: {e}")
