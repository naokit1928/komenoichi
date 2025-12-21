from __future__ import annotations

import json
from typing import Any, Dict, List, Tuple


# ============================================================
# 管理画面用：予約内容（items）と金額の整形
# ============================================================

def build_items_display(items_json: Any) -> str:
    """
    items_json から管理画面表示用の文字列を生成する。

    例:
      [{"kind": "RICE_10KG", "quantity": 1},
       {"kind": "RICE_5KG", "quantity": 2}]
      -> "5kg×2 / 10kg×1"
    """

    if isinstance(items_json, str):
        try:
            items = json.loads(items_json)
        except json.JSONDecodeError:
            items = []
    else:
        items = items_json or []

    counts: Dict[str, int] = {
        "RICE_5KG": 0,
        "RICE_10KG": 0,
        "RICE_25KG": 0,
    }

    for item in items:
        kind = item.get("kind")
        qty = int(item.get("quantity") or 0)
        if kind in counts:
            counts[kind] += qty

    parts: List[str] = []
    if counts["RICE_5KG"]:
        parts.append(f"5kg×{counts['RICE_5KG']}")
    if counts["RICE_10KG"]:
        parts.append(f"10kg×{counts['RICE_10KG']}")
    if counts["RICE_25KG"]:
        parts.append(f"25kg×{counts['RICE_25KG']}")

    return " / ".join(parts) if parts else ""


def calc_amounts(row: Dict[str, Any]) -> Tuple[int, int, int]:
    """
    row から金額情報を取り出し、
    (rice_subtotal, service_fee, total_amount) を返す。
    """
    rice_subtotal = int(row.get("rice_subtotal") or 0)
    service_fee = int(row.get("service_fee") or 0)
    total_amount = rice_subtotal + service_fee
    return rice_subtotal, service_fee, total_amount
