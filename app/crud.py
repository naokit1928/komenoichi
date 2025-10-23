# app/crud.py
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from typing import Optional, List, Dict, Any, Iterable
from datetime import datetime
from sqlalchemy import func, case
from . import models, schemas

# ----------------------------
# Users
# ----------------------------
def create_user(db: Session, user: schemas.UserCreate):
    data = user.model_dump(exclude_none=True)
    db_user = models.User(**data)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def get_users(db: Session, skip: int = 0, limit: int = 10):
    return db.query(models.User).offset(skip).limit(limit).all()


# ----------------------------
# Farms（4サイズ価格・owner_user_id 対応）
# ----------------------------
def _assign_if_hasattr(obj, field: str, value):
    """models.Farm にフィールドが存在する時だけ安全に代入"""
    if hasattr(obj, field):
        setattr(obj, field, value)

def _asdict_if_has_fields(obj, fields: Dict[str, Any]) -> Dict[str, Any]:
    """models.Farm に存在するフィールドのみ dict に詰める"""
    data = {}
    for k, v in fields.items():
        if hasattr(models.Farm, k) and v is not None:
            data[k] = v
    return data

def create_farm(db: Session, farm: schemas.FarmCreate):
    """
    - 価格は 5/10/25/30kg のいずれか1つ以上が必須（schemas 側で検証済）
    - APIでは owner_user_id を受け取り、DBの user_id に保存
    - モデルに price_5kg/25kg/30kg が未導入でも、存在する項目だけ安全に保存
      （price_10kg / 旧 price_20kg はそのまま利用可能）
    """
    # API -> DB フィールド変換
    price_map = {
        "price_5kg": farm.price_5kg,
        "price_10kg": farm.price_10kg,
        "price_25kg": farm.price_25kg,
        "price_30kg": farm.price_30kg,
    }
    base_kwargs = dict(
        name=farm.name,
        postal_code=farm.postal_code,
        stock=farm.stock,
        pickup_location=farm.pickup_location,
        pickup_time=farm.pickup_time,
        description=farm.description,
        active_flag=farm.active_flag,
        user_id=farm.owner_user_id,  # ← APIの owner_user_id を DBの user_id へ
    )

    # 価格フィールドはモデルにあるものだけ安全に設定
    base_kwargs.update(_asdict_if_has_fields(models.Farm, price_map))

    # 旧スキーマ互換（price_25kg が未導入で price_20kg がある場合）
    if not hasattr(models.Farm, "price_25kg") and hasattr(models.Farm, "price_20kg"):
        # 25kg 価格が指定されており、旧フィールドがあるならそこへ保存
        if farm.price_25kg is not None:
            base_kwargs["price_20kg"] = farm.price_25kg
        # 10kg はそのまま
        if farm.price_10kg is not None:
            base_kwargs["price_10kg"] = farm.price_10kg

    db_farm = models.Farm(**base_kwargs)
    db.add(db_farm)
    db.commit()
    db.refresh(db_farm)
    return db_farm


def get_farms(db: Session, skip: int = 0, limit: int = 10):
    return db.query(models.Farm).offset(skip).limit(limit).all()


def list_public_farms_only_active(db: Session):
    """active_flag=True の農家だけを返す（公開用）"""
    return (
        db.query(models.Farm)
        .filter(models.Farm.active_flag == True)
        .order_by(models.Farm.name.asc())
        .all()
    )


def get_farm_by_id(db: Session, farm_id: int):
    return db.query(models.Farm).filter(models.Farm.id == farm_id).first()


