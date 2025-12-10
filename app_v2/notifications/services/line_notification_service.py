from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple, List

from zoneinfo import ZoneInfo

from app_v2.notifications.dtos import NotificationContextDTO
from app_v2.notifications.repository.line_notification_job_repo import (
    LineNotificationJobRepository,
)
from app_v2.notifications.services.reminder_schedule_service import (
    ReminderScheduleService,
)
from app_v2.notifications.services.line_message_builder import LineMessageBuilder
from app_v2.notifications.external.line_client import LineClient
from app_v2.customer_booking.services.reservation_expanded_service import (
    _calc_event_for_booking,
    _format_event_display_label,
    _generate_pickup_code,
)

JST = ZoneInfo("Asia/Tokyo")
DB_PATH = "app.db"
LINE_MESSAGING_ACCESS_TOKEN_ENV = "LINE_MESSAGING_CHANNEL_ACCESS_TOKEN"


class LineNotificationService:
    """
    Stripe 決済成功後の LINE 通知スケジューラ。

    予約確定 → 即時送信するメッセージ
      ✔ CONFIRMATION（1通目）
      ✔ CANCEL_TEMPLATE（2通目 / Step2 追加）

    受け渡し前の REMINDER（条件次第で送信）

    さらに、予約キャンセル完了後に:
      ✔ CANCEL_COMPLETED（キャンセル完了通知 / CancelDomain から呼び出し）
    """

    def __init__(
        self,
        db_path: str = DB_PATH,
        job_repo: Optional[LineNotificationJobRepository] = None,
        reminder_service: Optional[ReminderScheduleService] = None,
        line_client: Optional[LineClient] = None,
    ) -> None:
        self._db_path = db_path
        self._job_repo = job_repo or LineNotificationJobRepository(db_path=db_path)
        self._reminder_service = reminder_service or ReminderScheduleService()

        if line_client is not None:
            self._line_client = line_client
        else:
            token = os.getenv(LINE_MESSAGING_ACCESS_TOKEN_ENV, "")
            self._line_client = LineClient(token)

    # ------------------------------------------------------------------
    #  Public API
    # ------------------------------------------------------------------
    def schedule_for_reservation(self, reservation_id: int) -> Optional[str]:
        """
        Stripe 決済成功後に呼び出される。

        予約1件につき、以下のジョブを冪等的に登録する：

          ✔ CONFIRMATION（即時）
          ✔ CANCEL_TEMPLATE（即時 / Step2 で追加）
          ✔ REMINDER（条件付き）
        """
        try:
            print(f"[LineNotificationService] schedule start: reservation_id={reservation_id}")
            conn = self._open_connection()

            # ---- 既存ジョブの取得（冪等チェック）----
            existing_jobs = self._fetch_existing_jobs_for_reservation(conn, reservation_id)

            has_confirmation = any(
                job.get("kind") == "CONFIRMATION" and job.get("status") in ("PENDING", "SENT")
                for job in existing_jobs
            )
            has_cancel_template = any(
                job.get("kind") == "CANCEL_TEMPLATE" and job.get("status") in ("PENDING", "SENT")
                for job in existing_jobs
            )
            has_reminder = any(
                job.get("kind") == "REMINDER" and job.get("status") in ("PENDING", "SENT")
                for job in existing_jobs
            )

            print(
                "[LineNotificationService] existing jobs: "
                f"CONFIRMATION={has_confirmation}, "
                f"CANCEL_TEMPLATE={has_cancel_template}, "
                f"REMINDER={has_reminder}"
            )

            # ---- reservation / user / farm 読み込み ----
            reservation, user = self._fetch_reservation_and_user(conn, reservation_id)
            if not reservation:
                print(f"[LineNotificationService] reservation #{reservation_id} not found.")
                return None
            if not user:
                print(f"[LineNotificationService] user not found for reservation #{reservation_id}.")
                return None

            line_user_id = (user.get("line_user_id") or "").strip()
            if not line_user_id:
                print("[LineNotificationService] user has no line_user_id → skip")
                return None

            farm = self._fetch_farm(conn, reservation.get("farm_id"))
            if not farm:
                print(
                    f"[LineNotificationService] farm #{reservation.get('farm_id')} not found "
                    f"(CANCEL_COMPLETED)."
                )
                return None

            ctx, event_start, event_end, confirmed_at = self._build_context(
                reservation=reservation,
                user=user,
                farm=farm,
                line_user_id=line_user_id,
            )


            now_jst = datetime.now(tz=JST)

            # -------------------------------------------------------------
            # ✔ 1通目：CONFIRMATION（即時）
            # -------------------------------------------------------------
            confirmation_text = LineMessageBuilder.build_confirmation(ctx)

            if not has_confirmation:
                self._job_repo.insert_job(
                    reservation_id=ctx.reservation_id,
                    farm_id=ctx.farm_id,
                    customer_line_user_id=ctx.customer_line_user_id,
                    kind="CONFIRMATION",
                    message_text=confirmation_text,
                    scheduled_at=now_jst,
                )
                print("[LineNotificationService] CONFIRMATION job inserted.")
            else:
                print("[LineNotificationService] CONFIRMATION exists → skip")

            # -------------------------------------------------------------
            

            # -------------------------------------------------------------
            # ✔ 3通目：REMINDER（48時間前 or 固定時間帯 / 条件次第）
            # -------------------------------------------------------------
            reminder_result = self._reminder_service.calculate_reminder_time(
                pickup_start=event_start,
                confirmed_at=confirmed_at,
            )

            if reminder_result.should_send and reminder_result.scheduled_at is not None:
                if not has_reminder:
                    reminder_text = LineMessageBuilder.build_reminder(ctx)
                    self._job_repo.insert_job(
                        reservation_id=ctx.reservation_id,
                        farm_id=ctx.farm_id,
                        customer_line_user_id=ctx.customer_line_user_id,
                        kind="REMINDER",
                        message_text=reminder_text,
                        scheduled_at=reminder_result.scheduled_at,
                    )
                    print(
                        "[LineNotificationService] REMINDER job inserted "
                        f"(scheduled_at={reminder_result.scheduled_at})."
                    )
                else:
                    print("[LineNotificationService] REMINDER exists → skip")

            print("[LineNotificationService] schedule_for_reservation completed.")
            return confirmation_text

        except Exception as e:
            print(f"[LineNotificationService] schedule_for_reservation error: {e}")
            return None

    def schedule_cancel_completed(self, reservation_id: int) -> Optional[int]:

        """
        予約キャンセル完了後に呼び出される。

        予約1件につき、CANCEL_COMPLETED ジョブを1つだけ冪等的に登録する。
        （すでに PENDING / SENT があればスキップ）
        """
        try:
            print(
                f"[LineNotificationService] schedule_cancel_completed start: "
                f"reservation_id={reservation_id}"
            )
            conn = self._open_connection()

            # 既存ジョブ（CANCEL_COMPLETED）の有無を確認
            existing_jobs = self._fetch_existing_jobs_for_reservation(conn, reservation_id)
            has_cancel_completed = any(
                job.get("kind") == "CANCEL_COMPLETED"
                and job.get("status") in ("PENDING", "SENT")
                for job in existing_jobs
            )

            if has_cancel_completed:
                print("[LineNotificationService] CANCEL_COMPLETED exists → skip")
                return None

            # reservation / user / farm 取得
            reservation, user = self._fetch_reservation_and_user(conn, reservation_id)
            if not reservation:
                print(
                    f"[LineNotificationService] reservation #{reservation_id} not found "
                    f"for CANCEL_COMPLETED."
                )
                return None
            if not user:
                print(
                    f"[LineNotificationService] user not found for reservation "
                    f"#{reservation_id} (CANCEL_COMPLETED)."
                )
                return None

            # （念のため）status が cancelled でなければログだけ出す
            status = reservation.get("status")
            if status != "cancelled":
                print(
                    f"[LineNotificationService] reservation #{reservation_id} status is "
                    f"'{status}', not 'cancelled' (CANCEL_COMPLETED)."
                )

            line_user_id = (user.get("line_user_id") or "").strip()
            if not line_user_id:
                print(
                    "[LineNotificationService] user has no line_user_id "
                    "→ skip CANCEL_COMPLETED"
                )
                return None

            farm = self._fetch_farm(conn, reservation.get("farm_id"))
            if not farm:
                print(f"[LineNotificationService] farm #{reservation.get('farm_id')} not found.")
                return None

            ctx, event_start, event_end, confirmed_at = self._build_context(
                reservation=reservation,
                user=user,
                farm=farm,
                line_user_id=line_user_id,
            )


            now_jst = datetime.now(tz=JST)
            message_text = LineMessageBuilder.build_cancel_completed(ctx)

            job = self._job_repo.insert_job(
                reservation_id=ctx.reservation_id,
                farm_id=ctx.farm_id,
                customer_line_user_id=ctx.customer_line_user_id,
                kind="CANCEL_COMPLETED",
                message_text=message_text,
                scheduled_at=now_jst,  # 即時送信
            )
            job_id = int(job.get("id"))
            print("[LineNotificationService] CANCEL_COMPLETED job inserted.")
            return job_id


        except Exception as e:
            print(f"[LineNotificationService] schedule_cancel_completed error: {e}")
            return None

    # ------------------------------------------------------------------
    # DB 接続
    # ------------------------------------------------------------------
    def _open_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        return conn

    # ------------------------------------------------------------------
    # 既存ジョブの取得
    # ------------------------------------------------------------------
    def _fetch_existing_jobs_for_reservation(
        self,
        conn: sqlite3.Connection,
        reservation_id: int,
    ) -> List[Dict[str, Any]]:
        cur = conn.execute(
            "SELECT * FROM line_notification_jobs WHERE reservation_id = ?",
            (reservation_id,),
        )
        rows = cur.fetchall()
        return [dict(r) for r in rows]

    # ------------------------------------------------------------------
    # reservation + user 取得
    # ------------------------------------------------------------------
    def _fetch_reservation_and_user(
        self,
        conn: sqlite3.Connection,
        reservation_id: int,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
        sql = """
        SELECT
            r.*,
            u.id AS user_id,
            u.line_user_id
        FROM reservations AS r
        JOIN users AS u ON r.user_id = u.id
        WHERE r.id = ?
        """

        cur = conn.execute(sql, (reservation_id,))
        row = cur.fetchone()
        if not row:
            return None, None

        row_dict = dict(row)

        reservation: Dict[str, Any] = {}
        user: Dict[str, Any] = {}

        for key, value in row_dict.items():
            if key in {
                "id",
                "user_id",
                "farm_id",
                "status",
                "created_at",
                "pickup_slot_code",
                "items_json",
                "rice_subtotal",
                "payment_succeeded_at",
            } or key.endswith("_at") or key.endswith("_id") or key in {
                "service_fee",
                "currency",
            }:
                reservation[key] = value

        user["id"] = row_dict.get("user_id")
        user["line_user_id"] = row_dict.get("line_user_id")

        return reservation, user

    # ------------------------------------------------------------------
    # farm 取得
    # ------------------------------------------------------------------
    def _fetch_farm(
        self,
        conn: sqlite3.Connection,
        farm_id: Any,
    ) -> Optional[Dict[str, Any]]:
        try:
            fid = int(farm_id)
        except (TypeError, ValueError):
            return None

        cur = conn.execute("SELECT * FROM farms WHERE id = ?", (fid,))
        row = cur.fetchone()
        return dict(row) if row else None

        # ------------------------------------------------------------------
    # NotificationContextDTO 構築
    # ------------------------------------------------------------------
    def _build_context(
        self,
        reservation: Dict[str, Any],
        user: Dict[str, Any],
        farm: Dict[str, Any],
        line_user_id: str,
    ) -> Tuple[NotificationContextDTO, datetime, datetime, datetime]:


        created_at = self._parse_db_utc_to_jst(reservation.get("created_at"))
        pickup_slot_code = str(reservation.get("pickup_slot_code", "") or "")


        # event_start / event_end
        event_start, event_end = _calc_event_for_booking(
            created_at=created_at,
            pickup_slot_code=pickup_slot_code,
        )
        pickup_display = _format_event_display_label(event_start, event_end)

        # キャンセル期限（＝受け渡し開始の3時間前）
        event_deadline = event_start - timedelta(hours=3)

        # 予約ID / userID
        reservation_id = int(reservation.get("id"))
        user_id = int(user.get("id") or 0)

        pickup_code = _generate_pickup_code(
            reservation_id=reservation_id,
            user_id=user_id,
        )

        # farm 情報
        pickup_place_name = farm.get("pickup_place_name") or ""
        pickup_notes = farm.get("pickup_notes") or ""

        lat = farm.get("pickup_lat")
        lng = farm.get("pickup_lng")
        if lat is not None and lng is not None:
            pickup_map_url = self._build_google_maps_url(lat, lng)
        else:
            pickup_map_url = ""

        # items_json → qty
        items = self._parse_items(reservation.get("items_json") or "[]")
        qty_5, qty_10, qty_25, subtotal_5, subtotal_10, subtotal_25 = (
            self._aggregate_rice_items(items)
        )

        rice_subtotal = reservation.get("rice_subtotal")
        if rice_subtotal is None:
            rice_subtotal = subtotal_5 + subtotal_10 + subtotal_25

        # confirmed_at
        payment_succeeded_at_raw = reservation.get("payment_succeeded_at") or reservation.get(
            "created_at"
        )
        confirmed_at = self._parse_db_utc_to_jst(payment_succeeded_at_raw)


        # DTO 構築
        ctx = NotificationContextDTO(
            reservation_id=reservation_id,
            farm_id=int(reservation.get("farm_id")),

            customer_line_user_id=line_user_id,
            pickup_display=pickup_display,
            pickup_place_name=pickup_place_name,
            pickup_map_url=pickup_map_url,
            pickup_detail_memo=pickup_notes,
            pickup_code=pickup_code,
            qty_5=qty_5,
            qty_10=qty_10,
            qty_25=qty_25,
            subtotal_5=subtotal_5,
            subtotal_10=subtotal_10,
            subtotal_25=subtotal_25,
            rice_subtotal=rice_subtotal,
            label_5kg="5kg",
            label_10kg="10kg",
            label_25kg="25kg",
            cancel_token_exp=int(event_deadline.timestamp()),

            # ★ キャンセルURL（TemplateMessage 用）
            cancel_base_url="http://localhost:5173/reservation/cancel",
        )

        return ctx, event_start, event_end, confirmed_at


    # ------------------------------------------------------------------
    # items_json パース
    # ------------------------------------------------------------------
    def _parse_items(self, items_json: str) -> Any:
        try:
            return json.loads(items_json)
        except Exception:
            return []

    def _aggregate_rice_items(
        self,
        items: Any,
    ) -> Tuple[int, int, int, int, int, int]:

        qty_5 = qty_10 = qty_25 = 0
        subtotal_5 = subtotal_10 = subtotal_25 = 0

        if not isinstance(items, list):
            return qty_5, qty_10, qty_25, subtotal_5, subtotal_10, subtotal_25

        for item in items:
            try:
                size = int(item.get("size_kg"))
                q = int(item.get("quantity") or 0)
                line_total = item.get("line_total")
                if line_total is None:
                    line_total = item.get("subtotal")
                s = int(line_total or 0)
            except Exception:
                continue

            if size == 5:
                qty_5 += q
                subtotal_5 += s
            elif size == 10:
                qty_10 += q
                subtotal_10 += s
            elif size == 25:
                qty_25 += q
                subtotal_25 += s

        return qty_5, qty_10, qty_25, subtotal_5, subtotal_10, subtotal_25

    # ------------------------------------------------------------------
    # ISO 日付 → JST
    # ------------------------------------------------------------------
    def _parse_iso_jst(self, value: Any) -> datetime:
        if value is None:
            return datetime.now(tz=JST)

        if isinstance(value, datetime):
            dt = value
        else:
            text = str(value).replace(" ", "T")
            try:
                dt = datetime.fromisoformat(text)
            except Exception:
                dt = datetime.now(tz=JST)

        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=JST)
        else:
            dt = dt.astimezone(JST)

        return dt

    def _parse_db_utc_to_jst(self, value: Any) -> datetime:

        """
        reservations テーブルなど、DB 内で UTC 保存されている DATETIME を
        JST に変換する専用ヘルパー。

        - "YYYY-MM-DD HH:MM:SS" / "YYYY-MM-DDTHH:MM:SS" 形式を想定
        - tzinfo が無い場合は UTC とみなす
        """
        if value is None:
            return datetime.now(tz=JST)

        if isinstance(value, datetime):
            dt = value
        else:
            text = str(value).replace(" ", "T")
            try:
                dt = datetime.fromisoformat(text)
            except Exception:
                return datetime.now(tz=JST)

        # naive → UTC とみなす
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)

        # 最終的に JST に揃える
        return dt.astimezone(JST)



    # ------------------------------------------------------------------
    # Maps URL
    # ------------------------------------------------------------------
    def _build_google_maps_url(self, lat: float, lng: float) -> str:
        return f"https://www.google.com/maps/search/?api=1&query={lat},{lng}"

    # ------------------------------------------------------------------
    # PENDING ジョブ送信
    # ------------------------------------------------------------------
    def send_pending_jobs(self, limit: int = 50, dry_run: bool = False) -> Dict[str, Any]:

        now_jst = datetime.now(tz=JST)

        candidate_jobs = self._job_repo.list_pending_jobs(before=now_jst)
        if limit > 0 and len(candidate_jobs) > limit:
            candidate_jobs = candidate_jobs[:limit]

        results = []
        sent = skipped = failed = dry_run_count = 0

        for job in candidate_jobs:
            job_result = self._send_job_core(job, now_jst=now_jst, dry_run=dry_run)
            results.append(job_result)

            r = job_result.get("result")
            if r == "SENT":
                sent += 1
            elif r == "FAILED":
                failed += 1
            elif r == "DRY_RUN":
                dry_run_count += 1
            else:
                skipped += 1

        summary = {
            "now": now_jst.isoformat(),
            "total_candidates": len(candidate_jobs),
            "processed": len(candidate_jobs),
            "sent": sent,
            "skipped": skipped,
            "failed": failed,
            "dry_run": dry_run,
            "dry_run_count": dry_run_count,
        }

        return {
            "ok": True,
            "summary": summary,
            "results": results,
        }

    # ------------------------------------------------------------------
    # 単体ジョブ送信
    # ------------------------------------------------------------------
    def send_single_job(self, job_id: int, dry_run: bool = False) -> Dict[str, Any]:

        with self._open_connection() as conn:
            cur = conn.execute(
                "SELECT * FROM line_notification_jobs WHERE id = ?",
                (job_id,),
            )
            row = cur.fetchone()

        if row is None:
            return {"ok": False, "job_id": job_id, "error": f"job #{job_id} not found"}

        job_dict = dict(row)
        now_jst = datetime.now(tz=JST)
        result = self._send_job_core(job_dict, now_jst=now_jst, dry_run=dry_run)
        result["ok"] = True
        return result

    # ------------------------------------------------------------------
    # ジョブ送信コア
    # ------------------------------------------------------------------
    def _send_job_core(
        self,
        job: Dict[str, Any],
        *,
        now_jst: datetime,
        dry_run: bool,
    ) -> Dict[str, Any]:

        job_id = job["id"]
        reservation_id = job["reservation_id"]
        status_before = job.get("status", "")
        attempt_before = int(job.get("attempt_count") or 0)
        scheduled_at_raw = job.get("scheduled_at")
        customer_line_user_id = job.get("customer_line_user_id") or ""
        message_text = job.get("message_text") or ""
        kind = job.get("kind", "")

        result = {
            "job_id": job_id,
            "reservation_id": reservation_id,
            "kind": kind,
            "status_before": status_before,
            "status_after": status_before,
            "attempt_count_before": attempt_before,
            "attempt_count_after": attempt_before,
            "result": "SKIPPED",
            "error": None,
        }

        # status チェック
        if status_before != "PENDING":
            result["result"] = "SKIPPED"
            result["error"] = f"status is {status_before}, not PENDING"
            return result

        scheduled_at = self._parse_iso_jst(scheduled_at_raw)
        if scheduled_at > now_jst:
            result["result"] = "SKIPPED"
            result["error"] = "scheduled_at is in future"
            return result

        # MAXリトライ
        if attempt_before >= 5:
            result["result"] = "SKIPPED"
            result["error"] = "attempt_count >= 5"
            return result

        # userIDチェック
        if not customer_line_user_id:
            result["result"] = "FAILED"
            result["error"] = "customer_line_user_id is empty"
            self._job_repo.update_status(
                job_id, status="FAILED", last_error=result["error"], increment_attempt=True
            )
            result["status_after"] = "FAILED"
            result["attempt_count_after"] = attempt_before + 1
            return result

        if not message_text:
            result["result"] = "FAILED"
            result["error"] = "message_text is empty"
            self._job_repo.update_status(
                job_id, status="FAILED", last_error=result["error"], increment_attempt=True
            )
            result["status_after"] = "FAILED"
            result["attempt_count_after"] = attempt_before + 1
            return result

        if dry_run:
            result["result"] = "DRY_RUN"
            return result

        # ----------------------------------------------------------
        # ✔ TemplateMessage か通常テキストかを自動判定（LineClient 側で処理）
        # ----------------------------------------------------------
        try:
            self._line_client.push_message(customer_line_user_id, message_text)
        except Exception as e:
            err_msg = f"{type(e).__name__}: {e}"
            print(f"[LineNotificationService] send_job failed: {err_msg}")
            self._job_repo.update_status(
                job_id, status="FAILED", last_error=err_msg, increment_attempt=True
            )
            result["result"] = "FAILED"
            result["status_after"] = "FAILED"
            result["attempt_count_after"] = attempt_before + 1
            result["error"] = err_msg
            return result

        self._job_repo.update_status(
            job_id, status="SENT", last_error=None, increment_attempt=True
        )
        result["result"] = "SENT"
        result["status_after"] = "SENT"
        result["attempt_count_after"] = attempt_before + 1
        return result
