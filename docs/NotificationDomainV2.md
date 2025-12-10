# LINE 通知モジュール V2 — 自動通知仕様書（保存版）

## 0. 目的と全体像

目的  
Stripe 決済完了をトリガーに、以下 2 種類の LINE 通知を自動送信する。

- **CONFIRMATION**: 決済直後に送る「予約確定メッセージ」
- **REMINDER**: 受け渡し日前日の決まった時刻に送る「リマインダーメッセージ」

実装方針

- 予約・決済ロジックと通知ロジックを疎結合にする
- 通知は **ジョブキュー(line_notification_jobs)** に蓄積し、
  - Stripe Webhook で「ジョブ登録」だけ行う
  - バックグラウンド Worker が 60 秒ごとにまとめて送信
- 通知の文面組み立て・リマインダー時刻計算は専用 Service に閉じ込める
- V1 の通知コードには一切依存しない（完全 V2）

---

## 1. 関連ファイル構成

### 1.1 通知ドメイン

- `app_v2/notifications/dtos.py`
  - `NotificationContextDTO`
    - 予約・受け渡し情報を LINE メッセージ用にまとめた DTO。
    - 主なフィールド
      - `reservation_id`, `farm_id`, `customer_line_user_id`
      - `pickup_display`（例: "12月3日（水）19:00〜20:00"）
      - `pickup_place_name`, `pickup_map_url`, `pickup_detail_memo`
      - `pickup_code`（4桁 PIN）
      - `qty_5`, `qty_10`, `qty_25`
      - `subtotal_5`, `subtotal_10`, `subtotal_25`, `rice_subtotal`
      - `label_5kg`, `label_10kg`, `label_25kg`

- `app_v2/notifications/services/line_notification_service.py`
  - 通知の中核 Service。
  - 役割
    - DB から `reservations / users / farms` を読み出し `NotificationContextDTO` を構築
    - `LineMessageBuilder` で文面を生成
    - `LineNotificationJobRepository` に CONFIRMATION / REMINDER ジョブを登録
    - `send_pending_jobs()` / `send_single_job()` でジョブを送信

- `app_v2/notifications/services/reminder_schedule_service.py`
  - リマインダー送信時刻だけを決める Service。
  - 入力: `pickup_start`, `confirmed_at` (datetime, JST 想定)
  - 出力: `ReminderScheduleResult(should_send: bool, scheduled_at: Optional[datetime])`

- `app_v2/notifications/services/line_message_builder.py`
  - 実際のメッセージ文面テンプレートを持つ。
  - メソッド
    - `build_confirmation(ctx: NotificationContextDTO) -> str`
    - `build_reminder(ctx: NotificationContextDTO) -> str`

- `app_v2/notifications/repository/line_notification_job_repo.py`
  - `line_notification_jobs` テーブルへのアクセス。
  - 主なメソッド
    - `ensure_table()`
    - `insert_job(...) -> Dict[str, Any]`
    - `list_pending_jobs(before: datetime) -> List[Dict[str, Any]]`
    - `update_status(job_id, status, last_error, increment_attempt)`
    - `get_jobs_by_reservation(reservation_id)`

- `app_v2/notifications/external/line_client.py`
  - LINE Messaging API への最小クライアント。
  - `push_message(user_id: str, text: str)` を持つ。
  - 環境変数 `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN` でアクセストークンを取得。

### 1.2 API 層

- `app_v2/notifications/api/notification_dev_api.py`
  - GET `/dev/notifications/preview`
  - 開発用:
    - 指定 reservation_id に対して `LineNotificationService.schedule_for_reservation()` を 1 回実行
    - その予約に紐づく `line_notification_jobs` を一覧で返す（送信はしない）

- `app_v2/notifications/api/notification_admin_api.py`
  - POST `/notifications/send-pending`
    - `LineNotificationService.send_pending_jobs(limit, dry_run)` を呼ぶ管理用エンドポイント
  - POST `/notifications/send-job/{job_id}`
    - `LineNotificationService.send_single_job(job_id, dry_run)` を呼ぶ管理用エンドポイント

