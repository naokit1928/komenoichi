# app_v2/farmer/services/registration_service.py
from __future__ import annotations

from dataclasses import dataclass

from app_v2.farmer.dtos import OwnerDTO, FarmPickupDTO
from app_v2.farmer.repository.registration_repo import RegistrationRepository
from app_v2.farmer.services.location_service import (
    GeocodeResult,
    geocode_address,
)


# ============================================================
# 例外クラス（API 層で HTTP エラーにマッピングする）
# ============================================================


class RegistrationError(Exception):
    """Registration ドメインでの共通エラーの基底クラス。"""
    pass


class OwnerAlreadyHasFarmError(RegistrationError):
    """
    すでに同じ owner_user_id に紐づく farm が存在する場合のエラー。

    v1 と同様、「同一オーナーが2重登録しようとした」ケースを表す。
    """

    def __init__(self, owner_user_id: int, existing_farm_id: int) -> None:
        self.owner_user_id = owner_user_id
        self.existing_farm_id = existing_farm_id
        super().__init__(
            f"farm already exists for owner_user_id={owner_user_id} (farm_id={existing_farm_id})"
        )


class OwnerUserNotFoundError(RegistrationError):
    """
    line_user_id に対応する users レコードが存在しない場合のエラー。
    """

    def __init__(self, line_user_id: str) -> None:
        self.line_user_id = line_user_id
        # メッセージ自体はデバッグ用。HTTP レスポンスでは "line login required" を返す。
        super().__init__(f"user not found for line_user_id={line_user_id}")


# ============================================================
# 戻り値の内部 DTO（API からそのまま JSON にしてもよい）
# ============================================================


@dataclass
class RegistrationResult:
    """
    Registration 完了時に service から返す結果。

    v1 の finish_registration と互換性のある形：
    {
      "farm_id": 19,
      "owner_user_id": 24,
      "settings_url_hint": "/farmer/settings?farm_id=19",
      "note": "Step3 registration successful (User + Farm saved)"
    }
    """

    farm_id: int
    owner_user_id: int
    settings_url_hint: str
    note: str = "Step3 registration successful (User + Farm saved)"


# ============================================================
# Registration サービス本体
# ============================================================


