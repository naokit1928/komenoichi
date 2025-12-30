-- email OTP tokens table

CREATE TABLE IF NOT EXISTS email_otp_tokens (
    otp_id INTEGER PRIMARY KEY AUTOINCREMENT,

    email TEXT NOT NULL,
    code TEXT NOT NULL,

    expires_at TEXT NOT NULL,
    consumed_at TEXT,
    attempt_count INTEGER NOT NULL DEFAULT 0,

    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_email_otp_tokens_email
ON email_otp_tokens (email);

CREATE INDEX IF NOT EXISTS idx_email_otp_tokens_expires_at
ON email_otp_tokens (expires_at);
