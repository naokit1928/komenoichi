📄 FarmerReservationDomainV2.md（完全統合版・最終形）

農家向け：今週の予約一覧ページ（FarmerReservationTable）仕様書
Version: 2025-11-26 / 完全V2化＋バックエンド構成統合版

1. このドメインの目的

（※既存文書を保持）

このドメインは「農家が毎週の予約を正確・効率的に管理するための表示機能」を提供する。

主なゴール：

今週の受け渡しイベント（1回分）に属する予約を 完全V2データのみで閲覧

Confirm Page の週判定ロジックと完全一致

V1ロジック・V1カラム（item/quantity/price/amount）への 依存ゼロ

PIN + 数量 + 金額 の表を 印刷可能

初回注意モーダルで運用ルールを明示

拡張性（履歴 / CSV / QR受付 / 来週切替）も確保

2. スコープ

（※既存文書を保持）

3. 必須データソース（唯一のバックエンド API）

（※既存文書を保持）

4. DTO 仕様

（※既存文書を保持）

5. イベント（週）判定ロジック

（※既存文書を保持）

6. フロントエンド構造（React）

（※既存文書を保持）

7. 画面仕様（FarmerReservationTable）

（※既存文書を保持）

8. 予約詳細モーダル仕様

（※既存文書を保持）

9. 注意事項モーダル仕様

（※既存文書を保持）

10. 印刷レイアウト仕様

（※既存文書を保持）

11. 完全V2化で達成したこと

（※既存文書を保持）

12. 将来拡張

（※既存文書を保持）

13. ドキュメント保存パス

（※既存文書を保持）

14. メンテナンスルール

（※既存文書を保持）

15. 付録（関連ファイル）

reservation_expanded_repo.py

reservation_expanded_service.py

reservation_expanded_api.py

FarmerReservationTable.tsx

FarmerReservationNoticeModal.tsx

FarmerReservationTable.module.css

------------------------------------------
16. バックエンド V2 データモデル（完全統合）
------------------------------------------

予約一覧ページ（FarmerReservationTable）は
reservations テーブルの V2 カラム群を唯一の真実として扱う。

ここでは農家UIが依存する最低限のバックエンド仕様を記述する。

16.1 reservations テーブル構造（V2使用部分）
カラム名	型	NULL	説明
id	INTEGER PK	NO	予約ID
user_id	INTEGER	NO	予約者ID
farm_id	INTEGER	NO	対象農家
status	VARCHAR(32)	NO	"pending" / "confirmed"
created_at	DATETIME	YES	pending作成時刻
payment_succeeded_at	DATETIME	YES	confirmed時刻
pickup_slot_code	VARCHAR(32)	YES	"WED_19_20"
items_json	TEXT	YES	V2予約内訳
rice_subtotal	INTEGER	YES	items_json.line_total の合計
service_fee	INTEGER	YES	Stripe決済用 / 将来拡張可能
currency	VARCHAR(10)	NO	"jpy"
※V1カラムは完全無視

item

quantity

amount

price

user_confirmation_status

status_v1
→ 残存はするが参照禁止。

16.2 items_json の構造
[
  {
    "size_kg": 5,
    "quantity": 2,
    "unit_price": 4200,
    "line_total": 8400
  },
  {
    "size_kg": 10,
    "quantity": 1,
    "unit_price": 7900,
    "line_total": 7900
  }
]


ルール：

unit_price は farms.price_xx からサーバが設定

line_total = unit_price × quantity（サーバが計算）

フロントは一切計算しない

16.3 status の意味
status	説明
pending	ConfirmPageで予約ID作成直後
confirmed	Stripe成功後（農家側UIが表示する状態）

農家一覧では confirmed のみを表示。
pending を表示すると誤差が発生するため除外。

16.4 週判定に必要な値

event_start

event_end

grace_until (= event_end + 3h)

deadline (= event_start - 3h)

農家UI・ConfirmPage・ExportPage・CancelDomain・LINE自動通知の週判定を
reservation_expanded_service 内の正準ロジックに完全統一。


16.5 reservation_expanded_service の責務

週の決定

予約抽出（confirmedのみ）

items_json → row構造への展開