class RegistrationService:
    """
    Farmer Registration のビジネスロジック層。

    - line_user_id から users レコードを取得
    - registration_status / is_friend を v1 と同じ条件でチェック
    - 1 owner_user_id につき 1 farm だけを許可
    - users のオーナー情報を更新 + registration_status を 'registered' に変更
    - farms レコードの新規作成
    - commit / rollback の制御

    HTTP の概念（ステータスコードなど）は一切持たない。
    """

    def __init__(self) -> None:
        # SQLAlchemy Session は不要。sqlite3 ベースの Repository を直接使う。
        self.repo = RegistrationRepository()

    # --------------------------------------------------------
    # 内部ヘルパー: owner 住所を geocode して lat/lng を得る
    # --------------------------------------------------------

    def _geocode_owner_address(
        self,
        *,
        owner_pref: str,
        owner_city: str,
        owner_addr_line: str,
    ) -> tuple[float, float]:
        """
        Owner の住所（都道府県 + 市区町村 + 番地）を 1 本の文字列にして geocode する。

        ここで得た lat/lng は farms.lat / farms.lng に保存するために使用する。
        """
        full_address = f"{owner_pref}{owner_city}{owner_addr_line}".strip()
        if not full_address:
            raise RegistrationError("owner address is empty")

        # location_service.geocode_address() は GeocodeResult を返す
        result: GeocodeResult = geocode_address(address=full_address, region="jp")

        # APIキー未設定などの致命的エラー
        if result.status == "NO_API_KEY":
            raise RegistrationError(
                result.error_message or "GOOGLE_GEOCODING_API_KEY is not configured"
            )

        if result.status == "NETWORK_ERROR":
            raise RegistrationError(
                result.error_message or "failed to call Google Geocoding API"
            )

        # ZERO_RESULTS / PARSE_ERROR なども含めて ok=False の場合は失敗扱い
        if not result.ok or result.lat is None or result.lng is None:
            raise RegistrationError(
                f"failed to geocode owner address (status={result.status})"
            )

        # 正常時
        return float(result.lat), float(result.lng)

    # --------------------------------------------------------
    # メインフロー
    # --------------------------------------------------------

    def register_new_farm(
        self,
        *,
        line_user_id: str,
        owner_last_name: str,
        owner_first_name: str,
        owner_last_kana: str,
        owner_first_kana: str,
        owner_postcode: str,
        owner_pref: str,
        owner_city: str,
        owner_addr_line: str,
        owner_phone: str,
        pickup_lat: float,
        pickup_lng: float,
        pickup_place_name: str,
        pickup_notes: str | None,
        pickup_time: str,
    ) -> RegistrationResult:
        """
        新規 Registration（Owner + Farm 初期登録）を実行する。

        v1 の finish_registration と同じ世界観：
          1) users.line_user_id でユーザーを取得
          2) registration_status == 'line_verified' かつ is_friend == 1 を要求
          3) まだ farm が存在しない owner_user_id だけ新規作成
        """

        # 1. line_user_id からユーザー行を取得
        user = self.repo.get_user_by_line_user_id(line_user_id)
        if user is None:
            # v1: HTTP 403 "line login required" 相当
            raise OwnerUserNotFoundError(line_user_id=line_user_id)

        owner_user_id = int(user["id"])
        status_lower = (user.get("registration_status") or "").lower()
        is_friend = int(user.get("is_friend") or 0)

        # 2. v1 と同じ条件: registration_status == 'line_verified' AND is_friend == 1
        if status_lower != "line_verified" or is_friend != 1:
            # v1: HTTPException(403, detail="friendship required")
            raise RegistrationError("friendship required")

        # 3. DTO 組み立て
        owner_dto = OwnerDTO(
            owner_user_id=owner_user_id,
            line_user_id=line_user_id,
            owner_last_name=owner_last_name,
            owner_first_name=owner_first_name,
            owner_last_kana=owner_last_kana,
            owner_first_kana=owner_first_kana,
            owner_postcode=owner_postcode,
            owner_pref=owner_pref,
            owner_city=owner_city,
            owner_addr_line=owner_addr_line,
            owner_phone=owner_phone,
        )

        pickup_dto = FarmPickupDTO(
            farm_id=None,  # Registration 時点ではまだ未発行
            pickup_lat=pickup_lat,
            pickup_lng=pickup_lng,
            pickup_place_name=pickup_place_name,
            pickup_notes=pickup_notes,
            pickup_time=pickup_time,
        )

        # 3.5 Owner 住所を geocode して lat/lng を取得
        owner_lat, owner_lng = self._geocode_owner_address(
            owner_pref=owner_pref,
            owner_city=owner_city,
            owner_addr_line=owner_addr_line,
        )

        try:
            # 4. Farm 重複チェック（owner_user_id または user_id で既に農家があるか）
            existing_farm_id = self.repo.get_existing_farm_id_for_owner(owner_user_id)
            if existing_farm_id is not None:
                raise OwnerAlreadyHasFarmError(
                    owner_user_id=owner_user_id,
                    existing_farm_id=existing_farm_id,
                )

            # 5. users 側のオーナー情報を更新（name/phone/address など）＋ 'registered' へ遷移
            self.repo.update_user_owner_info(owner_dto)

            # 6. farms に新規作成
            #    ★ ここで geocode した owner_lat/owner_lng を repo に渡す
            farm_id = self.repo.create_farm_for_registration(
                owner=owner_dto,
                pickup=pickup_dto,
                owner_lat=owner_lat,
                owner_lng=owner_lng,
            )

            # 7. ここまで成功したら commit
            self.repo.commit()

        except Exception:
            # 何か起きたらロールバックして再スロー
            self.repo.rollback()
            raise

        # 8. API 層がそのまま JSON にできる結果を返す
        settings_url_hint = f"/farmer/settings?farm_id={farm_id}"

        return RegistrationResult(
            farm_id=farm_id,
            owner_user_id=owner_user_id,
            settings_url_hint=settings_url_hint,
        )
