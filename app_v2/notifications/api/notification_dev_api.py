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
    開発用: 指定 reservation_id の通知 job をプレビューする。

    仕様（新）：
    - 文面は返さない（message_text は DB に存在しないため）
    - この API の関心は「どの kind の job が作られたか」
    - admin 表示（– / NONE）の事前確認用
    """

    # 呼び出し前の job 一覧
    before_jobs: List[Dict[str, Any]] = _job_repo.get_jobs_by_reservation(reservation_id)
    before_count = len(before_jobs)

    # 通知スケジューリングを 1 回だけ実行
    result = _notification_service.schedule_for_reservation(reservation_id)

    # 呼び出し後の job 一覧
    after_jobs: List[Dict[str, Any]] = _job_repo.get_jobs_by_reservation(reservation_id)
    after_count = len(after_jobs)
    jobs_created = max(0, after_count - before_count)

    if result is None:
        # 通知コンテキストを組み立てられなかった場合
        return {
            "ok": False,
            "reservation_id": reservation_id,
            "error_hint": (
                "LineNotificationService.schedule_for_reservation(...) が None を返しました。"
                " reservation / consumer / farm / line_consumer_id のいずれかが欠けています。"
                " サーバーログを確認してください。"
            ),
            "job_count": after_count,
            "jobs_created_in_this_call": jobs_created,
            "jobs": after_jobs,
        }

    return {
        "ok": True,
        "reservation_id": reservation_id,
        "job_count": after_count,
        "jobs_created_in_this_call": jobs_created,
        "jobs": after_jobs,
    }
