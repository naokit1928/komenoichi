🌾 Farmer Domain V2 – 完全まとめ（2025-11時点）

この文書は organize_data.md に完全準拠し、
今あなたが進めてきた V2 開発のすべてを一つに統合してまとめなおした“最新版の設計図”だよ。

1. V2 の目的

V1 の複雑な設計・不要カラム・機能バラつきから脱却する

データを「Owner」「Farm（＝Pickup Settings）」「Farmer Settings」に正しく三分割

今後は V2 のみで完結できるようにする

LINEハブを起点に、農家の操作フローを最短・最小・明快にする

2. Farmer LINE Hub の主要画面（V2）
① LINE Home

設定を開く（Farmer Settings v2）

今週の予約を確認

プロフィールを見る（公開ページプレビュー）

② Farmer Registration v2

Owner + Farm の初期登録をまとめて処理

必須：名前、ふりがな、郵便番号、住所フル、電話番号

必須：pickup（lat/lng、place、time、notes）

任意：farm_name, email（今後 farm_name 削除予定）

③ Pickup Settings v2

lat/lng（地図）＋ 400m 制限

pickup_time（スロット）

pickup_place_name

pickup_notes

予約が1件以上 → 編集禁止

④ Farmer Settings v2

品種ラベル

価格（10kg を入力 → 保存時に 5kg / 25kg を自動計算して DB 保存）

PRタイトル・本文

顔写真

カバー写真

PR画像（複数）

公開OK判定

予約受付ON/OFF（v2では active_flag に 1:1対応）

⑤ Reservations Export

日別の予約一覧

キロ数集計

PIN（ランダム4桁）

3. DTO（organize_data.md 100%準拠）
✔ OWNER
{
  "owner_user_id": 37,
  "line_user_id": "xxxx",
  "owner_last_name": "山田",
  "owner_first_name": "太郎",
  "owner_last_kana": "やまだ",
  "owner_first_kana": "たろう",
  "owner_postcode": "7700820",
  "owner_pref": "徳島県",
  "owner_city": "徳島市南出来島町",
  "owner_addr_line": "23-1",
  "owner_phone": "08012345678"
}

✔ FARM（＝pickup settings）
{
  "farm_id": 65,
  "pickup_lat": 34.0667,
  "pickup_lng": 134.5525,
  "pickup_place_name": "自宅前",
  "pickup_notes": "駐車場あり",
  "pickup_time": "WED_19_20"
}

✔ Pickup Status
{
  "active_reservations_count": 0,
  "can_edit_pickup": true
}

✔ Farmer Settings（公開）
{
  "rice_variety_label": "コシヒカリ",
  "price_10kg": 8800,
  "price_5kg": 4700,
  "price_25kg": 20200,

  "pr_title": "自然栽培のお米です",
  "pr_text": "...",

  "face_image_url": "...",
  "cover_image_url": "...",
  "pr_images": [
    { "id": "...", "url": "...", "order": 0 }
  ],

  "harvest_year": 2024,

  "is_ready_to_publish": true,
  "missing_fields": [],

  "is_accepting_reservations": false,   // ⇦ v2では active_flag と1:1

  "monthly_upload_bytes": 120000,
  "monthly_upload_limit": 30000000,
  "next_reset_at": "2025-12-01T00:00:00",

  "thumbnail_url": "..."
}

4. V2 バックエンド構成（確定）
app_v2/
  farmer/
    dtos.py
    repository/
      registration_repo.py
      pickup_settings_repo.py
      farmer_settings_repo.py
    services/
      registration_service.py
      pickup_settings_service.py
      farmer_settings_service.py
    api/
      registration_api.py
      pickup_settings_api.py
      farmer_settings_api.py

5. 重要ポリシー
● organize_data.md が唯一の正解

Blueprint.md（旧版）はもう削除でOK。

● DTO の名前は本物の構造を反映すること

is_accepting_reservations という曖昧なラベルは禁止。
V2 では active_flag のみで統一する。

● V1のデータを使わない

将来的に V1 を完全削除するため
V2 だけで完結するように作る。

● PR画像は必ず複数取得できる構造

v2の repository が複数の画像を JOIN しない場合、
DTO は必ず空配列になる。
（今ここが問題になっている）

● Farm name と parking_guide は廃止

今後も復活禁止。

✅ 6. 現在の進展（2025-11 時点 / 最新版）

