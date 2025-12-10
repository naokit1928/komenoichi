# Customer Booking Domain V2 ＋ 決済・LINE連携 V2 方針メモ

## 1. ゴール

- **アプリの本体を `app_v2` 側に完全移行**する。
- 近い将来、**`app`（V1側フォルダ）を丸ごと削除しても**、
  - Public Farm List
  - Farm Detail
  - Confirm（予約作成）
  - LINE Login
  - Stripe 決済開始
  - Stripe Webhook（支払い確定）
  - 支払い完了 LINE 通知  
  までの一連のフローが **すべて問題なく動作する状態** にする。
- 構造を **V2 の世界観（ドメイン別 / integrations 切り）にあわせてシステマチックに整理**する。

---

## 2. 現状の整理（2025-11 時点）

### 2.1 V2 で完結している部分

- **予約作成フロー（ConfirmPage → /api/reservations）** はすでに V2 で完結済み。

  - `frontend`  
    - `FarmDetailPage.tsx`
      - `GET /api/public/farms/{farm_id}`（V2 PublicFarmDetailDTO）
      - ConfirmPage へ `state` で予約候補データを渡す
    - `ConfirmPage.tsx`
      - `POST /api/reservations`（V2 ReservationFormDTO / ReservationResultDTO）

  - `backend`（V2）
    - `app_v2/customer_booking/api/reservations_api.py`
    - `app_v2/customer_booking/api/public_farm_detail_api.py` など
    - `app_v2/customer_booking/services/...`
    - `app_v2/customer_booking/repository/...`

- V1 の予約 API や V1 DTO に依存しない構造になっている。

---

### 2.2 共通インフラとして動いている部分

現在、以下は **`app` 側にファイルがあるが、ロジックとしては V1 予約に依存していない共通インフラ**として機能している。

- LINE ログイン:

  - `/api/line/login`
  - `/api/line/callback`
  - `/api/line/linked`

- Stripe チェックアウト:

  - `/stripe/checkout/{reservation_id}`

- Stripe Webhook:

  - `/stripe/webhook`

これらは、

- `SessionLocal` と `models.Reservation` / `models.User` を読むだけで、
- V1 予約 API や `items/quantity` などの V1 ロジックにはほぼ依存していない。

唯一の「V1臭」は、

- `stripe_webhook.py` 内のメッセージ生成部分、
- および `line_notifications.py` 内のヘルパーが  
  `reservation.item` / `reservation.quantity` / `reservation.price` など **V1 的なカラム名前提**で書かれている点。

ただし現状の本番フローでは `line_notifications.py` は呼ばれておらず、  
Stripe Webhook はシンプルなテキスト通知のみを自前で送っている。

---

## 3. V2 最終ゴールの定義（仕様レベル）

### 3.1 ドメインの切り方

- **Customer Booking Domain V2**
  - Public Farm List
  - Farm Detail
  - Confirm（予約作成 → pending）
  - 予約確定済みの閲覧など（将来）

- **Integrations Domain（横断機能）**
  - LINE Login / Logout / Link 状態確認
  - Stripe Checkout（決済開始）
  - Stripe Webhook（決済結果反映）
  - 通知（LINE push など）

### 3.2 「V1 を消しても動く」の条件

- 予約・公開 API は **すべて `app_v2` 配下のコードで実装**されていること。
- Stripe / LINE 関連の router も **`app_v2` 配下のファイルに移籍済み**であること。
- 既存のエンドポイント URL は維持（フロントの変更は極小 or 0）。
  - `/api/line/login`
  - `/api/line/callback`
  - `/api/line/linked`
  - `/stripe/checkout/{reservation_id}`
  - `/stripe/webhook`
- 決済・通知ロジックは、
  - `Reservation` テーブルの **V2 カラム群（rice_subtotal / service_fee / paid_service_fee / payment_status など）**だけで成立すること。
  - `item/quantity/price` など V1 専用カラムを前提にしないこと。

---

## 4. 設計方針（V2 世界観への揃え方）

### 4.1 フォルダ構成（案）

