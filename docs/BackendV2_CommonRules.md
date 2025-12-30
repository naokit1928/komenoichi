## 付録A：ローカル起動・運用コマンド（確定版）

.venv\Scripts\activate
uvicorn app_v2.main:app --host 0.0.0.0 --port 10000
npm run dev
stripe listen --forward-to http://localhost:10000/stripe/webhook

python -m app_v2.notifications.cron.send_pending_notifications
.\sqlite3.exe app.db

git status
git add .
git commit -m "メッセージ"
git push origin main


test+22@example.com



Backend V2 共通ルール（保存版）
0. この文書の目的

rice-app の V2 バックエンドを、今後も一貫した思想で拡張・保守するための共通ルール集。

SQLAlchemy / ORM / database.py 時代には戻らないことを明示する。

ChatGPT にバックエンドコードを書かせるときの「前提条件」として必ず参照することを想定。

1. V2 アーキテクチャの基本コンセプト

FastAPI のエントリポイントは app_v2/main.py のみ。
app/main.py（V1）は物理削除済みであり、今後復活させない。

ローカル・本番を問わず、FastAPI の待受ポートは 10000 に固定。
8000 / proxy / 相対パス前提の設計は V2 では存在しない。


データアクセスはすべて sqlite3 + Repository 経由

ORM（SQLAlchemy など）は一切使わない。

DB 接続は sqlite3.connect() を使い、row_factory = sqlite3.Row を設定する。

レイヤード構造を徹底

Repository：SQL（sqlite3 直叩き）だけを書く層。

Service：ビジネスロジック・バリデーション・トランザクション制御。

API（FastAPI Router）：HTTP I/O だけ。ビジネスロジックは持たない。

新規機能は必ず V2 配下に実装

バックエンドの新コードは app_v2/ 以下に置く。

app/ や V1 の router/model に新規追加しない。

2. ディレクトリ構成ルール（V2）

農家ドメイン（Farmer）

app_v2/farmer/dtos.py

app_v2/farmer/repository/..._repo.py

app_v2/farmer/services/..._service.py

app_v2/farmer/api/..._api.py

予約・顧客側（Customer Booking）

app_v2/customer_booking/dtos.py

app_v2/customer_booking/repository/..._repo.py

app_v2/customer_booking/services/..._service.py

app_v2/customer_booking/api/..._api.py

決済・外部API

app_v2/payments/...

app_v2/line/... など（今後必要に応じて整理）

新しい機能を作るときは、
DTO → Repository → Service → API の順に設計・実装する。

3. DB アクセスの共通ルール

DB 接続方法

すべての Repository で以下のようなパターンを使う：

import sqlite3, os

def _get_db_path() -> str:
    # V2 の正式な DB パス解決ルール
    env_path = os.getenv("APP_DB_PATH")
    if not env_path:
        raise RuntimeError("APP_DB_PATH is not defined")
    return env_path


class XxxRepository:
    def __init__(self, db: object | None = None) -> None:
        # db 引数は互換用。内部では使わない。
        self.conn = sqlite3.connect(_get_db_path())
        self.conn.row_factory = sqlite3.Row


db 引数は V1 互換のために受け取ってもよいが、
V2 の新規 Repository では定義しないことを推奨する。

新規コードでは Repository が自分で DB を開く。


禁止事項

from sqlalchemy ... / from sqlalchemy.orm import Session を書かない。

from app.database import ... を書かない。

SessionLocal / Base / engine を使わない。

Repository 以外（Service / API）で SQL を直接書かない。

トランザクション

書き込みを行う Repository には必ず commit() / rollback() メソッドを持たせる。

Service 側で：

try:
    # 複数の update/insert
    self.repo.xxx(...)
    self.repo.yyy(...)
    self.repo.commit()
except Exception:
    self.repo.rollback()
    raise


読み取り専用の場合は commit/rollback は不要だが、Repository に持っていても問題はない。

4. Service レイヤのルール

責務

Repository を 1つ以上受け取り、ビジネスロジックだけを書く層。

Service では以下を禁止する：

FastAPI / HTTPException / status_code の import
Stripe / LINE SDK の直接呼び出し（外部I/Oは adapter に閉じ込める）


代わりに 専用の Exception クラスを定義し、API 層で HTTP にマッピングする。

コンストラクタ

新しいサービスは原則以下のどちらか：

# Repository を外から注入するパターン
class XxxService:
    def __init__(self, repo: XxxRepository):
        self.repo = repo

# Repository を内部で new するパターン（シンプル系）
class XxxService:
    def __init__(self) -> None:
        self.repo = XxxRepository()


