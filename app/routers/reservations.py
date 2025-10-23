import os
from uuid import uuid4
from datetime import datetime
from typing import Any, Dict, List, Optional, Literal

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Path, Query, Response, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.database import get_db
from app import models, schemas, crud
from app.services.line_notifier import send_reservation_confirmed

router = APIRouter(prefix="/reservations", tags=["reservations"])

# Admin token dependency (maintains existing behavior)
def require_admin_token(x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token")) -> None:
    expected = os.getenv("ADMIN_TOKEN")
    if not expected:
        return
    if x_admin_token != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-Admin-Token",
        )

# Create a new reservation (new method only)
@router.post("/", response_model=schemas.ReservationResponse, summary="Create Reservation", description=(
    "新方式のみ：`item` は袋サイズ（\"5kg\"|\"10kg\"|\"25kg\"|\"30kg\"）、"
    "`quantity` は袋数(>=1)。`price`/`amount` は**サーバ側で農家設定から自動決定**します。"
))
def create_reservation(body: schemas.ReservationCreate = Body(...), db: Session = Depends(get_db)):
    crud.assert_farm_is_active(db, body.farm_id)
    created = crud.create_reservation(db, body)
    return created

# Get list of reservations (includes X-Total-Count header)
@router.get("/", response_model=List[schemas.ReservationResponse], dependencies=[Depends(require_admin_token)])
def read_reservations(
    response: Response,
    farm_id: Optional[int] = Query(None),
    user_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    created_from: Optional[datetime] = Query(None),
    created_to: Optional[datetime] = Query(None),
    limit: Optional[int] = Query(None, ge=1),
    offset: Optional[int] = Query(None, ge=0),
    sort: Optional[str] = Query(None, pattern="^(asc|desc)$"),
    db: Session = Depends(get_db),
):
    total = crud.count_reservations(
        db=db,
        farm_id=farm_id,
        user_id=user_id,
        status=status,
        created_from=created_from,
        created_to=created_to,
    )
    response.headers["X-Total-Count"] = str(total)
    expose = {"X-Total-Count", "X-Limit", "X-Offset"}
    response.headers["Access-Control-Expose-Headers"] = ", ".join(sorted(expose))
    if limit is not None:
        response.headers["X-Limit"] = str(limit)
    if offset is not None:
        response.headers["X-Offset"] = str(offset)
    return crud.list_reservations(
        db=db,
        farm_id=farm_id,
        user_id=user_id,
        status=status,
        limit=limit,
        offset=offset,
        sort=sort,
        created_from=created_from,
        created_to=created_to,
    )

