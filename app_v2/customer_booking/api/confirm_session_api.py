from fastapi import APIRouter, Request, HTTPException
from datetime import datetime, timedelta
import sqlite3
import secrets
import json

from app_v2.db.core import resolve_db_path

# ★ 追加：ConfirmService と DTO のインポート
from app_v2.customer_booking.services.confirm_service import ConfirmService
from app_v2.customer_booking.dtos import ReservationFormDTO, ReservationItemInput

router = APIRouter(prefix="/api/confirm", tags=["confirm-session"])

# ============================================================
# Phase 2-0: ConfirmSession から farm_id だけ取得（軽量）
# ============================================================
@router.get("/sessions/{cs}/farm_id")
def get_farm_id_from_session(request: Request, cs: str):
    """
    ConfirmBridge で Active 判定をするために、
    PENDING を生成せずに farm_id だけ取得する。
    """
    consumer_id = request.session.get("consumer_id")
    if not consumer_id:
        raise HTTPException(status_code=401, detail="ログインが必要です")
    
    conn = sqlite3.connect(resolve_db_path())
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    
    try:
        cur.execute(
            """
            SELECT confirm_session_id, consumer_id, status, draft_json
            FROM confirm_sessions
            WHERE confirm_session_id = ?
            """,
            (cs,),
        )
        cs_row = cur.fetchone()
        
        if not cs_row:
            raise HTTPException(status_code=404, detail="Confirm セッションが見つかりません")

        if cs_row["consumer_id"] is None:
            cur.execute(
                """
                UPDATE confirm_sessions
                SET consumer_id = ?
                WHERE confirm_session_id = ?
                  AND consumer_id IS NULL
                """,
                (consumer_id, cs),
            )
            conn.commit()
        elif int(cs_row["consumer_id"]) != int(consumer_id):
            raise HTTPException(status_code=403, detail="別ユーザーの Confirm セッションです")

        if cs_row["status"] != "draft":
            raise HTTPException(status_code=400, detail="この Confirm セッションは使用できません")
        
        try:
            draft = json.loads(cs_row["draft_json"])
        except Exception:
            raise HTTPException(status_code=400, detail="draft_json のパースに失敗しました")
        
        farm_id = draft.get("farm_id")
        if not farm_id:
            raise HTTPException(status_code=400, detail="draft に farm_id がありません")
        
        return {"farm_id": farm_id}
    
    finally:
        conn.close()

# ============================================================
# Phase 2-1: FarmDetail → ConfirmSession を作るだけ（draft 保存）
# ============================================================
@router.post("/sessions")
def create_confirm_session(request: Request, payload: dict):
    confirm_session_id = secrets.token_urlsafe(16)

    now = datetime.utcnow()
    expires = now + timedelta(minutes=30)

    consumer_id = request.session.get("consumer_id")

    conn = sqlite3.connect(resolve_db_path())
    cur = conn.cursor()

    cur.execute(
        """
        INSERT INTO confirm_sessions
            (confirm_session_id, consumer_id, status, draft_json, created_at, expires_at)
        VALUES (?, ?, 'draft', ?, ?, ?)
        """,
        (
            confirm_session_id,
            consumer_id,
            json.dumps(payload, ensure_ascii=False),
            now.isoformat(),
            expires.isoformat(),
        ),
    )

    conn.commit()
    conn.close()

    return {"confirm_session_id": confirm_session_id}

