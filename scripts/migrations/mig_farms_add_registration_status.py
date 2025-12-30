import sqlite3
from app_v2.db.core import resolve_db_path


def column_exists(cur, table, column):
    cur.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cur.fetchall())


def migrate():
    db_path = resolve_db_path()
    print(f"[migrate] db = {db_path}")

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    print("[migrate] begin")

    if not column_exists(cur, "farms", "registration_status"):
        print("[migrate] add column registration_status")
        cur.execute("""
            ALTER TABLE farms
            ADD COLUMN registration_status TEXT
        """)
    else:
        print("[migrate] registration_status already exists")

    print("[migrate] fill default status")
    cur.execute("""
        UPDATE farms
        SET registration_status = 'EMAIL_REGISTERED'
        WHERE registration_status IS NULL
    """)

    conn.commit()
    conn.close()

    print("[migrate] success")


if __name__ == "__main__":
    migrate()
