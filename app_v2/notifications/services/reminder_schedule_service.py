# app_v2/notifications/services/reminder_schedule_service.py

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone, time
from typing import Optional


# JST タイムゾーン（他ファイルと揃えて固定）
JST = timezone(timedelta(hours=9), "Asia/Tokyo")


@dataclass
class ReminderScheduleResult:
    """
    リマインダーの送信有無と、送信予定時刻（ある場合）を表すシンプルな DTO。
    """

    should_send: bool
    scheduled_at: Optional[datetime]


class ReminderScheduleService:
    """
    「いつリマインダーを送るか」だけを担当する Service。

    入力:
        - pickup_start: 予約が属する受け渡しイベントの開始日時 (JST 想定)
        - confirmed_at: Stripe 決済成功時刻 = 予約確定時刻 (JST 想定)

    出力:
        - ReminderScheduleResult:
            - should_send: リマインダーを送るべきか
            - scheduled_at: 実際に送るべき日時 (send_at)。送らない場合は None。
    """

    # 48時間ルール
    _MIN_LEAD_TIME = timedelta(hours=48)

    def calculate_reminder_time(
        self,
        pickup_start: datetime,
        confirmed_at: datetime,
    ) -> ReminderScheduleResult:
        """
        通知設計ドキュメントの仕様に基づき、リマインダー送信時刻を決定する。

        仕様まとめ:
        - 受け渡しまで 48 時間未満で確定した予約にはリマインダーを送らない。
        - 48 時間以上前に確定した予約のみ、時間帯別の固定時刻でリマインダーを送る。
          * 6:00〜12:00  → 前日 20:00
          * 12:00〜16:00 → 当日 8:00
          * 16:00〜22:00 → 当日 12:00
        - 深夜 23:00〜朝 8:00 には通知を飛ばさない（上記の固定時刻だけを使用）。
        """

        pickup_start_jst = self._to_jst(pickup_start)
        confirmed_at_jst = self._to_jst(confirmed_at)

        # ---- 1) 48時間ルール ----
        lead_time = pickup_start_jst - confirmed_at_jst
        if lead_time < self._MIN_LEAD_TIME:
            # 48時間未満 → リマインダーは送らない
            return ReminderScheduleResult(should_send=False, scheduled_at=None)

        # ---- 2) 時間帯別の固定時刻ロジック ----
        scheduled_at = self._compute_scheduled_at(pickup_start_jst)

        # 念のための安全策: 過去時刻になっていたら送らない
        if scheduled_at <= confirmed_at_jst:
            return ReminderScheduleResult(should_send=False, scheduled_at=None)

        return ReminderScheduleResult(should_send=True, scheduled_at=scheduled_at)

    # ------------------------------------------------------------------
    # 内部ヘルパー
    # ------------------------------------------------------------------

    @staticmethod
    def _to_jst(dt: datetime) -> datetime:
        """
        naive / 他タイムゾーンの datetime を JST に正規化する。
        """
        if dt.tzinfo is None:
            return dt.replace(tzinfo=JST)
        return dt.astimezone(JST)

    @staticmethod
    def _compute_scheduled_at(pickup_start_jst: datetime) -> datetime:
        """
        pickup_start（JST）から、時間帯別の固定リマインダー時刻を計算する。

        - 6:00〜12:00  → 前日 20:00
        - 12:00〜16:00 → 当日 8:00
        - 16:00〜22:00 → 当日 12:00

        ※ 想定外の時間帯（6:00未満 or 22:00以降）は
           とりあえず「当日 8:00」に寄せておく（将来の拡張余地として）。
        """
        hour = pickup_start_jst.hour
        date = pickup_start_jst.date()

        if 6 <= hour < 12:
            # 朝〜昼前 → 前日 20:00
            target_date = date - timedelta(days=1)
            target_time = time(hour=20, minute=0, tzinfo=JST)
        elif 12 <= hour < 16:
            # 昼〜夕方前 → 当日 8:00
            target_date = date
            target_time = time(hour=8, minute=0, tzinfo=JST)
        elif 16 <= hour < 22:
            # 夕方〜夜 → 当日 12:00
            target_date = date
            target_time = time(hour=12, minute=0, tzinfo=JST)
        else:
            # 想定外の時間帯（夜中など）は暫定的に「当日 8:00」に寄せる
            target_date = date
            target_time = time(hour=8, minute=0, tzinfo=JST)

        return datetime.combine(target_date, target_time, tzinfo=JST)
