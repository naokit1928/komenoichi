from __future__ import annotations

import os
from typing import Iterator, Optional

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker


def _load_database_url() -> str:
    """
    優先: 1) pydantic-settings（あれば） 2) 環境変数 3) 既定 sqlite
    """
    try:
        # 任意依存。CIや本番で未インストールでも動くようにする。
        from pydantic_settings import BaseSettings  # type: ignore

        class Settings(BaseSettings):
            database_url: str = "sqlite:///./app.db"

            class Config:
                env_file = ".env"
                env_prefix = ""
                case_sensitive = False

        return Settings().database_url
    except Exception:
        return os.getenv("DATABASE_URL", "sqlite:///./app.db")


SQLALCHEMY_DATABASE_URL = _load_database_url()

connect_args = (
    {"check_same_thread": False}
    if SQLALCHEMY_DATABASE_URL.startswith("sqlite")
    else {}
)

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db() -> Iterator[Session]:
    db: Optional[Session] = None
    try:
        db = SessionLocal()
        yield db
    finally:
        if db is not None:
            db.close()
