from pathlib import Path
import sqlite3

DB_PATH = Path("/var/data/app.db")

# Render / ローカル共通
# /opt/render/project/src/app_v2/init_db.py
#            ↑ parents[0]
# /opt/render/project/src/app_v2
#            ↑ parents[1]
# /opt/render/project/src
#            ↑ parents[2]
BASE_DIR = Path(__file__).resolve().parents[2]
SCHEMA_PATH = BASE_DIR / "src" / "schema.sql"


def init_db():
    print("=== INIT_DB START ===")
    print("DB_PATH:", DB_PATH)
    print("SCHEMA_PATH:", SCHEMA_PATH)

    # schema.sql の存在確認
    if not SCHEMA_PATH.exists():
        print("ERROR: schema.sql NOT FOUND")
        return

    try:
        schema_sql = SCHEMA_PATH.read_text(encoding="utf-8")
        print("schema.sql loaded. length =", len(schema_sql))
    except Exception as e:
        print("ERROR: failed to read schema.sql:", e)
        return

    try:
        conn = sqlite3.connect(DB_PATH)
        print("sqlite connected")

        conn.executescript(schema_sql)
        print("executescript OK")

        conn.commit()
        print("commit OK")

        conn.close()
        print("connection closed")

    except Exception as e:
        print("ERROR during DB init:", e)
        return

    print("=== INIT_DB END ===")
