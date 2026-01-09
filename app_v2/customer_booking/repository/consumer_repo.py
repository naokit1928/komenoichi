from __future__ import annotations

import sqlite3
from typing import Optional

from app_v2.db.core import resolve_db_path


class ConsumerRepository:
    """
    Consumer 解決用 Repository（EMAIL 正規化版）

    責務:
    - email を人格IDとして consumer を解決する
    - 存在しなければ email 付きで新規 consumer を作成する

    設計方針（更新後・固定）:
    - consumer = 人格
    - email = 人格ID
    - EMAIL consumer は consumers.email を正とする
    - LINE consumer（既存・email なし）は従来どおり DEFAULT VALUES で作成
    """

    def __init__(self) -> None:
        self.db_path = resolve_db_path()

    # ============================================================
    # lookup
    # ============================================================

    def get_consumer_id_by_email(
        self,
        *,
        email: str,
    ) -> Optional[int]:
        """
        consumers テーブルから email に対応する consumer_id を取得する
        """
        conn = sqlite3.connect(self.db_path)
        try:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT consumer_id
                FROM consumers
                WHERE email = ?
                LIMIT 1
                """,
                (email,),
            )
            row = cur.fetchone()
            return int(row[0]) if row else None
        finally:
            conn.close()

    # ============================================================
    # create
    # ============================================================

    def create_consumer_with_email(
        self,
        *,
        email: str,
    ) -> int:
        """
        email を人格IDとして新規 consumer を作成する
        """
        conn = sqlite3.connect(self.db_path)
        try:
            cur = conn.cursor()
            cur.execute(
                """
                INSERT INTO consumers (email)
                VALUES (?)
                """,
                (email,),
            )
            conn.commit()
            return int(cur.lastrowid)
        finally:
            conn.close()

    def create_consumer_without_email(self) -> int:
        """
        email を持たない consumer（例: LINE 由来）を作成する
        """
        conn = sqlite3.connect(self.db_path)
        try:
            cur = conn.cursor()
            cur.execute(
                """
                INSERT INTO consumers DEFAULT VALUES
                """
            )
            conn.commit()
            return int(cur.lastrowid)
        finally:
            conn.close()

    # ============================================================
    # public API
    # ============================================================

    def get_or_create_consumer_id_by_email(
        self,
        *,
        email: str,
    ) -> int:
        """
        email をキーに consumer_id を解決する。

        - consumers.email に既存レコードがあればそれを返す
        - なければ email 付きで新規 consumer を作成する
        """
        consumer_id = self.get_consumer_id_by_email(email=email)
        if consumer_id is not None:
            return consumer_id

        return self.create_consumer_with_email(email=email)
