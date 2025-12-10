"""
app_v2/notifications/api/notification_dev_api.py

開発用通知プレビュー API。
Stripe Webhook を触らずに、1件の予約に対して:

- LineNotificationService.schedule_for_reservation(reservation_id)
- line_notification_jobs に登録された CONFIRMATION / REMINDER

を確認するためのエンドポイントを提供する。
"""

from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, Query

from app_v2.dev.dev_api import require_dev_access
from app_v2.notifications.repository.line_notification_job_repo import (
    LineNotificationJobRepository,
)
from app_v2.notifications.services.line_notification_service import (
    LineNotificationService,
)

router = APIRouter(tags=["dev-notifications"])

_job_repo = LineNotificationJobRepository()
_notification_service = LineNotificationService()


@router.get("/notifications/preview")
def preview_notification_for_reservation(
    reservation_id: int = Query(..., gt=0),
    _: None = Depends(require_dev_access),
) -> Dict[str, Any]:
    """
    開発用: 指定 reservation_id の通知内容をプレビューする。

    挙動:
    - 呼び出し前の line_notification_jobs 件数を記録
    - LineNotificationService.schedule_for_reservation(reservation_id) を 1回だけ実行
    - 呼び出し後の件数との差分を jobs_created_in_this_call として返す

    schedule_for_reservation が None を返した場合でも 404 は投げず、
    ok=False と error_hint を返す（原因調査しやすくするため）。
    """
    # 呼び出し前の件数
    before_jobs: List[Dict[str, Any]] = _job_repo.get_jobs_by_reservation(reservation_id)
    before_count = len(before_jobs)

    # 新しい通知モジュールを必ず 1回実行
    confirmation_text = _notification_service.schedule_for_reservation(reservation_id)

    # 呼び出し後の件数
    after_jobs: List[Dict[str, Any]] = _job_repo.get_jobs_by_reservation(reservation_id)
    after_count = len(after_jobs)
    jobs_created = max(0, after_count - before_count)

    if confirmation_text is None:
        # 通知コンテキストを組み立てられなかった場合
        return {
            "ok": False,
            "reservation_id": reservation_id,
            "error_hint": (
                "LineNotificationService.schedule_for_reservation(...) が None を返しました。"
                " サーバーログの [LineNotificationService] のメッセージを確認してください。"
            ),
            "job_count": after_count,
            "jobs_created_in_this_call": jobs_created,
            "jobs": after_jobs,
        }

    # 正常に文面を生成できた場合
    return {
        "ok": True,
        "reservation_id": reservation_id,
        "confirmation_text": confirmation_text,
        "job_count": after_count,
        "jobs_created_in_this_call": jobs_created,
        "jobs": after_jobs,
    }