（※このまま Farmer Domain V2.md の該当セクションに置き換えてください）

6. 現在の進展（2025-11 時点 / 最新版）

ここでは、V2 開発のうち すでに完全に動作している部分と、安定化が完了した領域だけを正確に記す。

✔ Registration v2（完成）

Owner / Farm（pickup 初期設定）を 1ストロークで登録

必須項目（姓 / 名 / ふりがな / 郵便番号 / 住所フル / 電話番号 / lat/lng / pickup_time / place_name）を厳密にチェック

任意項目：farm_name, email, pickup_notes

LINE ID 連携 → Owner に正しく紐づく

finish_registration → farm_id 発行は安定動作

新規登録された農家は active_flag = 1（デフォルト）で作成されるよう修正済み

✔ Pickup Settings v2（完成）

lat/lng（Google Map）

400m ルール（owner_addr からの距離制限）

pickup_time スロット

pickup_place_name / pickup_notes

active_reservations_count > 0 のとき編集ロック → 完全実装

LINE Home → farm_id 自動遷移も安定化済み

✔ Farmer Settings v2（ほぼ完全版 / 最新設計どおり）
データ編集

rice_variety_label

price_10kg（編集可能・ソース） / price_5kg / price_25kg（保存時に price_10kg から自動計算して DB に保存）


pr_title / pr_text

face_image_url（必須）

cover_image_url

pr_images（複数画像 / order 対応）

harvest_year（年月に応じた完全自動計算）

画像まわり

v1 の pr_images_json と v2 の pr_images を両方吸収する互換レイヤー

Cloudinary の月次リセット：

monthly_upload_bytes

next_reset_at（NULL の場合は自動で次の月初を計算）

月初判定で bytes を自動リセット

公開条件（Publication Eligibility）

organize_data.md の V2 公式ロジックを完全反映

rice_variety_label 必須

pr_title 必須

price_10kg 必須

face_image_url 必須（※修正済み）

pickup settings が整っていること

cover / pr_text は任意

is_ready_to_publish / missing_fields

不足項目の自動判定が正しく機能

missing_fields は常に最新ロジックで算出

✔ active_flag（BAN / 公開マスタースイッチ）完成版
実装した内容

新規農家は active_flag = 1（デフォルト ON）

admin API（Swagger）で 1 / 0 を POST 可能

/api/farmer/settings-v2/admin/active-flag

active_flag = 0：

公開ページ（public farms）が非表示（BAN）

FarmerSettingsPage のトグルが強制 OFF

トグルを ON にしようとしても disabled

active_flag = 1：

public 表示 OK（ただし is_ready_to_publish が true の場合のみ）

トグル操作も再び可能

UI との同期

フロントの予約受付トグル（is_accepting_reservations）は
active_flag と 1:1 対応

active_flag を 0 → 1 に戻したときのズレを解消

active_flag=0 の間にトグルが ON 表示になるバグは修正済み

復帰時は常にトグル false から再スタートする仕様に統一

結果：
シャドウBANが完全に消え、BAN / 復帰の挙動が100%一貫した。

✔ Public Farms v2（公開API）

v2 の公開条件ロジックを使用

active_flag = 1

is_ready_to_publish = true

これら両方が揃わないと一覧にも詳細ページにも出さない

旧 public_farms.py はすべて v2 に置き換え済み

✔ LINE Hub（安定版）

farm が存在すれば pickup settings へ

なければ registration へ誘導

“プロフィールを見る” が最新 v2 の公開ページへ遷移

3メニューの UI を整理し、視認性を改善

✔ UI 完成度（FarmerSettingsPage 完全版）

公開ステータス表示を削除（あなたの指示どおり）

トグルは active_flag と同期

BAN時の disable UI 完全実装

ページ最下部にスペーサー追加（height:80px）

PR画像スライダー・サムネイルの安定動作

すべての自動計算（価格・年度・サムネイル）が正しく表示

まとめ（現時点の状態）

V2 の基幹3モジュール（Registration / Pickup / Settings）はすべて安定版

公開条件の V2 公式仕様（organize_data.md）は完全実装

active_flag（BAN機能）は設計どおりに統一されバグなし

フロントもバックエンドも整合性100%

今後追加するのは “分析機能” “予約一覧拡張” など高レイヤーのみ


（追記）
8. Price Calculation Policy（統合版・正式仕様）
✔ 基本方針（簡潔）

農家が入力する価格は 10kg のみ

