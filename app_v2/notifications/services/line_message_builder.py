from __future__ import annotations

from typing import Optional

from app_v2.notifications.dtos import NotificationContextDTO
from app_v2.customer_booking.utils.cancel_token import (
    CancelTokenPayload,
    create_cancel_token,
)


class LineMessageBuilder:

    @staticmethod
    def _safe_str(value: Optional[object]) -> str:
        return "" if value is None else str(value)

    # ---------------------------------------------------------------------
    # 1通目：予約確定メッセージ（変更なし）
    # ---------------------------------------------------------------------
    @classmethod
    def build_confirmation(cls, ctx: NotificationContextDTO) -> str:

        reservation_id = cls._safe_str(getattr(ctx, "reservation_id", None))

        qty_10 = int(getattr(ctx, "qty_10", 0) or 0)
        qty_5 = int(getattr(ctx, "qty_5", 0) or 0)
        qty_25 = int(getattr(ctx, "qty_25", 0) or 0)

        label_10kg = cls._safe_str(getattr(ctx, "label_10kg", "10kg"))
        label_5kg = cls._safe_str(getattr(ctx, "label_5kg", "5kg"))
        label_25kg = cls._safe_str(getattr(ctx, "label_25kg", "25kg"))

        rice_subtotal = int(getattr(ctx, "rice_subtotal", 0) or 0)

        pickup_display = cls._safe_str(getattr(ctx, "pickup_display", ""))
        pickup_place_name = cls._safe_str(getattr(ctx, "pickup_place_name", ""))
        pickup_map_url = cls._safe_str(getattr(ctx, "pickup_map_url", ""))
        pickup_detail_memo = getattr(ctx, "pickup_detail_memo", None)

        pickup_code = cls._safe_str(getattr(ctx, "pickup_code", ""))

        lines: list[str] = []

        # 冒頭
        lines.append(f"ご予約ありがとうございます。（予約ID：{reservation_id}）")
        lines.append("予約が確定しました。")
        lines.append("")

        # 受け渡し日時
        lines.append("■ 受け渡し日時")
        lines.append(f"・{pickup_display}")
        lines.append("")

        # 受け渡し場所
        lines.append("■ 受け渡し場所")
        lines.append(f"・{pickup_place_name}")
        if pickup_map_url:
            lines.append(pickup_map_url)
        lines.append("")

        # 補足メモ
        if pickup_detail_memo:
            lines.append("■ 補足メモ")
            lines.append(cls._safe_str(pickup_detail_memo))
            lines.append("")

        # 予約コード
        lines.append("■ 予約コード")
        lines.append(f"・4桁の予約コード：{pickup_code}")
        lines.append("　※ 農家さんにこのコードをお伝えください。")
        lines.append("")

        # 予約内容
        lines.append("■ 予約内容")
        if qty_5 > 0:
            lines.append(f"・{label_5kg}：{qty_5}袋")
        if qty_10 > 0:
            lines.append(f"・{label_10kg}：{qty_10}袋")
        if qty_25 > 0:
            lines.append(f"・{label_25kg}：{qty_25}袋")
        lines.append("")

        # 支払い
        lines.append("■ お支払い")
        lines.append(f"・お支払い金額：{rice_subtotal}円（現金）")
        lines.append("")

        # 注意事項
        lines.append("■ 注意事項")
        lines.append("※ 精米・袋づめのため、10分ほどお待ちいただく場合があります。")

        # ★キャンセルURLは1通目から完全削除

        return "\n".join(lines)

    # ---------------------------------------------------------------------
    # 2通目：控えめなキャンセル案内（TemplateMessage）
    # ---------------------------------------------------------------------
    @classmethod
    def build_cancel_template(cls, cls_ctx: NotificationContextDTO) -> dict:

        ctx = cls_ctx  # 引数名を ctx にそろえる（可読性のため）

        reservation_id_str = cls._safe_str(getattr(ctx, "reservation_id", None))
        customer_line_user_id = cls._safe_str(
            getattr(ctx, "customer_line_user_id", "")
        )
        cancel_token_exp = getattr(ctx, "cancel_token_exp", None)
        cancel_base_url = cls._safe_str(
            getattr(ctx, "cancel_base_url", "https://your-app.com/cancel")
        )

        # キャンセルURL生成（フォールバックなし）
        payload = CancelTokenPayload(
            reservation_id=int(reservation_id_str),
            line_user_id=customer_line_user_id,
            exp=int(cancel_token_exp),
        )
        token = create_cancel_token(payload)
        cancel_url = f"{cancel_base_url}?token={token}"

        # 本文
        body_text = (
            "来れなくなった場合は必ず、3時間前までに予約の取り消しをお願いします。"
            "無断キャンセルの場合は、次回以降のご予約を制限させていただくことがあります。"
        )

        alt_text = f"キャンセル案内（予約ID：{reservation_id_str}）"

        # Buttons テンプレート
        template_message: dict = {
            "type": "template",
            "altText": alt_text,
            "template": {
                "type": "buttons",
                "text": body_text,
                "actions": [
                    {
                        "type": "uri",
                        "label": "予約の取り消し",
                        "uri": cancel_url,
                    }
                ],
            },
        }

        return template_message

    # ---------------------------------------------------------------------
    # 3通目：リマインダー（短いメッセージ版）
    # ---------------------------------------------------------------------
    @classmethod
    def build_reminder(cls, ctx: NotificationContextDTO) -> str:
        pickup_display = cls._safe_str(getattr(ctx, "pickup_display", ""))

        lines: list[str] = []
        lines.append("【リマインダー】")
        lines.append("")
        lines.append(f"{pickup_display} にお受け取り予定があります。")
        lines.append("お気をつけてお越しください。")

        return "\n".join(lines)

    # ---------------------------------------------------------------------
    # 4通目：キャンセル完了通知（CANCEL_COMPLETED）
    # ---------------------------------------------------------------------
    @classmethod
    def build_cancel_completed(cls, ctx: NotificationContextDTO) -> str:
        """
        キャンセル完了通知（CANCEL_COMPLETED）
        タイトル＋予約ID＋2行の本文で構成する。
        """
        reservation_id = cls._safe_str(getattr(ctx, "reservation_id", None))

        lines: list[str] = []
        lines.append("【キャンセルが完了しました】")
        lines.append("")
        lines.append(f"（予約ID：{reservation_id}）")
        lines.append("キャンセル手続きが正常に処理されました。")
        lines.append("ご利用ありがとうございました。")

        return "\n".join(lines)