```text
app_v2/
  customer_booking/
    api/
      public_farms_api.py
      farm_detail_api.py
      reservations_api.py
    services/
    repository/

  integrations/
    line/
      line_api.py                # 旧 line_auth.py の中身を移動
    payments/
      stripe_checkout_api.py     # 旧 stripe_checkout.py の中身を移動
      stripe_webhook_api.py      # 旧 stripe_webhook.py の中身を移動
    notifications/
      line_notifications_service.py  # V2 用に必要なら将来作る

予約ドメインと外部連携ドメインを明確に分離する。

最初は router単位の移籍だけを行い、
DTO / service / repository 分割は後から段階的に行う。

4.2 DB / モデルの扱い

app.database.SessionLocal / app.models は V1/V2共通のインフラとしてしばらく残してよい。

将来的に app_v2/core/database.py などに移す余地はあるが、優先度は低い。

重要なのは「予約ロジック（API / DTO / service）は app_v2/customer_booking に集約する」こと。

Integrations 側は models.Reservation / models.User を直接読むが、

予約のビジネスロジックは触らない（状態更新のみ）。

5. 実装ステップ（壊さない順）
Step 1: V2 フローの宣言（ドキュメント更新）

Customer Booking Domain V2.md や README に以下を明文化する：

Public List → Farm Detail → Confirm → /api/reservations（V2）

Confirm 後のフローは：

LINE ログインチェック：GET /api/line/linked

必要なら LINE ログイン：GET /api/line/login?return_to=...

決済開始：POST /stripe/checkout/{reservation_id}

Stripe Webhook：POST /stripe/webhook（支払い確定＋Reservation更新＋LINE通知）

上記 LINE / Stripe 系エンドポイントは V2 booking フローの共通インフラとして使用する。

Step 2: LINE / Stripe router の app_v2 への移籍

app_v2/integrations/line/line_api.py

既存 line_auth.py の router とロジックをそのままコピー。

import パスのみ必要な範囲で調整（最初は from app.database import SessionLocal のままでもOK）。

app_v2/integrations/payments/stripe_checkout_api.py

既存 stripe_checkout.py の内容をまるごとコピー。

app_v2/integrations/payments/stripe_webhook_api.py

既存 stripe_webhook.py の内容をまるごとコピー。

main.py / エントリーポイントでの include_router を、

旧 app.routers.* → 新 app_v2.integrations.* に差し替える。

ルートの prefix や tags は変更しないので、URL は現状と同じ。

→ これにより、フロントの URL は一切変更せずに、実装本体だけ app_v2 側へ移籍できる。

Step 3: Stripe Webhook の V1 カラム依存を排除

stripe_webhook_api.py 内で、以下の方針で整理する：

Reservation 更新ロジック（payment_status, paid_service_fee, payment_intent_id, status = confirmed, payment_succeeded_at）はそのまま維持。

LINE への push メッセージ生成部分から

reservation.item

reservation.quantity

reservation.price
など V1 専用カラム依存を削除する。

メッセージ内容はシンプルでよい：

例：

【予約が確定しました】
予約ID: {reservation.id}
受け渡しの詳細は「予約確認」画面をご確認ください。


もしくは V2 仕様に合わせて、

reservation.rice_subtotal + service_fee から合計金額を計算する形に変更してもよい。

→ これで、Stripe Webhook は V2 予約カラムだけで成立するロジックになる。

Step 4: line_notifications.py の扱い

現状、本番フローからは呼ばれていないため、選択肢は二つ：

一旦完全に未使用として封印（コメント＋READMEで「旧V1通知用」と明記）。

将来リッチな通知を作るときに、app_v2/integrations/notifications/line_notifications_service.py として

V2の items_json / rice_subtotal / pickup_slot_code などを使った新実装を書く。

当面のゴールは **「line_notifications がなくても決済〜通知フローが完結すること」**なので、

いま急いで V2 対応させる必要はない。

6. 今後の発展的リファクタ（優先度中〜低）

V2 移行が安定したあと、余裕ができたら検討する項目：

Integrations にも DTO / service / repository レイヤーを導入

例：StripeCheckoutService, StripeWebhookService, LineAuthService など。

router は「認証・バリデーション → service 呼び出し」に限定する。

DB / models の app_v2 側への移管

app_v2/core/database.py, app_v2/core/models.py のように V2 側に移動し、

app 側は完全に読み取り専用 or 削除。

V1 予約 API / V1 フロントの段階的削除

/reservations（旧）、/farmer/settings（旧）などを計画的に無効化／削除。

これが完了したタイミングで、app フォルダをほぼ空にできる。

7. まとめ

ConfirmPage までの予約作成フローはすでに V2 で完結している。

LINE Login / Stripe Checkout / Webhook はロジック的には V1 予約に依存していないため、

そのままロジックを流用して構わない。

ただし「V1app を消しても動く」状態にするために、

ファイル実体を app_v2/integrations/... に移籍

Stripe Webhook のメッセージ生成から V1 専用カラム依存を削除

line_notifications.py は一旦「旧V1用ヘルパー」として封印 or V2用に書き直す

これらを行うことで、

app_v2 だけで public → detail → confirm → LINE → Stripe → Webhook → LINE通知 までの V2 booking フローが完結する設計になる。