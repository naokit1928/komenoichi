# app_v2/customer_booking/api/reservation_booked_api.py

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from app_v2.customer_booking.services.reservation_booked_service import (
    ReservationBookedService,
    ReservationBookedViewDTO,
)

router = APIRouter(
    prefix="/reservations/booked",
    tags=["customer_reservations_booked"],
)


# ---- Service Provider ----
def get_reservation_booked_service() -> ReservationBookedService:
    """
    ReservationBookedService を DI するための Provider。
    NotificationDomain の依存を内部で解決するので、
    ここでは単純なインスタンス化で OK。
    """
    return ReservationBookedService()


# ---- GET /reservations/booked?reservation_id=xxx ----
@router.get(
    "",
    response_model=ReservationBookedViewDTO,
    summary="予約済み 1 件分の詳細（自動送信メッセージつき）を取得する",
)
def get_booked_reservation(
    reservation_id: int = Query(..., gt=0, description="対象となる予約ID"),
    service: ReservationBookedService = Depends(get_reservation_booked_service),
) -> ReservationBookedViewDTO:
    """
    ReservationBookedPage（予約確認ページ）用 API。

    - NotificationDomain と同一ロジックで NotificationContextDTO を生成
    - 予約確定テキスト（1通目）
    - キャンセル案内 TemplateMessage（2通目）
    - リマインダー（3通目）
    - event_start / event_end / is_expired / is_expired_for_display
    をまとめて返す。

    ReservationBookedPage.tsx は is_expired_for_display を参照し、
    UI の出し分けを行う。
    """

    result = service.get_view_for_reservation(reservation_id)

    if result is None:
        raise HTTPException(
            status_code=404,
            detail="予約が見つからないか、通知用コンテキストを生成できませんでした。",
        )

    return result
