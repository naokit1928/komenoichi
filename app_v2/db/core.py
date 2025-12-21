import os
from pathlib import Path

def resolve_db_path() -> Path:
<<<<<<< HEAD
    db_path = os.getenv("DB_PATH")
    if not db_path:
        raise RuntimeError("DB_PATH is not set")
    return Path(db_path).resolve()
=======
    return Path(os.getenv("DB_PATH", "app.db")).resolve()
>>>>>>> f2214c5 (backend: finalize db path and render deploy ready)