V2 では「SQLAlchemy Session を受け取るコンストラクタ」は使わない：

# NG 例（こういう形は禁止）
class XxxService:
    def __init__(self, db: Session):
        self.db = db


例外設計

ドメイン固有のエラーは XxxError 系のクラスを作り、API 層で try/except する。

例：

OwnerUserNotFoundError

OwnerAlreadyHasFarmError

PickupLockedError

FarmNotFoundError

ロジックの集中

価格計算（10kg → 5kg / 25kg）、予約締切ロジック、400m ルール等は Service に集約。

API やフロントで同じ計算式を重複実装しない。
→ フロントは「表示用（価格ラベル）」に限定し、最終的な計算は必ずサーバーの Service を優先。

API（FastAPI Router）レイヤのルール

Webhook エンドポイント（例：/stripe/webhook）も API レイヤに含む。
Webhook では署名検証 → Service 呼び出しのみを行い、
状態遷移ロジックはすべて Service に委譲する。


責務

Request → DTO化 → Service 呼び出し → Response への変換。

ビジネスロジック・SQL・外部APIの細かい操作は Service 以下に任せる。

禁止事項

db: Session = Depends(get_db) を使わない。
→ DI で Session を受ける形は V2 では「禁止パターン」。

from app.database import get_db を書かない。

ここで SQL 文を書くのは禁止。

例外と HTTP ステータス

API 層では Service の Exception を HTTPException にマッピングするだけにする。

例：

try:
    result = service.xxx(...)
except SomeDomainError as e:
    raise HTTPException(status_code=400, detail=str(e))


レスポンス設計

レスポンスモデルは Pydantic の BaseModel で定義し、
Domain DTO（dataclass）と 1対1 or ラップする形を維持。

既存の DTO / レスポンス形式を変える場合は、Blueprint / 仕様書を先に更新してから変更。

6. 外部サービス（Stripe / LINE など）

Stripe

決済フロー：

フロントから /api/checkout/session → Stripe Checkout。

Stripe から webhook /stripe/webhook を受ける。

ローカル検証時は必ず以下を使用する：

stripe listen --forward-to http://localhost:10000/stripe/webhook

8000 を forward 先に指定することは禁止（V1 の遺物）。


webhook では 同一予約に対する複数イベントを前提にし、ステータスは idempotent に更新。

checkout.session.completed

charge.succeeded

charge.updated など

ログ例：

[DB] Reservation #212 は既に succeeded でした。
[DB] Reservation #212 は既に confirmed。スキップ。


は 正常挙動 であり、二重更新防止のサイン。

LINE

LINE Login / is_friend チェックなどの認証条件は Service に閉じ込める。

Registration 系では

registration_status == 'line_verified'

is_friend == 1
を前提条件としてチェック。

7. V1 との関係・移行方針

V1 は原則触らない

app/ 配下の router / model / repository は 歴史的資産として残すだけ。

新機能・修正は必ず V2 側に入れる。

V1 のコードを参考にする場合

ロジック・クエリ・レスポンス形式を「参考」にして、V2 の Repository / Service に焼き直す。

V1 の DB アクセスパターン（ORM）はそのままコピーしない。

8. 絶対にやってはいけないことリスト

from app.database import Base, engine, get_db を新規コードに書くこと。

SQLAlchemy の Session / text() を新規コードに持ち込むこと。

Router（API）に直接 SQL を書くこと。

Service から HTTP ステータスを直接返す（HTTPException を raise する）こと。

すでに動いている V2 の Repository / Service を 理由なく書き換えること。

仕様変更が必要な場合は、仕様書（Blueprint / Domain V2.md）を先に更新してから。

9. 新しい機能を追加するときのチェックリスト

 新機能は app_v2/ 以下に配置したか？

 DTO → Repository → Service → API の順で設計したか？

 Repository は sqlite3 を使い、ORM を使っていないか？

 Repository に commit() / rollback() を用意し、Service で制御しているか？

 Service でビジネスロジック・バリデーションを集約しているか？

 API で db: Session = Depends(get_db) していないか？

 既存の V2 仕様（価格計算ロジック、締切ロジックなど）と矛盾していないか？

 変更前に動いていた機能が壊れていないか（最低限、関連フローの手動テスト済みか）？

10. フロントエンドとの責務分離（V2 確定）

API の URL / 接続先はフロントで一元管理される。
バックエンドは「指定された URL で待つだけ」の存在。

バックエンド側で
「フロントは proxy を使うはず」
「/api は相対で来るはず」
という前提を一切持たない。

