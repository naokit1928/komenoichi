from __future__ import annotations

import json
import urllib.request
import urllib.error
from typing import Any


class LineClient:
    """
    LINE Messaging API への最小クライアント。

    役割：
    - Service 層から渡された「送信先 LINE ID」と「完成済みメッセージ」を
      そのまま LINE Push API に投げるだけ。

    重要な設計方針：
    - DB に message_text は保存しない
    - message_text は「送信直前に生成された完成形」
    - このクラスは通知ドメインの最終 I/O 層であり、判断ロジックは持たない
    """

    PUSH_URL = "https://api.line.me/v2/bot/message/push"

    def __init__(self, channel_access_token: str) -> None:
        self.channel_access_token = channel_access_token

    def push_message(self, line_consumer_id: str, message_text: str) -> None:
        """
        LINE の Push API にメッセージを送信する。

        - line_consumer_id:
            consumers.line_consumer_id（送信先 LINE ID）
        - message_text:
            通常は str（テキストメッセージ）
            JSON(dict) 形式文字列で "type" を含む場合のみ TemplateMessage として扱う

        失敗時は RuntimeError を送出する（上位で FAILED に反映）
        """
        if not self.channel_access_token:
            raise RuntimeError(
                "LINE channel access token が設定されていません。"
            )

        # TemplateMessage 等の JSON を許容（基本は text）
        try:
            loaded = json.loads(message_text)
            if isinstance(loaded, dict) and "type" in loaded:
                message_obj: dict[str, Any] = loaded
            else:
                message_obj = {"type": "text", "text": message_text}
        except Exception:
            message_obj = {"type": "text", "text": message_text}

        body_dict: dict[str, Any] = {
            "to": line_consumer_id,
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
