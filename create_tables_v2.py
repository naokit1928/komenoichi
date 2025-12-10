import sqlite3
from pathlib import Path


# このファイルと同じフォルダ直下の app.db を対象にする
DB_PATH = Path(__file__).resolve().parent / "app.db"


def create_tables() -> None:
    """
    V2 で実際に使っているコアテーブルだけを作成するスクリプト。

    - users / farms / farmer_profiles / reservations / reservation_items を作成
    - すべて CREATE TABLE IF NOT EXISTS なので、
      既存 app.db に対して実行しても「存在しないテーブルだけ」作成される
    - 既存テーブルの DROP / 破壊的変更は一切しない
    """
    conn = sqlite3.connect(DB_PATH)
    try:
        # 外部キーを有効化（reservation_items → reservations, farmer_profiles → farms）
        conn.execute("PRAGMA foreign_keys = ON;")

        # -------------------------------
        # users
        # -------------------------------
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id                  INTEGER     PRIMARY KEY,
                name                VARCHAR     NOT NULL,
                phone               VARCHAR,
                postal_code         VARCHAR,
                role                VARCHAR     NOT NULL,
                created_at          DATETIME,
                line_user_id        VARCHAR,
                stripe_customer_id  VARCHAR(100),
                registration_status TEXT,
                is_friend           INTEGER,
                address             VARCHAR(255),
                last_name           TEXT,
                first_name          TEXT,
                last_kana           TEXT,
                first_kana          TEXT
            );
            """
        )

        # -------------------------------
        # farms
        # -------------------------------
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS farms (
                id                          INTEGER         PRIMARY KEY,
                user_id                     INTEGER         NOT NULL,
                name                        VARCHAR         NOT NULL,
                description                 VARCHAR,
                postal_code                 VARCHAR         NOT NULL,
                address                     VARCHAR(255),
                map_url                     VARCHAR(512),
                lat                         FLOAT,
                lng                         FLOAT,
                location_status             VARCHAR(20)     NOT NULL DEFAULT 'pending',
                location_verified_at        DATETIME,
                location_verified_by        VARCHAR(100),
                location_note               TEXT,
                price_5kg                   FLOAT,
                price_10kg                  FLOAT,
                price_25kg                  FLOAT,
                stock                       INTEGER,
                pickup_location             VARCHAR,
                pickup_time                 VARCHAR,
                active_flag                 BOOLEAN         NOT NULL DEFAULT 1,
                owner_user_id               INTEGER,
                pickup_lat                  REAL,
                pickup_lng                  REAL,
                pickup_place_name           TEXT,
                pickup_location_text        TEXT,
                pickup_notes                TEXT,
                is_public                   INTEGER         NOT NULL DEFAULT 0,
                is_accepting_reservations   INTEGER         NOT NULL DEFAULT 0,
                admin_note                  TEXT,
                rice_variety_label          TEXT,
                harvest_year                INTEGER
            );
            """
        )

        # -------------------------------
        # farmer_profiles
        # -------------------------------
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS farmer_profiles (
                id                   INTEGER        PRIMARY KEY,
                farm_id              INTEGER        NOT NULL,
                pr_title             VARCHAR(60),
                pr_text              TEXT,
                face_image_url       VARCHAR(512),
                cover_image_url      VARCHAR(512),
                pr_images_json       TEXT,
                monthly_upload_bytes INTEGER        NOT NULL DEFAULT '0',
                monthly_upload_limit INTEGER        NOT NULL DEFAULT '150000000',
                next_reset_at        DATETIME,
                created_at           DATETIME       NOT NULL DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f','now')),
                updated_at           DATETIME       NOT NULL DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f','now')),
                parking_guide        TEXT,
                FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE
            );
            """
        )

        # -------------------------------
        # reservations
        # -------------------------------
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS reservations (
                id                           INTEGER         PRIMARY KEY,
                user_id                      INTEGER,
                farm_id                      INTEGER,
                item                         VARCHAR,
                quantity                     INTEGER,
                price                        FLOAT,
                amount                       FLOAT,
                status                       VARCHAR(32),
                no_show_reason               TEXT,
                no_show_timestamp            DATETIME,
                contact_method               VARCHAR(16),
                contact_result               TEXT,
                user_confirmation_status     VARCHAR(20),
                user_confirmation_note       TEXT,
                user_confirmation_checked_at DATETIME,
                created_at                   DATETIME,
                order_id                     VARCHAR,
                paid_service_fee             BOOLEAN         DEFAULT 0,
                payment_intent_id            VARCHAR(100),
                payment_status               VARCHAR(50),
                payment_succeeded_at         DATETIME,
                line_notified_at             DATETIME,
                pickup_slot_code             VARCHAR(32),
                items_json                   TEXT,
                rice_subtotal                INTEGER,
                service_fee                  INTEGER,
                currency                     VARCHAR(10)     DEFAULT 'jpy'
            );
            """
        )

        # -------------------------------
        # reservation_items
        # -------------------------------
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS reservation_items (
                id             INTEGER     PRIMARY KEY,
                reservation_id INTEGER     NOT NULL,
                item           VARCHAR     NOT NULL,
                quantity       INTEGER     NOT NULL,
                unit_price     FLOAT       NOT NULL,
                line_amount    FLOAT       NOT NULL,
                note           TEXT,
                FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE
            );
            """
        )

        # -------------------------------
        # indexes
        # -------------------------------

        # users
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS ix_users_id
                ON users (id);
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS ix_users_stripe_customer_id
                ON users (stripe_customer_id);
            """
        )

        # farmer_profiles
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS ix_farmer_profiles_farm_id
                ON farmer_profiles (farm_id);
            """
        )

        # reservation_items
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS ix_reservation_items_reservation_id
                ON reservation_items (reservation_id);
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS ix_reservation_items_id
                ON reservation_items (id);
            """
        )

        # users.line_user_id のユニーク制約
        conn.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS ux_users_line_user_id
                ON users (line_user_id);
            """
        )

        conn.commit()
    finally:
        conn.close()


if __name__ == "__main__":
    create_tables()
    print(f"Created/verified core V2 tables in {DB_PATH}")
