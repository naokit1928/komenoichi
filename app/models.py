# app/models.py
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, Float
from sqlalchemy.orm import relationship
from datetime import datetime, UTC   # ✅ UTCを追加
from .database import Base

# ------------------------------------------------------
# ユーザー（消費者 or 農家）
# ------------------------------------------------------
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    postal_code = Column(String, nullable=True)
    role = Column(String, nullable=False)  # "consumer" or "farmer"

    # ✅ タイムゾーン付きUTC（aware datetime）
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    # LINEユーザーID（任意）
    line_user_id = Column(String, nullable=True, index=True)

    farms = relationship("Farm", back_populates="owner")
    reservations = relationship("Reservation", back_populates="user")


# ------------------------------------------------------
# 農家（販売条件）
# ------------------------------------------------------
class Farm(Base):
    __tablename__ = "farms"

    id = Column(Integer, primary_key=True, index=True)

    # 所有者（APIでは owner_user_id として扱うがDB列は従来どおり user_id）
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    postal_code = Column(String, nullable=False)

    # 価格（4サイズ：未設定は販売しない）
    price_5kg  = Column(Float, nullable=True)
    price_10kg = Column(Float, nullable=True)
    price_25kg = Column(Float, nullable=True)
    price_30kg = Column(Float, nullable=True)

    stock = Column(Integer, nullable=True)
    pickup_location = Column(String, nullable=True)
    pickup_time = Column(String, nullable=True)

    # 受付オン/オフ（True=受付中）
    active_flag = Column(Boolean, nullable=False, server_default="1", index=True)

    owner = relationship("User", back_populates="farms")
    reservations = relationship("Reservation", back_populates="farm")


# ------------------------------------------------------
# 予約
# ------------------------------------------------------
class Reservation(Base):
    __tablename__ = "reservations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    farm_id = Column(Integer, ForeignKey("farms.id"))

    # 新仕様
    item = Column(String, nullable=False)  # "5kg", "10kg", "25kg", "30kg"
    quantity = Column(Integer, nullable=False, default=1)  # 袋数
    price = Column(Float, nullable=False)  # 1袋あたりの価格
    amount = Column(Float, nullable=True)  # 総額（price×quantity）

    status = Column(String, default="pending")  # "pending", "confirmed", "cancelled"

    # ✅ タイムゾーン付きUTC（aware datetime）
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    # 注文の束識別子（NULL許容）
    order_id = Column(String, nullable=True, index=True)

    user = relationship("User", back_populates="reservations")
    farm = relationship("Farm", back_populates="reservations")
