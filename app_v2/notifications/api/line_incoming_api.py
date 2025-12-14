from __future__ import annotations

import os
import json
import hmac
import hashlib
import base64
from urllib import request as urlrequest, error as urlerror

from fastapi import APIRouter, Request, Header, HTTPException, status

router = APIRouter(
    prefix="/api/line",
    tags=["line_incoming"],
)

# =========================================================
# 環境変数
# =========================================================

# Webhook 署名検証用（未設定の場合は検証スキップ）
CHANNEL_SECRET = os.getenv("LINE_MESSAGING_CHANNEL_SECRET")

# reply 用アクセストークン
ACCESS_TOKEN = os.getenv("LINE_MESSAGING_CHANNEL_ACCESS_TOKEN")

# フィードバックページ URL
# 本番では FRONTEND_URL=https://xxx を .env に入れておく
_frontend = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
FEEDBACK_URL = f"{_frontend}/feedback"


# =========================================================
# 内部ユーティリティ
# =========================================================

def _verify_signature(body: bytes, signature: str | None) -> None:
    """
    LINE Webhook の署名検証。

    設計方針：
    - CHANNEL_SECRET 未設定時は「警告のみ」で検証をスキップ
    - notification_jobs / DB / job には一切関与しない
    """
    if not CHANNEL_SECRET:
        print("[LineIncoming] WARNING: LINE_CHANNEL_SECRET not set; skip signature check")
        return

    if not signature:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-Line-Signature header missing",
        )

    mac = hmac.new(CHANNEL_SECRET.encode("utf-8"), body, hashlib.sha256)
    expected = base64.b64encode(mac.digest()).decode("utf-8")

    if not hmac.compare_digest(expected, signature):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid signature",
        )


def _reply_feedback_message(reply_token: str) -> None:
    """
    受信メッセージへの自動返信。

    重要：
    - 本 API は「通知」ではない（notification_jobs を使わない）
    - job は作らない / status 管理もしない
    - ユーザー操作の入口として、固定メッセージを即時返信するだけ
    """
    if not ACCESS_TOKEN:
        print("[LineIncoming] ERROR: LINE_CHANNEL_ACCESS_TOKEN not set; cannot reply")
        return

    url = "https://api.line.me/v2/bot/message/reply"

    payload = {
        "replyToken": reply_token,
        "messages": [
            {
                "type": "text",
                "text": (
                    "このLINEでは個別のメッセージには返信していません。\n"
                    "ご意見・不具合のご連絡は、下のボタンからフィードバックページへお送りください。"
                ),
            },
            {
                "type": "template",
                "altText": "フィードバックページはこちら",
                "template": {
                    "type": "buttons",
                    "text": "フィードバックページを開きます。",
                    "actions": [
                        {
                            "type": "uri",
                            "label": "フィードバックページ",
                            "uri": FEEDBACK_URL,
                        }
                    ],
                },
            },
        ],
    }

    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urlrequest.Request(
        url,
        data=data,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {ACCESS_TOKEN}",
        },
    )

    try:
        with urlrequest.urlopen(req, timeout=5) as resp:
            status_code = resp.getcode()
            body = resp.read().decode("utf-8")
            print(f"[LineIncoming] reply status={status_code}, body={body}")
    except urlerror.HTTPError as e:
        print(f"[LineIncoming] HTTPError reply: {e.code} {e.reason}")
    except Exception as e:
        print(f"[LineIncoming] Exception reply: {type(e).__name__}: {e}")


# =========================================================
# Webhook エンドポイント
# =========================================================

@router.post("/webhook", status_code=200)
async def line_webhook(
    request: Request,
    x_line_signature: str | None = Header(default=None),
):
    """
    LINE Messaging API Webhook 入口（フェーズ1）

    仕様（固定）：
    - text メッセージを受信したら
      → フィードバックページへの誘導メッセージを即時返信
    - DB / notification_jobs / admin 表示には一切影響しない
    """
    body = await request.body()

    # 署名チェック（未設定時は警告のみ）
    _verify_signature(body, x_line_signature)

    payload = json.loads(body.decode("utf-8"))
    events = payload.get("events", [])

    for event in events:
        if event.get("type") != "message":
            continue

        message = event.get("message") or {}
        if message.get("type") != "text":
            continue

        reply_token = event.get("replyToken")
        if not reply_token:
            continue

        _reply_feedback_message(reply_token)

    # LINE Webhook には 200 を返せば OK
    return {"ok": True}
