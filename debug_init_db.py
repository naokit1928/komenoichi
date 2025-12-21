import sqlite3
from pathlib import Path

DB_PATH = Path("debug_app.db")
SCHEMA_PATH = Path("src/schema.sql")

print("DB_PATH:", DB_PATH.resolve())
print("SCHEMA_PATH:", SCHEMA_PATH.resolve())

schema_sql = SCHEMA_PATH.read_text(encoding="utf-8")

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

statements = [
    s.strip() for s in schema_sql.split(";")
    if s.strip()
]

for i, stmt in enumerate(statements, 1):
    print(f"\n--- SQL #{i} ---")
    print(stmt[:200], "..." if len(stmt) > 200 else "")
    try:
        cur.execute(stmt)
        conn.commit()
        print("OK")
    except Exception as e:
        print("ERROR:", e)
        break

conn.close()

print("\n.tables:")
conn = sqlite3.connect(DB_PATH)
print(conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall())
conn.close()
