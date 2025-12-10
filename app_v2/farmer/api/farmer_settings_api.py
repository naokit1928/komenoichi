# app_v2/farmer/api/farmer_settings_api.py
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
from app_v2.farmer.services.farmer_settings_service import (
    FarmerSettingsService,
)

router = APIRouter(
    prefix="/farmer/settings-v2",
    tags=["farmer_settings_v2"],
)

# ============================================================
# Request Payloads
# ============================================================


class FarmerSettingsUpdatePayload(BaseModel):
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
    運営専用：BAN / BAN解除を行うための payload。
    Swagger 上ではここから active_flag を 0/1 切り替えできる。
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
    PR画像の並び順更新用 payload
    """

    image_ids: List[str]


# ============================================================
# GET Farmer Settings
# ============================================================


@router.get("", response_model=FarmerSettingsDTO)
def get_farmer_settings(
    farm_id: int,
):
    """
    Farmer Settings v2 - GET

    - 農家 UI / 運営 UI 双方から利用
    - active_flag / is_ready_to_publish / missing_fields なども確認可能
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
# POST Farmer Settings (farmer 用)
# ============================================================


@router.post("", response_model=FarmerSettingsDTO)
def update_farmer_settings(
    payload: FarmerSettingsUpdatePayload,
):
    """
    Farmer Settings v2 - POST

    - 農家側が操作する公開設定用
    - active_flag はここからは変更できない（BAN操作は admin 専用）
    """
    service = FarmerSettingsService()
    try:
        dto = service.save_settings(
            farm_id=payload.farm_id,
            is_accepting_reservations=payload.is_accepting_reservations,
            rice_variety_label=payload.rice_variety_label,
            pr_title=payload.pr_title,
            pr_text=payload.pr_text,
            price_10kg=payload.price_10kg,
            face_image_url=payload.face_image_url,
            cover_image_url=payload.cover_image_url,
        )
        return dto
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


# ============================================================
# Admin: active_flag を直接変更（BAN / BAN解除）
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
    運営専用エンドポイント。

    - active_flag を 0/1 に設定
    - BAN(0) にした場合は is_accepting_reservations も自動的に False へ
    - レスポンスは FarmerSettingsDTO（active_flag / is_accepting_reservations / missing_fields など）
    """
    service = FarmerSettingsService()
    try:
        dto = service.set_active_flag_for_admin(
            farm_id=payload.farm_id,
            active_flag=payload.active_flag,
        )
        return dto
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


# ============================================================
# 画像アップロード（顔 / カバー） v2
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
    顔写真アップロード v2

    - multipart/form-data で file を受け取り、
      Cloudinary にアップロード
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
            # 月次アップロード上限超え
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=msg,
            )
        if "not found" in msg:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
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
    カバー画像アップロード v2
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
        if "not found" in msg:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=msg,
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=msg,
        )


# ============================================================
# PR画像（複数アップロード / 並び替え / 削除） v2
# ============================================================


@router.post(
    "/pr-images",
    response_model=FarmerSettingsDTO,
)
async def upload_pr_images(
    farm_id: int,
    files: List[UploadFile] = File(...),
):
    """
    PR画像を複数枚アップロードするエンドポイント。

    - フロント側では FormData に files を複数 append 済み。
    """
    service = FarmerSettingsService()
    try:
        # (bytes, filename) のリストに変換
        file_tuples = []
        for f in files:
            content = await f.read()
            file_tuples.append((content, f.filename or "pr_image"))

        return service.upload_pr_images_from_bytes(
            farm_id=farm_id,
            files=file_tuples,
        )
    except ValueError as e:
        msg = str(e)
        if "monthly upload limit exceeded" in msg:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=msg,
            )
        if "not found" in msg:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
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
def update_pr_images_order(
    farm_id: int,
    payload: PRImagesOrderPayload,
):
    """
    PR画像の並び順(order)を更新するエンドポイント。
    """
    service = FarmerSettingsService()
    try:
        return service.reorder_pr_images(
            farm_id=farm_id,
            image_ids=payload.image_ids,
        )
    except ValueError as e:
        msg = str(e)
        if "not found" in msg:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=msg,
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=msg,
        )


@router.delete(
    "/pr-images",
    response_model=FarmerSettingsDTO,
)
def delete_pr_image(
    farm_id: int,
    image_id: Optional[str] = None,
):
    """
    PR画像を1枚削除するエンドポイント。

    - クエリパラメータ image_id で対象を指定
    """
    if not image_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="image_id is required",
        )

    service = FarmerSettingsService()
    try:
        return service.delete_pr_image(
            farm_id=farm_id,
            image_id=image_id,
        )
    except ValueError as e:
        msg = str(e)
        if "not found" in msg:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=msg,
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=msg,
        )
