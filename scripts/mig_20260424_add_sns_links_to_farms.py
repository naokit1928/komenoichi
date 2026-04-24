import sys
from pathlib import Path
import sqlite3

# PYTHONPATH を打たずに実行するためのルートパス解決
PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))

from app_v2.db.core import resolve_db_path

def migrate():
    db_path = resolve_db_path()
    print(f"[migrate] db = {db_path}")

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    try:
        print("[migrate] begin")
        cur.execute("PRAGMA foreign_keys = OFF;")

        # --- migration 処理 ---
        print("Adding sns_links_json column to farms table...")
        cur.execute("ALTER TABLE farms ADD COLUMN sns_links_json TEXT;")

        conn.commit()
        print("[migrate] success")

    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("[migrate] skip: column sns_links_json already exists.")
        else:
            conn.rollback()
            print("[migrate] failed:", e)
            raise
    except Exception as e:
        conn.rollback()
        print("[migrate] failed:", e)
        raise

    finally:
        cur.execute("PRAGMA foreign_keys = ON;")
        conn.close()

if __name__ == "__main__":
    migrate()