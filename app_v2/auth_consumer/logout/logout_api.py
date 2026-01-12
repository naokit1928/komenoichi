from fastapi import APIRouter, Request, status
from fastapi.responses import JSONResponse

router = APIRouter(
    prefix="/auth/consumer",
    tags=["auth_consumer"],
)

@router.post("/logout")
def consumer_logout(request: Request):
    request.session.clear()
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"ok": True},
    )
