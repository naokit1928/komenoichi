import logging


logger = logging.getLogger(__name__)


class MagicLinkMailer:
    """
    Magic Link 用メール送信クラス。

    Phase B-1b 方針:
    - まずは「送信された体で動く」ことを優先
    - SMTP / SendGrid / SES などは Phase C 以降
    - Service からの呼び出し口を確定させることが目的
    """

    def send(
        self,
        *,
        to: str,
        magic_link_url: str,
    ) -> None:
        """
        Magic Link メールを送信する。

        現在は仮実装:
        - 実際のメールは送らない
        - ログに出すのみ
        """

        print("=== MAGIC LINK (DEBUG) ===")
        print(magic_link_url)
        print("==========================")

        logger.info("=== Magic Link Mail (Phase B-1b mock) ===")
        logger.info("To: %s", to)
        logger.info("Magic Link URL:")
        logger.info(magic_link_url)
        logger.info("======================================")
