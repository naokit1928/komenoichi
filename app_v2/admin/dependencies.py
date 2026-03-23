# backend/app_v2/admin/dependencies.py
import os
import sqlite3
from fastapi import Request, HTTPException
from app_v2.db.core import resolve_db_path

def verify_admin_session(request: Request):
    """
    管理者権限をチェックする関所（Dependency）
    セッションの consumer_id からメールアドレスを引き、ADMIN_EMAILS と一致するか確認する。
    """
    consumer_id = request.session.get("consumer_id")
    if not consumer_id:
        raise HTTPException(status_code=403, detail="Not authenticated")

    admin_emails_env = os.getenv("ADMIN_EMAILS", "")
    if not admin_emails_env:
        raise HTTPException(status_code=403, detail="Admin emails not configured")
    
    allowed_emails = [e.strip().lower() for e in admin_emails_env.split(",") if e.strip()]

    db_path = resolve_db_path()
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        row = conn.execute(
            "SELECT email FROM consumers WHERE consumer_id = ?",
            (consumer_id,)
        ).fetchone()
        
        if not row or not row["email"]:
            raise HTTPException(status_code=403, detail="Consumer not found")
        
        user_email = row["email"].strip().lower()
        
        if user_email not in allowed_emails:
            raise HTTPException(status_code=403, detail="Access denied: Admins only")
        
        return user_email
    finally:
        conn.close()