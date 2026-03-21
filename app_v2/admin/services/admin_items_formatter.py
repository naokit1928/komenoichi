# app_v2/admin/services/admin_items_formatter.py
from __future__ import annotations

import json
from typing import Any, Dict, List


# ============================================================
# 管理画面用：予約内容（items）と金額の整形
# ============================================================

def build_items_display(items_json: Any) -> str:
    """
    items_json から管理画面表示用の文字列を生成する。
    V1形式(kind) と V2形式(size_kg) の両方に対応。
    """

    if isinstance(items_json, str):
        try:
            items = json.loads(items_json)
        except json.JSONDecodeError:
            items = []
    else:
        items = items_json or []

    counts: Dict[int, int] = {
        5: 0,
        10: 0,
        25: 0,
    }

    for item in items:
        # V2 フォーマット (size_kg)
        if "size_kg" in item:
            kg = int(item.get("size_kg"))
            qty = int(item.get("quantity") or 0)
            if kg in counts:
                counts[kg] += qty
        # V1 フォーマット (kind) フォールバック
        elif "kind" in item:
            kind = item.get("kind")
            qty = int(item.get("quantity") or 0)
            if kind == "RICE_5KG":
                counts[5] += qty
            elif kind == "RICE_10KG":
                counts[10] += qty
            elif kind == "RICE_25KG":
                counts[25] += qty

    parts: List[str] = []
    if counts[5]:
        parts.append(f"5kg×{counts[5]}")
    if counts[10]:
        parts.append(f"10kg×{counts[10]}")
    if counts[25]:
        parts.append(f"25kg×{counts[25]}")

    return " / ".join(parts) if parts else "内容なし"

def calc_amounts(row: Dict[str, Any]) -> tuple[int, int, int]:
    """
    (rice_subtotal, service_fee, total_amount) を返す
    """
    rice_subtotal = int(row.get("rice_subtotal") or 0)
    service_fee = int(row.get("service_fee") or 0)
    total_amount = rice_subtotal + service_fee
    return rice_subtotal, service_fee, total_amount