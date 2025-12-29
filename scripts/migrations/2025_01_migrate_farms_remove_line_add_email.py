"""
2025-01 migration: farms テーブルを現行仕様に揃える

目的
----
旧 farms スキーマ（LINE 連携前提）を、現行仕様に安全に移行する。

変更内容（最終形）
------------------
- farmer_line_id, is_friend を完全に削除
- name を nullable に変更
- email TEXT を追加
- owner_farmer_id INTEGER を追加

重要方針
--------
- SQLite の制約を前提にする
- DB の「現状」を PRAGMA で観測してから動作する
- すでに現行スキーマなら何もしない
- Alembic のような履歴依存・状態機械は使わない
"""

import sqlite3
from pathlib import Path


DB_PATH = Path(
    # Render 本番では /var/data/app.db 等を想定
    # ローカル実行時は適宜書き換える
    "/var/data/app.db"
)


def get_columns(cur, table: str) -> dict:
    """
    PRAGMA table_info を dict で返す
    { column_name: {notnull, type, dflt_value} }
    """
    rows = cur.execute(f"PRAGMA table_info({table})").fetchall()
    return {
        row[1]: {
            "type": row[2],
            "notnull": row[3],
            "default": row[4],
        }
        for row in rows
    }


def is_already_migrated(cols: dict) -> bool:
    """
    すでに現行スキーマかどうか判定
    """
    return (
        "email" in cols
        and "owner_farmer_id" in cols
        and "farmer_line_id" not in cols
        and "is_friend" not in cols
        and cols.get("name", {}).get("notnull") == 0
    )


def main():
    print("=== farms migration start ===")

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cols = get_columns(cur, "farms")

    if is_already_migrated(cols):
        print("Already migrated. Nothing to do.")
        conn.close()
        return

    print("Migration required. Rebuilding farms table...")

    # トランザクション開始
    cur.execute("BEGIN")

    try:
        # 1. 新しい farms テーブルを作成
        cur.execute(
            """
            CREATE TABLE farms_new (
                farm_id INTEGER PRIMARY KEY,
                last_name TEXT,
                first_name TEXT,
                last_kana TEXT,
                first_kana TEXT,
                phone TEXT,

                name TEXT, -- nullable

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
            )
            """
        )

        # 2. 旧 farms から必要なカラムだけコピー
        cur.execute(
            """
            INSERT INTO farms_new (
                farm_id,
                last_name, first_name, last_kana, first_kana, phone,
                name,
                description, postal_code, address, map_url, lat, lng,
                price_5kg, price_10kg, price_25kg,
                pickup_location, pickup_time, pickup_lat, pickup_lng,
                pickup_place_name, pickup_notes,
                active_flag, is_public, is_accepting_reservations,
                admin_note, rice_variety_label, harvest_year,
                pr_title, pr_text,
                face_image_url, cover_image_url, pr_images_json,
                monthly_upload_bytes, monthly_upload_limit,
                next_reset_at, first_activated_at,
                owner_farmer_id, email
            )
            SELECT
                farm_id,
                last_name, first_name, last_kana, first_kana, phone,
                name,
                description, postal_code, address, map_url, lat, lng,
                price_5kg, price_10kg, price_25kg,
                pickup_location, pickup_time, pickup_lat, pickup_lng,
                pickup_place_name, pickup_notes,
                active_flag, is_public, is_accepting_reservations,
                admin_note, rice_variety_label, harvest_year,
                pr_title, pr_text,
                face_image_url, cover_image_url, pr_images_json,
                monthly_upload_bytes, monthly_upload_limit,
                next_reset_at, first_activated_at,
                owner_farmer_id, email
            FROM farms
            """
        )

        # 3. 旧テーブルを削除してリネーム
        cur.execute("DROP TABLE farms")
        cur.execute("ALTER TABLE farms_new RENAME TO farms")

        conn.commit()
        print("Migration completed successfully.")

    except Exception as e:
        conn.rollback()
        print("Migration failed. Rolled back.")
        raise e

    finally:
        conn.close()


if __name__ == "__main__":
    main()
