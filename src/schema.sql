-- =========================================================
-- schema.sql
-- Generated from current SQLite .schema (single source of truth)
-- =========================================================

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
    sns_links_json TEXT,
    monthly_upload_bytes INTEGER DEFAULT 0,
    monthly_upload_limit INTEGER DEFAULT 150000000,
    next_reset_at TEXT,
    first_activated_at TEXT,
    owner_farmer_id INTEGER,
    email TEXT NOT NULL,
    registration_status TEXT NOT NULL,
    suspension_reason TEXT,
    warning_checked_count INTEGER DEFAULT 0
);

CREATE INDEX idx_farms_publishable_location
    ON farms (active_flag, is_accepting_reservations, pickup_lat, pickup_lng);

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
    pickup_display TEXT,
    confirmed_at DATETIME,
    event_start_at DATETIME,
    event_end_at DATETIME,
    guest_key TEXT,
    confirm_session_id TEXT,
    is_late_cancel INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (consumer_id) REFERENCES consumers(consumer_id),
    FOREIGN KEY (farm_id) REFERENCES farms(farm_id)
);

CREATE UNIQUE INDEX uq_pending_per_cs
    ON reservations(confirm_session_id)
    WHERE status='PENDING' AND confirm_session_id IS NOT NULL;

-- =========================================================
-- confirm_sessions
-- =========================================================
CREATE TABLE confirm_sessions (
    confirm_session_id TEXT PRIMARY KEY,
    consumer_id INTEGER,
    status TEXT NOT NULL,
    draft_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    consumed_at TEXT,
    expired_at TEXT
);

CREATE INDEX idx_confirm_sessions_consumer_id ON confirm_sessions (consumer_id);
CREATE INDEX idx_confirm_sessions_status ON confirm_sessions (status);
CREATE INDEX idx_confirm_sessions_expires_at ON confirm_sessions (expires_at);

-- =========================================================
-- magic_link_tokens (カスタマー用)
-- =========================================================
CREATE TABLE magic_link_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    reservation_id INTEGER,
    consumer_id INTEGER,
    agreed INTEGER NOT NULL CHECK (agreed IN (0, 1)),
    used INTEGER NOT NULL DEFAULT 0 CHECK (used IN (0, 1)),
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    used_at TEXT
);

-- =========================================================
-- farm_magic_link_tokens (農家用)
-- =========================================================
CREATE TABLE farm_magic_link_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    farm_id INTEGER,
    used INTEGER NOT NULL DEFAULT 0 CHECK (used IN (0, 1)),
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    used_at TEXT
);

CREATE INDEX idx_farm_magic_link_tokens_token ON farm_magic_link_tokens(token);

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

CREATE INDEX idx_email_otp_tokens_email ON email_otp_tokens (email);
CREATE INDEX idx_email_otp_tokens_expires_at ON email_otp_tokens (expires_at);

-- =========================================================
-- consumer_favorites (お気に入り機能)
-- =========================================================
CREATE TABLE consumer_favorites (
    consumer_id INTEGER NOT NULL,
    farm_id INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (consumer_id, farm_id),
    FOREIGN KEY (consumer_id) REFERENCES consumers(consumer_id),
    FOREIGN KEY (farm_id) REFERENCES farms(farm_id)
);

-- =========================================================
-- farm_status_logs (農家の受付トグル切り替え履歴)
-- =========================================================
CREATE TABLE farm_status_logs (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    farm_id INTEGER NOT NULL,
    is_accepting INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    reason TEXT,
    is_checked INTEGER DEFAULT 0,
    FOREIGN KEY (farm_id) REFERENCES farms(farm_id)
);

CREATE INDEX idx_farm_status_logs_farm_id ON farm_status_logs(farm_id);