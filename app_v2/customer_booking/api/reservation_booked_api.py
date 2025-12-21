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


def get_reservation_booked_service() -> ReservationBookedService:
    return ReservationBookedService()


@router.get(
    "",
    response_model=ReservationBookedViewDTO,
)
def get_booked_reservation(
    reservation_id: int = Query(..., gt=0),
    service: ReservationBookedService = Depends(get_reservation_booked_service),
) -> ReservationBookedViewDTO:
    result = service.get_view_for_reservation(reservation_id)

    if result is None:
        raise HTTPException(
            status_code=404,
            detail="予約が見つかりません。",
        )

    return result
