from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from typing import Tuple, Dict, Any

class CheckoutPrepService:
    """
    Checkout開始前の準備（PENDING予約の取得・JIT生成）を担当する Service
    """

    def prepare_pending_reservation(
        self,
        conn: sqlite3.Connection,
        consumer_id: int,
        cs: str
    ) -> Tuple[int, str]:
        """
        対象の ConfirmSession (cs) に紐づく PENDING 予約を用意し、
        (reservation_id, consumer_email) を返す。
        存在しなければ Draft から JIT (Just-In-Time) で作成する。
        """
        
        # 1. Consumer Email の取得
        cur = conn.cursor()
        cur.execute(
            "SELECT email FROM consumers WHERE consumer_id = ?",
            (consumer_id,),
        )
        row = cur.fetchone()
        if not row or not row["email"]:
            raise ValueError("CONSUMER_EMAIL_MISSING")
        consumer_email = row["email"]

        # 2. 既存 PENDING チェック (Idempotency)
        cur.execute(
            """
            SELECT reservation_id
            FROM reservations
            WHERE status = 'PENDING'
              AND confirm_session_id = ?
            LIMIT 1
            """,
            (cs,),
        )
        existing_row = cur.fetchone()

        if existing_row:
            # 既に作成済み（再試行など）
            return existing_row["reservation_id"], consumer_email

        # 3. 新規作成: Draft を読み込む
        cur.execute(
            """
            SELECT draft_json, status, expires_at
            FROM confirm_sessions
            WHERE confirm_session_id = ?
            """,
            (cs,),
        )
        cs_row = cur.fetchone()
        
        if not cs_row:
            raise ValueError("SESSION_NOT_FOUND")
        
        if cs_row["status"] == "draft":
            try:
                expires_at = datetime.fromisoformat(cs_row["expires_at"])
                if expires_at < datetime.utcnow():
                     raise ValueError("SESSION_EXPIRED")
            except ValueError:
                pass # ISOフォーマットエラー等は無視して進める

        # 4. JSON パース & 計算
        try:
            draft = json.loads(cs_row["draft_json"])
        except Exception:
            raise ValueError("DRAFT_JSON_CORRUPTED")

        farm_id = draft.get("farm_id")
        items = draft.get("items", [])
        pickup_slot_code = draft.get("pickup_slot_code")
        pickup_display = draft.get("pickup_display")
        
        if not farm_id or not items:
            raise ValueError("INVALID_DRAFT_DATA")

        # 5. 最新価格取得 (DB正)
        cur.execute(
            "SELECT price_5kg, price_10kg, price_25kg FROM farms WHERE farm_id = ?",
            (farm_id,),
        )
        price_row = cur.fetchone()
        if not price_row:
            raise ValueError("FARM_NOT_FOUND")
        
        price_map = {
            5: price_row["price_5kg"],
            10: price_row["price_10kg"],
            25: price_row["price_25kg"],
        }
        
        rice_subtotal = 0
        items_json = []
        
        for it in items:
            kg = it.get("size_kg")
            qty = int(it.get("quantity", 0))
            if qty <= 0: continue
            
            unit = price_map.get(kg)
            if unit is None:
                 raise ValueError("INVALID_KG_IN_DRAFT")
            
            sub = unit * qty
            rice_subtotal += sub
            items_json.append({
                "size_kg": kg,
                "quantity": qty,
                "unit_price": unit
            })

        service_fee = 300
        total = rice_subtotal + service_fee
        
        # 6. INSERT PENDING (Active Record 作成)
        now_iso = datetime.utcnow().isoformat()
        
        try:
            # SAVEPOINTを利用して、このブロックだけロールバック可能にする（競合対策）
            cur.execute("SAVEPOINT prep_pending")
            cur.execute(
                """
                INSERT INTO reservations
                (
                    consumer_id, confirm_session_id, farm_id, status,
                    created_at, pickup_slot_code, items_json,
                    rice_subtotal, service_fee, amount, currency, pickup_display
                )
                VALUES (?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, 'jpy', ?)
                """,
                (
                    consumer_id, cs, farm_id,
                    now_iso, pickup_slot_code, json.dumps(items_json, ensure_ascii=False),
                    rice_subtotal, service_fee, total, pickup_display
                )
            )
            reservation_id = cur.lastrowid
            cur.execute("RELEASE SAVEPOINT prep_pending")
            
        except sqlite3.IntegrityError:
            # 競合発生時（ダブルクリック等）は既存を探す
            cur.execute("ROLLBACK TO SAVEPOINT prep_pending")
            cur.execute(
                "SELECT reservation_id FROM reservations WHERE confirm_session_id = ? AND status='PENDING'",
                (cs,)
            )
            existing_after_fail = cur.fetchone()
            if not existing_after_fail:
                raise ValueError("CREATION_FAILED")
            reservation_id = existing_after_fail["reservation_id"]
            
        return reservation_id, consumer_email