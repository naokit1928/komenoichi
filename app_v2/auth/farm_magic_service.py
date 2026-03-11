import os
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import quote
from typing import Optional

from app_v2.auth_consumer.mailer import send_magic_link_email
from app_v2.auth import farm_magic_repo

TOKEN_BYTES = 32
EXPIRE_MINUTES = 15
REUSE_GRACE_SECONDS = 5

def _now() -> datetime:
    return datetime.now(timezone.utc)

# ==================================================
# send (Farm Login / Register)
# ==================================================

def send_login_magic_link(email: str) -> str:
    """既存農家のログイン用"""
    if not email:
        raise ValueError("email is required")

    row = farm_magic_repo.get_farm_by_email(email)
    if not row:
        raise ValueError("email_not_registered")

    return _issue_and_send(email, row["farm_id"])

def send_register_magic_link(email: str) -> str:
    """新規農家の登録用"""
    row = farm_magic_repo.get_farm_by_email(email)
    if row:
        raise ValueError("email_already_registered")

    farm_id = farm_magic_repo.create_placeholder_farm(email)
    return _issue_and_send(email, farm_id)

def _issue_and_send(email: str, farm_id: int, redirect_path: str | None = None) -> str:
    # ★ 修正: 同期的に呼んでいたクリーンアップ処理を削除 (API層でBackgroundTasksに任せる)

    api_base_url = os.getenv("API_BASE_URL")
    if not api_base_url:
        raise RuntimeError("API_BASE_URL is not set")

    now = _now()
    expires_at = now + timedelta(minutes=EXPIRE_MINUTES)
    token = _generate_token()

    farm_magic_repo.insert_token(
        token=token,
        email=email,
        farm_id=farm_id,
        expires_at=expires_at,
        created_at=now,
    )

    base_url = f"{api_base_url}/api/auth/farmer/magic/consume-login"
    if redirect_path:
        redirect_q = quote(redirect_path, safe="")
        magic_link_url = f"{base_url}?token={token}&redirect={redirect_q}"
    else:
        magic_link_url = f"{base_url}?token={token}"

    send_magic_link_email(email, magic_link_url)
    return magic_link_url

# ==================================================
# consume
# ==================================================

def consume_magic_link(token: str) -> dict:
    """
    トークンを検証・消費し、ログインに必要な情報(farm_id, is_registered)をまとめて返す。
    """
    if not token:
        raise ValueError("Token is required")

    record = farm_magic_repo.find_token(token)
    if not record:
        raise ValueError("Invalid token")

    now = _now()

    # 期限切れチェック
    try:
        expires_at = datetime.fromisoformat(record["expires_at"])
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
    except ValueError:
        expires_at = now - timedelta(seconds=1)

    if expires_at < now:
        raise ValueError("Token expired")

    farm_id = record["farm_id"]
    email = record["email"]

    # 使用済みチェック + 猶予期間ロジック
    if record["used"]:
        used_at_str = record["used_at"]
        if used_at_str:
            try:
                used_at = datetime.fromisoformat(used_at_str)
                if used_at.tzinfo is None:
                    used_at = used_at.replace(tzinfo=timezone.utc)
                if now - used_at < timedelta(seconds=REUSE_GRACE_SECONDS):
                    # 猶予期間内ならOKとして通す (ただし更新はしない)
                    return _build_success_response(farm_id, email)
            except ValueError:
                pass
        raise ValueError("Token already used")

    # 未使用なら使用済みに更新
    farm_magic_repo.mark_used(token_id=record["id"], used_at=now)
    
    return _build_success_response(farm_id, email)

def _build_success_response(farm_id: int, email: str) -> dict:
    owner_id = farm_magic_repo.get_farm_owner_id(farm_id)
    is_registered = (owner_id is not None)

    return {
        "email": email,
        "farm_id": farm_id,
        "is_registered": is_registered,
    }

def _generate_token() -> str:
    return secrets.token_urlsafe(TOKEN_BYTES)