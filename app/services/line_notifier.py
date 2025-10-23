# app/services/line_notifier.py
"""
LINE Push通知（予約確定）用モジュール（最小依存・堅牢化版）

主な特長
- DRY RUN を最優先：user_line_id が無くても必ず疑似送信ログを出す
- トークン未設定や例外時でも、予約処理を妨げない（False 返却のみ）
- 1関数エントリ: send_reservation_confirmed(...)

環境変数
- LINE_CHANNEL_ACCESS_TOKEN : Messaging API のチャネルアクセストークン
- LINE_NOTIFY_DRY_RUN       : "1" の場合は実送信せずコンソールに出力
"""

from __future__ import annotations
import os
import logging
from typing import Optional, Dict, Any
import requests

LOGGER = logging.getLogger(__name__)
LINE_PUSH_ENDPOINT = "https://api.line.me/v2/bot/message/push"


# -------- 内部ユーティリティ --------
def _get_line_token() -> Optional[str]:
    token = os.getenv("LINE_CHANNEL_ACCESS_TOKEN")
    if not token:
        LOGGER.warning("LINE_CHANNEL_ACCESS_TOKEN が未設定のため、通知をスキップします。")
    return token


def _is_dry_run() -> bool:
    return os.getenv("LINE_NOTIFY_DRY_RUN", "").strip() == "1"


def _build_headers(token: str) -> Dict[str, str]:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _post_json(url: str, headers: Dict[str, str], payload: Dict[str, Any], timeout: float = 5.0) -> bool:
    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=timeout)
        if resp.status_code == 200:
            return True
        LOGGER.error("LINE push 失敗 status=%s body=%s", resp.status_code, resp.text)
        return False
    except Exception as e:
        LOGGER.exception("LINE push 例外: %s", e)
        return False


# -------- 公開API --------
def send_text(user_line_id: Optional[str], text: str) -> bool:
    """
    任意テキストをPush送信。
    - DRY RUN=1 のときは、IDが無くても疑似送信ログを出して True を返す
    - 本番送信時は user_line_id / token が必須（無ければ False）
    """
    # 1) まず DRY RUN を判定（見える化を最優先）
    if _is_dry_run():
        print(
            "[DRY_RUN] would push",
            f"to={user_line_id or '(no user_line_id)'}",
            "text=",
            text.replace("\n", " / "),
        )
        LOGGER.info("[DRY_RUN] payload preview: to=%s text=%s", user_line_id, text)
        return True

    # 2) 本番送信フロー
    token = _get_line_token()
    if not token:
        return False
    if not user_line_id:
        LOGGER.warning("user_line_id が未設定のため、通知をスキップします。")
        return False

    payload = {
        "to": user_line_id,
        "messages": [{"type": "text", "text": text[:4900]}],  # 安全マージン
    }
    headers = _build_headers(token)
    return _post_json(LINE_PUSH_ENDPOINT, headers, payload)


def _build_confirmed_message(
    farm_name: str,
    quantity: int,
    price: int,
    pickup_location: Optional[str],
    pickup_time: Optional[str],
) -> str:
    loc = pickup_location or ""
    ptime = pickup_time or ""
    return (
        "予約が確定しました。\n"
        f"農家：{farm_name}\n"
        f"商品：{quantity}kg\n"
        f"金額：{price}円\n"
        f"受け渡し：{loc}（{ptime}）"
    ).strip()


def send_reservation_confirmed(
    *,
    user_line_id: Optional[str],
    farm_name: str,
    quantity: int,
    price: int,
    pickup_location: Optional[str],
    pickup_time: Optional[str],
) -> bool:
    """
    予約確定メッセージの送信エントリポイント。
    routers/reservations.py の PUT で status が confirmed に遷移した時のみ呼ぶ想定。
    """
    text = _build_confirmed_message(
        farm_name=farm_name,
        quantity=quantity,
        price=price,
        pickup_location=pickup_location,
        pickup_time=pickup_time,
    )
    return send_text(user_line_id=user_line_id, text=text)
