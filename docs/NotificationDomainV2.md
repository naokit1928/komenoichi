📘 NOTIFICATION（LINE通知）仕様まとめ
NotificationDomainV2 ― UTC統一・最終確定版
0. この文書の位置づけ（重要）

本書は、
komet プロジェクトにおける LINE 通知（notification）ドメインの
唯一の正式仕様書である。

実装は必ず本仕様に従う

「動いているからOK」は不可

時刻・状態・責務の曖昧さを残さない

1. 基本方針（最重要）
1.1 通知は「DBジョブ駆動」

LINE 通知は 即時送信しない

すべて notification_jobs テーブルを正とする

実際の送信は cron 実行時のみ

👉
「予約が入った＝通知が送られた」ではない

1.2 API / Service は送信しない

FastAPI の API / Service 層は：

LINE API を 呼ばない

送信成功・失敗を 判断しない

やることは ジョブを作るだけ

👉
送信の成否は cron + DB 状態でのみ管理する。

2. 通知種別（kind）
kind	意味
CONFIRMATION	予約確定通知
REMINDER	受取リマインダー
CANCEL_COMPLETED	キャンセル完了通知

CANCEL_TEMPLATE は 仕様上不要のため廃止

kind は この3種のみで固定

3. notification_jobs テーブル仕様（論理）
3.1 カラム（確定）
job_id          INTEGER (PK)
reservation_id  INTEGER (FK)

kind            TEXT
scheduled_at    TEXT   ← UTC ISO（最重要）
status          TEXT

attempt_count   INTEGER
last_error      TEXT

created_at      TEXT   ← UTC ISO
updated_at      TEXT   ← UTC ISO

4. 【最重要】時刻の統一ルール（UTC）
4.1 原則

notification_jobs に保存される時刻は
すべて UTC で統一する

対象：

scheduled_at

created_at

updated_at

すべて：

UTC

timezone-aware

ISO 8601 文字列

4.2 禁止事項（厳守）

JST のまま DB に保存すること ❌

timezone-naive な datetime を保存すること ❌

UTC と JST を混在させて比較すること ❌

SQLite は timezone を理解しないため、
保存時に統一しなければ必ずバグになる。

4.3 JST はどこで使うか

admin 画面の表示

LINE メッセージ文面

人間向け UI

👉 表示用のみ
👉 DB・比較・判定には使わない

5. status の意味（厳密・確定）
status	意味
PENDING	送信待ち（cron 対象）
SENT	LINE送信成功
FAILED	送信を試みて失敗
DASH	仕様上ジョブを作らない状態（admin 表示用）
NONE	本来あるべきジョブが存在しない異常状態
重要ルール

cron は PENDING のみを対象

FAILED は 自動再送しない

再送は 人間判断のみ

6. ジョブ作成ルール（API / Service 側）
6.1 予約確定時
CONFIRMATION

scheduled_at = 現在時刻（UTC）

status = PENDING

※ 即時送信したいが、
送信は cron に委譲する

REMINDER

scheduled_at = pickup_datetime - 48時間

UTC に変換して保存

status = PENDING

6.2 キャンセル完了時
CANCEL_COMPLETED

scheduled_at = 現在時刻（UTC）

status = PENDING

既存の REMINDER がある場合：

admin 表示上は DASH

DB の job は 作らない or 無視対象

7. cron 実行仕様（送信専用）
7.1 実行コマンド
python -m app_v2.notifications.cron.send_pending_notifications

7.2 対象条件（厳密）
status = 'PENDING'
AND scheduled_at <= now_utc


now_utc は timezone-aware UTC

比較は UTC 同士のみ

7.3 送信結果処理
結果	DB 更新
成功	status = SENT
失敗	status = FAILED + attempt_count++ + last_error
8. LINE API エラーの扱い
月間上限超過（429 等）

例外として扱わない

FAILED として記録

cron は継続実行

その他の HTTPError

同様に FAILED

last_error に全文保存

9. dry_run 仕様（安全装置）
挙動

LINE API を 呼ばない

DB を 一切更新しない

対象件数・候補確認のみ

制御方法
NOTIFICATION_CRON_DRY_RUN=true / false

10. 禁止事項（仕様として確定）

以下は すべて禁止：

API / Service から LINE を直接送る

background task / worker で送信する

cron 以外で status を SENT にする

FAILED を自動再送する

DB を経由しない通知

UTC/JST 混在の時刻比較

11. この仕様の狙い（設計思想）

誤爆防止

再現性のある挙動

管理画面での完全可視化

LINE 制限超過時でもシステムを壊さない

人間が「なぜそうなったか」を理解できる状態管理


12

予約確定時の即時送信（Initial Attempt）

本システムでは、通知送信は原則として cron により非同期で処理されるが、
予約確定直後のユーザー体験を重視し、予約確定時点で1回のみ即時送信を試行する仕様を採用する。

対象トリガー

Stripe Webhook

checkout.session.completed

payment_intent.succeeded

処理フロー

予約が確定する

notification_jobs に通知ジョブを作成する

CONFIRMATION

REMINDER（条件を満たす場合のみ）

ジョブ作成直後に、cron と同一ロジックである
send_pending_jobs() を 1回だけ実行する

この実行は **即時送信を目的とした初回トライ（Initial Attempt）**である

振る舞いの定義

scheduled_at <= now (UTC) のジョブのみが送信対象となる

通常、即時送信の対象となるのは CONFIRMATION のみである

送信に成功した場合
→ status = SENT

送信に失敗した場合（例：LINE 月間送信上限超過）
→ status = FAILED

cron との関係

予約確定時の即時送信は 1回限り

それ以降の再送・定期処理は cron のみが担当する

cron は即時送信と同一のロジックを使用するが、
実行タイミングと責務が異なる

設計上の意図

ユーザーは予約直後に通知を受け取ることを期待するため

cron 実行を待たずに初回送信を試みることで即時性を確保するため

送信処理をすべて notification_jobs 経由に統一し、
冪等性・可視性・再送制御を保つため

重要な補足

API 層や Service 層から直接 LINE メッセージを送信することはしない

すべての送信は notification_jobs を介して行われる

即時送信は「cron を前倒しで1回実行する」設計であり、
特別な送信経路は存在しない


13

### キャンセル完了通知（CANCEL_COMPLETED）の再送ポリシー

キャンセル完了通知は、予約キャンセル確定時に即時で1回のみ送信を試行する。

- 即時送信は、notification_jobs 作成直後に
  send_pending_jobs() を1回実行することで行う
- 送信に成功した場合は status = SENT とする
- 送信に失敗した場合は status = FAILED とし、
  それ以上の再送は行わない

キャンセル完了通知は即時性のみを重視する通知であり、
遅延して再送する価値が低いため、
FAILED は最終状態として扱う。
