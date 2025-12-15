import os
from pathlib import Path

def resolve_db_path() -> Path:
    db_path = os.getenv("DB_PATH")
    if not db_path:
        raise RuntimeError("DB_PATH is not set")
    return Path(db_path).resolve()