def update_farm(db: Session, farm_id: int, payload):
    """
    Farm を部分更新。
    - APIは price_5kg/10kg/25kg/30kg を任意更新（>0）。
    - モデル側にフィールドが無い項目は無視（導入前互換）。
    - owner_user_id の更新は受け付けない（運用上固定想定）。
    """
    farm = db.query(models.Farm).filter(models.Farm.id == farm_id).first()
    if farm is None:
        return None

    if hasattr(payload, "model_dump"):
        data = payload.model_dump(exclude_unset=True, exclude_none=True)
    elif isinstance(payload, dict):
        data = {k: v for k, v in payload.items() if v is not None}
    else:
        data = {}

    # 一般項目
    updatable_common = {
        "name", "description", "postal_code",
        "stock", "pickup_location", "pickup_time",
        "active_flag",
    }
    for k in list(data.keys()):
        if k in updatable_common:
            setattr(farm, k, data[k])

    # 価格項目（存在チェック）
    for price_field in ("price_5kg", "price_10kg", "price_25kg", "price_30kg"):
        if price_field in data and hasattr(models.Farm, price_field):
            setattr(farm, price_field, data[price_field])

    # 旧スキーマ互換（price_25kg 無し / price_20kg あり）
    if "price_25kg" in data and not hasattr(models.Farm, "price_25kg") and hasattr(models.Farm, "price_20kg"):
        setattr(farm, "price_20kg", data["price_25kg"])
    if "price_10kg" in data and hasattr(models.Farm, "price_10kg"):
        setattr(farm, "price_10kg", data["price_10kg"])

    db.commit()
    db.refresh(farm)
    return farm


def assert_farm_is_active(db: Session, farm_id: int) -> None:
    """受付停止中（active_flag=False）の農家に対して新規予約や確定操作を弾く"""
    farm = get_farm_by_id(db, farm_id)
    if farm is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm not found")
    if not farm.active_flag:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This farm is currently not accepting reservations (inactive).",
        )


# ----------------------------
# Reservations（新方式に一本化）
# ----------------------------
def _explicit_price_or_400(farm: models.Farm, item: str) -> float:
    """
    線形補間なし。設定されていないサイズは 400 を返す。
    優先順：新カラム → 旧カラム（25kgのみ price_20kg 互換）
    """
    if farm is None:
        raise HTTPException(status_code=404, detail="Farm not found")

    def _get(field: str):
        return getattr(farm, field) if hasattr(farm, field) else None

    if item == "5kg":
        price = _get("price_5kg")
        if price is None:
            raise HTTPException(status_code=400, detail="This farm does not sell 5kg.")
        return float(price)

    if item == "10kg":
        price = _get("price_10kg")
        if price is None:
            raise HTTPException(status_code=400, detail="This farm does not sell 10kg.")
        return float(price)

    if item == "25kg":
        # 新: price_25kg / 旧: price_20kg（互換）
        price = _get("price_25kg")
        if price is None:
            price = _get("price_20kg")
        if price is None:
            raise HTTPException(status_code=400, detail="This farm does not sell 25kg.")
        return float(price)

    if item == "30kg":
        price = _get("price_30kg")
        if price is None:
            raise HTTPException(status_code=400, detail="This farm does not sell 30kg.")
        return float(price)

    raise HTTPException(status_code=400, detail=f"unsupported item: {item}")


