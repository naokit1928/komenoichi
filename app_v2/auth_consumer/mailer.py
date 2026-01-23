import logging
import os
import requests

logger = logging.getLogger(__name__)


POSTMARK_SERVER_TOKEN = os.getenv("POSTMARK_SERVER_TOKEN")
MAIL_FROM = os.getenv("MAIL_FROM")
MAIL_FROM_NAME = os.getenv("MAIL_FROM_NAME", "")


class MagicLinkMailer:
    """
    Magic Link 用メール送信クラス。

    方針:
    - Service 層からのインターフェースは固定
    - 送信基盤(Postmark / SES 等)はこのクラス内でのみ切り替える
    """

    def send(
        self,
        *,
        to: str,
        magic_link_url: str,
    ) -> None:
        """
        Magic Link メールを送信する（Postmark）。
        """

        if not POSTMARK_SERVER_TOKEN:
            logger.warning("POSTMARK_SERVER_TOKEN is not set. Fallback to log only.")
            self._log_only(to, magic_link_url)
            return

        subject = "こめのいち ログインリンク"
        body_text = f"""こめのいちへのログインリンクです。

下のURLをクリックしてください：

{magic_link_url}

※ このリンクは一定時間で無効になります。
"""

        payload = {
            "From": f"{MAIL_FROM_NAME} <{MAIL_FROM}>" if MAIL_FROM_NAME else MAIL_FROM,
            "To": to,
            "Subject": subject,
            "TextBody": body_text,
            "MessageStream": "outbound",
        }

        try:
            resp = requests.post(
                "https://api.postmarkapp.com/email",
                headers={
                    "X-Postmark-Server-Token": POSTMARK_SERVER_TOKEN,
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=10,
            )

            if resp.status_code >= 400:
                logger.error("Postmark send failed: %s %s", resp.status_code, resp.text)
                raise RuntimeError("Postmark send failed")

            logger.info("Magic Link mail sent via Postmark to %s", to)

        except Exception:
            logger.exception("Magic Link mail send error")
            raise

    def _log_only(self, to: str, magic_link_url: str) -> None:
        """
        送信基盤が未設定のときのフォールバック（開発用）
        """
        print("=== MAGIC LINK (DEBUG) ===")
        print(magic_link_url)
        print("==========================")

        logger.info("=== Magic Link Mail (Fallback) ===")
        logger.info("To: %s", to)
        logger.info("Magic Link URL:")
        logger.info(magic_link_url)
        logger.info("================================")
