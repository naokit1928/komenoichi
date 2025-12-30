import sqlite3
from app_v2.db.core import resolve_db_path


def main():
    db_path = resolve_db_path()
    print(f"[migrate] db = {db_path}")

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    try:
        print("[migrate] begin")
        cur.execute("BEGIN")

        # --- legacy NULL cleanup (one-time, for rebuild safety) ---
        cur.execute("""
        UPDATE farms
        SET email = '__legacy__' || farm_id || '@invalid.local'
        WHERE email IS NULL;
        """)

        cur.execute("""
        UPDATE farms
        SET registration_status = 'EMAIL_REGISTERED'
        WHERE registration_status IS NULL;
        """)

        # 1. 既存 farms を元に、新テーブルを最終形で作成
        cur.execute("""
        CREATE TABLE farms_new (
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
            email TEXT NOT NULL,
            registration_status TEXT NOT NULL
        )
        """)

        # 2. データをすべてコピー
        cur.execute("""
        INSERT INTO farms_new (
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
            first_activated_at,
            owner_farmer_id,
            email,
            registration_status
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
            first_activated_at,
            owner_farmer_id,
            email,
            registration_status
        FROM farms
        """)

        # 3. 古いテーブルを削除
        cur.execute("DROP TABLE farms")

        # 4. 新テーブルを正式名称に
        cur.execute("ALTER TABLE farms_new RENAME TO farms")

        conn.commit()
        print("[migrate] success")

    except Exception as e:
        conn.rollback()
        print("[migrate] rollback")
        raise e

    finally:
        conn.close()


if __name__ == "__main__":
    main()
