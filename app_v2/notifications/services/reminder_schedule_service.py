from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone, time
from typing import Optional


# JST タイムゾーン（人間向け計算・判定用）
JST = timezone(timedelta(hours=9), "Asia/Tokyo")


@dataclass
class ReminderScheduleResult:
    """
    REMINDER 送信判定結果 DTO。

    should_send:
        True  -> REMINDER job を作成する
        False -> REMINDER job を作成しない（admin 表示は「–」側）

    scheduled_at:
        job.scheduled_at に入れる UTC datetime
        should_send=False の場合は None
    """

    should_send: bool
    scheduled_at: Optional[datetime]


class ReminderScheduleService:
    """
    REMINDER 通知を「送るか／送るならいつか」だけを判断する Service。

    【責務】
    - DB には一切触らない
    - job を作るかどうかの判断のみ
    - admin の NONE / – 表示ロジックには関与しない

    【重要仕様】
    - 内部計算は JST で行う
    - 外部に返す scheduled_at は必ず UTC
    """

    # 48時間ルール
    _MIN_LEAD_TIME = timedelta(hours=48)

    def calculate_reminder_time(
        self,
        pickup_start: datetime,
        confirmed_at: datetime,
    ) -> ReminderScheduleResult:
        """
        リマインダー送信時刻を決定する。

        正式仕様：
        - 受け渡し開始まで 48 時間未満で確定した予約
            → REMINDER は送らない
        - 48 時間以上前に確定した予約のみ送信対象
        - 送信時刻は受け渡し開始時刻の時間帯に応じた固定時刻
            * 6:00〜12:00  → 前日 20:00
            * 12:00〜16:00 → 当日 8:00
            * 16:00〜22:00 → 当日 12:00
        - 深夜・早朝に即時送信することはない
        """

        pickup_start_jst = self._to_jst(pickup_start)
        confirmed_at_jst = self._to_jst(confirmed_at)

        # --------------------------------------------------
        # 1) 48時間ルール
        # --------------------------------------------------
        lead_time = pickup_start_jst - confirmed_at_jst
        if lead_time < self._MIN_LEAD_TIME:
            return ReminderScheduleResult(
                should_send=False,
                scheduled_at=None,
            )

        # --------------------------------------------------
        # 2) 時間帯別の固定送信時刻（JST）
        # --------------------------------------------------
        scheduled_at_jst = self._compute_scheduled_at_jst(pickup_start_jst)

        # 念のため：確定時刻より過去になる場合は送らない
        if scheduled_at_jst <= confirmed_at_jst:
            return ReminderScheduleResult(
                should_send=False,
                scheduled_at=None,
            )

        # --------------------------------------------------
        # 3) UTC に正規化して返す（DB 保存前提）
        # --------------------------------------------------
        scheduled_at_utc = scheduled_at_jst.astimezone(timezone.utc)

        return ReminderScheduleResult(
            should_send=True,
            scheduled_at=scheduled_at_utc,
        )

    # ==================================================
    # 内部ヘルパー
    # ==================================================

    @staticmethod
    def _to_jst(dt: datetime) -> datetime:
        """
        naive / 他タイムゾーンの datetime を JST に正規化する。
        """
        if dt.tzinfo is None:
            return dt.replace(tzinfo=JST)
        return dt.astimezone(JST)

    @staticmethod
    def _compute_scheduled_at_jst(pickup_start_jst: datetime) -> datetime:
        """
        pickup_start（JST）から、時間帯別の固定 REMINDER 送信時刻（JST）を算出する。
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
            # 想定外（深夜など）は暫定的に「当日 8:00」
            target_date = date
            target_time = time(hour=8, minute=0, tzinfo=JST)

        return datetime.combine(target_date, target_time, tzinfo=JST)
