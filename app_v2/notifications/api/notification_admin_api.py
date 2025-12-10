# app_v2/notifications/api/notification_admin_api.py
"""
運用・管理者向け 通知送信 API。

目的：
- line_notification_jobs に溜まった PENDING ジョブを一括送信する
- 特定の job_id のみ送信（再送）する

ここではあくまで「入口」だけを定義し、
実際の送信ロジック・DB 更新ロジックは
app_v2.notifications.services.line_notification_service.LineNotificationService
側に委譲する。

※ 注意
現時点では LineNotificationService には send_pending_jobs / send_single_job
はまだ実装されていないため、このエンドポイントを呼ぶと AttributeError になります。
Step 2 で LineNotificationService 側を実装すると動作するようになります。
"""

from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Query

from app_v2.dev.dev_api import require_dev_access
from app_v2.notifications.services.line_notification_service import (
    LineNotificationService,
)

# /notifications プレフィックス配下にぶら下げる
router = APIRouter(prefix="/notifications", tags=["notifications-admin"])

# 通知サービスの単一インスタンス
_notification_service = LineNotificationService()


@router.post("/send-pending")
def send_pending_notifications(
    limit: int = Query(
        50,
        gt=0,
        le=200,
        description="一度に送信する最大ジョブ数（古い scheduled_at から順に）",
    ),
    dry_run: bool = Query(
        False,
        description="True の場合は送信せずに『送るつもりの一覧』だけ返す",
    ),
    _: None = Depends(require_dev_access),
) -> Dict[str, Any]:
    """
    status = 'PENDING' かつ scheduled_at <= 現在時刻 のジョブを、
    早い順に最大 `limit` 件まで送信するための管理用エンドポイント。

    - 実際の取得・送信ロジックは LineNotificationService.send_pending_jobs(...) に委譲
    - 戻り値の形式も LineNotificationService 側で定義したものをそのまま返す

    戻り値のイメージ（Step 2 実装予定）:
    {
        "ok": true,
        "summary": {
            "total_candidates": 10,
            "processed": 5,
            "sent": 4,
            "skipped": 1,
            "failed": 0
        },
        "results": [
            {
                "job_id": 12,
                "result": "SENT",   # or "SKIPPED" / "FAILED"
                "status_before": "PENDING",
                "status_after": "SENT",
                "attempt_count_after": 1,
                "error": null
            },
            ...
        ]
    }
    """
    try:
        # 実装は Step 2 で追加予定
        result = _notification_service.send_pending_jobs(
            limit=limit,
            dry_run=dry_run,
        )
        return result
    except AttributeError as e:
        # send_pending_jobs が未実装の場合は、分かりやすいエラーを返す
        raise HTTPException(
            status_code=500,
            detail=(
                "LineNotificationService.send_pending_jobs がまだ実装されていません。"
                " Step 2 の実装完了後に再度お試しください。"
            ),
        ) from e
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"send_pending_notifications で予期せぬエラー: {e}",
        ) from e


@router.post("/send-job/{job_id}")
def send_single_notification_job(
    job_id: int,
    dry_run: bool = Query(
        False,
        description="True の場合は送信せずに『このジョブを送る場合のシミュレーション結果』だけ返す",
    ),
    _: None = Depends(require_dev_access),
) -> Dict[str, Any]:
    """
    特定の job_id のみを対象に送信（または dry-run）するための管理用エンドポイント。

    典型的なユースケース:
    - 個別のリトライ
    - 1件だけ様子を見るテスト

    戻り値のイメージ（Step 2 実装予定）:
    {
        "ok": true,
        "job_id": 12,
        "result": "SENT",   # or "SKIPPED" / "FAILED"
        "status_before": "PENDING",
        "status_after": "SENT",
        "attempt_count_after": 2,
        "error": null
    }
    """
    try:
        # 実装は Step 2 で追加予定
        result = _notification_service.send_single_job(
            job_id=job_id,
            dry_run=dry_run,
        )
        return result
    except AttributeError as e:
        raise HTTPException(
            status_code=500,
            detail=(
                "LineNotificationService.send_single_job がまだ実装されていません。"
                " Step 2 の実装完了後に再度お試しください。"
            ),
        ) from e
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"send_single_notification_job で予期せぬエラー: {e}",
        ) from e
