# app_v2/auth_consumer/mailer.py

from app_v2.integrations.email.postmark_client import send_login_magic_link_email

def send_magic_link_email(email: str, link: str) -> None:
    """
    コンシューマー向けログイン用マジックリンクメールを送信する。
    
    役割:
      - ここでは「件名」や「本文」を作りません（Postmarkのテンプレートに任せます）。
      - 必要なデータ（action_url）だけを渡して送信を依頼します。
    """
    
    # テンプレート側で {{action_url}} として使うデータを準備
    template_model = {
        "action_url": link
    }
    
    # 共通クライアントを使って送信
    send_login_magic_link_email(email, template_model)