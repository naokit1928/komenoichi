from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Query

from app_v2.dev.dev_api import require_dev_access
from app_v2.notifications.services.line_notification_service import (
    LineNotificationService,
)

"""
運用・管理者向け 通知送信 API（最終確定版）

責務：
- notification_jobs に溜まった PENDING ジョブを送信する
- 実処理は LineNotificationService に完全委譲する

設計原則：
- job 作成判断・文面生成・DB 更新は一切行わない
- admin 表示（– / NONE）ロジックとは独立
"""

router = APIRouter(
    prefix="/notifications",
    tags=["notifications-admin"],
)

_notification_service = LineNotificationService()


@router.post("/send-pending")
def send_pending_notifications(
    limit: int = Query(
        50,
        gt=0,
        le=200,
        description="一度に送信する最大ジョブ数（scheduled_at 昇順）",
    ),
    dry_run: bool = Query(
        False,
        description="True の場合は送信せず、送信予定ジョブの一覧だけ返す",
    ),
    _: None = Depends(require_dev_access),
) -> Dict[str, Any]:
    """
    status='PENDING' かつ scheduled_at <= 現在時刻 のジョブを送信する。

    - 実際の送信処理は LineNotificationService.send_pending_jobs に委譲
    - 戻り値は Service 側の結果をそのまま返す
    """
    try:
        return _notification_service.send_pending_jobs(
            limit=limit,
            dry_run=dry_run,
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"send_pending_notifications failed: {e}",
        ) from e