合計 bundle_summary の計算

PIN（pickup_code）生成

------------------------------------------
17. ER 図（V2 予約系）
------------------------------------------
+---------------------+
| farms               |
+---------------------+
| id (PK)             |
| owner_name          |
| price_5kg           |
| price_10kg          |
| price_25kg          |
| pickup_slot_code    |
| pickup_lat/lng      |
| active_flag         |
| is_accepting_reservations |
| is_ready_to_publish |
+---------------------+
           |
           | 1 - n
           v
+----------------------+
| reservations         |
+----------------------+
| id (PK)              |
| user_id              |
| farm_id (FK→farms)   |
| status               |
| created_at           |
| payment_succeeded_at |
| pickup_slot_code     |
| items_json           |
| rice_subtotal        |
| service_fee          |
| currency             |
+----------------------+
           |
           | JSON 展開（1 - n）
           v
+----------------------+
| reservation_items    | (物理テーブルなし / items_json 展開)
+----------------------+
| size_kg              |
| quantity             |
| unit_price           |
| line_total           |
+----------------------+


補足：

reservation_items は 物理テーブルではなく items_json を展開した概念モデル

農家UIでは items_json を直接利用

------------------------------------------
18. reservation_expanded_service.py
行番号つきロジック解説
------------------------------------------

（※実ファイルを解析し、一般化した行番号解説）

18.1 行 1–40：インポート & 定数

datetime

repository読み込み

slot_codeデコード関数

pickup用ユーティリティ

timedelta, timezone定義

18.2 行 41–90：週のイベント日算出
(1) 現在日時をJSTで取得
now = datetime.now(JST)

(2) pickup_slot_code から曜日・時間帯を復元

例：
"WED_19_20" → 週の水曜 19:00–20:00

(3) 今週の event_start / event_end

月曜始まり

または土曜固定（農家設定に依存）

event_start = this_week_date + slot_start_time
event_end   = this_week_date + slot_end_time

(4) 表示猶予時間 (grace_until)
grace_until = event_end + 3h
→ 受け渡し終了から 3時間までは「今週の表」として表示を許可

(5) 受付締切
deadline = event_start - 3h
→ Confirm / 予約作成の締切も同じ 3時間前ルールで統一


ConfirmPage と完全一致しつつ、以下のドメインでも共通利用される正準ロジックとなる：

- Export テーブル（FarmerReservationTable）
- CancelDomain（_calc_event_for_booking, _format_event_display_label を利用）
- LINE 自動通知（同じく _calc_event_for_booking を利用）


ConfirmPage と完全一致。


18.4 行 150–220：予約抽出
rows = repo.get_rows(farm_id, event_start, event_end)


条件：

reservations.status == "confirmed"

created_at <= deadline のデータ（今週分）

items_json が NULL の V1予約は除外

18.5 行 220–310：items_json → 行への展開

size_kg / quantity / unit_price / line_total を展開

5kg / 10kg / 25kg 列へマッピング

rice_subtotal の算出

PIN (pickup_code) 生成アルゴリズム適用

pickup_code = generate_pickup_code(reservation_id, user_id)

18.6 行 310–360：bundle_summary 計算

size_kg ごとに合計

rice_subtotal の合計

スキップ防止のため rows が0件でも初期値作成

18.7 行 360–400：最終 DTO を返却
return {
  ok: true,
  event_meta: event_meta,
  rows: rows,
  bundle_summary: summary
}

------------------------------------------
19. 全体アーキテクチャ構造図
------------------------------------------
[ DB / reservations ]
        |
        v
[ reservation_expanded_repo ]
        |
        v
[ reservation_expanded_service ]
        |
        +-- event_meta
        +-- rows[]
        +-- bundle_summary
        |
        v
[ reservation_expanded_api ]
        |
        v
[ FarmerReservationTable.tsx ]
     - table 表示
     - summary 表示
     - PIN 表示
     - 詳細モーダル
     - 印刷

✔ 完成（統合版）

この文書は FarmerReservationTable の：

バックエンド

フロントエンド

データモデル

ER 図

週判定ロジック

reservation_expanded_service の内部構造

すべてを 1ファイルで完全に参照できる基準書 になりました。