# Summarize reservations (admin only)
@router.get("/summary", dependencies=[Depends(require_admin_token)], summary="Summarize Reservations", description="フィルタ条件に一致する予約の件数・金額合計・ステータス内訳を返します。")
def summarize_reservations(
    farm_id: Optional[int] = Query(None),
    user_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    created_from: Optional[datetime] = Query(None),
    created_to: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    return crud.summarize_reservations(
        db=db,
        farm_id=farm_id,
        user_id=user_id,
        status=status,
        created_from=created_from,
        created_to=created_to,
    )

# Update reservation status (with notification, preserves existing behavior)
@router.put("/{reservation_id}", response_model=schemas.ReservationResponse)
def update_reservation_status(
    reservation_id: int = Path(..., ge=1),
    payload: schemas.ReservationUpdate = None,
    db: Session = Depends(get_db),
):
    if payload is None:
        raise HTTPException(status_code=400, detail="No payload provided")
    if payload.status not in ("pending", "confirmed", "cancelled"):
        raise HTTPException(status_code=400, detail="invalid status")

    current = db.query(models.Reservation).filter(models.Reservation.id == reservation_id).first()
    if current is None:
        raise HTTPException(status_code=404, detail="Reservation not found")
    prev_status = current.status

    if payload.status == "confirmed":
        crud.assert_farm_is_active(db, current.farm_id)

    updated = crud.update_reservation_status(db, reservation_id, payload.status)
    if not updated:
        raise HTTPException(status_code=404, detail="Reservation not found")

    # Send LINE notification on reservation confirmation (ignore failures)
    try:
        if prev_status != "confirmed" and updated.status == "confirmed":
            user = db.query(models.User).filter(models.User.id == updated.user_id).first()
            farm = db.query(models.Farm).filter(models.Farm.id == updated.farm_id).first()
            user_line_id = getattr(user, "line_user_id", None)
            farm_name = farm.name if farm else ""
            pickup_location = getattr(farm, "pickup_location", None) if farm else None
            pickup_time = getattr(farm, "pickup_time", None) if farm else None
            send_reservation_confirmed(
                user_line_id=user_line_id,
                farm_name=farm_name,
                quantity=updated.quantity,
                price=updated.price,
                pickup_location=pickup_location,
                pickup_time=pickup_time,
            )
    except Exception:
        pass

    return updated

# Data models for bulk operations
class BulkItem(BaseModel):
    item: Literal["5kg", "10kg", "25kg", "30kg"]
    quantity: int = Field(..., ge=1)

class BulkReservationRequest(BaseModel):
    user_id: int
    farm_id: int
    items: List[BulkItem]
    client_order_id: Optional[str] = None

    # ✅ v2対応（変更箇所）
    @field_validator("items")
    @classmethod
    def _not_empty(cls, v):
        if not v:
            raise ValueError("items は1件以上必須です。")
        return v

class BulkReservationLine(BaseModel):
    reservation_id: int
    item: str
    quantity: int
    price: int
    amount: int
    status: str

class BulkReservationSummary(BaseModel):
    order_id: str
    user_id: int
    farm_id: int
    count: int
    total_quantity: int
    total_amount: int
    lines: List[BulkReservationLine]

class QuantityPatch(BaseModel):
    quantity: int = Field(..., ge=1, description="新しい袋数（1以上）。増量は不可。")

# Bulk create reservations (single order_id for all)
@router.post("/bulk", response_model=BulkReservationSummary, summary="Bulk予約（同一order_idで一括作成）")
def create_reservations_bulk(payload: BulkReservationRequest, db: Session = Depends(get_db)):
    # Validate target farm
    farm = db.query(models.Farm).filter(models.Farm.id == payload.farm_id).first()
    if not farm:
        raise HTTPException(status_code=404, detail="farm not found")
    if not getattr(farm, "active_flag", True):
        raise HTTPException(status_code=409, detail="farm is not accepting reservations (inactive)")

    # Ensure all requested item sizes have a price set
    price_map = {"5kg": "price_5kg", "10kg": "price_10kg", "25kg": "price_25kg", "30kg": "price_30kg"}
    for it in payload.items:
        if getattr(farm, price_map[it.item]) is None:
            raise HTTPException(status_code=400, detail=f"price not set for item={it.item}")

    # Determine order_id (use provided client_order_id or generate UUID4)
    order_id = payload.client_order_id.strip() if payload.client_order_id else str(uuid4())

    created_lines: List[BulkReservationLine] = []
    total_quantity = 0
    total_amount = 0

    try:
        for it in payload.items:
            price = int(getattr(farm, price_map[it.item]))
            qty = int(it.quantity)
            amount = price * qty
            # Create reservation object
            res = models.Reservation(
                user_id=payload.user_id,
                farm_id=payload.farm_id,
                item=it.item,
                quantity=qty,
                price=price,
                amount=amount,
                order_id=order_id,
            )
            db.add(res)
            db.flush()
            # Collect line info
            created_lines.append(BulkReservationLine(
                reservation_id=res.id,
                item=it.item,
                quantity=qty,
                price=price,
                amount=amount,
                status=str(res.status),
            ))
            total_quantity += qty
            total_amount += amount
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"bulk reservation failed: {e}")

    return BulkReservationSummary(
        order_id=order_id,
        user_id=payload.user_id,
        farm_id=payload.farm_id,
        count=len(created_lines),
        total_quantity=total_quantity,
        total_amount=total_amount,
        lines=created_lines,
    )

