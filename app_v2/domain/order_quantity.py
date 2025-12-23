from typing import Iterable
from app_v2.config.order_limits import DEFAULT_MAX_TOTAL_KG


class OrderItem:
    def __init__(self, size_kg: int, quantity: int):
        self.size_kg = size_kg
        self.quantity = quantity


def calc_total_kg(items: Iterable[OrderItem]) -> int:
    return sum(i.size_kg * i.quantity for i in items)


def validate_order_quantity(items: Iterable[OrderItem]) -> None:
    total_kg = calc_total_kg(items)

    if total_kg == 0:
        raise ValueError("quantity is zero")

    if total_kg > DEFAULT_MAX_TOTAL_KG:
        raise ValueError("order exceeds max kg")
