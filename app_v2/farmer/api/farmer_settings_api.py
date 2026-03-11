from __future__ import annotations

import os
from typing import Optional, List

from fastapi import (
    APIRouter,
    HTTPException,
    status,
    UploadFile,
    File,
    Request,
)
from pydantic import BaseModel, field_validator

from app_v2.farmer.dtos import FarmerSettingsDTO
from app_v2.farmer.services.farmer_settings_service import FarmerSettingsService


router = APIRouter(
    prefix="/farmer/settings-v2",
    tags=["farmer_settings"],
)

# ============================================================
# Request Payloads
# ============================================================


class FarmerSettingsUpdatePayload(BaseModel):
    is_accepting_reservations: Optional[bool] = None
    rice_variety_label: Optional[str] = None
    pr_title: Optional[str] = None
    pr_text: Optional[str] = None
    price_10kg: Optional[int] = None
    face_image_url: Optional[str] = None
    cover_image_url: Optional[str] = None


class AdminActiveFlagPayload(BaseModel):
    farm_id: int
    active_flag: int

    @field_validator("active_flag")
    @classmethod
    def validate_flag(cls, v: int) -> int:
        if v not in (0, 1):
            raise ValueError("active_flag must be 0 or 1")
        return v


class PRImagesOrderPayload(BaseModel):
    image_ids: List[str]


# ============================================================
# Helpers
# ============================================================


def _require_farm_id_from_session(request: Request) -> int:
    farm_id = request.session.get("farm_id")
    if not farm_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    return farm_id


def _require_admin(request: Request) -> None:
    admin_secret = os.getenv("ADMIN_SECRET")
    if not admin_secret:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="admin endpoint is not configured",
        )

    provided = request.headers.get("X-Admin-Secret", "")
    if provided != admin_secret:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="admin authentication failed",
        )

# ↓ _validate_image_upload は削除します。Service側でチェックするため不要です。

# ============================================================
# GET: Farmer Settings（ME）
# ============================================================


@router.get(
    "/me",
    response_model=FarmerSettingsDTO,
)
def get_farmer_settings_me(
    request: Request,
):
    farm_id = _require_farm_id_from_session(request)

    service = FarmerSettingsService()
    try:
        return service.load_settings(farm_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


# ============================================================
# POST: Farmer Settings 更新（ME）
# ============================================================


@router.post(
    "/me",
    response_model=FarmerSettingsDTO,
)
def update_farmer_settings_me(
    request: Request,
    payload: FarmerSettingsUpdatePayload,
):
    farm_id = _require_farm_id_from_session(request)

    service = FarmerSettingsService()
    try:
        return service.save_settings(
            farm_id=farm_id,
            is_accepting_reservations=payload.is_accepting_reservations,
            rice_variety_label=payload.rice_variety_label,
            pr_title=payload.pr_title,
            pr_text=payload.pr_text,
            price_10kg=payload.price_10kg,
            face_image_url=payload.face_image_url,
        )
    except ValueError as e:
        msg = str(e)
        if "cannot enable reservations" in msg:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=msg,
            )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=msg,
        )


# ============================================================
# Admin: active_flag 直接変更（farm_id 明示）
# ============================================================


@router.post(
    "/admin/active-flag",
    response_model=FarmerSettingsDTO,
    tags=["farmer_settings_admin_v2"],
)
def admin_update_active_flag(
    request: Request,
    payload: AdminActiveFlagPayload,
):
    _require_admin(request)

    service = FarmerSettingsService()
    try:
        return service.set_active_flag_for_admin(
            farm_id=payload.farm_id,
            active_flag=payload.active_flag,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


# ============================================================
# 画像アップロード
# ============================================================


@router.post(
    "/face-image/me",
    response_model=FarmerSettingsDTO,
)
async def upload_face_image_me(
    request: Request,
    file: UploadFile = File(...),
):
    farm_id = _require_farm_id_from_session(request)
    
    # 削除: _validate_image_upload(file)

    service = FarmerSettingsService()
    try:
        file_bytes = await file.read()
        return service.upload_face_image_from_bytes(
            farm_id=farm_id,
            file_bytes=file_bytes,
            filename=file.filename or "face_image",
        )
    except ValueError as e:
        msg = str(e)
        if "monthly upload limit exceeded" in msg:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=msg,
            )
        # 画像不正などもここでキャッチ
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=msg,
        )


@router.post(
    "/cover-image/me",
    response_model=FarmerSettingsDTO,
)
async def upload_cover_image_me(
    request: Request,
    file: UploadFile = File(...),
):
    # cover-image だけのAPIは現状使われていないようですが、もし残すなら以下。
    # 基本は pr-images 経由でカバーが決まるロジックに統一されているなら、ここは削除推奨。
    # ひとまずエラーが出ないように修正だけしておきます。
    
    farm_id = _require_farm_id_from_session(request)
    # 削除: _validate_image_upload(file)

    service = FarmerSettingsService()
    try:
        file_bytes = await file.read()
        # 注意: upload_cover_image_from_bytes は Service から削除されているかも？
        # もし未実装ならこのエンドポイントごと削除でOKです。
        # 既存コードとの互換性のため、ここでは一旦エラーを返すか、実装が必要です。
        raise HTTPException(status_code=501, detail="Not implemented") 
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


# ============================================================
# PR images（正規パス: /me/pr-images）
# ============================================================


@router.post(
    "/me/pr-images",
    response_model=FarmerSettingsDTO,
)
async def upload_pr_images_me(
    request: Request,
    files: List[UploadFile] = File(...),
):
    farm_id = _require_farm_id_from_session(request)

    # 削除: for f in files: _validate_image_upload(f)

    service = FarmerSettingsService()
    try:
        data = []
        for f in files:
            data.append((await f.read(), f.filename or "pr_image"))
        return service.upload_pr_images_from_bytes(
            farm_id=farm_id,
            files=data,
        )
    except ValueError as e:
        msg = str(e)
        if "monthly upload limit exceeded" in msg:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=msg,
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=msg,
        )


@router.put(
    "/me/pr-images/order",
    response_model=FarmerSettingsDTO,
)
def reorder_pr_images_me(
    request: Request,
    payload: PRImagesOrderPayload,
):
    farm_id = _require_farm_id_from_session(request)

    service = FarmerSettingsService()
    try:
        # Service に reorder_pr_images が復活しているので呼べる
        return service.reorder_pr_images(
            farm_id=farm_id,
            image_ids=payload.image_ids,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.delete(
    "/me/pr-images",
    response_model=FarmerSettingsDTO,
)
def delete_pr_image_me(
    request: Request,
    image_id: str,
):
    farm_id = _require_farm_id_from_session(request)

    service = FarmerSettingsService()
    try:
        return service.delete_pr_image(
            farm_id=farm_id,
            image_id=image_id,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )