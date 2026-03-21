 stripe listen --forward-to localhost:8000/stripe/webhook 

Customer Booking Domain V2
0. 事前確定事項（2025-11-21 時点）
A. 一覧ページ（Public Farm List）仕様

1ページ 8件 ロード

無限スクロール方式（Airbnb 形式）

並び順は ユーザー位置からの距離順（Haversine）

位置取得不可 → IP推定 → それも不可なら徳島県中心

100km 圏内0件でも必ず表示（距離順）

no_farms_within_100km = true の場合は上部に注意文を表示

PR画像は 一覧では1枚のみ（pr_images[0]）

地図モーダルは V1デザインを完全に維持

地図ピンの座標は pickup_lat / pickup_lng

地図と一覧は 同じ PublicFarmCardDTO[] を共有

B. PublicFarmCardDTO 仕様（一覧・地図共通）

farm_id はそのまま使用

名前／住所のラベルはサーバー側で作成

owner_label = owner_full_name + "さんのお米"

owner_address_label = 都道府県 + 市区町村 + 町域 + "の農家"

pr_title は 必須

pickup_slot_code → 次回受け渡し日時の計算に使用

次回受け渡し日時は 締切3時間前ルール

地図モーダルに渡す props は以下

type MapLayerPortalProps = {
  open: boolean;
  onRequestClose: () => void;
  farms: PublicFarmCardDTO[];
  mapCenter: { lat: number; lng: number };
  noFarmsWithin100km: boolean;
};

C. 地図モーダルの下部シート

face_image_url

owner_label

owner_address_label

price_10kg

next_pickup_display

pr_title

「詳細を見る」ボタン

これ以外の項目（good, deals, attendance）は完全削除・痕跡なし。

D. 設計思想

UI が必要とするすべてのデータを DTO に完全パッケージして返す

フロント側では 一切計算しない

Farmer Domain V2 の生データを直接参照しない


1. このドメインの目的とスコープ
1-1. このドメインの目的

「ユーザーが農家を探し、受け渡し日時を確認し、予約・決済までスムーズに行える UI/UX の V2 を設計する」。

範囲は：

農家一覧

農家詳細

予約フォーム

Stripe 決済

予約完了ページ

1-2. 前提

予約・決済ドメインの「真実のソース」はすべて V2（本ドキュメント）とする。V1 実装・カラムは過去データ参照用として残すが、新規機能や UI は V2 の DTO / テーブル仕様のみを前提に設計・実装する。

また 2025-11-24 時点で、サーバー側の app_v1 フォルダは削除済みであり、
Public API（一覧・詳細）、予約作成、LINE連携、Stripe 決済・Webhook を含む
一連のフローはすべて app_v2 配下のコードのみで動作している。
V1 のコードは今後も参照されない前提で、本ドキュメントを唯一の仕様として扱う。


Farmer Domain V2（Registration / Pickup / Settings）は完成済み

公開条件は Farmer Domain V2 の

active_flag

is_accepting_reservations

is_ready_to_publish
をそのまま使用する

予約・決済ドメインの「真実のソース」はすべて V2（本ドキュメント）とする。V1 実装・カラムは過去データ参照用として残すが、新規機能や UI は V2 の DTO / テーブル仕様のみを前提に設計・実装する。

2. ユーザーペルソナと体験フロー
2-1. ペルソナ

新規ユーザー（農家直送の米を買いたい人）

リピーター（決済後、再度同じ農家を予約したい人）

2-2. 典型フロー

一覧 → 詳細 → 予約 → 決済 → 完了

詳細 → 予約 へ直接遷移も可


3. ページ別仕様
3-1. 農家一覧ページ（Public Farm List）
🎯目的

ユーザーが 次回受け渡し日時と価格を基準に直感的に農家を選べること。

🧱カードに必要な項目（表示順）

owner_label（山田太郎さんのお米）

owner_address_label（徳島県阿南市見能林の農家）

face_image_url（丸）

price_10kg（¥8,700）

next_pickup_display（11/27（水）19:00–20:00）

pr_title

PR画像：pr_images[0]

🧭 その他仕様

並び順：ユーザー位置からのHaversine距離で昇順

100km以内いない場合：注意文＋距離順表示

無限スクロール：8件ずつ fetch



📌【追記用：画像の使い分け仕様（一覧・地図モーダル共通）】
E. 画像の使い分け（一覧と地図モーダルの明確な役割分担）

本ドメインでは、ユーザー体験を最適化するため、
PR画像（商品のイメージ） と
顔アイコン（農家の個性）
を役割に応じて使い分ける。

1. 農家一覧ページ（Public Farm List）での画像仕様
🖼 上部の大きい画像（ワイド写真）

使用フィールド：pr_images[0]

役割：商品（米）と農家の雰囲気が最も伝わる主要ビジュアル

表示例：稲刈り風景 / 田んぼ / 作業写真 など

仕様：フル幅、Airbnb 型カードデザイン

👤 名前横の小さな丸アイコン（顔写真）

使用フィールド：face_image_url

役割：「誰が作っているか」を直感的に伝える

表示位置：owner_label の左側

表示形状：丸マスク（既存の V1 と同じ）

一覧カードはこの “PR画像＋顔丸アイコン” の組み合わせで統一する。

2. 地図モーダル（MapLayerPortal）での画像仕様
🗺 左側の大きい領域（Farm 3 と表示されていた部分）

V2ではこの領域の背景画像を
pr_images[0]（PR写真）で完全に置き換える

役割：マップ選択時に「農家の品質・雰囲気」を強く伝えるメイン画像

仕様：V1 のレイアウト・サイズ・グラデーションはそのまま維持

👤 face_image_url は地図下部シートでは使用しない

下部シートには顔アイコンは置かず、
テキスト情報（名前・住所・価格・受渡日時・PRタイトル）を中心に配置する

一覧 → 地図モーダルへの遷移で
「一覧：人の顔」「地図：PR画像」 の役割分担が明確になる

3. 地図モーダル下部シートの表示項目（画像以外の要素）

順番と内容は以下で固定する：

owner_label（例：山田太郎さんのお米）

owner_address_label（徳島県阿南市見能林の農家）

price_10kg（¥8,700 (10kg)）

next_pickup_display（11/27（水）19:00–20:00）

pr_title（短い紹介文）

「詳細を見る」ボタン

※ good / deals / attendance は完全削除、痕跡なし

4. 画像利用のまとめ（最終版）
コンポーネント	PR画像（pr_images[0]）	顔写真（face_image_url）
一覧カード	✔ 大きいメイン画像	✔ 小さな丸アイコン
地図モーダル（左の大画像）	✔ 完全に PR画像で統一	✖ 使用しない
地図モーダル（下部シート）	✖ 使用しない	✖ 使用しない（画像は置かない）

一覧＝商品を見やすく、人を確認できる
地図＝商品イメージを強く伝える

という 役割分担で UX が最大化される。

3-2. 地図モーダル（MapLayerPortal）
🎯目的

「位置で探す」UXを提供するが、デザインはV1そのまま。

📦 props（確定）
{
  open,
  onRequestClose,
  farms: PublicFarmCardDTO[],
  mapCenter: { lat, lng },
  noFarmsWithin100km
}

📌 ピンの仕様

bubbleに ¥{price_10kg} を表示

active時のスタイルはそのまま

📌 下部シート（詳細ミニビュー）

face_image_url

owner_label

owner_address_label

price_10kg

next_pickup_display

pr_title

「詳細を見る」ボタン

※ Good / Deals / Attendance は完全に削除。

3-3. 農家詳細ページ（Public Farm Detail）

別途 PublicFarmDetailDTO で定義するが、一覧カードと共通項目は：

owner_label

owner_address_label

next_pickup_display

pr_title

pr_images（全枚）

価格表（5kg/10kg/25kg）

品種ラベル

自動計算 harvest_year

ピックアップ場所（住所＋地図）

3-4. 予約フォームページ

選択可能kg（5kg/10kg/25kg）

next_pickup_start / deadline

指定されたスロット（pickup_slot_code）

ユーザー連絡先（電話・メール）

3-5. Stripe 決済フロー

価格は DTO → API で確定

決済 → Webhook → 予約ステータス confirmed

3-6. 予約完了ページ

システム照会ID

farm_id

next_pickup_display

受け渡し場所（住所）

4. DTO 設計
4-1. PublicFarmCardDTO（一覧・地図共通）

✔ 最新版（あなたの希望どおり）

export type PublicFarmCardDTO = {
  farm_id: number;

  owner_full_name: string;      // 山田太郎
  owner_label: string;          // 山田太郎さんのお米
  owner_address_label: string;  // 徳島県阿南市見能林の農家

  price_10kg: number;

  face_image_url: string;
  pr_images: string[];
  pr_title: string;

  pickup_slot_code: string;

  next_pickup_display: string;
  next_pickup_start: string;     // ISO
  next_pickup_deadline: string;  // ISO

  pickup_lat: number;
  pickup_lng: number;
};

補足：
next_pickup_start / next_pickup_deadline / next_pickup_display は、
バックエンド側の共通ユーティリティ

- app_v2/customer_booking/services/pickup_time_utils.py の compute_next_pickup()

によって一元的に計算される。PublicFarmList API と Reservation API
（/api/reservations）は必ずこの関数を参照し、3時間前締切ルールを
完全に共有する。


4-2. PublicFarmDetailDTO

農家詳細ページ（/farms/{farm_id}）専用の DTO。
一覧カードと共通の項目に加えて、価格表（5/10/25kg）、品種ラベル、収穫年度、住所テキスト、ミニマップ座標、共有URLなどを含む。

// 一覧カードと共通の項目
export type PublicFarmDetailDTO = {
  farm_id: number;

  // 表示ラベル（意味ベース）
  owner_full_name: string;      // 例: "山田太郎"
  owner_label: string;          // 例: "山田太郎さんのお米"
  owner_address_label: string;  // 例: "徳島県阿南市見能林の農家"

  // 代表価格（10kg）
  price_10kg: number | null;

  // 画像・タイトル
  face_image_url: string;   // 丸アイコン用
  pr_images: string[];      // すべてのPR画像（0枚以上）
  pr_title: string;         // PRタイトル（必須運用）

  // 受け渡しスロット（一覧と同じ）
  pickup_slot_code: string;     // 例: "WED_19_20"
  next_pickup_display: string;  // 例: "11/27（水）19:00–20:00"
  next_pickup_start: string;    // ISO文字列
  next_pickup_deadline: string; // ISO文字列

補足：
これらの受け渡しスロット関連フィールドも、
app_v2/customer_booking/services/pickup_time_utils.py の
compute_next_pickup() によって算出される。
PublicFarmCardDTO と PublicFarmDetailDTO で同じロジックを共有し、
一覧・詳細・Confirm・予約APIの間で次回受け渡し日時／締切が
必ず一致するようにする。



  pickup_lat: number;
  pickup_lng: number;

  // ===== ここから詳細ページ専用の追加項目 =====

  // 価格表（バックエンド確定値・予約時に使用する単価の元）
  price_5kg: number | null;   // farms.price_5kg からそのまま
  price_25kg: number | null;  // farms.price_25kg からそのまま

  // 品種ラベル・収穫年度
  rice_variety_label: string | null; // 例: "コシヒカリ"
  harvest_year: number | null;       // 例: 2025（null の場合はフロントでフォールバック計算可）

  // 住所テキスト（フル）
  address_text: string;  // 例: "徳島県徳島市伊月町1丁目14-1 ○○マンション101号室"

  // ミニマップ中心座標（pickup_lat/lng と同じでもよい）
  center_lat: number;
  center_lng: number;

  // 受け渡し日時文言（下部CTA用）
  // 例: "11/27（水）19:00–20:00" / "受け渡し日時は未設定です" など
  // （フロント側では pickupTextCard / pickupTextCTA の元になる）
  pickup_time: string | null;

  // PR本文（任意）
  pr_text: string | null;

  // 評価・実績（現状はダミー無し、将来拡張を前提に null 許容）
  good_rate: number | null;    // 0–100 の百分率
  deals_count: number | null;  // 取引件数

  // 共有用URL（なければフロントで window.location.href を使う）
  share_url: string | null;
};

FarmDetailPage 側の実装（2025-11-23 時点）

- `/farms/{farm_id}` は **PublicFarmDetailDTO を 1:1 で受け取り表示する V2 実装** に完全移行した。
- 価格は DTO に含まれる `price_5kg / price_10kg / price_25kg` をそのまま使用し、
  旧来の `pricing/preview` API やフロント側での再計算ロジックには一切依存しない。
- DTO に含まれる `harvest_year / rice_variety_label / pickup_lat / pickup_lng /
  pickup_address_label / pr_title / pr_text / pr_images / face_image_url` も、
  FarmDetailPage 内の各カードコンポーネント（プロフィール・価格・受け渡し時間・地図など）に
  そのまま渡して表示している。
- 公開条件チェック（`active_flag / is_accepting_reservations / is_ready_to_publish`）は
  バックエンド service 層で完結しており、FarmDetailPage から V1 のテーブルやフラグを
  直接参照する部分は存在しない。



4-3. ReservationFormDTO

予約フォーム（農家詳細ページ → 予約内容確認ページ）からサーバーに送るリクエストボディ。

価格情報は一切送らない

「どの農家で」「どのスロットに」「どのサイズを何口予約するか」だけを渡し、
単価・小計はすべてサーバー側で確定する

TypeScript 定義（フロント側イメージ）

// ConfirmPage から POST /api/reservations に送るボディ
export type ReservationFormDTO = {
  farm_id: number;

  // 予約する受け渡しスロット
  // 例: "WED_19_20"
  pickup_slot_code: string;

  // 予約するお米の内訳
  items: {
    size_kg: 5 | 10 | 25; // 5kg / 10kg / 25kg のどれか
    quantity: number;     // そのサイズを何口予約するか（1以上の整数）
  }[];
};


説明

farm_id

対象となる農家のID。FarmDetailから引き継ぐ。

pickup_slot_code

受け渡しスロットを表すコード（例: "WED_19_20"）。

予約ドメインルール「farm_id と pickup_slot_code は必須」を満たすため、必須項目とする。

items[]

size_kg … 予約する枠サイズ（5kg / 10kg / 25kg）。

quantity … そのサイズを何枠予約するか（1,2,...）。

単価や小計は送らず、サーバー側で farms.price_5kg / 10kg / 25kg から計算する。

4-4. ReservationResultDTO

予約作成後にサーバーから返すレスポンス DTO。

Confirm ページ（予約内容の確認）

予約完了ページ

の両方で共通して利用することを想定する。
現在の UI では Confirm ページは「金額確認のみ」なので、
金額関連＋システム照会IDを中心とした最小セットを定義する。

TypeScript 定義（フロント側イメージ）

export type ReservationResultItemDTO = {
  size_kg: 5 | 10 | 25;
  quantity: number;
  unit_price: number;  // このサイズ1枠あたりの金額
  subtotal: number;    // unit_price * quantity
};

export type ReservationResultDTO = {
  // 予約識別子（Stripe セッション作成時に使用）
  reservation_id: number;

  // どの農家の予約か（完了ページなどで使用）
  farm_id: number;

  // お米代の内訳
  items: ReservationResultItemDTO[];
  rice_subtotal: number;   // items[].subtotal の合計

  // Stripe で決済する運営サポート費
  service_fee: number;     // 例: 300
  currency: "jpy";
};


説明

reservation_id

作成された予約のID。

POST /stripe/checkout/{reservation_id} の入力として使用する。

farm_id

対象農家のID。完了ページや将来の履歴画面で利用できるように保持しておく。

items[]

size_kg / quantity は ReservationFormDTO と同じ。

unit_price はサーバー側で farms テーブルから決定した 1枠あたりの価格。

subtotal は unit_price * quantity をサーバー側で計算した値。

rice_subtotal

お米代の合計金額。Confirm ページの「お米代（現地で農家さんにお支払い）」として表示する。

service_fee

Stripe でオンライン決済する金額（運営サポート費）。

現状は 300 円だが、将来の仕様変更に備えてサーバー側で値を持つ。

currency

通貨コード。現状は "jpy" 固定。

※ 「合計（お米代＋運営サポート費）」は UI から合計カードを削除する方針のため、
DTO には total フィールドを持たせない。


Customer Booking Domain V2.md の中で：

4-4. ReservationResultDTO

（完了ページ用の表示情報）



5. API 設計


となっているはずなので、
「（完了ページ用の表示情報）」の行のすぐ下 に、下のブロックをそのまま貼り付けて。

Customer Booking Domain V2

追記する内容（そのままコピペでOK）
4-5. Reservation 永続化（reservations テーブル仕様）

このセクションでは、Confirm Page / Stripe 決済で使用する予約レコード
（SQLite テーブル `reservations`）の V2 仕様を定義する。

### 4-5-1. 目的

- Confirm Page で作成した予約を「pending → confirmed」の 2 段階で管理する。
- 予約内容（何kgを何袋 / どのスロットか）を JSON で正確に保存する。
- 過去予約の集計・分析（離脱率、決済成功率など）に耐えられる構造にする。
- 既存の V1 カラム（item / quantity / price / amount など）は残したまま、
  V2 では **新カラム群を真実のソースとして使う**。

### 4-5-2. reservations テーブル カラム一覧（V2 で重要なもの）

（実装メモ）

2025-11-23 の時点で、既存の `reservations` テーブルに対して

- `item / quantity / price / amount`
- `user_confirmation_status` など V1 由来のカラム

を含むすべてについて NOT NULL 制約を解除し、`id` 以外は NULL 許容とした。

これにより、V2 では

- INSERT 時に `item / quantity / price / amount` などを一切セットしない
- `items_json / rice_subtotal / service_fee / pickup_slot_code / currency` を **真実のソース** として扱う

という運用を安全に行う。


| カラム名   | 型              | NULL | 用途 |
|-----------|-----------------|------|------|
| id        | INTEGER PK      | NO   | システム照会ID（ReservationResultDTO.reservation_id と一致） |
| user_id   | INTEGER         | NO   | 予約したユーザーID（当面は 1 固定などで運用可） |
| farm_id   | INTEGER         | NO   | どの農家への予約か |

#### 受け渡しスロット

| カラム名           | 型             | NULL | 用途 |
|--------------------|----------------|------|------|
| pickup_slot_code   | VARCHAR(32)    | YES  | 受け渡し時間帯コード。例: `"WED_19_20"`。V2 では必ずセットするが、既存予約互換のため DB 上は NULL 許容。 |

#### 予約アイテム内訳（お米）

| カラム名    | 型    | NULL | 用途 |
|------------|-------|------|------|
| items_json | TEXT  | YES  | 予約したお米の内訳を JSON 配列で保存する。V2 ではここを **真実のソース** とする。 |

`items_json` の中身（例）:

```json
[
  { "size_kg": 10, "quantity": 2, "unit_price": 8000, "line_total": 16000 },
  { "size_kg": 5,  "quantity": 1, "unit_price": 4200, "line_total": 4200 },
  { "size_kg": 25, "quantity": 1, "unit_price": 18400, "line_total": 18400 }
]


Confirm Page から送られてくるのは size_kg と quantity のみ。

unit_price / line_total はサーバー側で farms.price_5kg/10kg/25kg から計算して埋める。

金額（お米代＋運営サポート費）
カラム名	型	NULL	用途
rice_subtotal	INTEGER	YES	items_json の line_total 合計＝お米代合計。Confirm Page の「お米代（現地で農家さんにお支払い）」表示の元データ。
service_fee	INTEGER	YES	運営サポート費。現在は常に 300 を保存する。将来変更しても過去レコードの金額が崩れないようにするため。
currency	VARCHAR(10)	NO	通貨コード。デフォルト "jpy"。
ステータス・ライフサイクル
カラム名	型	NULL	用途
status	VARCHAR(32)	NO	予約ステータス。V2では "pending" / "confirmed" を使用。将来 "cancelled" など拡張可。
created_at	DATETIME	YES	レコード作成時刻。予約が pending になったタイミング として扱う。
payment_succeeded_at	DATETIME	YES	Stripe 決済成功時刻。V2では事実上 confirmed_at として扱う。

※ 既存カラム status / created_at / payment_succeeded_at は
V2 でもそのまま利用する。新たに confirmed_at カラムは増やさず、
payment_succeeded_at を confirmed の時刻として扱う。

決済・LINE通知関連（既存カラムをそのまま利用）
カラム名	型	NULL	用途
payment_intent_id	VARCHAR(100)	YES	Stripe PaymentIntent ID（または Checkout Session ID）。Webhook との紐付けに利用。
payment_status	VARCHAR(50)	YES	Stripe 側のステータス（succeeded など）。デバッグ・障害解析用。
paid_service_fee	BOOLEAN	NO	V1 由来のフラグ。V2 では status == 'confirmed' かつ payment_status == 'succeeded' で同等の意味を持つため、主に互換用として残す。
line_notified_at	DATETIME	YES	LINE 通知を送った時刻。将来の通知ログ/再送制御に利用予定。
4-5-3. V1 カラムとの関係

V1 由来の以下のカラムは、過去データとの互換性のために残すが、V2 ではメインの情報源としては使わない。

item / quantity / price / amount

過去の予約サマリーとしては参照可能。

V2 では items_json / rice_subtotal / service_fee を使う前提で設計する。

4-5-4. ステータス遷移（pending → confirmed）

予約のライフサイクルはシンプルな 2 段階。

pending

Confirm Page で「300円で決済に進む」ボタンを押した瞬間に、
reservations レコードを INSERT する。

この時点で：

status = 'pending'

created_at = CURRENT_TIMESTAMP

payment_succeeded_at = NULL

Stripe 決済をまだ完了していない「仮予約」。

confirmed

Stripe Checkout で決済が成功し、Webhook（/stripe/webhook）が
checkout.session.completed を受信したタイミングで確定させる。

このとき：

status = 'confirmed'

payment_status = 'succeeded'（Stripe の状態に合わせる）

payment_succeeded_at = CURRENT_TIMESTAMP

この時点で予約は正式に確定する。

ユーザーが Stripe 画面で離脱した場合：

status = 'pending' のまま残り続ける。

これにより、決済離脱率の分析や障害検知（Webhook 死亡など）が可能になる。

4-5-5. Confirm Page / Stripe との関係（サマリ）

Confirm Page → POST /api/reservations

リクエスト: ReservationFormDTO

処理内容:

reservations に status = 'pending' で INSERT

items_json / rice_subtotal / service_fee を計算・保存

レスポンス: ReservationResultDTO

フロントはその後、reservation_id を使って Stripe Checkout 用の
エンドポイント/stripe/checkout/{reservation_id} など）を呼び出す。

Stripe 決済成功 → Webhook /stripe/webhook

Stripe の metadata / payment_intent_id から reservation_id を特定

対応するレコードに対して：

status = 'confirmed'

payment_status = 'succeeded'

payment_succeeded_at = CURRENT_TIMESTAMP

これにより「決済が通った予約だけが confirmed になる」ことを保証する。


---

これで「reservations テーブルをどう使うか」「pending / confirmed の意味」が  
将来見直すときにも迷わないレベルで設計図に残せるはず。

次のステップとしては：

- このブロックを md に貼る  
- DB に 5 つのカラムを追加（pickup_slot_code / items_json / rice_subtotal / service_fee / currency）  
- そのうえで `reservations_api.py` を書いていく  

という流れで行ける。

5. API 設計

GET /api/public/farms?page=1&lat=&lng=

GET /api/public/farms/{farm_id}

5-2. Public Farm Detail API（GET /api/public/farms/{farm_id}）

5-2-1. エンドポイント概要

HTTP Method: GET

Path: /api/public/farms/{farm_id}

役割:

- 農家詳細ページ（/farms/{farm_id}）に必要な情報を 1件分返す
- レスポンス本体は PublicFarmDetailDTO

公開対象（フィルタ条件）は一覧と同じく Farmer Domain V2 の

- farms.active_flag == 1
- farms.is_accepting_reservations == true
- farms.is_ready_to_publish == true

をすべて満たす farm のみ。

5-2-2. リクエスト仕様

Path Parameter:

- farm_id: int（必須）

例:

GET /api/public/farms/63

5-2-3. 正常系レスポンス（200 OK）

{
  "ok": true,
  "farm": {
    // PublicFarmDetailDTO
    "farm_id": 63,
    "owner_full_name": "山田太郎",
    "owner_label": "山田太郎さんのお米",
    "owner_address_label": "徳島県阿南市見能林の農家",

    "price_10kg": 8700,
    "price_5kg": 4600,
    "price_25kg": 21000,

    "face_image_url": "https://.../face.jpg",
    "pr_images": [
      "https://.../pr1.jpg",
      "https://.../pr2.jpg"
    ],
    "pr_title": "減農薬コシヒカリを家族で育てています",
    "pr_text": "家族で育てたお米を、精米したてでお届けします。",

    "pickup_slot_code": "WED_19_20",
    "next_pickup_display": "11/27（水）19:00–20:00",
    "next_pickup_start": "2025-11-27T19:00:00+09:00",
    "next_pickup_deadline": "2025-11-27T16:00:00+09:00",

    "pickup_lat": 34.123456,
    "pickup_lng": 134.56789,
    "center_lat": 34.123456,
    "center_lng": 134.56789,

    "address_text": "徳島県阿南市見能林町◯◯-◯◯",

    "rice_variety_label": "コシヒカリ",
    "harvest_year": 2025,

    "pickup_time": "11/27（水）19:00–20:00",

    "good_rate": 97,
    "deals_count": 13,

    "share_url": "https://rice-app.example.com/farms/63"
  }
}

5-2-4. 異常系レスポンス

1) 公開条件を満たさない / farm_id 不正

- 404 Not Found

{
  "ok": false,
  "error_code": "FARM_NOT_FOUND",
  "message": "指定された農家は見つからないか、現在は公開されていません。"
}

2) その他のサーバーエラー

- 500 Internal Server Error

{
  "ok": false,
  "error_code": "INTERNAL_ERROR",
  "message": "予期しないエラーが発生しました"
}


POST /api/reservations

POST /stripe/checkout/{reservation_id}

POST /stripe/webhook

5-3. Reservation API（POST /api/reservations）

5-3-1. エンドポイント概要

- HTTP Method: POST
- Path: `/api/reservations`
- 役割: Confirm Page からの入力（どの農家で / どのスロットに / 何kgを何袋か）を受け取り、
  サーバー側で単価・小計を確定したうえで
  `reservations` テーブルに `status = 'pending'` の予約レコードを作成する。

本エンドポイントは V2 専用であり、V1 の `item / quantity / price / amount` カラムには一切書き込まない。

5-3-2. リクエストボディ（ReservationFormDTO）

Content-Type: `application/json`

```json
{
  "farm_id": 71,
  "pickup_slot_code": "WED_19_20",
  "items": [
    { "size_kg": 5, "quantity": 1 },
    { "size_kg": 10, "quantity": 1 },
    { "size_kg": 25, "quantity": 1 }
  ]
}

farm_id: 予約対象の農家 ID（必須）

pickup_slot_code: 受け渡しスロットコード（必須）。例: "WED_19_20"

items[]: 予約するお米の内訳

size_kg: 5 / 10 / 25 のいずれか（5kg / 10kg / 25kg 枠）

quantity: 1 以上の整数

単価・合計金額は一切送らない。
サーバー側で farms.price_5kg / price_10kg / price_25kg から確定する。

【追加仕様：Confirm Page の有効期限（client_next_pickup_deadline_iso）】

Confirm Page を開いたときの締切（next_pickup_deadline）を
フロント側で client_next_pickup_deadline_iso として保存し、
予約リクエスト POST /api/reservations の body に含めて送信する。

サーバー側では：

1. client_next_pickup_deadline_iso が past（now >= deadline）なら → 409 を返す
2. 未来の時刻なら → 通常どおり pending 予約を作成

これにより：

- UI を開きっぱなしのまま締切を跨ぐと 409
- UI / Detail / Confirm / API 間の締切ロジックが100%一致
- 改ざんされた deadline（過去値）も確実に拒否される

という完全な一貫性が保証される。


5-3-3. サーバー側の処理内容（概要）

items が空の場合は 400 を返す。

各 items[i] について:

quantity <= 0 の場合は 400。

size_kg に応じて farms テーブルから単価 (price_5kg / price_10kg / price_25kg) を取得。

unit_price * quantity を計算し、小計 subtotal を求める。

すべての subtotal を合計して rice_subtotal を算出。

運営サポート費 service_fee は現状 300 円で固定（将来変更に備えてサーバー側で保持）。

items_json に以下の JSON 配列を保存する:

[
  { "size_kg": 5,  "quantity": 1, "unit_price": 3685,  "subtotal": 3685 },
  { "size_kg": 10, "quantity": 1, "unit_price": 7700,  "subtotal": 7700 },
  { "size_kg": 25, "quantity": 1, "unit_price": 15410, "subtotal": 15410 }
]

reservations テーブルに INSERT する:

user_id: 当面は 1 固定（将来的にログインユーザーIDと紐付け）

farm_id: リクエストの farm_id

pickup_slot_code: リクエストの pickup_slot_code

items_json: 上記 JSON 文字列

rice_subtotal: 計算された合計

service_fee: 300

currency: "jpy"

status: "pending"

created_at: CURRENT_TIMESTAMP

V1 由来の item / quantity / price / amount などのカラムは NULL のままにする。

5-3-4. レスポンスボディ（ReservationResultDTO）

成功時（200 OK）のレスポンス例:

{
  "reservation_id": 169,
  "farm_id": 71,
  "items": [
    {
      "size_kg": 5,
      "quantity": 1,
      "unit_price": 3685,
      "subtotal": 3685
    },
    {
      "size_kg": 10,
      "quantity": 1,
      "unit_price": 7700,
      "subtotal": 7700
    },
    {
      "size_kg": 25,
      "quantity": 1,
      "unit_price": 15410,
      "subtotal": 15410
    }
  ],
  "rice_subtotal": 26795,
  "service_fee": 300,
  "currency": "jpy"
}


reservation_id: 作成された予約の ID（reservations.id）

farm_id: リクエストと同じ

items[]: サーバー側で確定した単価と小計

rice_subtotal: items[].subtotal の合計

service_fee: Stripe で決済する運営サポート費

currency: "jpy"

Confirm Page では、このレスポンスをそのまま

「お米代（現地払い）」 = rice_subtotal

「運営サポート費（オンライン決済）」 = service_fee

として表示する。
合計カードは UI の方針どおり 表示しない ため、DTO に total フィールドは存在しない。

5-3-5. エラーケース

400 Bad Request

items が空

quantity <= 0

size_kg が 5 / 10 / 25 以外

farm_id に対応する farms レコードが存在しない

指定サイズの価格 (price_5kg など) が未設定の場合

500 Internal Server Error

その他の予期せぬエラー


---

この 3点だけ入れておけば、

- 「V1互換を気にしない」という方針
- `reservations` テーブルをどう変えたか
- `/api/reservations` が何をしているか

が設計書と実装で完全に揃います。

これ以上は、Stripe セッション作成・Webhook の具体仕様はまだこれからなので、  
実装が固まってから 5-4 / 5-5 として追記する形で十分だと思います。

6. 公開条件

Farmer Domain V2 の

active_flag

is_accepting_reservations

is_ready_to_publish
をANDしたものが公開条件。

7. 予約ドメインルール

受け渡し締切（next_pickup_deadline）を過ぎた予約は受け付けない。
ただしフロント側の Confirm Page で締切前に画面を開いていた場合は、
Confirm 表示時点での締切（client_next_pickup_deadline_iso）をそのまま使用する。

その結果：

- Confirm → 決済を締切前に開始した場合 → 成功
- Confirm を開いたまま締切を跨いだ場合 → API が 409 を返して拒否
- UI と API は compute_next_pickup によって完全に一致した締切ロジックで動作する


farm_id と pickup_slot_code は必須

二重予約防止は V2.1 以降に拡張予定

8. V1 → V2 移行方針（2025-11-24 時点）

- サーバー側の app_v1 フォルダは削除済みであり、Public Farm List / Public Farm Detail /
  予約作成（/api/reservations）/ LINE 連携 / Stripe Checkout & Webhook を含む
  すべてのフローは app_v2 配下のみで動作している。
- reservations テーブルの V1 由来カラム（item / quantity / price / amount など）は
  過去データ閲覧用として残すが、新規の書き込み・読み取りロジックは
  items_json / rice_subtotal / service_fee / pickup_slot_code / currency など
  V2 カラム群のみを真実のソースとして使用する。
- LINE 連携は app_v2/integrations/line/line_api.py が提供する
  /api/line/login, /api/line/callback, /api/line/linked などのエンドポイントを
  唯一の入り口とし、V1 の line_auth.py 系コードは存在しない。
- Stripe 連携は app_v2/integrations/payments 配下の
  /stripe/checkout/{reservation_id}（Checkout セッション作成）と
  /stripe/webhook（決済結果受信）を唯一のエンドポイントとする。
  V1 の create-intent や force-confirm はテスト用途に限定し、
  本番フローの仕様からは除外する。
- 今後追加する Export v2 や Admin Dashboard、ユーザー向け履歴画面なども、
  本ドメインで定義した V2 DTO / API / テーブル仕様のみを前提に設計する。


9. 今後の拡張


LINE通知

Export v2

Admin Dashboard

5-1. PublicFarmList API（GET /api/public/farms）
5-1-1. エンドポイント概要

HTTP Method: GET

Path: /api/public/farms

役割:

顧客向け「農家一覧ページ＋地図モーダル」に必要なリストデータを返す

返却単位は PublicFarmCardDTO（一覧カード・地図ピン・地図下部シートで共通利用）

8件ずつページネーションし、距離順でソートして返す

5-1-2. 公開対象（フィルタ条件）

Farmer Domain V2 の公開条件をそのまま使用する：

farms.active_flag == 1（BANされていない）

farms.is_accepting_reservations == true（予約受付中）

farms.is_ready_to_publish == true（設定情報が公開条件を満たしている）

これら 3条件すべてを満たす farm のみ 一覧に載る。

5-1-3. リクエスト仕様
クエリパラメータ
GET /api/public/farms?page=1&lat=34.06&lng=134.55

パラメータ	型	必須	説明
page	int	任意	1 始まりのページ番号。省略時は 1。常に 1 以上。
lat	float	任意	ユーザー位置（緯度）。位置がわかっている場合のみ送る。
lng	float	任意	ユーザー位置（経度）。位置がわかっている場合のみ送る。
page / page_size の扱い

フロント実装上、1ページあたり 8件固定 で運用する。

API 内部では page_size = 8 を固定値として扱う。

レスポンス JSON には page_size を含める（確認用）。

位置情報が無い場合の扱い（lat / lng 省略時）

lat / lng が指定されていない場合、サーバー側で 近似ユーザー位置 を推定して使う想定（実装方法はインフラ側で調整）

第一候補: IP アドレスからの地域推定

それも不明な場合: 徳島県中心座標 を使用（例: lat=34.0703, lng=134.5548）

