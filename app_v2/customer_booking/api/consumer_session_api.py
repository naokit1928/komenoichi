from fastapi import APIRouter, Request, status
from fastapi.responses import JSONResponse

router = APIRouter(
    prefix="/consumers",
    tags=["consumers"],
)


@router.post("/logout")
def consumer_logout(request: Request):
    """
    consumer セッションのリセット（非常口）

    - session cookie のみ破棄
    - DB は一切触らない
    """
    request.session.clear()

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"ok": True},
    )
