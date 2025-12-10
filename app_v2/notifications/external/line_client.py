# app_v2/notifications/external/line_client.py

from __future__ import annotations

import json
import urllib.request
import urllib.error
from typing import Any


class LineClient:
    """
    LINE Messaging API への最小限のクライアント。

    - 今は push_message 1本だけ
    - 引数の文字列が「普通のテキスト」の場合 → テキストメッセージとして送信
    - 引数の文字列が「TemplateMessage 等の JSON」の場合 → そのまま messages[0] として送信
    """

    PUSH_URL = "https://api.line.me/v2/bot/message/push"

    def __init__(self, channel_access_token: str) -> None:
        self.channel_access_token = channel_access_token

    def push_message(self, line_user_id: str, message_text: str) -> None:
        """
        LINE の Push API にメッセージを送信する。

        - message_text が JSON(dict) で "type" キーを持っていれば、その dict を message オブジェクトとみなす
        - それ以外は従来通り {"type": "text", "text": message_text} で送る

        失敗した場合は RuntimeError を投げる。
        """
        if not self.channel_access_token:
            raise RuntimeError(
                "LINE channel access token が設定されていません。"
            )

        # message_text が JSON なら TemplateMessage として扱う
        message_obj: dict[str, Any]
        try:
            loaded = json.loads(message_text)
            if isinstance(loaded, dict) and "type" in loaded:
                # 例: {"type": "template", "altText": "...", "template": {...}}
                message_obj = loaded
            else:
                # dict だが LINE メッセージではない → テキストとして扱う
                message_obj = {
                    "type": "text",
                    "text": message_text,
                }
        except Exception:
            # JSON でなければ従来どおりテキスト送信
            message_obj = {
                "type": "text",
                "text": message_text,
            }

        body_dict: dict[str, Any] = {
            "to": line_user_id,
            "messages": [message_obj],
        }
        body = json.dumps(body_dict, ensure_ascii=False).encode("utf-8")

        req = urllib.request.Request(
            self.PUSH_URL,
            data=body,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.channel_access_token}",
            },
        )

        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                # LINE API は 200 が成功
                if resp.status != 200:
                    err_body = resp.read().decode("utf-8", errors="ignore")
                    raise RuntimeError(
                        f"LINE push_message failed: status={resp.status}, body={err_body}"
                    )
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="ignore")
            raise RuntimeError(
                f"LINE push_message HTTPError: status={e.code}, body={err_body}"
            ) from e
        except urllib.error.URLError as e:
            raise RuntimeError(f"LINE push_message URLError: {e}") from e