※ API 仕様としては「lat/lng 未指定でも呼び出せる」「バックエンドが reasonable な中心座標を決める」という前提。

5-1-4. レスポンス仕様
正常系（200 OK）
{
  "ok": true,
  "page": 1,
  "page_size": 8,
  "total_count": 42,
  "has_next": true,
  "no_farms_within_100km": false,
  "farms": [
    {
      "farm_id": 63,
      "owner_label": "山田太郎さんのお米",
      "owner_address_label": "徳島県阿南市見能林の農家",
      "owner_full_name": "山田太郎",
      "price_10kg": 8700,
      "face_image_url": "https://.../face.jpg",
      "pr_images": [
        "https://.../pr1.jpg",
        "https://.../pr2.jpg",
        "https://.../pr3.jpg"
      ],
      "pr_title": "減農薬コシヒカリを家族で育てています",
      "pickup_slot_code": "WED_19_20",
      "next_pickup_display": "11/27（水）19:00–20:00",
      "next_pickup_start": "2025-11-27T19:00:00+09:00",
      "next_pickup_deadline": "2025-11-27T16:00:00+09:00",
      "pickup_lat": 34.123456,
      "pickup_lng": 134.56789
    }
  ]
}

トップレベルフィールド
フィールド名	型	説明
ok	boolean	常に true（正常系）
page	int	現在のページ番号
page_size	int	1ページあたり件数（常に 8）
total_count	int	条件に合致する農家の総件数（全ページ分）
has_next	boolean	次ページが存在するかどうか
no_farms_within_100km	boolean	100km 圏内に1件も農家がない場合 true
farms	array	PublicFarmCardDTO の配列（0件以上）
farms 配列要素：PublicFarmCardDTO
export type PublicFarmCardDTO = {
  farm_id: number;

  // 表示ラベル（直感的 & 意味ベース）
  owner_label: string;          // "山田太郎さんのお米"
  owner_address_label: string;  // "徳島県阿南市見能林の農家"
  owner_full_name: string;      // "山田太郎"

  price_10kg: number;

  face_image_url: string;
  pr_images: string[];
  pr_title: string;             // PRタイトル（必須運用）

  pickup_slot_code: string;     // 例: "WED_19_20"

  next_pickup_display: string;  // 例: "11/27（水）19:00–20:00"
  next_pickup_start: string;    // ISO日時: "2025-11-27T19:00:00+09:00"
  next_pickup_deadline: string; // ISO日時: "2025-11-27T16:00:00+09:00"

  pickup_lat: number;
  pickup_lng: number;
};


next_pickup_start / next_pickup_deadline は JST(+09:00) の ISO8601 文字列 で返す（DBはUTCでもよいが API レイヤで変換）。
これら next_pickup_* は、すべて pickup_time_utils.compute_next_pickup()
によって一元的に算出され、Reservation API も同じロジックを参照する。


pr_images[0] : 一覧カード・地図モーダル左側メイン画像として使用。

face_image_url : 一覧カードの丸アイコンとして使用。

5-1-5. 並び順・距離ロジック
1. 距離の基準点（center）

lat / lng が指定されている場合:
→ それを中心として計算。

指定されていない場合:
→ サーバーが決めた「ユーザー近傍座標」または「徳島中心」を使用（仕様 5-1-3 参照）。

2. 距離計算方法

Haversine 方式 で pickup_lat / pickup_lng と中心座標の距離を計算。

計算された距離を元に 昇順（近い順）にソート してから、ページングして返す。

3. 100km フラグの判定

全件のうち、中心から100km以内の farm が1件もない場合
→ no_farms_within_100km = true

それでも distance の近い順で一覧を返す

フロント側はこのフラグを見て
「近くに農家がいません。かわりに一番近い農家を表示しています。」
などの文言を出す。

※ 100km は「フィルタ」ではなく「UI用のフラグ」であり、
　実際には距離が何kmでもソートして返す。

5-1-6. 異常系レスポンス
400 Bad Request（例）
{
  "ok": false,
  "error_code": "INVALID_COORDINATES",
  "message": "lat/lng が不正です"
}


発生条件（例）：

lat / lng に数値以外の値が入っている

緯度が [-90, 90] の範囲外

経度が [-180, 180] の範囲外

500 Internal Server Error（例）
{
  "ok": false,
  "error_code": "INTERNAL_ERROR",
  "message": "予期しないエラーが発生しました"
}


この仕様で /api/public/farms を実装しておけば：

FarmsListPage は farms 配列をそのままカードに使える

MapLayerPortal は farms と no_farms_within_100km をそのまま props でもらえばいい

バックエンドの公開条件・距離ロジックはすべて API 側で完結

という形になります。


(追記）)
Customer Booking Domain V2 は 一覧 → API → DTO → 地図 → 詳細ページ
の順で設計・実装するのがもっとも筋が通っていて壊れないと思う。

✅ 今後の正しい進め方（壊さず・最短）

次はこの順番でやるのがベスト：

① PublicFarmCardDTO（一覧カード用）を100%確定

この部分はもうほぼ完成している。
最後に一度だけフィールド・型・説明を精査して完全に fix する。

② Backend 側で PublicFarmCardDTO を返す API を作る

例：
GET /api/public/farms?page=1&per_page=8&lat=...&lng=...

距離順ソート

next_pickup の計算

owner_label / owner_address_label の生成

pr_images[0], price_10kg など

この API が完成してから UI 改修をする。

③ FarmsListPage.tsx に DTO をそのまま渡す

一覧カードの表示に必要なデータが揃う。

④ 地図モーダル（MapLayerPortal.tsx）へ props を渡す

ここで初めて：

<MapLayerPortal
    open={mapOpen}
    onRequestClose={...}
    farms={publicFarms}
    mapCenter={userApproxLocation}
    noFarmsWithin100km={flag}
/>


となり、ダミーデータ不要・違和感ゼロで動く。

⑤ そして最後に MapLayerPortal.tsx を V2 仕様で書き換え

