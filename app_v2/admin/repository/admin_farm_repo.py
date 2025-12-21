from __future__ import annotations

import sqlite3
from typing import Any, Dict, List

from app_v2.db.core import resolve_db_path


class AdminFarmRepository:
    """
    管理画面用 Farm 解決 Repository

    - farms テーブルのみ参照
    - 検索ロジックはここに閉じる
    - 返すのは「表示・識別に必要な最小情報」
    """

    def __init__(self) -> None:
        self.conn = sqlite3.connect(resolve_db_path())
        self.conn.row_factory = sqlite3.Row

    def find_farms_by_owner_kana(
        self,
        *,
        owner_kana_query: str,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """
        農家オーナー名（ひらがな）で部分一致検索
        """

        like_query = f"%{owner_kana_query}%"

        sql = """
            SELECT
                f.farm_id AS farm_id,
                f.last_name || ' ' || f.first_name AS owner_full_name,
                f.last_kana || ' ' || f.first_kana AS owner_full_kana,
                f.postal_code AS owner_postcode,
                f.address AS owner_address_line,
                f.phone AS owner_phone
            FROM farms AS f
            WHERE
                f.last_kana LIKE ?
                OR f.first_kana LIKE ?
                OR (f.last_kana || f.first_kana) LIKE ?
            ORDER BY f.farm_id
            LIMIT ?
        """

        cur = self.conn.execute(
            sql,
            (like_query, like_query, like_query, limit),
        )
        return [dict(row) for row in cur.fetchall()]
