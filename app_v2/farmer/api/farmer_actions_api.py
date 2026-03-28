# app_v2/farmer/api/farmer_actions_api.py

from fastapi import APIRouter, Request, HTTPException
import sqlite3
from datetime import datetime, timedelta, timezone
from app_v2.db.core import resolve_db_path

router = APIRouter(tags=["farmer_actions"])
DB_PATH = str(resolve_db_path())

# ==========================================
# ノーショーとして報告する（月2回上限あり）
# ==========================================
@router.post("/api/farmer/reservations/{reservation_id}/no_show")
def mark_as_no_show(reservation_id: int, request: Request):
    farm_id = request.session.get("farm_id")
    if not farm_id:
        raise HTTPException(status_code=401, detail="認証されていません。")

    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        
        cur.execute("SELECT status, event_start_at FROM reservations WHERE reservation_id = ? AND farm_id = ?", (reservation_id, farm_id))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="予約が見つかりません。")

        thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        cur.execute("""
            SELECT COUNT(*) as cnt 
            FROM reservations 
            WHERE farm_id = ? AND status = 'no_show' AND event_start_at >= ?
        """, (farm_id, thirty_days_ago))
        
        count = cur.fetchone()["cnt"]
        if count >= 2:
            raise HTTPException(status_code=400, detail="月間の無断キャンセル報告上限（2回）に達しました。これ以上の報告は運営にご連絡ください。")

        cur.execute("UPDATE reservations SET status = 'no_show' WHERE reservation_id = ?", (reservation_id,))
        conn.commit()
        
    return {"ok": True}


# ==========================================
# ノーショー報告を取り消す（遅れて来た時用）
# ==========================================
@router.post("/api/farmer/reservations/{reservation_id}/undo_no_show")
def undo_no_show(reservation_id: int, request: Request):
    farm_id = request.session.get("farm_id")
    if not farm_id:
        raise HTTPException(status_code=401, detail="認証されていません。")
    
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        
        cur.execute("SELECT status FROM reservations WHERE reservation_id = ? AND farm_id = ?", (reservation_id, farm_id))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="予約が見つかりません。")
            
        if row["status"] == "no_show":
            cur.execute("UPDATE reservations SET status = 'confirmed' WHERE reservation_id = ?", (reservation_id,))
            conn.commit()
        
    return {"ok": True}