5kg / 25kg は自動計算して DB に保存

公開ページ・予約ページ・export は DB の値をそのまま使う

✔ 計算ルール

10kg → 100円単位で丸める

5kg = 10kg × 0.52
25kg = 10kg × 2.40

四捨五入 → 最後に再度 100円単位で丸める
（係数は将来変更可能）

⚠ 価格ロジックを変更したい場合（最重要）

プロジェクト全体で変更するのは 2 箇所だけ。

① バックエンド（本番ロジック）

farmer_settings_service.py → _auto_calc_prices()
ここが システム全体の真の価格計算式。
将来係数を変える場合は必ずここを編集する。

② フロント（プレビュー）

PriceEditor.tsx → derivePricesFrom10()
設定ページのプレビュー用。
バックエンドと同じ係数と丸め方をコピーする。

追加（必要に応じて）

係数変更後は農家が 10kg を保存し直せば DB が更新される

全農家を一括更新したい場合は Farm 全件に対して再計算スクリプトを実行

✔ 注意

公開APIは DB の値を返すだけ → 変更後は “保存し直し” が必要

予約の単価（unit_price）は予約時点で固定 → 過去予約は影響を受けない


✔ Farmer Domain V2 — 追記用セクション

（app フォルダ構成の最終整理）

9. app/ ディレクトリの最終構成（2025-11 時点）

V2 への完全移行により、プロジェクト直下の app/ フォルダは最小構成となり、役割は “アプリケーションの起動点” のみに縮小された。

app/
  main.py
  cloudinary_client.py
  database.py
  __init__.py
  static/
  __pycache__/

● main.py

FastAPI アプリのエントリーポイント。
V2 のすべての router（registration, pickup settings, farmer settings, reservations, stripe 等）をここで読み込む。
V1 の router は完全に削除され、main.py は V2 の世界観だけで動作している。

● cloudinary_client.py

Cloudinary アップロード専用の薄いラッパ。
V2 の

farmer_settings_service.py（画像アップロード）

registration_service.py（顔写真など初期登録）
から呼ばれ、画像関連の唯一の依存先として残す。

V1 の複雑な image_utils.py 等はすべて廃止済み。

● database.py

SQLite の 単純なコネクション管理レイヤー
（※本体のモデル定義はすべて V2 側 app_v2/.../repository/ に移動済み）

app/database.py の役割は：

SQLite ファイルのパスを固定

コネクションを開くためのユーティリティを提供

Alembic を使わない “シンプル ORM-less” スタイルを維持

V1 由来の冗長なモデル定義は含まれていない。
実際に Reservation / Farm / Owner を扱うのは V2 の repository 階層。

● static/

Stripe checkout ページなど、
FastAPI の /static/ で提供する HTML/CSS/JS を置く場所。
V1 ではテンプレートが複雑化していたが、V2 では必要最低限の用途に限定。

10. app/ 内の削除済み・不要ファイル（V2では使用しない）

V1 時代のファイル（例：models.py、crud.py、schemas.py など）は 全削除可能。
実際にあなたが main.py を起動し、全フロー（Registration → Pickup → Settings → 公開 → 予約 → Stripe → Export）を検証して 完全に動いたことを確認済み。

理由：

V2 ではすべての DB 操作は repository 層に分離されている

DTO 定義は app_v2/.../dtos.py に集約

予約や農家設定のビジネスロジックは service 層へ

V1 の pydantic モデルは一切参照せず

Stripe の成功 webhook → status 更新も V2 のパスにのみ依存

main.py は V1 router を 1 行も import していない

よって、V1 ファイルは残しても読み込まれず、削除してもアプリに影響しない。

11. SQLite（app.db）の読み込み位置（重要）

プロジェクト直下の app.db が実体として使われる。
app/app.db（0 byte）やその他バックアップとは一切関係しない。

現在の main.py・database.py は 相対パスでプロジェクト直下の app.db を参照しているため、この動作は完全に正常で、V2 の公式仕様として採用。

12. 最終的なアーキテクチャの位置づけ
● app/

起動レイヤー（bootstrap）
↓

● app_v2/

ドメインロジック・DTO・サービス・リポジトリ（本体）
↓

● frontend/

UI（React）
↓

● Cloudinary / Stripe / LINE

外部サービス連携

この 4 層でシンプルに構成されているため、
app/ 配下は この少数ファイルのみ残す構造が最適解。