Notification ドメイン構造改革まとめ（保守・拡張ガイド）
0. この文書の目的

このプロジェクトの notification（LINE通知）機構は、
構造改革（V2）により完全分離・安定化された状態にある。

本ドキュメントは：

将来の保守・修正・仕様変更時の 判断基準

「どこを触ればよいか／触ってはいけないか」の明確化

機能追加・通知種別追加・通知手段追加時の 安全な拡張方法

を残すためのものである。

1. Notification 全体像（完成構造）
ドメイン全体の依存関係
API / Cron / Service 呼び出し
        ↓
LineNotificationService（Facade）
        ↓
+------------------------------+
| NotificationScheduler        |  ← いつ・何を送るか決める
| NotificationDispatcher       |  ← 実際に送る
+------------------------------+
        ↓
+------------------------------+
| Repository 層                |
|  - LineNotificationJobRepo   |  ← job 管理
|  - NotificationDataRepo      |  ← 読み取り専用
+------------------------------+
        ↓
LineClient（外部 API）

2. 設計の基本原則（絶対ルール）
原則①：DB 入口は Repository のみ

resolve_db_path() を使うのは Repository だけ

Scheduler / Dispatcher / Service は DB の存在を知らない

❌ NG

sqlite3.connect(...)
resolve_db_path()


✅ OK

repo.fetch(...)
repo.insert_job(...)

原則②：「判断」と「実行」を分離する
層	やること	やってはいけないこと
Scheduler	送るか／いつ送るか決める	LINE API を叩く
Dispatcher	job を送る	送信条件を判断する
Repository	DB CRUD	ビジネス判断
原則③：Facade（LineNotificationService）は薄く保つ

LineNotificationService は 入口専用。

ロジックを書かない

if 文を書かない

DB を触らない

👉 ここが肥大化したら V1 に逆戻り

3. 各コンポーネントの責務（触る前に読む）
LineNotificationService（Facade）

責務

他ドメインからの唯一の入口

Scheduler / Dispatcher の呼び出し

変更してよいケース

新しい公開メソッドを増やす

変更してはいけない

条件分岐の追加

DB / Repository 呼び出し

NotificationScheduler

責務

「どの通知を」「いつ job として登録するか」決める

典型的な修正

通知条件の変更

通知タイミングの変更

新しい通知種別の追加

禁止事項

LINE API 呼び出し

sqlite / SQL 記述

NotificationDispatcher

責務

job を取得して送信するだけ

典型的な修正

再送ロジック

失敗時の扱い変更

別チャネル（Email/SMS）追加

禁止事項

予約状態の判断

Scheduler のロジックをコピーすること

NotificationContextBuilder

責務

通知に必要な「文脈情報」を生成

修正ポイント

通知に使うデータ構造の変更

表示用データの追加

LineMessageBuilder

責務

純粋に「文言」を組み立てる

最重要ルール

DB・Repository を絶対に触らない

if/else を最小限に保つ

LineNotificationJobRepository

責務

notification_jobs テーブルの CRUD のみ

典型的な変更

retry 回数の扱い変更

status の種類追加

NotificationDataRepository

責務

通知に必要な reservation / consumer / farm の読み取り

ルール

書き込み禁止

job テーブルに触らない

4. よくある変更シナリオ別ガイド
通知文言を変えたい

→ LineMessageBuilder だけ

通知タイミングを変えたい

→ ReminderScheduleService or NotificationScheduler

新しい通知種別を追加したい

Scheduler に判定追加

job_repo に kind 登録

Dispatcher で送信処理追加

MessageBuilder に文言追加

👉 既存コードを壊さない

LINE以外（Email / Push）を追加したい

Dispatcher を差し替える or 拡張

Scheduler / Repository は一切触らない

5. 触る前のセルフチェック（必須）

変更前に必ず確認する：

この変更は どの責務か？

Repository を触る理由は本当にあるか？

Scheduler と Dispatcher を混ぜていないか？

Facade が太っていないか？

1つでも怪しければ 設計を見直す

6. この構造の価値

この notification 構造は：

実運用で動作確認済み

Stripe / Reservation / Admin と同時稼働

再送・拡張に耐える

将来 Queue / Worker 化が容易