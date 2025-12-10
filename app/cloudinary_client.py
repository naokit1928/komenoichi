import os
import cloudinary
import cloudinary.uploader

# 必要な環境変数：
# CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
# 任意：CLOUDINARY_UPLOAD_FOLDER （例: "rice-app/farms"）
def init():
    cloudinary.config(
        cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
        api_key=os.getenv("CLOUDINARY_API_KEY"),
        api_secret=os.getenv("CLOUDINARY_API_SECRET"),
        secure=True,
    )

def upload_bytes(content: bytes, filename: str, folder: str | None = None):
    init()
    options = {
        "folder": folder or os.getenv("CLOUDINARY_UPLOAD_FOLDER", "rice-app/farms"),
        "resource_type": "image",
        "use_filename": True,
        "unique_filename": True,
        "overwrite": False,
        "invalidate": False,
    }
    resp = cloudinary.uploader.upload(content, **options)
    return {
        "url": resp.get("secure_url"),
        "public_id": resp.get("public_id"),
        "bytes": int(resp.get("bytes") or 0),
    }

def delete_public_id(public_id: str) -> bool:
    """
    Cloudinary 側の実ファイルを削除する。
    - 既に存在しない場合はエラーにはしない（`result: not found` でも True を返す）
    """
    init()
    try:
        resp = cloudinary.uploader.destroy(public_id, invalidate=True)
        # resp 例: {'result': 'ok'} / {'result': 'not found'}
        return resp.get("result") in {"ok", "not found"}
    except Exception:
        return False
