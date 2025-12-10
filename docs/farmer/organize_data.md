🍚 rice-app データ仕様（Owner / Farm / Registration / Pickup / Settings / Status）

この文書は、農家データの全体構造を統一し、フロントとバックエンドが参照すべき正式な仕様をまとめたものです。
すべての開発（Registration, Pickup Setting, Farmer Setting, Publicページ）はこの仕様の上で動きます。

1. 👤 OWNER（オーナー情報）

Registration Page で入力後は 固定。
フロント UI に 100% 準拠したデータ形式。

{
  "owner_user_id": 37,
  "line_user_id": "xxxxx",

  "owner_name": "山田太郎",
  "owner_last_name": "山田",
  "owner_first_name": "太郎",

  "owner_last_kana": "やまだ",
  "owner_first_kana": "たろう",

  "owner_postcode": "7780001",
  "owner_pref": "徳島県",
  "owner_city": "三好市池田町",
  "owner_addr_line": "西山123",

  "owner_phone": "08008899088"
}

住所仕様（統一方針）

owner_pref：都道府県（セレクト）

owner_city：市区町村＋町域まで（UIそのまま）

owner_addr_line：番地＋建物名の統合欄

addr1/addr2 は legacy（使用しない／将来削除）

2. 🌾 FARM（農園の基本データ）

Registration Page で作成され、
pickup 系は Farmer Pickup Settings Page で編集可能。

{
  "farm_id": 65,

  "pickup_lat": 34.0667,
  "pickup_lng": 134.5525,

  "pickup_place_name": "自宅前の納屋",
  "pickup_notes": "駐車場は南側です",

  "pickup_time": "WED_19_20"
}

重要ルール

Owner と Farm は 1:1

Farm データの編集は Pickup Settings Page のみ

API / DB の farm.owner_xxx 系は legacy（使わない）

3. 🔄 Farmer Pickup Settings Page 専用データ

Pickup ページでは Farm 本体＋今週の予約状態（Status） を返す。

{
  "farm": {
    "farm_id": 65,

    "pickup_lat": 34.0667,
    "pickup_lng": 134.5525,
    "pickup_place_name": "自宅前の納屋",
    "pickup_notes": "駐車場は南側です",
    "pickup_time": "WED_19_20"
  },

  "status": {
    "active_reservations_count": 0,
    "can_edit_pickup": true
  }
}

編集制約

active_reservations_count > 0 のとき

pickup_lat

pickup_lng

pickup_time
→ 編集禁止

「場所名」「メモ」はいつでも編集可能

4. 🧰 Farmer Settings Page（公開プロフィール編集）

ここで扱うのは 公開ページに関係する設定のみ。
Registration / Pickup のデータとは完全に独立。

✨ 編集可能データ（農家が自由に変更できる）

is_accepting_reservations
→ 今週の予約受付 ON/OFF
※ 将来は「公開条件を満たしたときのみ ON にできる」仕様にする

rice_variety_label（品種）

price_10kg / price_5kg / price_25kg
→ 5kg・25kg は 10kg から自動計算（policy で処理し、Farm テーブルの price_5kg / price_25kg に保存）


pr_title

pr_text

face_image_url

cover_image_url
→ pr_images の先頭画像が cover image になる

pr_images[]
→ id（Cloudinary public_id）/ url / order の3要素を持つ
→ カバーは order = 0 （先頭）

📄 表示のみの自動データ（農家は編集できない）

harvest_year
→ 月により自動計算（9–12月 → その年産 / 1–8月 → 前年産）

monthly_upload_bytes

monthly_upload_limit

next_reset_at
→ Cloudinary 画像管理（毎月1日0:00にリセットが妥当）

is_ready_to_publish
→ UIガイド用
（必須項目が揃っているかどうか）

missing_fields
→ 上の判定で不足している項目リスト

thumbnail_url
→ 一覧ページ用の自動生成サムネイル
（cover image とは異なる）