# Reduce reservation quantity (pending only, decrease only)
@router.patch("/{reservation_id}/quantity", response_model=schemas.ReservationResponse, summary="予約数量の減量（pending限定）", description="pending の予約数量を **減らす** ときだけ許可。price は据え置き、amount は price*quantity に再計算。")
def reduce_reservation_quantity(reservation_id: int, payload: QuantityPatch = Body(...), db: Session = Depends(get_db)):
    res = db.query(models.Reservation).filter(models.Reservation.id == reservation_id).first()
    if not res:
        raise HTTPException(status_code=404, detail="reservation not found")
    if str(res.status) != "pending":
        raise HTTPException(status_code=409, detail="only pending reservations can be modified")

    new_qty = int(payload.quantity)
    old_qty = int(res.quantity)
    if new_qty >= old_qty:
        raise HTTPException(status_code=400, detail="quantity can only be decreased; use a new reservation to increase")

    res.quantity = new_qty
    res.amount = int(res.price) * new_qty
    db.add(res)
    db.commit()
    db.refresh(res)
    return res

# Helper to get price for a given item from a Farm object
def _choose_price(farm: models.Farm, item: str) -> Optional[int]:
    # Map item to farm price field
    col_map = {
        "5kg": getattr(farm, "price_5kg", None),
        "10kg": getattr(farm, "price_10kg", None),
        "25kg": getattr(farm, "price_25kg", None),
        "30kg": getattr(farm, "price_30kg", None),
    }
    return col_map.get(item)

# Bulk create reservations with transaction (all-or-nothing commit)
@router.post("/bulk_tx", summary="Bulk予約（トランザクション版：全件一括コミット）")
def create_bulk_reservations_tx(payload: BulkReservationRequest, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    仕様:
      - 既存 /bulk と同一の入力で受け付ける
      - 全件検証に通ったらトランザクション内で一括作成し、**全件成功時のみコミット**
      - 処理途中で1件でもエラーなら **ロールバック**（DBに何も残しません）
      - price/amount はサーバ側で決定 (status は既定値 pending)
      - active_flag=false の農家は 409 でブロック

    返却:
      - order_id（client_order_id を使用。未指定時は None）
      - lines: 予約ごとの詳細情報 (reservation_id, price, amount, quantity など)
      - totals: 件数および total_quantity, total_amount
    """
    # Validate target farm (404 if not found, 409 if inactive)
    farm: Optional[models.Farm] = db.execute(select(models.Farm).where(models.Farm.id == payload.farm_id)).scalars().first()
    if not farm:
        raise HTTPException(status_code=404, detail="farm not found")
    if getattr(farm, "active_flag", True) is False:
        raise HTTPException(status_code=409, detail="farm is inactive")

    # Validate all items and calculate prices/amounts upfront
    prepared: List[Dict[str, Any]] = []
    for it in payload.items:
        price = _choose_price(farm, it.item)
        if price is None:
            raise HTTPException(status_code=422, detail=f"item '{it.item}' is not sold by this farm")
        amount = int(price) * int(it.quantity)
        prepared.append({
            "user_id": payload.user_id,
            "farm_id": payload.farm_id,
            "item": it.item,
            "quantity": int(it.quantity),
            "price": int(price),
            "amount": int(amount),
            "order_id": payload.client_order_id,  # use same order_id for all
        })

    # Insert all reservations in one transaction
    created_rows: List[models.Reservation] = []
    try:
        for row in prepared:
            r = models.Reservation(
                order_id=row["order_id"],
                user_id=row["user_id"],
                farm_id=row["farm_id"],
                item=row["item"],
                quantity=row["quantity"],
                price=row["price"],
                amount=row["amount"],
            )
            db.add(r)
            db.flush()
            created_rows.append(r)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"bulk_tx failed: {e}")

    # Build response
    lines = []
    for r in created_rows:
        lines.append({
            "reservation_id": r.id,
            "order_id": r.order_id,
            "user_id": r.user_id,
            "farm_id": r.farm_id,
            "item": r.item,
            "quantity": r.quantity,
            "price": r.price,
            "amount": r.amount,
            "status": r.status,
            "created_at": r.created_at.isoformat(timespec="seconds") if isinstance(r.created_at, datetime) else r.created_at,
        })
    totals = {
        "count": len(lines),
        "total_quantity": sum(int(x["quantity"] or 0) for x in lines),
        "total_amount": sum(int(x["amount"] or 0) for x in lines),
    }
    return {"order_id": payload.client_order_id, "lines": lines, "totals": totals}