11. フォールバック禁止ルール（重要）

env 未設定時のデフォルト値（例："app.db" / "localhost"）は禁止。

設定ミスは即エラーにする。
フォールバックは不具合の発見を遅らせるため、V2 では採用しない。


 12. V2 開発における「GPT 作業ルール・完全版」（運用規約）

この章は設計思想ではなく運用規約。
コードと同等に尊重されるルールとして扱う。

■ 1. 原因特定のルール（最重要）
1-1. 原因は断定しない

100％確証を得る前に「これが原因です」と言い切らない。

必ずこう述べる：
→ 「現状の仮説はこれ。確認のために A / B / C を見せてください」

1-2. 仮説 → 情報要求 → 確定 の順を守る

Step1：仮説はあくまで仮説

Step2：ログ・DB・Swagger・ファイルを要求

Step3：確認後に原因を確定する

1-3. 推測ベースではコードを書かない

ロジック・仕様・既存の構造が曖昧なら必ず質問してから進める。

■ 2. ファイル確認ルール
2-1. 既存ファイルを必ず確認してからコードを書く

既存ファイルを読まずに上書きするのは禁止。

必ず：

どの関数があるか

どの DTO を使っているか

どの API と紐づいているか
を先に把握したうえで修正を提案する。

2-2. 必要ファイルを僕から先にリストアップする

「A を直すには B/C/D/E が必要です」

と先に必要ファイル一覧を提示し、足りなければあなたに依頼する。

■ 3. コード修正プロセスのルール
3-1. 1ステップ＝1～2ファイルに限定

一度に多くのファイルを触らない。

例えば：

Step1：service + repo

Step2：repo + api

Step3：DTO

Step4：TSX

3-2. 「最小変更」が原則

動いているロジックは絶対に壊さない。

新しいアイデアや“賢い汎用化”は後回し。

今動いているコードに 100%合わせる。

3-3. 各ステップ必ず動作確認してから次へ

Step1 完了 → DBチェック

Step2 完了 → SwaggerでJSON確認

Step3 完了 → フロントの挙動確認

OK なら次のステップへ

■ 4. ターミナル / DB チェックのルール
4-1. Windows に合わせて「Python対話モード」だけでコードを書く

あなたの環境では shell コマンドは通りにくいので、

今後ターミナル用コードはすべて python 対話モード前提 で書く。

例：

import sqlite3
conn = sqlite3.connect("app.db")
conn.row_factory = sqlite3.Row

for row in conn.execute("SELECT * FROM farms LIMIT 5"):
    print(dict(row))

conn.close()

4-2. 必要なときは必ず DB / API の実データを要求する

推測で原因を決めず、

「DBの中身を見せて」

「Swaggerのレスポンスを貼って」

「このファイルの最新版を送って」

など、確認を要求する。

■ 5. 文章量・返答速度に関するルール
5-1. 返答はできる限り短く・速く

長文禁止。

5–6 分の思考時間は避ける。長時間考えている
のは推測が多すぎるサイン。推測をしすぎないよう
まず確かめるべき情報を要求すべき。

小さい返答と質問を繰り返し、テンポよく進める。

5-2. 求めていない方向に話を広げない

あなたが求めていない改善案・抽象論・余計な説明を付け足さない。

■ 6. あなたの開発方針を最優先にするルール
6-1. “既存機能を壊さない”が最優先

動いている V2 機能は 聖域扱い とする。

既存のフロー・DTO・仕様を勝手に変えない。

6-2. V1 に戻す・混ぜる可能性はゼロ

新旧ロジックのミックス禁止。

混在によるバグを絶対に出さない。

■ 7. コラボレーション運用ルール
7-1. Step-by-step で進める（あなたのリズムに合わせる）

あなたが「まず原因を探る」と言えば、その方向に合わせる。

設計 → 確認 → 実装 → 検証、のサイクルで進める。

7-2. 進め方がズレそうなときは必ず確認

「今の方向性で合ってる？」と必ず聞く。

✅ 総まとめ（短く）

あなたが求める開発スタイルは：

“原因を正確に確定してから、最小変更で既存のロジックに完全に合わせて進める”

僕は今後：

憶測の段階では断定しない

既存コードを必ず先に確認

必要ファイルをリストアップ

小さいステップで進める

Python対話モードのみ案内

返答を短く、速く

あなたのロジックを壊さない

このルールで対応する。

(追記）)コードを書く際はフォールバックなどの妥協的な予防策は絶対に使わないこと。フォールバックしてしまうと失敗が分からなくなり本当の根本的な改善できなくなる。