🗂 このページでは扱わない（API のおまけ）

active_reservations_count（Pickup Page 専用）

is_active（管理者のみが触るアカウント有効フラグ）

✅ 5. 🧩 公開条件（Publication Eligibility）– V2 公式仕様（最新版）

ここでは、農家が「一般公開ページ（Public Farm Page）」に表示されるための
V2 における最小・明確・一貫した公開条件 を定義する。

V1 時代に存在した下記の古い公開フラグは 公開判定に一切使わない：

is_public

registration_status

location_status

is_verified_location

is_profile_complete
など

V2 の公開条件は 3つのブール条件だけ に統一する。

5.1 公開判定に使用する3つのフラグ（V2 コアロジック）
① farms.active_flag（運営による利用許可 / BAN）

デフォルト：1（許可 / BANされていない）

運営だけが変更できる

0 の場合、その農家は 強制的に非公開

目的：

不適切 / 問題行為など運営判断で停止するための「マスタースイッチ」

② farms.is_accepting_reservations（農家による公開トグル）

農家が Settings ページで ON/OFF する「公開トグル」

True = 公開したい

False = 自分の意思で非公開にしたい

ただし、後述の「公開準備が完了していない場合」はトグルを有効化できない

③ is_ready_to_publish（計算値 / 必須項目の埋まり確認）

DBに保存しない / サービス層で毎回計算する派生値。
農家が公開するために必要な最低限の項目が揃っているかを確認する。

準備完了とみなす条件（すべて必須）：

rice_variety_label が設定済み

price_10kg が設定済み（→ 5kg / 25kg も同じロジックで自動計算され、いずれも DB に保存されていること）

pr_titleが入力されている。（pr_textは任意であり、入力されていなくても条件にはかかわらない）

cover_image_url が設定されている

PR画像 pr_images が最低1枚以上ある（必要なら追加）

face_image_url が設定されている

pickup_lat, pickup_lng が設定済み

pickup_time が設定済み

不足がある場合は missing_fields として返し、
Settings UI では公開トグルを有効化しない。

5.2 公開可否の最終判定（V2 公式アルゴリズム）

Public Page に掲載してよいかの最終判定は次の論理式で行う：

is_public = (
    farm.active_flag == 1
    and farm.is_accepting_reservations is True
    and is_ready_to_publish is True
)

✔ 全部揃っている → 公開
✔ 1つでも欠けている → 非公開
5.3 一覧ページ（/api/public/farms）に出す条件

公開一覧に表示する対象は is_public == True のレコードのみ。

公開中農家だけを収集する内部ロジック：

Farm + FarmerProfile の JOIN

active_flag == 1 でフィルタ

is_accepting_reservations == True でフィルタ

is_ready_to_publish == True は Python サービス層で計算し、NGなら除外

DTO に整形して返す

→ 一覧と詳細の判定ロジックを完全に統一できる。

5.4 詳細ページ（/public/farms/{id}）も同じ判定を採用

FarmDetailsPage に表示できる条件もまったく同じ：

if not is_public:
    return 404 or {"is_public": False, "message": "公開準備中です"}


この統一により、

一覧には出るのに詳細が404

詳細は見えるのに一覧に出ない

といった 不整合が完全に消える。

5.5 トグル操作ルール（農家による公開／非公開）
● is_ready_to_publish = False（準備不足）

トグルは UI で無効（グレーアウト）

API に true を送っても 強制で false にされる

● active_flag = 0（運営BAN）

トグルは表示してもよいが変更不可（保存時に強制 false）

農家が何をしても公開にはならない

● 全て揃っている場合（公開条件OK）

トグルを ON/OFF するだけで公開・非公開が即反映される

ON にすると即一覧に現れ、OFF にすると即一覧から消える

5.6 この V2 公開基準の長期メリット

運営タスクは BAN だけ
→ 登録審査や手動承認は一切不要

