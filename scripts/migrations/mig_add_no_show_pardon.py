# scripts/migrations/mig_add_no_show_pardon.py
import sys
from pathlib import Path
PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))

import sqlite3
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
        print("Adding no_show_pardon column to consumers table...")
        cur.execute("ALTER TABLE consumers ADD COLUMN no_show_pardon INTEGER DEFAULT 0;")

        conn.commit()
        print("[migrate] success")

    except Exception as e:
        conn.rollback()
        print("[migrate] failed:", e)
        raise

    finally:
        cur.execute("PRAGMA foreign_keys = ON;")
        conn.close()

if __name__ == "__main__":
    migrate()