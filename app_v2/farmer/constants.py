# app_v2/farmer/constants.py

class FarmConfig:
    # --- 価格計算ロジック ---
    # 5kg = 10kg * 0.52 + 50円
    PRICE_RATIO_5KG = 0.52
    PRICE_OFFSET_5KG = 50
    
    # 25kg = 10kg * 2.40 + 50円
    PRICE_RATIO_25KG = 2.40
    PRICE_OFFSET_25KG = 50
    
    # 価格の許容範囲 (10kg)
    PRICE_10KG_MIN = 5000
    PRICE_10KG_MAX = 9900
    
    # --- アップロード制限 ---
    # 1ファイルあたりの最大サイズ (15MB)
    MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024
    
    # 月間アップロード転送量制限 (デフォルト 50MB)
    DEFAULT_MONTHLY_UPLOAD_LIMIT = 50 * 1024 * 1024

    # --- 画像フォーマット ---
    ALLOWED_IMAGE_MIMES = {"image/jpeg", "image/png", "image/webp"}
    ALLOWED_IMAGE_FORMATS = {"JPEG", "PNG", "WEBP"}