農家は Registration → Settings → トグルON の3ステップで完結

V1の古い is_public / registration_status / location_status が絡まない
→ コードも仕様も大幅にシンプル化

公開一覧・詳細ページ・内部APIのすべてが 完全に一貫した条件で動作

デバッグ時も

active_flag

is_accepting_reservations

is_ready_to_publish
を見るだけで状態が100%把握できる

6. 🔗 全体関係図（最重要）
LINE友だち → LINEログイン → users 作成（id 付与）
     ↓
Registration Page（Owner + Farm初期値）
     ↓
finish_registration → farm_id 発行
     ↓
Farmer Settings Page（公開情報の編集）
     ↓
公開条件（is_ready_to_publish / active_flag / location_status / registration_status）
     ↓
予約受付トグル（is_accepting_reservations）
     ↓
Public Farm Page（is_public = 1）

7. ✔ この md が担う役割

Registration / Pickup / Settings / 公開状態 を跨いだ
完全統一仕様

DB カラム整理（legacy の切り出し）

API レスポンスの明確化

フロント参照の一本化

今後の開発の「唯一の真実のソース（Single Source of Truth）」
📦 8. Farmer Reservation Export（受け渡し予約一覧）
概要

農家が「指定日の受け渡し予約」を一覧で確認し、
必要に応じて印刷するためのページ。

URL 例

/reservations/export?format=html&farm_id=XX&status=confirmed

このページで表示されるデータ
表示項目	内容
予約番号（4桁PIN）	reservation_id + user_id + SALT から計算した4桁
5kg / 10kg / 25kg の数量	bundle_items を集計した数量
合計金額	各 line_total を合計
合計行	当日の全予約の合計数量＋合計金額

行をタップするとモーダルが開き、
以下のように予約の明細を確認できる：

商品（5kg / 10kg / 25kg）

数量

単価（予約時点の価格）

小計（quantity × unit_price）

合計金額

内部予約ID（reservation_id）※小さく表示

🔧 データ構造（内部）

export ページは、
reservations と reservation_items を元に下記の構造を作る。

{
  "reservation_id": 166,
  "user_id": 1,
  "farm_id": 65,
  "status": "confirmed",
  "created_at": "2025-11-19T10:01:20",

  "bundle_items": [
    { "item": "5kg", "quantity": 2, "unit_price": 4700, "line_total": 9400 },
    { "item": "10kg", "quantity": 1, "unit_price": 8800, "line_total": 8800 },
    { "item": "25kg", "quantity": 2, "unit_price": 20200, "line_total": 40400 }
  ]
}

bundle_items の意味
フィールド	内容
item	"5kg" / "10kg" / "25kg"
quantity	個数
unit_price	予約時の価格（設定変更後でも変わらない）
line_total	小計（quantity × unit_price）
🔢 Export 用に計算される派生データ

内部データから export 表示用に計算される派生項目：

{
  "pickup_code": "9674",
  "count_5kg": 2,
  "count_10kg": 1,
  "count_25kg": 2,
  "total_amount": 58600
}

🔐 pickup_code（予約番号）の生成方法

「ランダム4桁」のように見えるが実際は計算式：

pickup_code = (reservation_id * A + user_id * B + SECRET_SALT) % 10000


再現可能（同じ予約なら必ず同じ4桁）

内部IDを隠す目的

農家にとって分かりやすい4桁PIN

購入者にも伝えやすい

🚫 このページで表示しないが内部に保持している項目

order_id（Stripeなどの将来用途）

status（confirmed / canceled）

created_at

user_id（将来の購入者履歴用）

※ export 画面は 農家の当日オペレーションに関係ない情報は極限まで隠す 方針。

👌 README に追記するのは以上です

他の整理済みデータ（Owner / Farm / Farmer Settings / Pickup Settings）と同じ構造で統一

UIに出る値、内部値、派生値が明確

export の仕様はこれで完全にカバー
