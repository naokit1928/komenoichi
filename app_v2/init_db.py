from pathlib import Path
import sqlite3

DB_PATH = Path("/var/data/app.db")

# Render / ローカル共通で必ず通る
BASE_DIR = Path(__file__).resolve().parents[2]  # = /opt/render/project/src
SCHEMA_PATH = BASE_DIR / "src" / "schema.sql"   # = /opt/render/project/src/src/schema.sql

def init_db():
    print("INIT_DB RUNNING:", DB_PATH)
    print("SCHEMA_PATH:", SCHEMA_PATH)

    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        schema_sql = f.read()

    conn = sqlite3.connect(DB_PATH)
    conn.executescript(schema_sql)
    conn.commit()   # ← ★この1行を追加
    conn.close()
