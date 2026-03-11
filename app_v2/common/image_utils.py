# app_v2/common/image_utils.py
import io
from typing import Optional
from PIL import Image

# 定数ファイルをインポート
from app_v2.farmer.constants import FarmConfig

def validate_image_content(file_bytes: bytes) -> str:
    """
    バイナリデータを検証し、安全な画像であれば拡張子(format)を返す。
    不正なファイル、破損ファイル、許可されていない形式は ValueError を送出する。
    """
    if len(file_bytes) > FarmConfig.MAX_FILE_SIZE_BYTES:
        raise ValueError("File size exceeds limit")

    try:
        # メモリ上で画像を開く（完全なロードはしないので高速）
        with Image.open(io.BytesIO(file_bytes)) as img:
            img.verify()  # 破損チェック
            
            if img.format not in FarmConfig.ALLOWED_IMAGE_FORMATS:
                allowed = ", ".join(sorted(FarmConfig.ALLOWED_IMAGE_FORMATS))
                raise ValueError(f"Unsupported image format: {img.format}. Allowed: {allowed}")
            
            # 爆弾画像（Zip Bombのような巨大解像度）対策
            # ※必要に応じて調整してください
            if img.width > 8000 or img.height > 8000:
                raise ValueError("Image dimensions too large (max 8000x8000)")
            
            return img.format.lower()
            
    except Exception as e:
        # Pillow がエラーを吐いた場合は不正ファイルとみなす
        raise ValueError("Invalid image file or corrupted") from e