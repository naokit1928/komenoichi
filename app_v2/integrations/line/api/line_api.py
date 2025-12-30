from __future__ import annotations

import os
from urllib.parse import urlparse, parse_qs

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import RedirectResponse, JSONResponse

from app_v2.integrations.line.services.line_oauth_service import LineOAuthService
from app_v2.integrations.line.services.line_link_service import LineLinkService

# ============================================================
# Router
# ============================================================

router = APIRouter(prefix="/api/line", tags=["line_v2"])

FRONT_BASE = os.getenv(
    "FRONTEND_BASE_URL",
    os.getenv("VITE_FRONTEND_BASE_URL", "http://localhost:5173"),
)

LINKED_COOKIE = "line_linked"


# ============================================================
# Helpers
# ============================================================

def _extract_farm_id_from_url(url: str | None) -> int | None:
    if not url:
        return None
    try:
        qs = parse_qs(urlparse(url).query)
        v = qs.get("farm_id", [None])[0]
        return int(v) if v and str(v).isdigit() else None
    except Exception:
        return None


def _is_consumer_flow(return_to: str) -> bool:
    """
    旧実装と完全互換。
    /farms/{id}/confirm... を consumer フローとみなす。
    """
    path = urlparse(return_to).path or ""
    return path.startswith("/farms/")


# ============================================================
# Login
# ============================================================

@router.get("/login")
def line_login(return_to: str):
    if not return_to:
        raise HTTPException(status_code=400, detail="return_to is required")

    oauth = LineOAuthService()
    login_url = oauth.build_login_url(return_to=return_to)
    

    return RedirectResponse(login_url, status_code=302)


# ============================================================
# Callback
# ============================================================

@router.get("/callback")
def line_callback(
    response: Response,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
):
    if error:
        raise HTTPException(status_code=400, detail=f"LINE error: {error}")
    if not code or not state:
        raise HTTPException(status_code=400, detail="code/state missing")

    # --------------------------------------------------------
    # 1) OAuth（code → LINE user）
    # --------------------------------------------------------
    oauth = LineOAuthService()
    oauth_result = oauth.exchange_code_for_profile(code=code, state=state)

    line_user_id = oauth_result["line_user_id"]
    state_payload = oauth_result["state_payload"]

    return_to = state_payload.get("return_to") or f"{FRONT_BASE}/farmer/settings"

    # --------------------------------------------------------
    # 2) フロー判定
    # --------------------------------------------------------
    is_consumer_flow = _is_consumer_flow(return_to)
    intended_farm_id = _extract_farm_id_from_url(return_to)

    # --------------------------------------------------------
    # 3) 業務連携（DB）
    # --------------------------------------------------------
    linker = LineLinkService()
    link_result = linker.link_line_user(
        line_user_id=line_user_id,
        is_consumer_flow=is_consumer_flow,
        intended_farm_id=intended_farm_id,
    )

    # --------------------------------------------------------
    # 4) Redirect 決定（旧挙動と完全一致）
    # --------------------------------------------------------
    if link_result.is_consumer_flow:
        final_return = return_to
    else:
        final_return = f"{FRONT_BASE}/farmer/settings?farm_id={link_result.farm_id}"

    resp = RedirectResponse(final_return, status_code=302)

    resp.set_cookie(
        key=LINKED_COOKIE,
        value="1",
        max_age=60 * 60 * 24 * 30,
        httponly=True,
        secure=True,
        samesite="None",
        path="/",
    )

    return resp


# ============================================================
# Status / Reset
# ============================================================

@router.get("/linked")
def line_linked(request: Request):
    linked = request.cookies.get(LINKED_COOKIE) == "1"
    return JSONResponse({"linked": linked})


@router.get("/reset")
def line_reset(return_to: str = "/"):
    resp = RedirectResponse(url=return_to, status_code=302)
    resp.delete_cookie(key=LINKED_COOKIE, path="/")
    return resp


@router.get("/reset_to_farm/{farm_id}")
def line_reset_to_farm(farm_id: int):
    url = f"{FRONT_BASE}/farms/{farm_id}"
    resp = RedirectResponse(url=url, status_code=302)
    resp.delete_cookie(key=LINKED_COOKIE, path="/")
    return resp
