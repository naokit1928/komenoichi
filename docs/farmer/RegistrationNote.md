【ページ本体】
pages/farmer/FarmerRegistrationPage.tsx

【Owner 情報】
components/registration/OwnerSection.tsx

【Pickup（受け渡し）情報】
features/farmer-pickup/PickupLocationCard.tsx
features/farmer-pickup/PickupPlaceNameCard.tsx
features/farmer-pickup/PickupNotesCard.tsx
features/farmer-registration/PickupTimeCardForRegistration.tsx

【ロジック / 型】
lib/registration.ts
lib/api.ts   ← postRaw() など

【DEV（開発用）】
（必要なら）dev/dev_api.ts




0. 目的・位置づけ

LINE ログイン済みの農家ユーザーが、初回に 1 回だけ Owner 情報 + 初期 Pickup 情報を登録し、新規 farm_id を発行するフロー。

V2 では以下を満たすことをゴールとする：

owner_user_id は LINE の line_user_id からサーバ側で解決（フロントは送らない）。

farm_id は 今回の登録完了時にサーバ側で新規発行。

受け渡し場所は 地図 + 400m ルール + 住所からのジオコーディング を前提。

受け渡し時間は 事前定義スロット（WED_19_20 / SAT_10_11）から 1 つ選択。

1. フロント実装構成（使用ファイル一覧）
1-1. ページ本体

frontend/src/pages/farmer/FarmerRegistrationPage.tsx

Registration V2 のメインページ。

役割：

画面状態（RegistrationValues）の保持。

各セクションコンポーネント（Owner / Pickup）の組み立て。

ジオコーディング（/api/geocode 呼び出し）。

エラーメッセージ集約と送信前バリデーション。

POST /api/farmer/registration/finish_registration 呼び出し。

登録成功時に /farmer/settings?farm_id=XX へ遷移。

1-2. Owner 情報コンポーネント

frontend/src/components/registration/OwnerSection.tsx

氏名（漢字・かな）、電話番号、郵便番号、住所（都道府県・市区町村・住所1・住所2）を入力するカード。

FarmerRegistrationPage から以下の props を受け取る：

lastName / firstName / lastKana / firstKana

ownerPostal（郵便番号） + setter

pref / city / addr1 / addr2 + setter

phone + setter

郵便番号から住所検索する UI（zipcloud API）が含まれる。

バリデーション自体は FarmerRegistrationPage 側（validate, computeAddressErrors, computePhoneError）で集約。

1-3. Pickup 情報コンポーネント群

frontend/src/features/farmer-pickup/PickupLocationCard.tsx

地図ベースで「受け渡し場所（lat/lng）」を選択するカード。

FarmerRegistrationPage からの主な props：

mode="new"（Registration 専用モード）

initialLat, initialLng（既存値があれば中心位置）

onSave(lat, lng)：保存時に RegistrationValues の lat / lng を更新

baseLat, baseLng：Owner 住所からジオコーディングした基準点

radiusMeters={400}：400m ルール

addressReady：Owner 住所が一定レベル入力済みかどうか（未入力時は注意モーダルでブロック）

disabled：ジオコーディング中は操作不可

frontend/src/features/farmer-pickup/PickupPlaceNameCard.tsx

「受け渡し場所の名称」（例：◯◯さんの倉庫前）を入力するカード。

props:

value（values.pickupPlaceName）

saving（今回は常に false）

onSave(v) → RegistrationValues の pickupPlaceName を更新。

frontend/src/features/farmer-pickup/PickupNotesCard.tsx

「受け渡し補足メモ」（駐車場所・目印 etc）の任意入力カード。

props:

value（values.pickupNotes）

saving（false）

onSave(v) → RegistrationValues の pickupNotes を更新。

frontend/src/features/farmer-registration/PickupTimeCardForRegistration.tsx

受け渡し時間スロットを選ぶカード（モーダル）。

型定義：

export type TimeSlotOption = "WED_19_20" | "SAT_10_11";

内部で固定オプション配列 OPTIONS を使用：

"WED_19_20" → 「毎週水曜 19:00–20:00」

"SAT_10_11" → 「毎週土曜 10:00–11:00」

props:

value: TimeSlotOption | null

onSave(slot: TimeSlotOption)：選択後、モーダルを閉じつつ選択値を親に返す。

FarmerRegistrationPage 側では：

const [pickupTimeOption, setPickupTimeOption] = useState<TimeSlotOption | null>(null);

カード使用時：

<PickupTimeCardForRegistration
  value={pickupTimeOption}
  onSave={(slot: TimeSlotOption) => {
    setPickupTimeOption(slot);
    set("pickupTime")(slot);  // RegistrationValues.pickupTime にも保持
  }}
/>

1-4. ロジック・共通関数

frontend/src/lib/registration.ts

RegistrationValues 型

validate(values: RegistrationValues)（既存 V1 からのバリデーションロジック）

FarmerRegistrationPage.tsx 内部定義の補助関数：

computeAddressErrors(v: RegistrationValues): string[]

computePhoneError(phone: string): string | null

buildFullAddressForGeocoding(v: RegistrationValues): string | null

async geocodeAddress(fullAddress: string)

POST /api/geocode を叩いて lat/lng を取得。

normalizeErrorMessage(msg: string): string

lat/lng 関連のメッセージを「受け渡し場所を設定してください。」に集約。

buildRegistrationPayload(values, lineUserId): FarmerRegistrationPayload

API /api/farmer/registration/finish_registration 用の JSON を作成。

2. 画面仕様（入力・バリデーション・エラー表示）
2-1. 入力項目（RegistrationValues ベース）

Owner 情報

lastName / firstName

lastKana / firstKana

phone

ownerPostal

pref（初期値は "徳島県"）

city

addr1

addr2（任意）

Pickup 情報（フロント側 state）

lat / lng（地図で選択）

pickupPlaceName

pickupNotes

pickupTime（TimeSlotOption と同期）

2-2. バリデーション

validate(values) の結果（既存必須項目・型チェックなど）

computeAddressErrors：

郵便番号：7 桁数字必須

都道府県・市区町村・住所1 は必須

computePhoneError：

空 → 「携帯電話番号を入力してください」

11 桁以外 → 「無効な携帯電話番号です」

070/080/090/060 以外のプレフィックス → 無効

位置情報・時間：

lat/lng 未設定 → 「受け渡し場所を設定してください。」（地図関連メッセージを集約）

pickupTime 未選択 → 「受け渡し時間を選択してください。」（※ 実装上は allErrors の一要素として扱う）

2-3. エラー表示仕様

送信ボタン押下時：

setSubmitted(true) にし、allErrors.length > 0 なら 送信せずに return。

allErrors は上記エラーを重複排除した配列。

画面では 登録ボタン直上 に赤字リストとして表示：

className="mt-3 text-[14px] font-semibold space-y-1 list-none text-red-600"

サーバー側エラー：

res.ok === false の場合：

res.data?.detail が配列 → "サーバーエラー:\n- ..." 形式で msg に格納。

それ以外 → "サーバーエラー: " + JSON.stringify(detail)。

msg はフォーム最下部に赤字テキストとして表示。

通信エラー：

catch 節で "通信エラーが発生しました。時間をおいて再度お試しください。" を msg に表示。

3. バックエンド API 構成
3-1. Registration V2 API

ファイル構成

app_v2/farmer/api/registration_api.py

app_v2/farmer/services/registration_service.py

app_v2/farmer/repository/registration_repo.py

app_v2/farmer/dtos.py（OwnerDTO, FarmPickupDTO）

ルート定義

APIRouter(prefix="/farmer/registration", tags=["farmer-registration-v2"])

main.py で：

app.include_router(v2_registration_api.router, prefix="/api")

→ 最終 URL

POST /api/farmer/registration/finish_registration

Request（RegistrationRequest）

line_user_id: str

Owner 情報（サーバ側で OwnerDTO に変換）：

owner_last_name

