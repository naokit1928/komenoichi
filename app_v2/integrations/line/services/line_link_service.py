from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from app_v2.integrations.line.repository.line_link_repository import (
    ensure_consumer_by_line_user_id,
    get_user_by_line_user_id,
    create_farmer_user,
    get_owned_farm_id,
    create_farm,
)


@dataclass(frozen=True)
class LineLinkResult:
    is_consumer_flow: bool
    consumer_ensured: bool
    farmer_user_id: Optional[int]
    farm_id: Optional[int]


class LineLinkService:
    """
    LINE user_id を受け取り、
    consumer / farmer の連携を行う業務サービス。
    """

    def link_line_user(
        self,
        *,
        line_user_id: str,
        is_consumer_flow: bool,
        intended_farm_id: Optional[int],
    ) -> LineLinkResult:
        """
        line_api で取得した情報を元に、
        連携処理を行う。

        intended_farm_id:
          return_to に farm_id が含まれていた場合のみ指定
        """

        # --------------------------------------------------
        # 1) consumer は常に ensure（現行挙動を維持）
        # --------------------------------------------------
        ensure_consumer_by_line_user_id(line_user_id)

        if is_consumer_flow:
            # 購入者フローでは farm を一切触らない
            return LineLinkResult(
                is_consumer_flow=True,
                consumer_ensured=True,
                farmer_user_id=None,
                farm_id=None,
            )

        # --------------------------------------------------
        # 2) farmer フロー
        # --------------------------------------------------
        user_id = get_user_by_line_user_id(line_user_id)

        if user_id is None:
            # 新規 farmer user 作成
            user_id = create_farmer_user(line_user_id)

        # --------------------------------------------------
        # 3) farm の確定
        # --------------------------------------------------
        farm_id: Optional[int] = None

        if intended_farm_id is not None:
            owned = get_owned_farm_id(user_id, intended_farm_id)
            if owned is not None:
                farm_id = owned

        if farm_id is None:
            # 必ず新規 farm を作成（現行挙動どおり）
            farm_id = create_farm(user_id)

        return LineLinkResult(
            is_consumer_flow=False,
            consumer_ensured=True,
            farmer_user_id=user_id,
            farm_id=farm_id,
        )