### 1.3 Stripe・LINE 関連

- `app_v2/stripe/api/stripe_webhook_api.py`
  - Stripe Webhook ( `/stripe/webhook` ) のエンドポイント。
  - `payment_intent.succeeded` / `checkout.session.completed` などのイベントを受信。
  - 対象 reservation を `succeeded` / `confirmed` に更新後、
    **必ず 1 回だけ** `LineNotificationService.schedule_for_reservation(reservation_id)` を呼ぶ。

- `app_v2/line/api/line_api.py`
  - LINE Login, 友だち連携など（通知そのものとは別ドメイン）。

### 1.4 main.py（バックグラウンド Worker）

- `app/main.py`
  - FastAPI アプリの起動ポイント。
  - アプリ起動時に `start_notification_worker()` を呼び、  
    60 秒ごとに `LineNotificationService.send_pending_jobs(limit=50, dry_run=False)` を実行するバックグラウンド Task を起動。
  - アプリ終了時には Worker Task をキャンセル・停止する。

---

## 2. DB スキーマ: line_notification_jobs

テーブル定義（概略）

```sql
CREATE TABLE IF NOT EXISTS line_notification_jobs (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    reservation_id        INTEGER NOT NULL,
    farm_id               INTEGER NOT NULL,
    customer_line_user_id TEXT    NOT NULL,
    kind                  TEXT    NOT NULL,  -- "CONFIRMATION" / "REMINDER" など
    scheduled_at          TEXT    NOT NULL,  -- ISO 文字列 (JST)
    status                TEXT    NOT NULL DEFAULT 'PENDING',  -- PENDING / SENT / FAILED
    message_text          TEXT    NOT NULL,
    attempt_count         INTEGER NOT NULL DEFAULT 0,
    last_error            TEXT,
    created_at            TEXT    NOT NULL,
    updated_at            TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_line_notification_jobs_status_scheduled
    ON line_notification_jobs (status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_line_notification_jobs_reservation
    ON line_notification_jobs (reservation_id);

-- 重複送信防止用
CREATE UNIQUE INDEX IF NOT EXISTS idx_line_jobs_reservation_kind
    ON line_notification_jobs (reservation_id, kind);

ポイント

1 予約につき 1 種類の通知（CONFIRMATION / REMINDER）は 最大 1 行 まで

→ Stripe Webhook が複数回呼ばれても、同じ (reservation_id, kind) のジョブは重複しない

scheduled_at の比較で送信タイミングを制御

status ＋ attempt_count でリトライ・失敗管理

3. 通知フロー詳細
3.1 Stripe Webhook → 予約更新 → ジョブ登録

ユーザーがフロントエンドから Stripe 決済を実行

Stripe 側で payment_intent.succeeded などのイベントが発生

Webhook エンドポイント /stripe/webhook がイベントを受信

stripe_webhook_api.py 内で以下を実行

reservation_id をイベントの metadata 等から取得

対象 reservations レコードを

payment_status = "succeeded"

status = "confirmed"
に更新（既に同じ状態ならスキップ）

その後、1度だけ LineNotificationService.schedule_for_reservation(reservation_id) を呼ぶ

LineNotificationService.schedule_for_reservation() の処理

reservations + users を JOIN 取得

farms から受け渡し場所情報を取得

NotificationContextDTO / event_start / confirmed_at を構築

CONFIRMATION メッセージ文面を生成

CONFIRMATION ジョブを即時登録

scheduled_at = now(JST)

ReminderScheduleService.calculate_reminder_time(event_start, confirmed_at) を呼ぶ

should_send=True かつ scheduled_at が返ってきた場合のみ

REMINDER メッセージ文面を生成

REMINDER ジョブを登録

処理結果として CONFIRMATION の message_text を返す（必要に応じて Webhook 内でログなどに利用可能）

3.2 リマインダー時刻の仕様

ReminderScheduleService にロジックを集約。

48 時間ルール

lead_time = pickup_start_jst - confirmed_at_jst
if lead_time < timedelta(hours=48):
    return ReminderScheduleResult(should_send=False, scheduled_at=None)


受け渡し開始時刻 pickup_start まで 48 時間未満の場合、REMINDER は送らない

時間帯別の固定時刻

受け渡し開始時刻 pickup_start の「時刻帯」によって送信時刻を決定。

6:00〜12:00 → 前日 20:00

12:00〜16:00 → 当日 8:00

16:00〜22:00 → 当日 12:00

上記以外（6:00 未満 or 22:00 以降）は暫定的に「当日 8:00」

安全策

計算された scheduled_at が confirmed_at 以下だった場合（理論的には起きない想定だが念のため）、
should_send=False として REMINDER 自体を送らない。

結果として、例えば

現在: 12月1日 1:54

受け渡し: 12月3日（水）19:00〜20:00

の場合:

lead_time > 48h → REMINDER 対象

受け渡し時間帯: 19:00 → 16:00〜22:00 に該当

REMINDER 送信時刻: 12月3日（水）12:00

4. ジョブ送信ロジック
4.1 LineNotificationService.send_pending_jobs()

引数: limit: int = 50, dry_run: bool = False

処理:

now_jst = datetime.now(JST)

LineNotificationJobRepository.list_pending_jobs(before=now_jst) で

status='PENDING'

scheduled_at <= now_jst
のジョブを古い順に取得

最大 limit 件まで処理対象にする

各ジョブに対して _send_job_core(job, now_jst, dry_run) を実行

結果を集計して以下を返す:

{
  "ok": true,
  "summary": {
    "now": "...",
    "total_candidates": 3,
    "processed": 3,
    "sent": 2,
    "skipped": 1,
    "failed": 0,
    "dry_run": false,
    "dry_run_count": 0
  },
  "results": [
    {
      "job_id": 20,
      "reservation_id": 237,
      "kind": "CONFIRMATION",
      "status_before": "PENDING",
      "status_after": "SENT",
      "attempt_count_before": 0,
      "attempt_count_after": 1,
      "result": "SENT",
      "error": null
    },
    ...
  ]
}

4.2 LineNotificationService._send_job_core()

主要ロジック:

status != 'PENDING' → SKIPPED

scheduled_at > now_jst → SKIPPED

attempt_count >= MAX_ATTEMPTS(=5) → SKIPPED

customer_line_user_id or message_text が空なら FAILED

dry_run=True の場合:

LINE 送信はせずに result="DRY_RUN"、DB 更新もしない

実際の送信:

LineClient.push_message(customer_line_user_id, message_text)

成功 → status='SENT', attempt_count += 1

失敗 → status='FAILED', attempt_count += 1, last_error に詳細を保存

4.3 send_single_job(job_id, dry_run)

指定 job_id のジョブ 1 件だけに _send_job_core() を適用するユーティリティ。

手動での個別リトライ・動作確認用。

5. バックグラウンド Worker（NotificationWorker）

※ 実装は main.py にて行う前提。

5.1 役割

line_notification_jobs のうち

status='PENDING'

scheduled_at <= now(JST)
のジョブを 60 秒ごとに自動送信する。

5.2 典型的な実装イメージ

# main.py（イメージ）

_notification_worker_task: Optional[asyncio.Task] = None

async def start_notification_worker() -> None:
    """
    line_notification_jobs テーブルのうち、
    - status = 'PENDING'
    - scheduled_at <= now(JST)
    のジョブを 60 秒ごとにまとめて送信するバックグラウンド処理。
    決済直後の CONFIRMATION も、前日12時の REMINDER もすべてここでカバーされる。
    """
    global _notification_worker_task

    async def worker() -> None:
        service = LineNotificationService()
        while True:
            try:
                result = service.send_pending_jobs(limit=50, dry_run=False)
                summary = result.get("summary", {})
                sent = int(summary.get("sent") or 0)
                skipped = int(summary.get("skipped") or 0)
                failed = int(summary.get("failed") or 0)

                # 何か送った・失敗したときだけログを出す
                if sent > 0 or failed > 0:
                    print(
                        "[NotificationWorker]",
                        f"sent={sent} skipped={skipped} failed={failed}",
                    )
            except Exception as e:
                print(f"[NotificationWorker] error: {e}")
            await asyncio.sleep(60)

    _notification_worker_task = asyncio.create_task(worker())

async def stop_notification_worker() -> None:
    global _notification_worker_task
    if _notification_worker_task is not None:
        _notification_worker_task.cancel()
        _notification_worker_task = None

FastAPI の lifespan / startup イベントで start_notification_worker() を呼び、
shutdown で stop_notification_worker() を呼ぶ構成。

ログは 何も起きていない場合は出さない 方針にしている。

6. 開発・運用時のテスト方法
6.1 Stripe Webhook を通した一連のテスト

フロントから予約 → Stripe 決済まで通す

ターミナルログで

[Stripe] Received event: payment_intent.succeeded

[DB] Reservation #XXX を支払い成功に更新しました。

[DB] Reservation #XXX を confirmed に更新しました。

[LineNotificationService] schedule_for_reservation start: reservation_id=XXX

CONFIRMATION / REMINDER job inserted ...
を確認

line_notification_jobs テーブルを直接確認して

(reservation_id, kind) が 1 行ずつ登録されていること

数分以内に LINE に CONFIRMATION が届くことを確認

REMINDER については、scheduled_at を SQL で現在時刻 + 数分に書き換え、
Worker によって自動送信されるか確認する。

6.2 開発用プレビュー API

/dev/notifications/preview?reservation_id=XXX

予約を実際に決済しなくても、通知コンテキストやメッセージ文面を確認できる。

6.3 管理者用 API

/notifications/send-pending（Swagger から実行可能）

Worker を止めている状態でも、このエンドポイントを叩けば手動で送信できる。

/notifications/send-job/{job_id}

個別ジョブのテスト・リトライに使用。

7. 将来の変更時の指針

文面を変えたい場合

line_message_builder.py のテンプレートのみ修正する。

NotificationContextDTO の構造は変えない方が安全（他のロジックと連動するため）。

リマインダーのルールを変えたい場合

reminder_schedule_service.py の中だけを編集する。

特に _MIN_LEAD_TIME と _compute_scheduled_at() を変更することで、
48時間ルールや時間帯別の送信時刻を柔軟に変えられる。

新しい通知種別を追加したい場合（例: CANCELLED, NO_SHOW など）

kind に新しい値を定義

LineMessageBuilder に新しいビルダーメソッドを追加

LineNotificationService.schedule_for_reservation() とは別のエントリポイント
（例: キャンセル時の専用 Service メソッド）を定義し、
LineNotificationJobRepository.insert_job() でジョブを登録する。

(reservation_id, kind) の UNIQUE 制約を維持するかどうかは要件次第。

LINE チャネルを変更したい場合

.env の LINE_MESSAGING_CHANNEL_ACCESS_TOKEN を差し替えるだけで良い。

コード変更は不要。

負荷・コスト調整

Worker の 60 秒間隔は、将来本番で負荷や料金を見ながら
asyncio.sleep(60) の値を変更すれば良い。

予約件数が増えた場合は limit を調整する。

8. まとめ

Stripe 決済 → 予約確定 → LINE 通知 という一連の流れは、

Webhook で「ジョブ作成」

バックグラウンド Worker で「ジョブ送信」
という 2 段構成で実現されている。

通知の文面・リマインダー時刻・DB スキーマ・API が明確に分離されているため、
将来の変更（文面だけ変更、リマインダーだけ変更など）がしやすい。

V2 通知モジュールは V1 に完全に依存せず、
予約システムとして恥ずかしくない標準的な設計になっている。

--- 追記：ReservationBookedPage / NotificationDomain の統一ルール ---
A. event_start / event_end の正準ロジック（新規追加）

NotificationDomain は、予約に関するすべての時間計算の 唯一の正準ロジック を保持する。
pickup の時間は次のように扱う：

event_start = pickup_start（JST）

event_end = pickup_end（JST）

ReservationBookedService、CancelDomain、NotificationDomain は
すべてこの event_start / event_end を参照する。

B. ReservationBookedPage（予約確認ページ）との同期仕様

ReservationBookedPage が予約内容を表示するかどうかは、
NotificationDomain の event_end を使用して次のルールで判断する。

表示制御ロジック
is_expired = now > event_end
is_expired_for_display = now > event_end + 15分

判定表
状態	is_expired	is_expired_for_display	UI 表示
event_end より前	False	False	予約内容を表示
event_end ～ event_end+15分	True	False	予約内容を表示（猶予時間）
event_end+15分 以降	True	True	「現在、予定している受け渡しの予約はありません」を表示

この 15分猶予は、
受け渡し直後でもユーザーが確認ページを開けるようにする意図的仕様 である。

C. ReservationBookedService の責務（新規追加）

ReservationBookedService は以下を保証する：

NotificationDomain の event_start / event_end ロジックをそのまま使用する

event_end+15分 を過ぎた予約は UI 表示対象から除外（is_expired_for_display = True）

DTO に次のフィールドを追加してフロントへ返す：

"is_expired": true/false,
"is_expired_for_display": true/false

D. 統合テスト方法（新規追加）

バックエンドで以下を実行することで、
event_start / event_end および expired フラグが正しく計算されているか確認できる。

from app_v2.customer_booking.services.reservation_booked_service import ReservationBookedService

s = ReservationBookedService()
r = s.get_view_for_reservation(RESERVATION_ID)

print("event_start =", r.event_start)
print("event_end =", r.event_end)
print("is_expired =", r.is_expired)
print("is_expired_for_display =", r.is_expired_for_display)

期待される動作
条件	is_expired	is_expired_for_display	UI
event_end より前	False	False	表示
event_end 直後	True	False	表示
event_end+15分後	True	True	非表示
E. この仕様の目的（最後に追記）

LINE 通知（NotificationDomain）

キャンセル（CancelDomain）

予約確認表示（ReservationBookedPage）

これらすべてが 同じ event_start / event_end の計算ロジックで動くこと を保証するため。
これにより、将来の拡張（1ユーザー1予約制限、リマインダー、ペナルティ判定など）でも
時間判定が破綻しない。

A. キャンセル直後に、該当予約に紐づく REMINDER ジョブ（kind='REMINDER', status='PENDING'）を即時削除する。

LineNotificationJobRepository.delete_pending_reminder_jobs(reservation_id) を呼び出し
status='PENDING' の REMINDER ジョブだけを安全に削除する

これにより、キャンセル後に誤ってリマインダーが送られることを防止する

CONFIRMATION や CANCEL_COMPLETED など、他種別の通知履歴には影響しない

Worker（send_pending_jobs）側の挙動は変更しない（既存ロジックを壊さない）

B. CANCEL_COMPLETED 通知は通常通り生成・送信される。

キャンセル処理完了後、
LineNotificationService.schedule_cancel_completed(reservation_id) により
CANCEL_COMPLETED メッセージを登録し、
send_single_job により即時送信される仕様は従来どおり維持する。

C. これらはリマインダー時刻ロジック（48時間ルール、時間帯別スロット）とは独立して動作する。

キャンセル前に作成されていた REMINDER（前日20:00 / 当日8:00 / 当日12:00）はすべて削除対象

キャンセル後に新しい REMINDER が作られることはない

当初の NotificationDomain の原則
「リマインダーは“存在する予約”に対してのみ送る」
を厳密に保証するための仕様