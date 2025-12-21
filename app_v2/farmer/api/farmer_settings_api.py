from __future__ import annotations

from typing import Optional, List

from fastapi import (
    APIRouter,
    HTTPException,
    status,
    UploadFile,
    File,
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
    """
    農家本人が編集できる可変情報のみ。
    registration 由来の固定情報は含めない。
    """

    farm_id: int

    is_accepting_reservations: Optional[bool] = None
    rice_variety_label: Optional[str] = None
    pr_title: Optional[str] = None
    pr_text: Optional[str] = None
    price_10kg: Optional[int] = None
    face_image_url: Optional[str] = None
    cover_image_url: Optional[str] = None


class AdminActiveFlagPayload(BaseModel):
    """
    運営専用。
    農家 BAN / BAN解除 用。
    """

    farm_id: int
    active_flag: int

    @field_validator("active_flag")
    @classmethod
    def validate_flag(cls, v: int) -> int:
        if v not in (0, 1):
            raise ValueError("active_flag must be 0 or 1")
        return v


class PRImagesOrderPayload(BaseModel):
    """
    PR画像の並び順更新用。
    """
    image_ids: List[str]


# ============================================================
# GET: Farmer Settings
# ============================================================


@router.get("", response_model=FarmerSettingsDTO)
def get_farmer_settings(
    farm_id: int,
):
    """
    Farmer Settings v2 - GET

    - 農家 UI / 管理 UI 共通
    - 公開可否判定（missing_fields 等）も含む
    """
    service = FarmerSettingsService()
    try:
        return service.load_settings(farm_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


# ============================================================
# POST: Farmer Settings 更新（農家用）
# ============================================================


@router.post("", response_model=FarmerSettingsDTO)
def update_farmer_settings(
    payload: FarmerSettingsUpdatePayload,
):
    """
    Farmer Settings v2 - POST

    - 農家本人が操作する編集 API
    - active_flag は変更不可
    """
    service = FarmerSettingsService()
    try:
        return service.save_settings(
            farm_id=payload.farm_id,
            is_accepting_reservations=payload.is_accepting_reservations,
            rice_variety_label=payload.rice_variety_label,
            pr_title=payload.pr_title,
            pr_text=payload.pr_text,
            price_10kg=payload.price_10kg,
            face_image_url=payload.face_image_url,
            # NOTE:
            # cover_image_url は「PR画像先頭=カバー」という運用に寄せるなら、
            # save_settings 側で算出・保存するのが筋（API からは渡さない）。
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


# ============================================================
# Admin: active_flag 直接変更
# ============================================================


@router.post(
    "/admin/active-flag",
    response_model=FarmerSettingsDTO,
    tags=["farmer_settings_admin_v2"],
)
def admin_update_active_flag(
    payload: AdminActiveFlagPayload,
):
    """
    運営専用 API。

    - BAN / BAN解除
    - BAN 時は is_accepting_reservations も自動で false
    """
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
# 画像アップロード（顔 / カバー）
# ============================================================


@router.post(
    "/face-image",
    response_model=FarmerSettingsDTO,
)
async def upload_face_image(
    farm_id: int,
    file: UploadFile = File(...),
):
    """
    顔写真アップロード（multipart/form-data）
    """
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
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=msg,
        )


@router.post(
    "/cover-image",
    response_model=FarmerSettingsDTO,
)
async def upload_cover_image(
    farm_id: int,
    file: UploadFile = File(...),
):
    """
    カバー画像アップロード（multipart/form-data）
    """
    service = FarmerSettingsService()
    try:
        file_bytes = await file.read()
        return service.upload_cover_image_from_bytes(
            farm_id=farm_id,
            file_bytes=file_bytes,
            filename=file.filename or "cover_image",
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


@router.post(
    "/pr-images",
    response_model=FarmerSettingsDTO,
)
async def upload_pr_images(
    farm_id: int,
    files: List[UploadFile] = File(...),
):
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
    "/pr-images/order",
    response_model=FarmerSettingsDTO,
)
def reorder_pr_images(
    farm_id: int,
    payload: PRImagesOrderPayload,
):
    service = FarmerSettingsService()
    try:
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
    "/pr-images",
    response_model=FarmerSettingsDTO,
)
def delete_pr_image(
    farm_id: int,
    image_id: str,
):
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
