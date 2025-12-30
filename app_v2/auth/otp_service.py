import random
import sqlite3
from datetime import datetime, timedelta

from app_v2.db.core import resolve_db_path
from app_v2.auth import otp_repo


# ======================================================
# 定数（ここで一元管理）
# ======================================================

OTP_DIGITS = 6
OTP_EXPIRE_MINUTES = 10
MAX_ATTEMPTS = 5

# OTP を許可する registration_status
ALLOWED_OTP_STATUSES = {
    "EMAIL_REGISTERED",
    "PROFILE_COMPLETED",
    "PUBLISH_READY",
}
    


# ======================================================
# 内部ユーティリティ
# ======================================================

def _now() -> datetime:
    return datetime.utcnow()


def _generate_otp_code() -> str:
    """
    6桁の数値 OTP を生成（000000 は除外）
    """
    return str(random.randint(10 ** (OTP_DIGITS - 1), 10 ** OTP_DIGITS - 1))


def _get_farm_registration_status(email: str) -> str | None:
    """
    email に紐づく farm の registration_status を取得
    存在しない場合は None
    """
    conn = sqlite3.connect(resolve_db_path())
    try:
        row = conn.execute(
            """
            SELECT registration_status
            FROM farms
            WHERE email = ?
            LIMIT 1
            """,
            (email,),
        ).fetchone()
        return row[0] if row else None
    finally:
        conn.close()


def _can_issue_otp(email: str) -> bool:
    """
    OTP を発行してよい farm か判定する
    """
    status = _get_farm_registration_status(email)
    if status is None:
        return False
    return status in ALLOWED_OTP_STATUSES


# ======================================================
# 公開サービス関数
# ======================================================

def request_otp(email: str) -> None:
    """
    OTP を発行する

    - registration_status が許可状態でない場合は例外
    - 既存 OTP は消さない
    """
    if not _can_issue_otp(email):
        raise ValueError("email_not_registered")

    issued_at = _now()
    expires_at = issued_at + timedelta(minutes=OTP_EXPIRE_MINUTES)
    code = _generate_otp_code()

    otp_repo.insert_otp(
        email=email,
        code=code,
        expires_at=expires_at,
        created_at=issued_at,
    )

    # メール送信は service の責務（実装は後で差し替え）
    _send_otp_email(email=email, code=code)


def verify_otp(email: str, code: str) -> None:
    """
    OTP を検証する
    成功時：何も返さない（例外が出なければ成功）
    """
    otp = otp_repo.find_latest_valid_otp(email=email, code=code)

    if otp is None:
        raise ValueError("invalid_otp")

    # 試行回数チェック
    if otp["attempt_count"] >= MAX_ATTEMPTS:
        raise ValueError("too_many_attempts")

    # 有効期限チェック
    expires_at = datetime.fromisoformat(otp["expires_at"])
    if expires_at < _now():
        raise ValueError("otp_expired")

    # 使用済みにする
    otp_repo.mark_otp_consumed(
        otp_id=otp["otp_id"],
        consumed_at=_now(),
    )


# ======================================================
# メール送信（スタブ）
# ======================================================

def _send_otp_email(email: str, code: str) -> None:
    """
    OTP メール送信
    本番では SendGrid / SES 等に差し替える
    """
    # TODO: 実装
    print(f"[OTP] send to {email}: {code}")
