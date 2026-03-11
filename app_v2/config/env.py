# app_v2/config/env.py
import os

FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL")
if not FRONTEND_BASE_URL:
    raise RuntimeError("FRONTEND_BASE_URL is not set")

POSTMARK_SERVER_TOKEN = os.getenv("POSTMARK_SERVER_TOKEN")
MAIL_FROM = os.getenv("MAIL_FROM")
MAIL_FROM_NAME = os.getenv("MAIL_FROM_NAME", "")
