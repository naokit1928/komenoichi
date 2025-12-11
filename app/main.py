from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.routing import APIRoute
from pathlib import Path
import os
from urllib.parse import urlparse

from dotenv import load_dotenv
load_dotenv()

# DEV MODE: Swagger の Admin Token を自動設定
if os.getenv("DEV_MODE", "0") == "1":
    os.environ["ADMIN_TOKEN"] = "devtoken123"


def custom_generate_unique_id(route: APIRoute) -> str:
    """OpenAPI operationId を一意にする"""
    return f"{route.tags[0]}_{route.name}" if route.tags else route.name


app = FastAPI(
    title="Rice Reservation API (V2 only)",
    description="Tokushima Rice Reservation System - V2 Backend Only",
    version="2.0.0",
    generate_unique_id_function=custom_generate_unique_id,
)

# ============================================================
#  CORS 設定（ローカル + Render + Vercel 全対応）
# ============================================================

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

# メインの FRONTEND_URL
fe = os.getenv("FRONTEND_URL")
if fe:
    origins.append(fe)

# Vercel Preview / Production URL
for key in ["VERCEL_FRONTEND_URL", "VERCEL_FRONTEND_PREVIEW_URL"]:
    url = os.getenv(key)
    if url:
        origins.append(url)

# Origin だけ抽出
clean = []
for url in origins:
    parsed = urlparse(url)
    if parsed.scheme and parsed.netloc:
        clean.append(f"{parsed.scheme}://{parsed.netloc}")
    else:
        clean.append(url)

origins = sorted(list(set(clean)))

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Existing-Farm-Id", "X-Settings-URL"],
)

# ============================================================
#  static 配置
# ============================================================

static_dir = Path("app/static")
static_dir.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

# ============================================================
#  Routers (V2)
# ============================================================

# Farmer domain V2
from app_v2.farmer.api.registration_api import router as v2_registration_api
from app_v2.farmer.api.pickup_settings_api import router as v2_pickup_settings_api
from app_v2.farmer.api.farmer_settings_api import router as v2_farmer_settings_api
from app_v2.farmer.api.geocode_api import router as v2_geocode_api

# Customer Booking V2
from app_v2.customer_booking.api.public_farms_api import router as v2_public_farms_api
from app_v2.customer_booking.api.reservations_api import router as v2_reservations_router
from app_v2.customer_booking.api.reservation_expanded_api import router as v2_expanded_router
from app_v2.customer_booking.api.cancel_api import router as v2_cancel_router

# Integrations
from app_v2.integrations.line.line_api import router as line_router_v2
from app_v2.integrations.payments.stripe_checkout_api import router as stripe_checkout_router_v2
from app_v2.integrations.payments.stripe_webhook_api import router as stripe_webhook_router_v2
from app_v2.notifications.api.notification_dev_api import router as notification_dev_router
from app_v2.notifications.api.notification_admin_api import router as notification_admin_router
from app_v2.notifications.api.line_incoming_api import router as line_incoming_router
from app_v2.dev.dev_api import router as dev_router

# Admin Reservations
from app_v2.admin_reservations.admin_reservation_api import router as admin_reservations_router

# V1 ReservationBooked
from app_v2.customer_booking.api.reservation_booked_api import router as reservation_booked_router

# ============================================================
#  Router mount
# ============================================================

# V1 Booked
app.include_router(reservation_booked_router, prefix="/api")

# V2 Farmer
app.include_router(v2_registration_api, prefix="/api")
app.include_router(v2_pickup_settings_api, prefix="/api")
app.include_router(v2_farmer_settings_api, prefix="/api")
app.include_router(v2_geocode_api, prefix="/api")

# V2 Customer
app.include_router(v2_public_farms_api)
app.include_router(v2_reservations_router, prefix="/api")
app.include_router(v2_expanded_router)

# Cancel
app.include_router(v2_cancel_router, prefix="/api")

# Feedback
from app_v2.feedback.api.feedback_api import router as feedback_router
app.include_router(feedback_router)

# Line / Stripe
app.include_router(line_router_v2)
app.include_router(stripe_checkout_router_v2)
app.include_router(stripe_webhook_router_v2)

# Line Incoming
app.include_router(line_incoming_router)

# Dev
app.include_router(dev_router, prefix="/dev")
app.include_router(notification_dev_router, prefix="/dev")
app.include_router(notification_admin_router)

# Admin Reservations
app.include_router(admin_reservations_router)

# ============================================================
#  Notification Worker → 今は停止（Render 本番が安定したらONにできる）
# ============================================================

# Worker 完全停止（Render 本番のため）
@app.on_event("startup")
async def noop_start():
    print("[Worker] disabled for Render deployment")

@app.on_event("shutdown")
async def noop_stop():
    pass

# ============================================================
#  Root
# ============================================================

@app.get("/")
def root():
    return {"message": "Rice Reservation API (V2 Mode) is running"}
