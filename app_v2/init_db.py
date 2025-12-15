import os
import sqlite3
from pathlib import Path

print("INIT_DB RUNNING:", os.environ.get("APP_DB_PATH"))

DB_PATH = os.environ["APP_DB_PATH"]
SCHEMA_PATH = Path(__file__).resolve().parents[2] / "schema.sql"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        conn.executescript(f.read())
    conn.commit()
    conn.close()
