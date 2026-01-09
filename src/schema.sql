-- =========================================================
-- schema.sql
-- Generated from current SQLite .schema (single source of truth)
-- =========================================================

-- =========================================================
-- reservations
-- =========================================================
CREATE TABLE reservations (
    reservation_id INTEGER PRIMARY KEY AUTOINCREMENT,
    consumer_id INTEGER,
    farm_id INTEGER,
    item TEXT,
    quantity INTEGER,
    price FLOAT,
    amount FLOAT,
    status VARCHAR(32),
    created_at DATETIME,
    paid_service_fee BOOLEAN DEFAULT 0,
    payment_intent_id VARCHAR(100),
    payment_status VARCHAR(50),
    payment_succeeded_at DATETIME,
    pickup_slot_code VARCHAR(32),
    items_json TEXT,
    rice_subtotal INTEGER,
    service_fee INTEGER,
    currency VARCHAR(10) DEFAULT 'jpy',
    FOREIGN KEY (consumer_id) REFERENCES consumers(consumer_id),
    FOREIGN KEY (farm_id) REFERENCES farms(farm_id)
);

-- =========================================================
-- email_otp_tokens
-- =========================================================
CREATE TABLE email_otp_tokens (
    otp_id INTEGER PRIMARY KEY AUTOINCREMENT,

    email TEXT NOT NULL,
    code TEXT NOT NULL,

    expires_at TEXT NOT NULL,
    consumed_at TEXT,
    attempt_count INTEGER NOT NULL DEFAULT 0,

    created_at TEXT NOT NULL
);

CREATE INDEX idx_email_otp_tokens_email
    ON email_otp_tokens (email);

CREATE INDEX idx_email_otp_tokens_expires_at
    ON email_otp_tokens (expires_at);

-- =========================================================
-- farms
-- =========================================================
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

    email TEXT NOT NULL,
    registration_status TEXT NOT NULL
);

-- =========================================================
-- magic_link_tokens
-- =========================================================
CREATE TABLE magic_link_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    confirm_context_json TEXT NOT NULL,
    agreed INTEGER NOT NULL CHECK (agreed IN (0, 1)),
    used INTEGER NOT NULL DEFAULT 0 CHECK (used IN (0, 1)),
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    used_at TEXT,
    reservation_id INTEGER,
    consumer_id INTEGER
);

CREATE INDEX idx_magic_link_tokens_token
    ON magic_link_tokens (token);

CREATE INDEX idx_magic_link_tokens_expires_at
    ON magic_link_tokens (expires_at);

-- =========================================================
-- consumers
-- =========================================================
CREATE TABLE consumers (
    consumer_id INTEGER PRIMARY KEY,
    created_at TEXT,
    stripe_customer_id TEXT,
    registration_status TEXT,
    email TEXT
);
