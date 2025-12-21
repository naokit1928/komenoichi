# app_v2/db/core.py
import os
from pathlib import Path

def resolve_db_path() -> Path:
    return Path(os.getenv("DB_PATH", "app.db")).resolve()