この段階なら props がすべて揃っているので壊れない。

✅ PublicFarmCardDTO（最終版）
export type PublicFarmCardDTO = {
  farm_id: number;

  // 表示ラベル（直感的 & 意味ベース）
  owner_label: string;          // "山田太郎さんのお米"
  owner_address_label: string;  // "徳島県阿南市見能林の農家"
  owner_full_name: string;      // "山田太郎"

  price_10kg: number;

  face_image_url: string;
  pr_images: string[];
  pr_title: string;             // PRタイトル（必須）

  pickup_slot_code: string;

  next_pickup_display: string;
  next_pickup_start: string;
  next_pickup_deadline: string;

  pickup_lat: number;
  pickup_lng: number;
};



JSON 出力例（API の正式レスポンス）

{
  "ok": true,
  "page": 1,
  "page_size": 8,
  "total_count": 42,
  "has_next": true,
  "farms": [
    {
      "farm_id": 63,
      "owner_label": "山田太郎さんのお米",
      "owner_address_label": "徳島県阿南市見能林の農家",
      "owner_full_name": "山田太郎",
      "price_10kg": 8700,
      "face_image_url": "https://.../face.jpg",
      "pr_images": [
        "https://.../pr1.jpg",
        "https://.../pr2.jpg",
        "https://.../pr3.jpg"
      ],
      "pr_title": "減農薬コシヒカリを家族で育てています",
      "pickup_slot_code": "WED_19_20",
      "next_pickup_display": "11/27（水）19:00–20:00",
      "next_pickup_start": "2025-11-27T19:00:00+09:00",
      "next_pickup_deadline": "2025-11-27T16:00:00+09:00",
      "pickup_lat": 34.123456,
      "pickup_lng": 134.56789
    }
  ]
}


10. Public Farm List 実装ステータス（2025-11-22 時点）

この節では、Public Farm List / 地図モーダル周りの「現時点で実装済みの範囲」と
「今後の TODO（後回しにしたもの）」を明示する。

10-1. 実装済み（Backend / API）

- `GET /api/public/farms` は PublicFarmList API Design に従って実装済み。
- レスポンスは `PublicFarmCardDTO` 配列＋ページ情報（`ok, page, page_size, total_count, has_next, no_farms_within_100km`）で返却される。
- 公開条件は Farmer Domain V2 の
  - `farms.active_flag == 1`
  - `farms.is_accepting_reservations == true`
  - `farms.is_ready_to_publish == true`
  を満たす farm のみ。
- 距離計算（Haversine）と「開始3時間前締切」ロジックに基づく
  `next_pickup_start / next_pickup_deadline / next_pickup_display` も実装済み。
- `owner_label`, `owner_address_label` の生成ロジックは仕様どおりに動作しており、
  フロントからの JSON を確認済み。

10-2. 実装済み（Frontend / Public 一覧ページ）

- `FarmsListPage.tsx` は V2 の `PublicFarmCardDTO[]` をそのまま受け取り表示する。
- 一覧カードのレイアウトは V1 デザインを維持しつつ、フィールド割り当ては次の通り：
  - 大きい画像：`pr_images[0]`
  - 顔アイコン：`face_image_url`
  - 太字タイトル：`pr_title`
  - その下の行：`owner_label`（◯◯さんのお米）
  - 説明行：`owner_address_label`（◯◯県◯◯市◯◯町の農家）
  - 価格・次回受け渡し：`price_10kg`, `next_pickup_display`
- お気に入りハートはローカル（`localStorage` ベース）で動作。
- 一覧の各カードから `/farms/{farm_id}` への遷移は正常に動作。
- `MapLayerPortal` は V2 用に書き換え済みで、
  一覧と同じ `PublicFarmCardDTO[]` を受けてピン・下部シートを表示する。
  - ピン位置：`pickup_lat`, `pickup_lng`（20〜30m の微オフセット付き）
  - バブル表示：`¥{price_10kg}`
  - 下部シート：`pr_images[0]`, `pr_title`, `owner_address_label`,
    `price_10kg`, `next_pickup_display` を表示し、`/farms/{farm_id}` へリンク。

10-3. まだ未実装で、後のフェーズに回す項目（TODO）

10-4. 実装済み（Frontend / Public Farm Detail ページ）

- Detail ページは `GET /api/public/farms/{farm_id}`（PublicFarmDetailDTO）を唯一のデータソースとして使用。
- プロフィール（face_image_url, owner_label など）
- 価格カード（price_5kg / price_10kg / price_25kg）
- 収穫年 + 品種表示（harvest_year / rice_variety_label）
- PR テキスト・画像（pr_title / pr_text / pr_images）
- 受け渡し時間（next_pickup_display）
- 地図 + 住所（pickup_lat / pickup_lng / pickup_address_label）
これらを FarmDetailPage 内の分割されたカードコンポーネントにそのまま渡して表示する。



以下は仕様上は想定しているが、2025-11-22 時点ではあえて未実装とし、
将来のフェーズで対応する。

- 無限スクロール
  - API は `page / page_size / has_next` を返しているが、
    フロント側は現状 `page=1` のみ取得し、2ページ目以降の自動ロードは行っていない。
- 地図のセンタリング／ユーザー位置連動
  - `MapLayerPortal` の `mapCenter` は現在、徳島県中心座標の固定値。
  - ブラウザの geolocation や検索条件（lat/lng クエリ）に応じて
    中心を動かすロジックはまだ入れていない。
- `no_farms_within_100km` フラグの UI 表示
  - レスポンスには含まれているが、フロント側の注意文表示は未実装。

pickup_time_utils.compute_next_pickup() を共通利用することで、
一覧／詳細／Confirm／予約APIの 3時間前締切ロジックはすべて同期している。）


上記の状態をもって、Public Farm List / MapLayerPortal については
「Customer Booking Domain V2 の Phase 1（一覧＋地図の基本体験）」が完了したものとする。
無限スクロールやユーザー位置連動は Phase 2 以降の改善タスクとして扱う。
