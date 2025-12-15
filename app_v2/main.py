from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRoute
import os
from urllib.parse import urlparse
import asyncio
from contextlib import suppress
from typing import Optional

from app_v2.db.core import resolve_db_path

from dotenv import load_dotenv
load_dotenv()

# DEV MODE: Swagger の Admin Token を自動設定
if os.getenv("DEV_MODE", "0") == "1":
    # DEV_MODE=1 のときは、必ず ADMIN_TOKEN を dev 固定値にする
    os.environ["ADMIN_TOKEN"] = "devtoken123"


def custom_generate_unique_id(route: APIRoute) -> str:
    """
    OpenAPI schema内のoperationIdを一意にするための関数。
    デフォルトでは重複しうるため、"module_name_function_name" 形式に上書きする。
    """
    return f"{route.tags[0]}_{route.name}" if route.tags else route.name


app = FastAPI(
    title="Rice Reservation API (V2 only)",
    description="Tokushima Rice Reservation System - V2 Backend Only",
    version="2.0.0",
    generate_unique_id_function=custom_generate_unique_id,
)

# ============================
#  DB PATH RESOLUTION (重要)
# ============================
db_path = resolve_db_path()
print(f"[BOOT] resolved DB_PATH = {db_path}")


# ============================
#  CORS
# ============================
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

FRONTEND_URL = os.getenv("FRONTEND_URL")
if FRONTEND_URL:
    origins.append(FRONTEND_URL)

# Vercel のプレビュー / 本番 URL を自動追加（もしあれば）
for env_key in ["VERCEL_FRONTEND_URL", "VERCEL_FRONTEND_URL_PREVIEW"]:
    url = os.getenv(env_key)
    if url:
        origins.append(url)

# URL から origin 部分だけ取り出して CORS 許可リストに追加
clean_origins = []
for url in origins:
    parsed = urlparse(url)
    if parsed.scheme and parsed.netloc:
        origin = f"{parsed.scheme}://{parsed.netloc}"
        clean_origins.append(origin)
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
#  V2 Routers
# ============================

# Farmer domain V2
from app_v2.farmer.api.registration_api import router as v2_registration_api
from app_v2.farmer.api.pickup_settings_api import router as v2_pickup_settings_api
from app_v2.farmer.api.farmer_settings_api import router as v2_farmer_settings_api
from app_v2.farmer.api.geocode_api import router as v2_geocode_api

# Customer booking V2
from app_v2.customer_booking.api.public_farms_api import (
    router as v2_public_farms_api,
)
from app_v2.customer_booking.api.reservations_api import (
    router as v2_reservations_router,
)
from app_v2.customer_booking.api.reservation_expanded_api import (
    router as v2_expanded_router,
)
from app_v2.customer_booking.api.cancel_api import (
    router as v2_cancel_router,
)

# Integrations V2 (LINE / Stripe)
from app_v2.integrations.line.line_api import router as line_router_v2
from app_v2.integrations.payments.stripe_checkout_api import (
    router as stripe_checkout_router_v2,
)
from app_v2.integrations.payments.stripe_webhook_api import (
    router as stripe_webhook_router_v2,
)

from app_v2.notifications.api.notification_dev_api import (
    router as notification_dev_router,
)
from app_v2.notifications.api.notification_admin_api import (
    router as notification_admin_router,
)

from app_v2.notifications.api.line_incoming_api import (
    router as line_incoming_router,
)

from app_v2.dev.dev_api import router as dev_router

# 通知サービス（バックグラウンドワーカー用）
from app_v2.notifications.services.line_notification_service import (
    LineNotificationService,
)




# Feedback V2
from app_v2.feedback.api.feedback_api import router as feedback_router

# Admin Reservations V2 ★ 追加
from app_v2.admin_reservations.admin_reservation_api import (
    router as admin_reservations_router,
)

# ============================
# ▼▼▼ V1 ROUTERS▼▼▼
# ============================
from app_v2.customer_booking.api.reservation_booked_api import router as reservation_booked_router



app.include_router(reservation_booked_router, prefix="/api")


# ============================
#  Router include (V2 only)
# ============================

# Farmer domain V2
app.include_router(v2_registration_api, prefix="/api")
app.include_router(v2_pickup_settings_api, prefix="/api")
app.include_router(v2_farmer_settings_api, prefix="/api")
app.include_router(v2_geocode_api, prefix="/api")

# Customer booking V2
app.include_router(v2_public_farms_api)
app.include_router(v2_reservations_router, prefix="/api")
app.include_router(v2_expanded_router)


# 🔽 追加：キャンセルAPI（/api/reservation/cancel）
app.include_router(v2_cancel_router, prefix="/api")

# Feedback V2
app.include_router(feedback_router)

# Integrations V2
app.include_router(line_router_v2)
app.include_router(stripe_checkout_router_v2)
app.include_router(stripe_webhook_router_v2)

# LINE incoming webhook（問い合わせ → フィードバック誘導）
app.include_router(line_incoming_router)

# Dev / Notifications
app.include_router(dev_router, prefix="/dev")
app.include_router(notification_dev_router, prefix="/dev")
app.include_router(notification_admin_router)

# Admin Reservations V2 ★ 追加
# /api/admin/reservations ... のルーター（内部で prefix="/api/admin/reservations" 済）
app.include_router(admin_reservations_router)

# ============================
#  Notification Background Worker
# ============================

_notification_worker_task: Optional[asyncio.Task] = None




@app.on_event("startup")
async def start_notification_worker() -> None:
    """
    line_notification_jobs テーブルのうち、
    - status = 'PENDING'
    - scheduled_at <= now(JST)
    のジョブを 60 秒ごとにまとめて送信するバックグラウンド処理。
    決済直後の CONFIRMATION も、前日12時の REMINDER もすべてここでカバーされる。
    """
    global _notification_worker_task

    async def worker() -> None:
        service = LineNotificationService()
        while True:
            try:
                result = service.send_pending_jobs(limit=50, dry_run=False)
                summary = result.get("summary", {}) or {}

                sent = int(summary.get("sent") or 0)
                skipped = int(summary.get("skipped") or 0)
                failed = int(summary.get("failed") or 0)

                # 何か送った / 失敗したときだけログを出す
                if sent > 0 or failed > 0:
                    print(
                        "[NotificationWorker] "
                        f"sent={sent} skipped={skipped} failed={failed}"
                    )
            except Exception as e:
                # ワーカー自体が落ちないように、例外は握りつぶしてログだけ出す
                print(f"[NotificationWorker] error: {e}")

            # 60 秒ごとに実行
            await asyncio.sleep(60)

    _notification_worker_task = asyncio.create_task(worker())


@app.on_event("shutdown")
async def stop_notification_worker() -> None:
    """
    アプリ終了時にバックグラウンドタスクをきれいに止める。
    """
    global _notification_worker_task
    if _notification_worker_task is not None:
        _notification_worker_task.cancel()
        with suppress(Exception):
            await _notification_worker_task


# ============================
#  Root
# ============================
@app.get("/")
def root():
    return {"message": "Rice Reservation API (V2 Mode) is running"}
