# scripts/migrations/mig_farms_email.py

import sys
from pathlib import Path

# ★ ここが最重要：project/src を PYTHONPATH に強制追加
PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))

import sqlite3
from app_v2.db.core import resolve_db_path


def migrate():
    db_path: Path = resolve_db_path()
    print(f"[migrate] db = {db_path}")

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    try:
        print("[migrate] begin")

        cur.execute("PRAGMA foreign_keys = OFF;")

        cur.execute("""
            ALTER TABLE farms RENAME TO farms_old;
        """)

        cur.execute("""
            CREATE TABLE farms (
                farm_id INTEGER PRIMARY KEY,

                last_name TEXT,
                first_name TEXT,
                last_kana TEXT,
                first_kana TEXT,
                phone TEXT,

                name TEXT,
                description TEXT,
                postal_code TEXT,
                address TEXT,
                map_url TEXT,
                lat REAL,
                lng REAL,

                price_5kg INTEGER,
                price_10kg INTEGER,
                price_25kg INTEGER,

                pickup_location TEXT,
                pickup_time TEXT,
                pickup_lat REAL,
                pickup_lng REAL,
                pickup_place_name TEXT,
                pickup_notes TEXT,

                active_flag INTEGER NOT NULL DEFAULT 1,
                is_public INTEGER NOT NULL DEFAULT 0,
                is_accepting_reservations INTEGER NOT NULL DEFAULT 0,

                admin_note TEXT,
                rice_variety_label TEXT,
                harvest_year TEXT,

                pr_title TEXT,
                pr_text TEXT,
                face_image_url TEXT,
                cover_image_url TEXT,
                pr_images_json TEXT,

                monthly_upload_bytes INTEGER DEFAULT 0,
                monthly_upload_limit INTEGER DEFAULT 150000000,
                next_reset_at TEXT,

                first_activated_at TEXT,

                owner_farmer_id INTEGER,
                email TEXT
            );
        """)

        cur.execute("""
            INSERT INTO farms (
                farm_id,
                last_name,
                first_name,
                last_kana,
                first_kana,
                phone,
                name,
                description,
                postal_code,
                address,
                map_url,
                lat,
                lng,
                price_5kg,
                price_10kg,
                price_25kg,
                pickup_location,
                pickup_time,
                pickup_lat,
                pickup_lng,
                pickup_place_name,
                pickup_notes,
                active_flag,
                is_public,
                is_accepting_reservations,
                admin_note,
                rice_variety_label,
                harvest_year,
                pr_title,
                pr_text,
                face_image_url,
                cover_image_url,
                pr_images_json,
                monthly_upload_bytes,
                monthly_upload_limit,
                next_reset_at,
                first_activated_at
            )
            SELECT
                farm_id,
                last_name,
                first_name,
                last_kana,
                first_kana,
                phone,
                name,
                description,
                postal_code,
                address,
                map_url,
                lat,
                lng,
                price_5kg,
                price_10kg,
                price_25kg,
                pickup_location,
                pickup_time,
                pickup_lat,
                pickup_lng,
                pickup_place_name,
                pickup_notes,
                active_flag,
                is_public,
                is_accepting_reservations,
                admin_note,
                rice_variety_label,
                harvest_year,
                pr_title,
                pr_text,
                face_image_url,
                cover_image_url,
                pr_images_json,
                monthly_upload_bytes,
                monthly_upload_limit,
                next_reset_at,
                first_activated_at
            FROM farms_old;
        """)

        cur.execute("DROP TABLE farms_old;")

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
