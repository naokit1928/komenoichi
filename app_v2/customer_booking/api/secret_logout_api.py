import os
from fastapi import APIRouter, Request, HTTPException, status
from fastapi.responses import JSONResponse

router = APIRouter(
    prefix="/consumers",
    tags=["consumers"],
)

# 非公開ログアウト用シークレットキー（.env 管理）
SECRET_LOGOUT_KEY = os.getenv("SECRET_LOGOUT_KEY")


@router.get("/secret-logout")
@router.post("/secret-logout")
def secret_logout(request: Request, key: str):
    """
    consumer セッションの強制ログアウト（非常口・UI非公開）

    - 管理者専用（URL直打ち or POST）
    - UIからは一切利用しない
    - cookie / session のみ破棄
    - DB・予約・決済には一切触らない
    """

    if not SECRET_LOGOUT_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SECRET_LOGOUT_KEY is not configured",
        )

    if key != SECRET_LOGOUT_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="forbidden",
        )

    # consumer セッションのみ破棄
    request.session.clear()

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"ok": True},
    )
