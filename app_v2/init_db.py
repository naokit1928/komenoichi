from pathlib import Path
import os
import sqlite3


print("INIT_DB FILE:", __file__)


def resolve_project_root() -> Path:
    # ローカル:
    #   C:\Users\...\komet\app_v2\init_db.py
    # Render:
    #   /opt/render/project/src/app_v2/init_db.py
    #
    # parents[1] = app_v2
    # parents[2] = プロジェクトルート（komet / src）
    return Path(__file__).resolve().parents[1]


def resolve_db_path() -> Path:
    """
    優先順位:
      1) 環境変数 DB_PATH
      2) Windows: ./local_app.db
      3) Linux(Render): /var/data/app.db
    """
    env = (os.getenv("DB_PATH") or "").strip()
    if env:
        return Path(env)

    if os.name == "nt":  # Windows
        return Path("./local_app.db")

    # Linux / Render
    return Path("/var/data/app.db")


PROJECT_ROOT = resolve_project_root()
SCHEMA_PATH = PROJECT_ROOT / "src" / "schema.sql"
DB_PATH = resolve_db_path()


def init_db():
    print("=== INIT_DB START ===")
    print("PROJECT_ROOT:", PROJECT_ROOT)
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
        # 親ディレクトリが無いと SQLite は作れない
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)

        conn = sqlite3.connect(str(DB_PATH))
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


if __name__ == "__main__":
    init_db()
