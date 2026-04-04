import os
import logging
import httpx

logger = logging.getLogger(__name__)

def _get_sender_signature():
    """
    環境変数から送信者名とメールアドレスを取得し、Postmark用のシグネチャを構成する。
    例: "こめのいち <info@komenoichi.jp>"
    """
    from_email = os.getenv("MAIL_FROM", "info@komenoichi.jp")
    from_name = os.getenv("MAIL_FROM_NAME")

    if from_name:
        return f"{from_name} <{from_email}>"
    return from_email


def _send_with_template(to_email: str, template_alias: str, template_model: dict):
    """
    Postmark API の共通送信処理
    """
    token = os.getenv("POSTMARK_SERVER_TOKEN")
    if not token:
        logger.error("POSTMARK_SERVER_TOKEN is not set")
        return None

    # =========================================================
    # ★ 追加: すべてのメールに自動で frontend_url を追加する魔法
    # =========================================================
    if "frontend_url" not in template_model:
        # 環境変数 FRONTEND_URL を取得。末尾のスラッシュはエラー防止のため削除する。
        # 万が一設定されていない場合は、本番サイトをデフォルトにする。
        frontend_url = os.getenv("FRONTEND_URL", "https://komenoichi.jp").rstrip("/")
        template_model["frontend_url"] = frontend_url
    # =========================================================

    sender_signature = _get_sender_signature()

    payload = {
        "From": sender_signature,
        "To": to_email,
        "TemplateAlias": template_alias,
        "TemplateModel": template_model
    }

    try:
        logger.info(
            f"[MAIL] send_email called: {template_alias}",
            extra={
                "to": to_email,
                "template": template_alias,
                "from": sender_signature,
            },
        )

        with httpx.Client(timeout=10.0) as client:
            response = client.post(
                "https://api.postmarkapp.com/email/withTemplate",
                json=payload,
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "X-Postmark-Server-Token": token
                }
            )
            response.raise_for_status()
            return response.json()
            
    except Exception as e:
        logger.error(f"POSTMARK_SEND_ERROR ({template_alias}): {e}", exc_info=True)
        return None


def send_reservation_confirmed_email(to_email: str, template_model: dict):
    """
    予約確定メールを送信する。
    """
    return _send_with_template(to_email, "reservation-confirmed", template_model)


def send_reservation_cancelled_email(to_email: str, template_model: dict):
    """
    予約キャンセル完了メールを送信する。
    """
    return _send_with_template(to_email, "reservation-cancelled", template_model)


def send_login_magic_link_email(to_email: str, template_model: dict):
    """
    ログイン用マジックリンクメールを送信する。
    TemplateAlias: login-magic-link
    """
    return _send_with_template(to_email, "login-magic-link", template_model)


def send_farmer_notification_email(to_email: str, template_model: dict):
    """
    農家に新規予約が入ったことを通知するメールを送信する。
    TemplateAlias: farmer-reservation-notification
    """
    return _send_with_template(to_email, "farmer-reservation-notification", template_model)

def send_farmer_cancelled_notification_email(to_email: str, template_model: dict):
    """
    農家に予約がキャンセルされたことを通知するメールを送信する。
    TemplateAlias: farmer-reservation-cancelled-notification
    """
    return _send_with_template(to_email, "farmer-reservation-cancelled-notification", template_model)


def send_farmer_emergency_cancel_email(to_email: str, farm_name: str, reason: str):
    """
    農家による緊急停止（一括キャンセル）時の通知メール
    reason: 'A' (災害) または 'B' (自己都合)
    """
    if reason == "A":
        template_alias = "emergency-cancel-disaster"
    else:
        template_alias = "emergency-cancel-convenience"

    template_model = {
        "farm_name": farm_name
    }

    return _send_with_template(to_email, template_alias, template_model)