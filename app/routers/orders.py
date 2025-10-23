# app/routers/orders.py
from typing import List, Optional, Dict, Any, Tuple, DefaultDict
from datetime import datetime
from collections import defaultdict
import os

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    Response,
    Header,
    status,
    Path,
)
from sqlalchemy.orm import Session
from sqlalchemy import asc, desc, func

from app.database import get_db
from app import models

router = APIRouter(prefix="/orders", tags=["orders"])


# ==== 管理トークン（環境変数 ADMIN_TOKEN 未設定なら無効） ====
def require_admin_token(
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token")
) -> None:
    expected = os.getenv("ADMIN_TOKEN")
    if not expected:
        return
    if x_admin_token != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-Admin-Token",
        )


# ==== 共通ユーティリティ ====
def _amount_or_fallback(price: Optional[int], qty: Optional[int], amount: Optional[int]) -> int:
    if amount is None:
        return int(price or 0) * int(qty or 0)
    return int(amount)


def _to_iso(dt: Optional[datetime]) -> Optional[str]:
    return dt.isoformat() if isinstance(dt, datetime) else None


def _apply_filters(q, farm_id, user_id, status, created_from, created_to):
    if farm_id is not None:
        q = q.filter(models.Reservation.farm_id == farm_id)
    if user_id is not None:
        q = q.filter(models.Reservation.user_id == user_id)
    if status is not None:
        q = q.filter(models.Reservation.status == status)
    if created_from is not None:
        q = q.filter(models.Reservation.created_at >= created_from)
    if created_to is not None:
        q = q.filter(models.Reservation.created_at <= created_to)
    return q


# =========================================
# 一覧：注文（order_id）ごとのサマリ
# =========================================
@router.get(
    "",
    dependencies=[Depends(require_admin_token)],
    summary="List orders (grouped by order_id)",
    description="予約行を order_id で集約し、注文サマリを一覧で返します。",
)
def list_orders(
    response: Response,
    # フィルタ
    farm_id: Optional[int] = Query(None),
    user_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    created_from: Optional[datetime] = Query(None),
    created_to: Optional[datetime] = Query(None),
    # 並び（created_to基準）
    sort: Optional[str] = Query(None, pattern="^(asc|desc)$"),
    db: Session = Depends(get_db),
):
    q = db.query(models.Reservation)
    q = _apply_filters(q, farm_id, user_id, status, created_from, created_to)

    rows: List[models.Reservation] = q.all()

    # order_id -> 行リスト
    buckets: DefaultDict[Optional[str], List[models.Reservation]] = defaultdict(list)
    for r in rows:
        buckets[getattr(r, "order_id", None)].append(r)

    items: List[Dict[str, Any]] = []
    total_orders = 0
    total_quantity = 0
    total_amount = 0

    for oid, rlist in buckets.items():
        if not rlist:
            continue
        total_orders += 1
        any_r = rlist[0]
        count = len(rlist)
        qty = sum(int(x.quantity or 0) for x in rlist)
        amt = sum(_amount_or_fallback(x.price, x.quantity, x.amount) for x in rlist)
        total_quantity += qty
        total_amount += amt
        created_from_o = min(x.created_at for x in rlist if x.created_at)
        created_to_o = max(x.created_at for x in rlist if x.created_at)
        items.append(
            dict(
                order_id=oid,
                user_id=any_r.user_id,
                farm_id=any_r.farm_id,
                count=count,
                total_quantity=qty,
                total_amount=amt,
                created_from=_to_iso(created_from_o),
                created_to=_to_iso(created_to_o),
            )
        )

    reverse = False if sort == "asc" else True
    items.sort(key=lambda x: (x["created_to"] or ""), reverse=reverse)

    response.headers["X-Total-Orders"] = str(total_orders)
    response.headers["X-Total-Quantity"] = str(total_quantity)
    response.headers["X-Total-Amount"] = str(total_amount)
    response.headers["Access-Control-Expose-Headers"] = "X-Total-Orders, X-Total-Quantity, X-Total-Amount"

    return items


