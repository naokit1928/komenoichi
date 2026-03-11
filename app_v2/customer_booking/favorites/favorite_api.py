from fastapi import APIRouter, Request, HTTPException, status
from typing import List
from datetime import datetime

from app_v2.customer_booking.favorites.favorite_repo import FavoriteRepository

# ★ 農家一覧で使っている完成済みの処理をインポート
from app_v2.customer_booking.utils.pickup_time_utils import JST, compute_next_pickup
from app_v2.customer_booking.repository.public_farms_repo import _row_to_entity
from app_v2.customer_booking.services.public_farms_service import (
    _format_next_pickup_display,
    _build_card_dto,
)

router = APIRouter(
    prefix="/api/public/favorites",
    tags=["favorites"],
)

@router.get("", response_model=List[int])
def get_favorites(request: Request):
    consumer_id = request.session.get("consumer_id")
    if not consumer_id:
        return []
    repo = FavoriteRepository()
    return repo.get_favorite_farm_ids(int(consumer_id))

@router.post("/{farm_id}")
def add_favorite(request: Request, farm_id: int):
    consumer_id = request.session.get("consumer_id")
    if not consumer_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    repo = FavoriteRepository()
    repo.add_favorite(int(consumer_id), farm_id)
    return {"ok": True}

@router.delete("/{farm_id}")
def remove_favorite(request: Request, farm_id: int):
    consumer_id = request.session.get("consumer_id")
    if not consumer_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    repo = FavoriteRepository()
    repo.remove_favorite(int(consumer_id), farm_id)
    return {"ok": True}

@router.get("/farms")
def get_favorite_farms(request: Request):
    consumer_id = request.session.get("consumer_id")
    if not consumer_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    
    repo = FavoriteRepository()
    rows = repo.get_favorite_farms_full(int(consumer_id))
    
    now = datetime.now(JST)
    results = []
    
    for row in rows:
        # ★ 農家一覧と全く同じロジックを通してDTOを生成し、画像を文字列URLに変換する
        entity = _row_to_entity(row)
        start_dt, deadline_dt = compute_next_pickup(now, entity.pickup_slot_code)
        display = _format_next_pickup_display(start_dt, entity.pickup_slot_code)
        
        dto = _build_card_dto(entity, start_dt, deadline_dt, display)
        
        # Pydanticモデルを辞書型に変換して追加
        results.append(dto.model_dump() if hasattr(dto, "model_dump") else dto.dict())
        
    return {"farms": results}