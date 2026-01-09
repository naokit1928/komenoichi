import os
import secrets
from datetime import datetime, timedelta, timezone

from app_v2.auth_consumer.magic.repository import MagicLinkRepository
from app_v2.auth_consumer.mailer import MagicLinkMailer


class MagicLinkService:
    """
    Consumer 用 Magic Link Service。

    責務:
    - reservation_id を含む Magic Link の発行
    - Magic Link の消費・検証
    - Magic Link と consumer_id の紐づけ
    """

    TOKEN_BYTES = 32
    EXPIRE_MINUTES = 15

    def __init__(
        self,
        repo: MagicLinkRepository | None = None,
        mailer: MagicLinkMailer | None = None,
    ) -> None:
        self.repo = repo or MagicLinkRepository()
        self.mailer = mailer or MagicLinkMailer()

    # ==================================================
    # send
    # ==================================================

    def send_magic_link(
        self,
        *,
        email: str,
        reservation_id: int,
        agreed: bool,
    ) -> str:
        """
        reservation_id を紐づけた Magic Link を生成・送信し、
        開発モード用に magic link URL を返す
        """

        if not agreed:
            raise ValueError("Agreement is required")

        api_base_url = os.getenv("API_BASE_URL")
        if not api_base_url:
            raise RuntimeError("API_BASE_URL is not set")

        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=self.EXPIRE_MINUTES)

        token = self._generate_token()

        self.repo.insert_token(
            token=token,
            email=email,
            reservation_id=reservation_id,
            agreed=agreed,
            expires_at=expires_at,
            created_at=now,
        )

        magic_link_url = (
            f"{api_base_url}/api/auth/consumer/magic/consume"
            f"?token={token}"
        )

        self.mailer.send(
            to=email,
            magic_link_url=magic_link_url,
        )

        # ★ 開発用：フロントに表示するため返す
        return magic_link_url

    # ==================================================
    # consume
    # ==================================================

    def consume_magic_link(self, token: str) -> dict:
        """
        Magic Link を消費し、reservation_id と email を返す
        """

        if not token:
            raise ValueError("Token is required")

        record = self.repo.get_by_token(token)
        if not record:
            raise ValueError("Invalid token")

        if record["used"]:
            raise ValueError("Token already used")

        now = datetime.now(timezone.utc)

        expires_at = datetime.fromisoformat(record["expires_at"])
        if expires_at < now:
            raise ValueError("Token expired")

        self.repo.mark_used(
            token=token,
            used_at=now,
        )

        return {
            "reservation_id": record["reservation_id"],
            "email": record["email"],
        }

    # ==================================================
    # attach consumer
    # ==================================================

    def attach_consumer_id(self, *, token: str, consumer_id: int) -> None:
        """
        Magic Link token に consumer_id を紐づける（EMAIL = consumer の永続化）
        """

        if not token:
            raise ValueError("Token is required")
        if not consumer_id:
            raise ValueError("consumer_id is required")

        # Repo の責務に完全委譲（Repo が DB 接続/SQL/commit を持つ設計）
        self.repo.attach_consumer_id(
            token=token,
            consumer_id=consumer_id,
        )

    # ==================================================
    # internal
    # ==================================================

    def _generate_token(self) -> str:
        return secrets.token_urlsafe(self.TOKEN_BYTES)
