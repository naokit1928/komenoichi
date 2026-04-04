# app_v2/farmer/api/farmer_actions_api.py

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
import sqlite3
from datetime import datetime, timedelta, timezone
from app_v2.db.core import resolve_db_path

# ★ パスを正しい場所（integrations.email）に修正しました
from app_v2.integrations.email.postmark_client import send_farmer_emergency_cancel_email

router = APIRouter(tags=["farmer_actions"])
DB_PATH = str(resolve_db_path())


class EmergencyStopRequest(BaseModel):
    reason: str  # 'A' (災害・不可抗力) または 'B' (自己都合・在庫調整)


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


# ==========================================
# 緊急停止（一括キャンセル）
# ==========================================
@router.post("/api/farmer/emergency-stop")
def farmer_emergency_stop(request: Request, body: EmergencyStopRequest):
    farm_id = request.session.get("farm_id")
    if not farm_id:
        raise HTTPException(status_code=401, detail="認証されていません。")

    if body.reason not in ("A", "B"):
        raise HTTPException(status_code=400, detail="不正な停止理由です。")

    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        try:
            # 1. 農家の受付を停止し、理由を記録
            cur.execute("""
                UPDATE farms 
                SET is_accepting_reservations = 0, suspension_reason = ? 
                WHERE farm_id = ?
            """, (body.reason, farm_id))

            # 2. ログテーブルにも理由付きで記録
            cur.execute("""
                INSERT INTO farm_status_logs (farm_id, is_accepting, created_at, reason) 
                VALUES (?, 0, datetime('now'), ?)
            """, (farm_id, body.reason))

            # 3. 今週（未来）の確定済み予約を取得
            cur.execute("""
                SELECT r.reservation_id, r.consumer_id, c.email, f.name as farm_name 
                FROM reservations r
                JOIN consumers c ON r.consumer_id = c.consumer_id
                JOIN farms f ON r.farm_id = f.farm_id
                WHERE r.farm_id = ? AND r.status = 'confirmed' AND r.event_start_at >= datetime('now')
            """, (farm_id,))
            active_reservations = cur.fetchall()

            # 4. 予約を一括でキャンセル状態に更新
            for res in active_reservations:
                cur.execute("UPDATE reservations SET status = 'cancelled' WHERE reservation_id = ?", (res["reservation_id"],))
            
            # コミットしてDBの状態を確定
            conn.commit()

        except Exception as e:
            conn.rollback()
            raise HTTPException(status_code=500, detail=f"処理中にエラーが発生しました: {str(e)}")

    # 5. DB確定後、対象者に一斉メール送信（Postmark）
    cancel_count = 0
    for res in active_reservations:
        if res["email"]:
            try:
                send_farmer_emergency_cancel_email(
                    to_email=res["email"], 
                    farm_name=res["farm_name"], 
                    reason=body.reason
                )
            except Exception as e:
                # 1件のメール送信失敗で全体のエラーにしないための防波堤
                print(f"[MAIL_ERROR] Failed to send emergency cancel email to {res['email']}: {e}")
            cancel_count += 1

    return {
        "ok": True, 
        "cancelled_count": cancel_count, 
        "message": f"受付を停止し、{cancel_count}件の予約をキャンセルしました。"
    }