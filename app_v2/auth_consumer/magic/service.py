import os
import secrets
from datetime import datetime, timedelta, timezone

from app_v2.auth_consumer.magic.repository import MagicLinkRepository
from app_v2.auth_consumer.mailer import MagicLinkMailer


class MagicLinkService:
    """
    Consumer 用 Magic Link Service。

    責務:
    - reservation_id を含む Magic Link の発行（Confirm 用）
    - consumer_id を含む Magic Link の発行（LoginOnly 用）
    - Magic Link の消費・検証
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
    # send (Confirm 用)
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
    # send-login (LoginOnly 用)
    # ==================================================

    def send_login_magic_link(
        self,
        *,
        email: str,
        consumer_id: int,
    ) -> str:
        """
        consumer_id を紐づけた Magic Link を生成・送信する（ログイン専用）。

        - reservation は一切作らない
        - agreed チェックは行わない
        """

        if not email:
            raise ValueError("email is required")
        if not consumer_id:
            raise ValueError("consumer_id is required")

        api_base_url = os.getenv("API_BASE_URL")
        if not api_base_url:
            raise RuntimeError("API_BASE_URL is not set")

        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=self.EXPIRE_MINUTES)

        token = self._generate_token()

        self.repo.insert_token(
            token=token,
            email=email,
            reservation_id=None,      # ★ LoginOnly：予約なし
            agreed=False,
            expires_at=expires_at,
            created_at=now,
            consumer_id=consumer_id,  # ★ 直接 consumer_id を保持
        )

        # ★★ ここが唯一の修正点 ★★
        magic_link_url = (
            f"{api_base_url}/api/auth/consumer/magic/consume-login"
            f"?token={token}"
        )

        self.mailer.send(
            to=email,
            magic_link_url=magic_link_url,
        )

        return magic_link_url

    # ==================================================
    # consume
    # ==================================================

    def consume_magic_link(self, token: str) -> dict:
        """
        Magic Link を消費し、reservation_id / email / consumer_id を返す。

        ※ Confirm / LoginOnly の両対応
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
            "reservation_id": record.get("reservation_id"),
            "email": record.get("email"),
            "consumer_id": record.get("consumer_id"),
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

        self.repo.attach_consumer_id(
            token=token,
            consumer_id=consumer_id,
        )

    # ==================================================
    # internal
    # ==================================================

    def _generate_token(self) -> str:
        return secrets.token_urlsafe(self.TOKEN_BYTES)
