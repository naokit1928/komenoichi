# tests/test_bulk_tx.py
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import get_db, Base  # Base は app.database 由来を使う
from app.models import Farm, Reservation


def _infer_default_for_column(col):
    """Farm の必須列（NOT NULL かつ default無し）に入れるダミー値を推定する。"""
    # 主キーなどは除外
    if col.name in ("id",):
        return None
    # 既に server_default / default があればスキップ
    if col.server_default is not None or col.default is not None:
        return None
    if col.nullable:
        return None

    # 型に応じた簡易既定値
    try:
        pytype = col.type.python_type  # 取得できない型もあるため try
    except Exception:
        pytype = None

    if pytype is bool:
        return False
    if pytype is int:
        return 1
    if pytype is float:
        return 0.0
    # 文字列などその他は str にしておく
    return f"test_{col.name}"


def new_farm(**overrides) -> Farm:
    """
    Farm(**overrides) を作る際、モデル側の必須列（NOT NULL, default無し）を自動で埋める。
    - 既知の価格列・active_flag は呼び出し側から渡す（上書きOK）
    - name / owner_user_id / 住所系などが必須でも自動でダミー値が入る
    """
    base: dict = {}
    for col in Farm.__table__.columns:
        v = _infer_default_for_column(col)
        if v is not None:
            base[col.name] = v
    base.update(overrides)
    return Farm(**base)


@pytest.fixture(autouse=True)
def client():
    """
    - SQLite in-memory（StaticPool）でアプリとテストが同一エンジンを共有
    - Base.metadata.create_all() で全テーブル作成
    - 外部キーは OFF（User 未投入でも OK）
    - get_db をテスト用セッションに差し替え
    - Farm を3件投入：
        * active_full（全サイズ価格あり）
        * inactive（active_flag=False）
        * active_partial（10kg 価格 None = 販売しない）
    """
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    # すべてのテーブルを生成
    Base.metadata.create_all(bind=engine)
    with engine.begin() as conn:
        conn.exec_driver_sql("PRAGMA foreign_keys=OFF")

    # 依存性差し替え
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    # 初期データ投入
    session = TestingSessionLocal()

    # 1) active & 全価格設定
    farm_active_full = new_farm(
        active_flag=True,
        price_5kg=1000, price_10kg=2000, price_25kg=3000, price_30kg=4000,
    )
    # 2) inactive
    farm_inactive = new_farm(
        active_flag=False,
        price_5kg=500, price_10kg=1500, price_25kg=2500, price_30kg=3500,
    )
    # 3) active だが 10kg を販売しない（価格 None）
    farm_active_partial = new_farm(
        active_flag=True,
        price_5kg=1000, price_10kg=None, price_25kg=3000, price_30kg=4000,
    )

    session.add_all([farm_active_full, farm_inactive, farm_active_partial])
    session.commit()
    active_full_id = farm_active_full.id
    inactive_id = farm_inactive.id
    active_partial_id = farm_active_partial.id
    session.close()

    c = TestClient(app)
    c._Session = TestingSessionLocal
    c.active_full_id = active_full_id
    c.inactive_id = inactive_id
    c.active_partial_id = active_partial_id
    try:
        yield c
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def _db_all_reservations(client, farm_id=None):
    """DB に保存された予約を取得（検証用）"""
    session = client._Session()
    try:
        q = session.query(Reservation)
        if farm_id is not None:
            q = q.filter(Reservation.farm_id == farm_id)
        return list(q.all())
    finally:
        session.close()


def test_bulk_tx_success(client):
    """(正常系) 2行作成・合計数量/金額が正しく計算される"""
    payload = {
        "user_id": 1,
        "farm_id": client.active_full_id,
        "items": [
            {"item": "5kg", "quantity": 2},   # 1000 * 2
            {"item": "10kg", "quantity": 3},  # 2000 * 3
        ],
        "client_order_id": "TEST-ORDER-123",
    }
    r = client.post("/reservations/reservations/bulk_tx", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()

    assert data["totals"]["count"] == 2
    assert data["totals"]["total_quantity"] == 5
    assert data["totals"]["total_amount"] == (1000 * 2 + 2000 * 3)

    # 各行の検証
    assert len(data["lines"]) == 2
    for line in data["lines"]:
        assert line["order_id"] == "TEST-ORDER-123"
        assert line["status"] == "pending"
        assert isinstance(line["reservation_id"], int) and line["reservation_id"] > 0

    # DBにも2件作成されている
    rows = _db_all_reservations(client, farm_id=client.active_full_id)
    assert len(rows) == 2
    assert sum(x.quantity for x in rows) == 5
    assert sum(x.amount for x in rows) == (1000 * 2 + 2000 * 3)


def test_bulk_tx_inactive_farm(client):
    """(異常系) farm が inactive の場合は 409 を返し、DB には作成されない"""
    payload = {
        "user_id": 1,
        "farm_id": client.inactive_id,
        "items": [{"item": "5kg", "quantity": 1}],
    }
    r = client.post("/reservations/reservations/bulk_tx", json=payload)
    assert r.status_code == 409
    assert r.json().get("detail") == "farm is inactive"
    assert len(_db_all_reservations(client, farm_id=client.inactive_id)) == 0


def test_bulk_tx_item_not_sold(client):
    """(異常系) 価格未設定（販売しない）サイズを含むと 422 を返し、DB には作成されない"""
    payload = {
        "user_id": 1,
        "farm_id": client.active_partial_id,  # 10kg は None
        "items": [{"item": "10kg", "quantity": 1}],
    }
    r = client.post("/reservations/reservations/bulk_tx", json=payload)
    assert r.status_code == 422
    assert "not sold by this farm" in r.json().get("detail", "")
    assert len(_db_all_reservations(client, farm_id=client.active_partial_id)) == 0


def test_bulk_tx_empty_items(client):
    """(異常系) items が空配列なら 422（Pydantic バリデーション）"""
    payload = {"user_id": 1, "farm_id": client.active_full_id, "items": []}
    r = client.post("/reservations/reservations/bulk_tx", json=payload)
    assert r.status_code == 422
    # DBには作成されない
    assert len(_db_all_reservations(client, farm_id=client.active_full_id)) == 0


def test_bulk_tx_missing_order_id(client):
    """(正常系) client_order_id 省略時は order_id=None で作成される"""
    payload = {
        "user_id": 1,
        "farm_id": client.active_full_id,
        "items": [
            {"item": "5kg", "quantity": 1},   # 1000
            {"item": "10kg", "quantity": 1},  # 2000
        ],
    }
    r = client.post("/reservations/reservations/bulk_tx", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()

    assert data["order_id"] is None
    assert data["totals"]["count"] == 2
    assert data["totals"]["total_quantity"] == 2
    assert data["totals"]["total_amount"] == (1000 + 2000)
    for line in data["lines"]:
        assert line["order_id"] is None
