from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, ConfigDict, field_validator, model_validator, Field

# ==========================================================
# Users
# ==========================================================
class UserCreate(BaseModel):
    name: str
    role: str  # "customer" | "farmer"
    phone: Optional[str] = None
    postal_code: Optional[str] = None
    line_user_id: Optional[str] = None


class UserResponse(BaseModel):
    # ORMの id を user_id として返す
    user_id: int = Field(alias="id", serialization_alias="user_id")

    name: str
    role: str
    phone: Optional[str] = None
    postal_code: Optional[str] = None
    created_at: datetime
    line_user_id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ==========================================================
# Farms（4サイズ価格・owner_user_id alias対応）
# ==========================================================
class FarmCreate(BaseModel):
    name: str
    postal_code: str

    price_5kg: Optional[float] = None
    price_10kg: Optional[float] = None
    price_25kg: Optional[float] = None
    price_30kg: Optional[float] = None

    stock: int
    pickup_location: str
    pickup_time: str
    description: Optional[str] = None
    active_flag: Optional[bool] = True

    owner_user_id: int  # API入力上の呼び名

    @model_validator(mode="after")
    def check_prices(self):
        prices = [self.price_5kg, self.price_10kg, self.price_25kg, self.price_30kg]
        if not any(p is not None for p in prices):
            raise ValueError("At least one of price_5kg/price_10kg/price_25kg/price_30kg must be provided.")
        for label, p in {
            "price_5kg": self.price_5kg,
            "price_10kg": self.price_10kg,
            "price_25kg": self.price_25kg,
            "price_30kg": self.price_30kg,
        }.items():
            if p is not None and p <= 0:
                raise ValueError(f"{label} must be > 0")
        return self


class FarmResponse(BaseModel):
    # ORMの id を farm_id として返す
    farm_id: int = Field(alias="id", serialization_alias="farm_id")

    name: str
    postal_code: str
    price_5kg: Optional[float] = None
    price_10kg: Optional[float] = None
    price_25kg: Optional[float] = None
    price_30kg: Optional[float] = None
    stock: int
    pickup_location: str
    pickup_time: str
    description: Optional[str] = None
    active_flag: bool

    # ORMの user_id を owner_user_id として返す
    owner_user_id: int = Field(alias="user_id", serialization_alias="owner_user_id")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class FarmUpdate(BaseModel):
    price_5kg: Optional[float] = None
    price_10kg: Optional[float] = None
    price_25kg: Optional[float] = None
    price_30kg: Optional[float] = None
    stock: Optional[int] = None
    pickup_location: Optional[str] = None
    pickup_time: Optional[str] = None
    description: Optional[str] = None
    active_flag: Optional[bool] = None

    @model_validator(mode="after")
    def check_prices_if_given(self):
        for label, p in {
            "price_5kg": self.price_5kg,
            "price_10kg": self.price_10kg,
            "price_25kg": self.price_25kg,
            "price_30kg": self.price_30kg,
        }.items():
            if p is not None and p <= 0:
                raise ValueError(f"{label} must be > 0")
        return self


# ==========================================================
# Reservations（新方式・自動価格化対応）
# ==========================================================
ItemLiteral = Literal["5kg", "10kg", "25kg", "30kg"]


class ReservationCreate(BaseModel):
    user_id: int
    farm_id: int
    item: ItemLiteral
    quantity: int = 1

    @field_validator("quantity")
    @classmethod
    def validate_bag_count(cls, v: int) -> int:
        if v < 1:
            raise ValueError("quantity (bag count) must be >= 1")
        return v


class ReservationResponse(BaseModel):
    # ORMの id を reservation_id として返す
    reservation_id: int = Field(alias="id", serialization_alias="reservation_id")

    user_id: int
    farm_id: int
    item: ItemLiteral
    quantity: int
    price: float
    amount: Optional[float] = None
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class ReservationUpdate(BaseModel):
    status: str  # "pending" | "confirmed" | "cancelled"
