from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from fastapi.routing import APIRoute
import os
from urllib.parse import urlparse
from typing import Optional
from contextlib import asynccontextmanager

from app_v2.db.core import resolve_db_path
from app_v2.maintenance.cleanup import run_pending_gc

from app_v2.customer_booking.api.consumer_delete_api import router as consumer_delete_router
from app_v2.farmer.api.farmer_delete_api import router as farmer_delete_router




# ============================
# ENV 判定（cookie 用・本番判定）
# ============================
IS_RENDER = os.getenv("RENDER", "") == "true"


def custom_generate_unique_id(route: APIRoute) -> str:
    return f"{route.tags[0]}_{route.name}" if route.tags else route.name


# ============================
# Lifespan (起動時・終了時処理)
# ============================
@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- 起動時 (Startup) ---
    print("[BOOT] Running Startup Tasks...")
    
    # 1. ゴミ掃除 (1日間保持)
    run_pending_gc(retention_days=1)
    
    yield
    # --- 終了時 (Shutdown) ---
    print("[SHUTDOWN] Application is stopping...")


app = FastAPI(
    title="Rice Reservation API (V2 only)",
    description="Tokushima Rice Reservation System - V2 Backend Only",
    version="2.0.0",
    generate_unique_id_function=custom_generate_unique_id,
    lifespan=lifespan,
)


# ============================
# DB PATH RESOLUTION（重要）
# ============================
db_path = resolve_db_path()
print(f"[BOOT] resolved DB_PATH = {db_path}")


# ============================
# CORS
# ============================
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

FRONTEND_URL = os.getenv("FRONTEND_URL")
if FRONTEND_URL:
    origins.append(FRONTEND_URL)

for env_key in ["VERCEL_FRONTEND_URL", "VERCEL_FRONTEND_URL_PREVIEW"]:
    url = os.getenv(env_key)
    if url:
        origins.append(url)

clean_origins = []
for url in origins:
    parsed = urlparse(url)
    if parsed.scheme and parsed.netloc:
        clean_origins.append(f"{parsed.scheme}://{parsed.netloc}")
    else:
        clean_origins.append(url)

origins = list(sorted(set(clean_origins)))

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Existing-Farm-Id", "X-Settings-URL"],
)

# ============================
# Session Middleware
# ============================

cookie_domain = os.getenv("COOKIE_DOMAIN", None)

app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SESSION_SECRET", "dev-secret-key"),
    domain=cookie_domain,       # ★ 追加: これがiPadで弾かれないための魔法です（先頭のドットが超重要）
    same_site="lax",            # ★ 変更: "none" から "lax" に変更（ファーストパーティの仲間になったため）
    https_only=True if IS_RENDER else False,
    max_age=60 * 60 * 24 * 30,  # 30日
)

# ============================
# Routers
# ============================

# --- Auth (Farmer: Magic Link / Consumer: Magic Link + Logout) ---
from app_v2.auth_consumer.magic.api import router as consumer_magic_router
from app_v2.auth_consumer.logout.logout_api import router as consumer_logout_router
from app_v2.auth.auth_farmer_magic_api import router as farmer_magic_router


# --- Farmer ---
from app_v2.farmer.api.registration_api import router as registration_router
from app_v2.farmer.api.pickup_settings_api import router as pickup_settings_router
from app_v2.farmer.api.farmer_settings_api import router as farmer_settings_router
from app_v2.farmer.api.geocode_api import router as geocode_router
from app_v2.farmer.farmer_me_api import router as farmer_me_router

# --- Customer Booking ---
from app_v2.customer_booking.api.public_farms_api import router as public_farms_router
from app_v2.customer_booking.api.public_farm_detail_api import (
    router as public_farm_detail_router,
)
from app_v2.customer_booking.api.public_reservations_api import (
    router as public_reservations_router,
)
from app_v2.customer_booking.consumer_history.consumer_history_api import (
    router as consumer_history_router,
)
from app_v2.customer_booking.api.confirm_session_api import router as confirm_session_router
from app_v2.customer_booking.api.reservation_expanded_api import (
    router as expanded_router,
)
from app_v2.customer_booking.api.cancel_api import router as cancel_router
from app_v2.customer_booking.api.reservation_booked_api import (
    router as reservation_booked_router,
)
from app_v2.customer_booking.api.consumer_me_api import (
    router as consumer_me_router,
)

from app_v2.customer_booking.api.consumer_identity_api import (
    router as consumer_identity_router,
)

from app_v2.customer_booking.api.state_api import (
    router as consumer_state_router,
)

from app_v2.customer_booking.favorites import favorite_api


# --- Integrations ---
from app_v2.integrations.payments.stripe.stripe_checkout_api import (
    router as stripe_checkout_router,
)
from app_v2.integrations.payments.stripe.stripe_webhook_api import (
    router as stripe_webhook_router,
)



from app_v2.admin.api.admin_reservation_api import (
    router as admin_reservations_router,
)
from app_v2.admin.api.admin_farm_api import (
    router as admin_farm_router,
)

# ============================
# Router Registration
# ============================

# Auth
app.include_router(consumer_magic_router, prefix="/api")
app.include_router(consumer_logout_router, prefix="/api")
app.include_router(farmer_magic_router, prefix="/api")


# ReservationBooked（予約確認ページ専用）
app.include_router(reservation_booked_router, prefix="/api")

# Consumer whoami API
app.include_router(consumer_me_router, prefix="/api")

# Consumer identity API（表示専用）
app.include_router(consumer_identity_router, prefix="/api")


# Farmer
app.include_router(registration_router, prefix="/api")
app.include_router(pickup_settings_router, prefix="/api")
app.include_router(farmer_settings_router, prefix="/api")
app.include_router(geocode_router, prefix="/api")
app.include_router(farmer_me_router, prefix="/api")

# Customer
app.include_router(public_farms_router)
app.include_router(public_farm_detail_router)
app.include_router(public_reservations_router)
app.include_router(consumer_history_router)
app.include_router(confirm_session_router)
app.include_router(expanded_router)
app.include_router(cancel_router, prefix="/api")
app.include_router(consumer_state_router)
app.include_router(favorite_api.router)

# Integrations
app.include_router(stripe_checkout_router)
app.include_router(stripe_webhook_router)


# Feedback / Admin / Dev
app.include_router(admin_reservations_router)
app.include_router(admin_farm_router)

app.include_router(consumer_delete_router, prefix="/api")
app.include_router(farmer_delete_router, prefix="/api")

@app.get("/")
def root():
    return {"message": "Rice Reservation API (V2 Mode) is running"}