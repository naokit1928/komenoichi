# app/routers/users.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import schemas, crud, models

router = APIRouter(prefix="/users", tags=["users"])

@router.post("/", response_model=schemas.UserResponse)
def create_user(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    # 受け取った payload をそのまま CRUD に渡す（line_user_id も含む）
    user = crud.create_user(db, payload)
    return user

@router.get("/", response_model=list[schemas.UserResponse])
def read_users(db: Session = Depends(get_db)):
    return crud.get_users(db)
