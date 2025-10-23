# app/database.py
from __future__ import annotations

import os
from typing import Iterator, Optional

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base, Session

# ------------------------------------------------------------
# Settings: pydantic-settings があれば使う / 無ければ環境変数で代替
# ------------------------------------------------------------
def _load_database_url() -> str:
    """
    優先順:
      1) pydantic-settings が利用可能なら .env を読みつつ DATABASE_URL を解決
      2) 環境変数 DATABASE_URL
      3) 既定値: sqlite:///./app.db
    """
    try:
        # optional import（CIや最小構成で未インストールでもOK）
        from pydantic_settings import BaseSettings  # type: ignore

        class Settings(BaseSettings):
            database_url: str = "sqlite:///./app.db"

            class Config:
                env_file = ".env"
                env_prefix = ""
                case_sensitive = False

        settings = Settings()
        return settings.database_url
    except Exception:
        # モジュール未導入 or 解析失敗時は環境変数→既定値
        return os.getenv("DATABASE_URL", "sqlite:///./app.db")


SQLALCHEMY_DATABASE_URL: str = _load_database_url()

# ------------------------------------------------------------
# SQLAlchemy (SQLite なら connect_args を付ける)
# ------------------------------------------------------------
connect_args = {}
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# ------------------------------------------------------------
# FastAPI 依存性: DBセッション
# ------------------------------------------------------------
def get_db() -> Iterator[Session]:
    db: Optional[Session] = None
    try:
        db = SessionLocal()
        yield db
    finally:
        if db is not None:
            db.close()
