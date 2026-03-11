import os
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

from app_v2.auth_consumer.magic.repository import MagicLinkRepository
from app_v2.auth_consumer.mailer import send_magic_link_email

class MagicLinkService:
    """
    Consumer 用 Magic Link Service。
    責務:
    - consumer_id を含む Magic Link の発行（LoginOnly 用）
    - Magic Link の消費・検証
    """

    TOKEN_BYTES = 32
    EXPIRE_MINUTES = 15

    def __init__(
        self,
        repo: MagicLinkRepository | None = None,
    ) -> None:
        self.repo = repo or MagicLinkRepository()

    # ==================================================
    # send (LoginOnly 用)
    # ==================================================
    def send_login_magic_link(
        self,
        *,
        email: str,
        consumer_id: int,
        redirect_path: str | None = None,
    ) -> str:
        token = secrets.token_urlsafe(self.TOKEN_BYTES)
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=self.EXPIRE_MINUTES)

        self.repo.insert_token(
            token=token,
            email=email,
            reservation_id=None,
            agreed=True,
            expires_at=expires_at,
            created_at=now,
            consumer_id=consumer_id,
        )

        api_base_url = os.getenv("API_BASE_URL", "http://localhost:8000").rstrip("/")
        
        magic_link_url = (
            f"{api_base_url}/api/auth/consumer/magic/consume-login"
            f"?token={token}"
        )
        if redirect_path:
            magic_link_url += f"&redirect={quote(redirect_path)}"

        # 実際のメール送信
        send_magic_link_email(email, magic_link_url)

        return magic_link_url

    # ==================================================
    # consume
    # ==================================================
    def consume_magic_link(self, token: str) -> dict:
        if not token:
            raise ValueError("Token is missing")

        now = datetime.now(timezone.utc)
        record = self.repo.get_token_record(token)

        if not record:
            raise ValueError("Invalid token")
        if record["used"]:
            raise ValueError("Token already used")

        try:
            expires_at = datetime.fromisoformat(record["expires_at"])
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
        except ValueError:
            expires_at = now - timedelta(seconds=1)

        if expires_at < now:
            raise ValueError("Token expired")

        self.repo.mark_used(
            token=token,
            used_at=now,
        )

        return {
            "reservation_id": record.get("reservation_id"),
            "email": record.get("email"),
            "consumer_id": record.get("consumer_id"),
        }

    # ==================================================
    # attach consumer
    # ==================================================
    def attach_consumer_id(self, *, token: str, consumer_id: int) -> None:
        if not token:
            raise ValueError("Token is required")
        if not consumer_id:
            raise ValueError("consumer_id is required")

        self.repo.attach_consumer_id(
            token=token,
            consumer_id=consumer_id,
        )