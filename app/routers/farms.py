# app/routers/farms.py
from typing import List, Literal
from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app import schemas, crud, models

router = APIRouter(prefix="/farms", tags=["farms"])


@router.post("/", response_model=schemas.FarmResponse)
def create_farm(payload: schemas.FarmCreate, db: Session = Depends(get_db)):
    """農家を新規登録"""
    created = crud.create_farm(db, payload)
    return created


@router.get("/", response_model=List[schemas.FarmResponse])
def read_farms(
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0, description="先頭からのスキップ件数"),
    limit: int = Query(100, ge=1, le=1000, description="最大取得件数"),
    sort: Literal["asc", "desc"] = Query("desc", description="id での並び順"),
):
    """
    内部管理用：全農家（active/inactive問わず）
    既定は id の降順（新しい順）で 100 件まで。
    """
    order_col = models.Farm.id.desc() if sort == "desc" else models.Farm.id.asc()
    return (
        db.query(models.Farm)
        .order_by(order_col)
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get("/public", response_model=List[schemas.FarmResponse])
def list_public_active_farms(
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0, description="先頭からのスキップ件数"),
    limit: int = Query(100, ge=1, le=1000, description="最大取得件数"),
    sort: Literal["asc", "desc"] = Query("desc", description="id での並び順"),
):
    """
    一般公開用：active_flag=True の農家のみ
    既定は id の降順（新しい順）で 100 件まで。
    """
    order_col = models.Farm.id.desc() if sort == "desc" else models.Farm.id.asc()
    return (
        db.query(models.Farm)
        .filter(models.Farm.active_flag == True)  # noqa: E712
        .order_by(order_col)
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.put("/{farm_id}", response_model=schemas.FarmResponse)
def update_farm(
    farm_id: int = Path(..., ge=1),
    payload: schemas.FarmUpdate = None,
    db: Session = Depends(get_db),
):
    """部分更新（価格・在庫・受け取り条件・active_flagなど）"""
    if payload is None:
        raise HTTPException(status_code=400, detail="No payload provided")

    updated = crud.update_farm(db, farm_id, payload)
    if updated is None:
        raise HTTPException(status_code=404, detail="Farm not found")
    return updated