owner_first_name

owner_last_kana

owner_first_kana

owner_postcode

owner_pref

owner_city

owner_addr_line

owner_phone

初期 Pickup 情報（FarmPickupDTO）：

pickup_lat: float

pickup_lng: float

pickup_place_name: string

pickup_notes: string | null

pickup_time: string（例："WED_19_20" / "SAT_10_11"）

Response（RegistrationResponse）

ok: true/false

farm_id: int（新規発行された farm_id）

owner_user_id: int（line_user_id から解決した users.id）

settings_url_hint: str（例：/farmer/settings?farm_id=77）

note: str | None（将来のメッセージ用）

3-2. Service 層（RegistrationService）

app_v2/farmer/services/registration_service.py

RegistrationService.finish_registration(payload: RegistrationRequest) -> RegistrationResult

主な役割：

line_user_id から owner_user_id を解決（users テーブル）。

既に owner_user_id で farm が存在しないかチェック。

存在する場合 → OwnerAlreadyHasFarmError を投げる。

OwnerDTO / FarmPickupDTO を組み立て。

RegistrationRepository.create_farm_for_registration() を呼び出し。

トランザクション commit / rollback を制御。

RegistrationResult(farm_id, owner_user_id, settings_url_hint) を返す。

3-3. Repository 層（RegistrationRepository）

app_v2/farmer/repository/registration_repo.py

主なメソッド：

find_owner_user_id_by_line_user_id(line_user_id) -> Optional[int]

find_existing_farm_by_owner_user_id(owner_user_id) -> Optional[int]

create_farm_for_registration(owner: OwnerDTO, pickup: FarmPickupDTO) -> int

INSERT INTO farms (...) VALUES (...) を実行。

初期状態の想定：

active_flag = 1

is_public = 0（初期状態では非公開、Settings から公開）

is_accepting_reservations = 0

location_status なども必要に応じて初期値を設定。

commit(), rollback()

4. ジオコーディング API（住所 → 緯度経度）

バックエンド：

app_v2/farmer/api/geocode_api.py（既に実装済み）

APIRouter(prefix="/geocode", ...) を main.py で /api prefix 付きで include

→ POST /api/geocode

フロント：

FarmerRegistrationPage.tsx の geocodeAddress(fullAddress) から呼び出し。

Request:

address: string（「日本 + 〒 + 住所」のまとめ）

region: "jp"

Response:

ok: true/false

lat: number

lng: number

住所未入力 or ジオコーディング失敗時：

baseLat/baseLng は null

geoStatus を "error"、geoError に「住所から位置を特定できませんでした。」を格納し、画面下に赤字表示。

5. DEV ログインフロー（開発用）

バックエンド：app_v2/dev/dev_api.py

router = APIRouter(tags=["dev"])

main.py:

from app_v2.dev.dev_api import router as dev_router
app.include_router(dev_router, prefix="/dev")


.env:

DEV_MODE=1 のときのみ有効（require_dev_access でガード）。

エンドポイント：

POST /dev/test_login

body: { line_user_id: string, nickname?: string }

users テーブルに行を作成し registration_status = 'line_verified' に。

POST /dev/friendship_override

body: { line_user_id: string, is_friend: bool }

users.is_friend を強制的に 1/0 に設定。

POST /dev/reset_user

指定 line_user_id のユーザーを初期化（下書き farm 削除、registration_status リセット）。

フロント：FarmerRegistrationPage.tsx

const DEV_MODE = (import.meta as any).env?.VITE_DEV_MODE === "1";

submit 前に：

if (DEV_MODE && devAutoFriend) {
  await postRaw("/dev/test_login", { line_user_id: lineUserId });
  await postRaw("/dev/friendship_override", {
    line_user_id: lineUserId,
    is_friend: true,
  });
}


lineUserId は現在、dev 用にランダム生成：

const [lineUserId] = useState(
  "dev_" + Math.random().toString(36).slice(2, 10)
);


本番ではここを「LINE ログインから渡された line_user_id に差し替える」想定。