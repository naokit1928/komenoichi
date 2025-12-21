from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from app_v2.admin.dto.admin_reservation_dtos import (
    NotificationStatusSummaryDTO,
)


# ============================================================
# 管理画面用：通知ステータス集約ロジック
# ============================================================

def build_notification_summary(
    *,
    jobs: List[Dict[str, Any]],
    reservation_status: str,
    created_at: datetime,
    event_start: datetime,
) -> NotificationStatusSummaryDTO:
    """
    line_notification_jobs の配列から NotificationStatusSummaryDTO を構成する。

    仕様（AdminReservationService から完全移植）:

    - confirmation:
        * ジョブなし        → NONE
        * FAILED が1件以上 → FAILED
        * PENDING が存在   → PENDING
        * SENT のみ        → SENT

    - reminder:
        * キャンセル済み                → DASH
        * lead_time < 48h:
            - ジョブあり → 通常集約
            - ジョブなし → DASH（正常）
        * lead_time >= 48h:
            - ジョブあり → 通常集約
            - ジョブなし → NONE（異常）

    - cancel_completed:
        * 未キャンセル → DASH
        * キャンセル済み:
            - ジョブあり → 通常集約
            - ジョブなし → NONE（異常）
    """

    kinds = ["CONFIRMATION", "REMINDER", "CANCEL_COMPLETED"]

    # --------------------------------------------------------
    # kind ごとに status を集計
    # --------------------------------------------------------
    status_map: Dict[str, List[str]] = {k: [] for k in kinds}

    for job in jobs:
        kind = str(job.get("kind") or "")
        status = str(job.get("status") or "")
        if kind in status_map:
            status_map[kind].append(status)

    # --------------------------------------------------------
    # 共通：ステータス配列 → 表示用ステータス
    # --------------------------------------------------------
    def summarize_status(statuses: List[str]) -> str:
        if not statuses:
            return "NONE"
        if any(s == "FAILED" for s in statuses):
            return "FAILED"
        if any(s == "PENDING" for s in statuses):
            return "PENDING"
        return "SENT"

    # ========================================================
    # confirmation（単純集約）
    # ========================================================
    confirmation = summarize_status(status_map["CONFIRMATION"])

    # ========================================================
    # reminder（48時間ルールあり）
    # ========================================================
    reminder_statuses = status_map["REMINDER"]
    is_cancelled = reservation_status == "cancelled"

    if is_cancelled:
        reminder = "DASH"
    else:
        # lead_time（hours）を計算
        lead_time_hours: Optional[float]
        try:
            delta = event_start - created_at
            lead_time_hours = delta.total_seconds() / 3600.0
        except Exception:
            lead_time_hours = None

        if lead_time_hours is not None and lead_time_hours < 48:
            # 48時間未満 → 正常なのでジョブは作られない前提
            if reminder_statuses:
                reminder = summarize_status(reminder_statuses)
            else:
                reminder = "DASH"
        else:
            # 48時間以上 or lead_time 計算不可
            if reminder_statuses:
                reminder = summarize_status(reminder_statuses)
            else:
                reminder = "NONE"

    # ========================================================
    # cancel_completed
    # ========================================================
    cancel_completed_statuses = status_map["CANCEL_COMPLETED"]

    if not is_cancelled:
        cancel_completed = "DASH"
    else:
        if cancel_completed_statuses:
            cancel_completed = summarize_status(cancel_completed_statuses)
        else:
            cancel_completed = "NONE"

    # ========================================================
    # DTO 組み立て
    # ========================================================
    return NotificationStatusSummaryDTO(
        confirmation=confirmation,
        reminder=reminder,
        cancel_completed=cancel_completed,
    )