# =========================================
# 新規：注文サマリーAPI（期間/各種フィルタ）
# ※ 静的パスは動的パスより上に定義（/summary を優先）
# =========================================
@router.get(
    "/summary",
    dependencies=[Depends(require_admin_token)],
    summary="Orders summary (period totals)",
    description=(
        "注文（order単位）の集計を返します。"
        "count=注文数（distinct order_id）、total_quantity/total_amount=全予約行の合算。"
        "by_status は予約行ベースの件数集計です（互換性優先）。"
    ),
)
def orders_summary(
    response: Response,
    farm_id: Optional[int] = Query(None),
    user_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    created_from: Optional[datetime] = Query(None),
    created_to: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
):
    base = db.query(models.Reservation)
    base = _apply_filters(base, farm_id, user_id, status, created_from, created_to)

    # order_id が NULL でないものを distinct で数える
    order_ids = (
        base.filter(models.Reservation.order_id.isnot(None))
        .with_entities(models.Reservation.order_id)
        .distinct()
        .all()
    )
    orders_count = len(order_ids)

    rows = base.all()
    total_quantity = sum(int(r.quantity or 0) for r in rows)
    total_amount = sum(_amount_or_fallback(r.price, r.quantity, r.amount) for r in rows)

    # by_status（予約行の件数）
    by_status: Dict[str, int] = {}
    for s, c in (
        db.query(models.Reservation.status, func.count(models.Reservation.id))
        .select_from(models.Reservation)
        .filter(models.Reservation.id.in_([r.id for r in rows]) if rows else True)
        .group_by(models.Reservation.status)
        .all()
    ):
        by_status[str(s)] = int(c)

    response.headers["X-Total-Orders"] = str(orders_count)
    response.headers["X-Total-Quantity"] = str(total_quantity)
    response.headers["X-Total-Amount"] = str(total_amount)
    response.headers["Access-Control-Expose-Headers"] = "X-Total-Orders, X-Total-Quantity, X-Total-Amount"

    return dict(
        count=orders_count,
        total_quantity=total_quantity,
        total_amount=total_amount,
        by_status=by_status,
    )


# =========================================
# 詳細：注文単位（order_id）のサマリ＋行明細
# ※ 動的パスは最後に定義
# =========================================
@router.get(
    "/{order_id}",
    dependencies=[Depends(require_admin_token)],
    summary="Get single order",
    description="指定した order_id のサマリと行明細を返します。",
)
def get_order(
    order_id: str = Path(..., min_length=1),  # ← 正規表現は使わない（順序で衝突回避）
    db: Session = Depends(get_db),
):
    q = db.query(models.Reservation).filter(models.Reservation.order_id == order_id)
    rows: List[models.Reservation] = q.all()
    if not rows:
        raise HTTPException(status_code=404, detail="order not found")

    qty = sum(int(x.quantity or 0) for x in rows)
    amt = sum(_amount_or_fallback(x.price, x.quantity, x.amount) for x in rows)
    created_from_o = min(x.created_at for x in rows if x.created_at)
    created_to_o = max(x.created_at for x in rows if x.created_at)

    summary = dict(
        order_id=order_id,
        user_id=rows[0].user_id,
        farm_id=rows[0].farm_id,
        count=len(rows),
        total_quantity=qty,
        total_amount=amt,
        created_from=_to_iso(created_from_o),
        created_to=_to_iso(created_to_o),
    )

    lines = [
        dict(
            reservation_id=r.id,
            item=r.item,
            quantity=r.quantity,
            price=r.price,
            amount=_amount_or_fallback(r.price, r.quantity, r.amount),
            status=r.status,
            created_at=_to_iso(r.created_at),
        )
        for r in sorted(rows, key=lambda x: (x.created_at, x.id))
    ]

    return {"summary": summary, "lines": lines}
