# app_v2/integrations/line/line_incoming_api.py

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

# 環境変数（すでに通知ドメインで使っているはずのものを再利用）
CHANNEL_SECRET = os.getenv("LINE_MESSAGING_CHANNEL_SECRET")
ACCESS_TOKEN = os.getenv("LINE_MESSAGING_CHANNEL_ACCESS_TOKEN")


# フィードバックページURL
# 本番では FRONTEND_URL=https://xxx を .env に入れておく前提
_frontend = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
FEEDBACK_URL = f"{_frontend}/feedback"


def _verify_signature(body: bytes, signature: str | None) -> None:
    """
    LINE の Webhook 署名検証。
    CHANNEL_SECRET が未設定なら警告だけ出してスキップ。
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
    受け取った replyToken に対して、
    「フィードバックページへ誘導する固定メッセージ」を返信する。
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

    data = json.dumps(payload).encode("utf-8")
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


@router.post("/webhook", status_code=200)
async def line_webhook(
    request: Request,
    x_line_signature: str | None = Header(default=None),
):
    """
    LINE Messaging API Webhook 入口（フェーズ1用）

    - 任意メッセージ（text）を受け取ったら
      フィードバックページへの誘導メッセージを返信するだけ。
    """
    body = await request.body()

    # 署名チェック（CHANNEL_SECRET 未設定なら警告のみ）
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

    # LINE Webhook には 200 を返せばOK
    return {"ok": True}
