from __future__ import annotations

from typing import Optional

from app_v2.notifications.dtos import NotificationContextDTO


class LineMessageBuilder:
    """
    LINE に送信する各種メッセージを組み立てる責務だけを持つ Builder。

    重要ルール：
    - message_text は「送信時に生成」する（DB には保存しない）
    - このクラスは副作用を持たない（純粋に文字列を返す）
    - notifications ドメイン以外（Web / cancel / UI）の責務は持たない
    """

    @staticmethod
    def _safe_str(value: Optional[object]) -> str:
        return "" if value is None else str(value)

    # ------------------------------------------------------------------
    # 1通目：予約確定メッセージ（テキスト）
    # ------------------------------------------------------------------
    @classmethod
    def build_confirmation(cls, ctx: NotificationContextDTO) -> str:
        reservation_id = cls._safe_str(ctx.reservation_id)

        qty_5 = int(ctx.qty_5 or 0)
        qty_10 = int(ctx.qty_10 or 0)
        qty_25 = int(ctx.qty_25 or 0)

        label_5kg = cls._safe_str(ctx.label_5kg)
        label_10kg = cls._safe_str(ctx.label_10kg)
        label_25kg = cls._safe_str(ctx.label_25kg)

        rice_subtotal = int(ctx.rice_subtotal or 0)

        pickup_display = cls._safe_str(ctx.pickup_display)
        pickup_place_name = cls._safe_str(ctx.pickup_place_name)
        pickup_map_url = cls._safe_str(ctx.pickup_map_url)
        pickup_detail_memo = cls._safe_str(ctx.pickup_detail_memo)
        pickup_code = cls._safe_str(ctx.pickup_code)

        lines: list[str] = []

        lines.append(f"ご予約ありがとうございます。（予約ID：{reservation_id}）")
        lines.append("予約が確定しました。")
        lines.append("")

        lines.append("■ 受け渡し日時")
        lines.append(f"・{pickup_display}")
        lines.append("")

        lines.append("■ 受け渡し場所")
        lines.append(f"・{pickup_place_name}")
        if pickup_map_url:
            lines.append(pickup_map_url)
        lines.append("")

        if pickup_detail_memo:
            lines.append("■ 補足メモ")
            lines.append(pickup_detail_memo)
            lines.append("")

        lines.append("■ 予約コード")
        lines.append(f"・4桁の予約コード：{pickup_code}")
        lines.append("　※ 農家さんにこのコードをお伝えください。")
        lines.append("")

        lines.append("■ 予約内容")
        if qty_5 > 0:
            lines.append(f"・{label_5kg}：{qty_5}袋")
        if qty_10 > 0:
            lines.append(f"・{label_10kg}：{qty_10}袋")
        if qty_25 > 0:
            lines.append(f"・{label_25kg}：{qty_25}袋")
        lines.append("")

        lines.append("■ お支払い")
        lines.append(f"・お支払い金額：{rice_subtotal}円（現金）")
        lines.append("")

        lines.append("■ 注意事項")
        lines.append("※ 精米・袋づめのため、10分ほどお待ちいただく場合があります。")

        return "\n".join(lines)

    # ------------------------------------------------------------------
    # リマインダー（テキスト）
    # ------------------------------------------------------------------
    @classmethod
    def build_reminder(cls, ctx: NotificationContextDTO) -> str:
        pickup_display = cls._safe_str(ctx.pickup_display)

        lines: list[str] = []
        lines.append("【リマインダー】")
        lines.append("")
        lines.append(f"{pickup_display} にお受け取り予定があります。")
        lines.append("お気をつけてお越しください。")

        return "\n".join(lines)

    # ------------------------------------------------------------------
    # キャンセル完了通知（テキスト）
    # ------------------------------------------------------------------
    @classmethod
    def build_cancel_completed(cls, ctx: NotificationContextDTO) -> str:
        reservation_id = cls._safe_str(ctx.reservation_id)

        lines: list[str] = []
        lines.append("【キャンセルが完了しました】")
        lines.append("")
        lines.append(f"（予約ID：{reservation_id}）")
        lines.append("キャンセル手続きが正常に処理されました。")
        lines.append("ご利用ありがとうございました。")

        return "\n".join(lines)
