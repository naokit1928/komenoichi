# app/main.py
from fastapi import FastAPI
from .database import Base, engine
from . import models

# --- 既存ルータの読み込み ---
from .routers import users, farms, reservations
# --- 新規追加: Virtual Orders（仮想注文一覧） ---
from .routers import orders

# --- 将来のエクスポート専用ルータ（存在する時だけ有効化） ---
try:
    from .routers import reservations_export as reservations_export_router
    HAS_EXPORT_ROUTER = True
except Exception:
    reservations_export_router = None  # type: ignore
    HAS_EXPORT_ROUTER = False

# --- FastAPI アプリ本体 ---
app = FastAPI(title="Rice Direct Sales API")

# --- モデルをDBに反映（初回起動時のみ） ---
Base.metadata.create_all(bind=engine)

# --- 既存ルータの登録 ---
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(farms.router, prefix="/farms", tags=["farms"])
app.include_router(reservations.router, prefix="/reservations", tags=["reservations"])

# --- 新規 Virtual Orders ルータの登録 ---
app.include_router(orders.router, prefix="/orders", tags=["orders"])

# --- エクスポートルータ（存在時のみ有効） ---
# reservations_export.py が存在していれば自動マウント
if HAS_EXPORT_ROUTER and hasattr(reservations_export_router, "router"):
    app.include_router(reservations_export_router.router, prefix="/reservations", tags=["reservations"])

# --- ヘルスチェック（既存維持） ---
@app.get("/healthz")
def healthcheck():
    return {"status": "ok"}