# ============================================================
# Phase 2-2（最重要）: ConfirmBridge → cs 冪等で PENDING を生成 / 再利用
# ============================================================
@router.post("/from-session")
def create_pending_from_session(request: Request, cs: str):
    consumer_id = request.session.get("consumer_id")
    if not consumer_id:
        raise HTTPException(status_code=401, detail="ログインが必要です")

    now = datetime.utcnow()

    conn = sqlite3.connect(resolve_db_path())
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    try:
        # 1) confirm_session を取得
        cur.execute(
            """
            SELECT confirm_session_id, consumer_id, status, draft_json, expires_at
            FROM confirm_sessions
            WHERE confirm_session_id = ?
            """,
            (cs,),
        )
        cs_row = cur.fetchone()

        if not cs_row:
            raise HTTPException(status_code=404, detail="Confirm セッションが見つかりません")

        if cs_row["status"] != "draft":
            raise HTTPException(status_code=400, detail="この Confirm セッションは使用できません")

        # consumer_id の補完と検証
        if cs_row["consumer_id"] is None:
            cur.execute(
                """
                UPDATE confirm_sessions
                SET consumer_id = ?
                WHERE confirm_session_id = ?
                  AND consumer_id IS NULL
                """,
                (consumer_id, cs),
            )
            conn.commit()
        elif int(cs_row["consumer_id"]) != int(consumer_id):
            raise HTTPException(status_code=403, detail="別ユーザーの Confirm セッションです")

        try:
            expires_at = datetime.fromisoformat(cs_row["expires_at"])
        except Exception:
            raise HTTPException(status_code=400, detail="Confirm セッションの期限情報が不正です")

        # ====================================================
        # Step 3-3 FSM: expired 遷移
        # ====================================================
        if expires_at < now and cs_row["status"] == "draft":
            conn2 = sqlite3.connect(resolve_db_path())
            try:
                conn2.execute(
                    """
                    UPDATE confirm_sessions
                       SET status = 'expired',
                           expired_at = ?
                     WHERE confirm_session_id = ?
                       AND status = 'draft'
                    """,
                    (now.isoformat(), cs),
                )
                conn2.commit()
            finally:
                conn2.close()

            raise HTTPException(status_code=400, detail="Confirm セッションは期限切れです")

        # 2) 既存 PENDING を探す（cs 冪等）
        cur.execute(
            """
            SELECT *
            FROM reservations
            WHERE confirm_session_id = ?
              AND status = 'PENDING'
            """,
            (cs,),
        )
        pending = cur.fetchone()

        if pending:
            # cs 冪等：既にあれば必ず再利用
            return {
                "status": "reused",
                "farm_id": pending["farm_id"],
            }

        # 3) draft のパースと DTO への詰め替え
        try:
            draft = json.loads(cs_row["draft_json"])
        except Exception:
            raise HTTPException(status_code=400, detail="Confirm セッションの draft が不正です")

        if "farm_id" not in draft:
            raise HTTPException(status_code=400, detail="draft に farm_id がありません")

        items_input = []
        for it in draft.get("items", []):
            items_input.append(ReservationItemInput(
                size_kg=it["size_kg"],
                quantity=it["quantity"]
            ))

        form_dto = ReservationFormDTO(
            farm_id=draft["farm_id"],
            pickup_slot_code=draft.get("pickup_slot_code", ""),
            pickup_display=draft.get("pickup_display", ""),
            items=items_input,
            client_next_pickup_deadline_iso=draft.get("client_next_pickup_deadline_iso")
        )

        service = ConfirmService()

        # 4) ConfirmService に処理を委譲（価格再計算・締切チェック・INSERT を安全に行う）
        try:
            cur.execute("BEGIN;")

            result = service.create_pending_reservation(
                payload=form_dto,
                consumer_id=consumer_id,
                conn=conn
            )

            # ConfirmService は confirm_session_id を知らないため、ここで UPDATE して紐付ける
            cur.execute(
                "UPDATE reservations SET confirm_session_id = ? WHERE reservation_id = ?",
                (cs, result.reservation_id)
            )

            conn.commit()

        except HTTPException as e:
            conn.rollback()
            raise e
        except sqlite3.IntegrityError:
            conn.rollback()
            # 同時実行での競合対策（冪等リトライ）
            cur.execute(
                """
                SELECT *
                FROM reservations
                WHERE confirm_session_id = ?
                  AND status = 'PENDING'
                """,
                (cs,),
            )
            pending2 = cur.fetchone()
            if not pending2:
                raise HTTPException(status_code=500, detail="PENDING の作成に失敗しました")
            return {
                "status": "reused",
                "farm_id": pending2["farm_id"],
            }
        except Exception as e:
            conn.rollback()
            raise HTTPException(status_code=500, detail=f"PENDING の作成に失敗しました: {e}")

        return {
            "status": "created",
            "farm_id": draft["farm_id"],
        }

    finally:
        conn.close()

# ============================================================
# Phase 3: ConfirmPage 用の Context 取得 API
# ============================================================
@router.get("/sessions/{cs}/context")
def get_confirm_session_context(request: Request, cs: str):
    consumer_id = request.session.get("consumer_id")
    if not consumer_id:
        raise HTTPException(status_code=401, detail="ログインが必要です")

    conn = sqlite3.connect(resolve_db_path())
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    try:
        cur.execute(
            """
            SELECT confirm_session_id, consumer_id, status, draft_json, expires_at
            FROM confirm_sessions
            WHERE confirm_session_id = ?
            """,
            (cs,),
        )
        cs_row = cur.fetchone()

        if not cs_row:
            raise HTTPException(status_code=404, detail="Confirm セッションが見つかりません")

        try:
            expires_at = datetime.fromisoformat(cs_row["expires_at"])
        except Exception:
            expires_at = datetime.utcnow()

        if expires_at < datetime.utcnow() and cs_row["status"] == "draft":
             raise HTTPException(status_code=400, detail="セッションの有効期限が切れています")

        if cs_row["consumer_id"] is not None:
             if int(cs_row["consumer_id"]) != int(consumer_id):
                 raise HTTPException(status_code=403, detail="他ユーザーのセッションです")

        try:
            draft = json.loads(cs_row["draft_json"])
        except Exception:
            raise HTTPException(status_code=500, detail="JSON parse error")

        farm_id = draft.get("farm_id")
        items_in = draft.get("items", [])
        
        cur.execute(
            """
            SELECT price_5kg, price_10kg, price_25kg
            FROM farms
            WHERE farm_id = ?
            """,
            (farm_id,),
        )
        price_row = cur.fetchone()
        if not price_row:
            raise HTTPException(status_code=404, detail="農家が見つかりません")

        price_map = {
            5: price_row["price_5kg"],
            10: price_row["price_10kg"],
            25: price_row["price_25kg"],
        }

        rice_subtotal = 0
        display_items = []

        for item in items_in:
            kg = item.get("size_kg")
            qty = item.get("quantity", 0)
            
            unit_price = price_map.get(kg)
            if unit_price is None:
                continue

            rice_subtotal += unit_price * qty
            display_items.append({
                "size_kg": kg,
                "quantity": qty,
                "unit_price": unit_price
            })

        service_fee = 300
        total = rice_subtotal + service_fee

        return {
            "farm_id": farm_id,
            "rice_subtotal": rice_subtotal,
            "service_fee": service_fee,
            "total": total,
            "items": display_items,
            "pickup_slot_code": draft.get("pickup_slot_code"),
            "pickup_display": draft.get("pickup_display"),
            "client_next_pickup_deadline_iso": draft.get("client_next_pickup_deadline_iso")
        }

    finally:
        conn.close()