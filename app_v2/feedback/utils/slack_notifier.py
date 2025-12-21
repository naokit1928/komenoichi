# komet\app_v2\feedback\utils\slack_notifier.py"

"""
SlackNotifier

- Incoming Webhook を使って Slack にメッセージを送るための薄いラッパ。
- 環境変数 SLACK_WEBHOOK_URL から URL を取得する。
- 依存ライブラリは標準ライブラリのみ（urllib）なので、追加インストール不要。
"""

from __future__ import annotations

import json
import os
from typing import Any, Dict, Optional
from urllib import error, request


class SlackNotifier:
    """
    シンプルな Slack Webhook クライアント。

    使い方:
        from app_v2.customer_booking.utils.slack_notifier import SlackNotifier

        notifier = SlackNotifier()
        result = notifier.send_message("テスト投稿です")
        print(result)

    戻り値は {"ok": True} または {"ok": False, ...} の辞書。
    """

    def __init__(
        self,
        webhook_url: Optional[str] = None,
        default_username: str = "RiceApp Feedback Bot",
        default_icon_emoji: str = ":memo:",
    ) -> None:
        env_url = os.getenv("SLACK_WEBHOOK_URL", "").strip()
        self.webhook_url: str = (webhook_url or env_url).strip()
        self.default_username = default_username
        self.default_icon_emoji = default_icon_emoji

    # ---- 公開メソッド -------------------------------------------------

    def is_configured(self) -> bool:
        """
        Webhook URL が設定されているかどうかを返す。
        """
        return bool(self.webhook_url)

    def send_message(
        self,
        text: str,
        *,
        username: Optional[str] = None,
        icon_emoji: Optional[str] = None,
        extra_payload: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Slack にテキストメッセージを送信する。

        - text: 投稿したい本文（必須）
        - username: Slack 上で表示する投稿者名（省略時は default_username）
        - icon_emoji: アイコン絵文字（":memo:" など、省略可）
        - extra_payload: attachments / blocks など追加フィールドを渡したい場合に使用

        戻り値:
            {"ok": True}
            もしくはエラー内容を含む {"ok": False, ...}
        """

        if not self.webhook_url:
            # 本番で URL 未設定の場合はエラーだが、
            # 開発中は「送信スキップ」として扱えるようにしておく。
            print("[SlackNotifier] SLACK_WEBHOOK_URL is not set. Skip sending.")
            return {"ok": False, "skipped": True, "reason": "no_webhook"}

        payload: Dict[str, Any] = {
            "text": text,
            "username": username or self.default_username,
        }

        if icon_emoji or self.default_icon_emoji:
            payload["icon_emoji"] = icon_emoji or self.default_icon_emoji

        if extra_payload:
            # text / username / icon_emoji 以外のフィールドを上書き / 追加
            payload.update(extra_payload)

        data = json.dumps(payload).encode("utf-8")

        req = request.Request(
            self.webhook_url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with request.urlopen(req, timeout=5) as resp:
                status = resp.getcode()
                body = resp.read().decode("utf-8", errors="ignore")
        except error.HTTPError as e:  # HTTP ステータス 4xx/5xx
            body = e.read().decode("utf-8", errors="ignore")
            status = e.code
            print(f"[SlackNotifier] HTTPError status={status}, body={body}")
            return {
                "ok": False,
                "skipped": False,
                "status_code": status,
                "body": body,
            }
        except Exception as e:
            print(f"[SlackNotifier] Error while sending to Slack: {e}")
            return {"ok": False, "skipped": False, "error": str(e)}

        if status != 200:
            # Webhook のレスポンスが "ok" 以外の場合など
            print(f"[SlackNotifier] Unexpected status={status}, body={body}")
            return {
                "ok": False,
                "skipped": False,
                "status_code": status,
                "body": body,
            }

        print(f"[SlackNotifier] SUCCESS status={status}, body={body}")

        return {"ok": True}