def create_reservation(db: Session, reservation: schemas.ReservationCreate):
    """
    - reservation.item: "5kg"|"10kg"|"25kg"|"30kg"
    - reservation.quantity: 袋数(>=1)
    - price は農家の設定から **必ず**決定（リクエストで受けない）
    - status は "pending" 固定で新規作成
    - **amount は price * quantity を予約作成時に保存**
    """
    # 必要な主体の存在
    farm = get_farm_by_id(db, reservation.farm_id)
    if farm is None:
        raise HTTPException(status_code=404, detail="Farm not found")
    user = db.query(models.User).filter(models.User.id == reservation.user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    # 受付停止中チェック
    assert_farm_is_active(db, reservation.farm_id)

    # 線形補間なし：未設定サイズは 400
    price = _explicit_price_or_400(farm, reservation.item)

    # 予約時点で金額を確定
    amount = float(price) * int(reservation.quantity)

    db_reservation = models.Reservation(
        user_id=reservation.user_id,
        farm_id=reservation.farm_id,
        item=reservation.item,
        quantity=reservation.quantity,
        price=price,
        amount=amount,  # ← 追加
        status="pending",
        created_at=datetime.utcnow(),
    )
    db.add(db_reservation)
    db.commit()
    db.refresh(db_reservation)
    return db_reservation


def get_reservations(db: Session, skip: int = 0, limit: int = 10):
    return db.query(models.Reservation).offset(skip).limit(limit).all()


def get_reservation_by_id(db: Session, reservation_id: int):
    return db.query(models.Reservation).filter(models.Reservation.id == reservation_id).first()


# --- 予約一覧（本体） ---
def list_reservations(
    db: Session,
    farm_id: Optional[int] = None,
    user_id: Optional[int] = None,
    status: Optional[str] = None,             # pending / confirmed / cancelled
    limit: Optional[int] = None,
    offset: Optional[int] = None,
    sort: Optional[str] = None,               # "asc" | "desc"（未指定は desc）
    created_from: Optional[datetime] = None,  # この日時以降
    created_to: Optional[datetime] = None,    # この日時以前
) -> List[models.Reservation]:
    """
    予約一覧を取得（既存仕様を維持）。
    """
    q = db.query(models.Reservation)

    if farm_id is not None:
        q = q.filter(models.Reservation.farm_id == farm_id)

    if user_id is not None:
        q = q.filter(models.Reservation.user_id == user_id)

    if status is not None:
        q = q.filter(models.Reservation.status == status)

    # 日付レンジ
    if created_from is not None and hasattr(models.Reservation, "created_at"):
        q = q.filter(models.Reservation.created_at >= created_from)

    if created_to is not None and hasattr(models.Reservation, "created_at"):
        q = q.filter(models.Reservation.created_at <= created_to)

    # 並び順（デフォルトは desc）
    sort_dir = (sort or "desc").lower()
    is_asc = sort_dir == "asc"

    if hasattr(models.Reservation, "created_at"):
        q = q.order_by(models.Reservation.created_at.asc() if is_asc else models.Reservation.created_at.desc())
    else:
        q = q.order_by(models.Reservation.id.asc() if is_asc else models.Reservation.id.desc())

    # ページネーション（任意）
    if offset is not None:
        q = q.offset(max(0, int(offset)))
    if limit is not None:
        q = q.limit(max(0, int(limit)))

    return q.all()


# --- 追加: 総件数（ページネーション情報用） ---
def count_reservations(
    db: Session,
    farm_id: Optional[int] = None,
    user_id: Optional[int] = None,
    status: Optional[str] = None,
    created_from: Optional[datetime] = None,
    created_to: Optional[datetime] = None,
) -> int:
    """
    list_reservations と同じフィルタ条件で「総件数のみ」を返す。
    limit / offset / sort は無関係。
    """
    q = db.query(models.Reservation)

    if farm_id is not None:
        q = q.filter(models.Reservation.farm_id == farm_id)

    if user_id is not None:
        q = q.filter(models.Reservation.user_id == user_id)

    if status is not None:
        q = q.filter(models.Reservation.status == status)

    if created_from is not None and hasattr(models.Reservation, "created_at"):
        q = q.filter(models.Reservation.created_at >= created_from)

    if created_to is not None and hasattr(models.Reservation, "created_at"):
        q = q.filter(models.Reservation.created_at <= created_to)

    return q.count()


def update_reservation_status(db: Session, reservation_id: int, status: str):
    """予約の状態を更新する（pending / confirmed / cancelled）"""
    db_reservation = (
        db.query(models.Reservation)
        .filter(models.Reservation.id == reservation_id)
        .first()
    )
    if db_reservation is None:
        return None
    db_reservation.status = status
    db.commit()
    db.refresh(db_reservation)
    return db_reservation


# --- 追加: 集計API用サマリ ---
def summarize_reservations(
    db: Session,
    farm_id: Optional[int] = None,
    user_id: Optional[int] = None,
    status: Optional[str] = None,             # pending / confirmed / cancelled
    created_from: Optional[datetime] = None,  # この日時以降（UTC）
    created_to: Optional[datetime] = None,    # この日時以前（UTC）
) -> Dict:
    """
    予約をフィルタして集計結果を返す。
    - total_amount は Reservation.amount があれば合計、無ければ None
    """
    q = db.query(models.Reservation)

    # 同一フィルタ（AND 条件）
    if farm_id is not None:
        q = q.filter(models.Reservation.farm_id == farm_id)
    if user_id is not None:
        q = q.filter(models.Reservation.user_id == user_id)
    if status is not None:
        q = q.filter(models.Reservation.status == status)

    if created_from is not None and hasattr(models.Reservation, "created_at"):
        q = q.filter(models.Reservation.created_at >= created_from)
    if created_to is not None and hasattr(models.Reservation, "created_at"):
        q = q.filter(models.Reservation.created_at <= created_to)

    # カラム存在チェック（amount は任意）
    amount_col = getattr(models.Reservation, "amount", None)

    # 集計式
    total_count_expr = func.count(models.Reservation.id)
    pending_expr = func.coalesce(
        func.sum(case((models.Reservation.status == "pending", 1), else_=0)),
        0
    )
    confirmed_expr = func.coalesce(
        func.sum(case((models.Reservation.status == "confirmed", 1), else_=0)),
        0
    )
    cancelled_expr = func.coalesce(
        func.sum(case((models.Reservation.status == "cancelled", 1), else_=0)),
        0
    )

    columns = [total_count_expr, pending_expr, confirmed_expr, cancelled_expr]

    if amount_col is not None:
        total_amount_expr = func.coalesce(func.sum(amount_col), 0)
        columns.append(total_amount_expr)
        total_count, pending, confirmed, cancelled, total_amount = q.with_entities(*columns).one()
    else:
        total_count, pending, confirmed, cancelled = q.with_entities(*columns).one()
        total_amount = None

    return {
        "count": int(total_count or 0),
        "total_amount": total_amount if amount_col is not None else None,
        "by_status": {
            "pending": int(pending or 0),
            "confirmed": int(confirmed or 0),
            "cancelled": int(cancelled or 0),
        },
    }


# --- 追加: エクスポート用イテレータ ---
def iter_reservations_for_export(
    db: Session,
    farm_id: Optional[int] = None,
    user_id: Optional[int] = None,
    status: Optional[str] = None,             # pending / confirmed / cancelled
    created_from: Optional[datetime] = None,  # UTC
    created_to: Optional[datetime] = None,    # UTC
    sort: Optional[str] = None,               # "asc" | "desc"（未指定は desc）
) -> Iterable[Dict[str, Any]]:
    """
    CSV/HTML ストリーム用に、一覧と同一フィルタで Reservation レコードを順次返す。
    - 返す dict のキーは固定（列が存在しない場合は None をセット）
    """
    q = db.query(models.Reservation)

    # フィルタ（一覧APIと同一）
    if farm_id is not None:
        q = q.filter(models.Reservation.farm_id == farm_id)
    if user_id is not None:
        q = q.filter(models.Reservation.user_id == user_id)
    if status is not None:
        q = q.filter(models.Reservation.status == status)
    if created_from is not None and hasattr(models.Reservation, "created_at"):
        q = q.filter(models.Reservation.created_at >= created_from)
    if created_to is not None and hasattr(models.Reservation, "created_at"):
        q = q.filter(models.Reservation.created_at <= created_to)

    # 並び順（既定: desc = 新しい順）
    sort_dir = (sort or "desc").lower()
    is_asc = sort_dir == "asc"
    if hasattr(models.Reservation, "created_at"):
        q = q.order_by(models.Reservation.created_at.asc() if is_asc else models.Reservation.created_at.desc())
    else:
        q = q.order_by(models.Reservation.id.asc() if is_asc else models.Reservation.id.desc())

    # 取得（メモリ効率のため適度にバッチ取得）
    for r in q.yield_per(500):
        created_at = getattr(r, "created_at", None)
        price = getattr(r, "price", None)
        amount = getattr(r, "amount", None)
        item = getattr(r, "item", None)
        yield {
            "id": r.id,
            "user_id": r.user_id,
            "farm_id": r.farm_id,
            "status": r.status,
            "item": item,
            "quantity": r.quantity,
            "price": price,
            "amount": amount,
            "created_at": created_at,
        }
