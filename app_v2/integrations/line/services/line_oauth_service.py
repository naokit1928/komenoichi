from __future__ import annotations

import os
import requests
from typing import Dict, Any

from app_v2.integrations.line.utils.state_signer import sign_state, verify_state
from app_v2.integrations.line.utils.url_builder import build_redirect_url


LINE_AUTH_BASE = "https://access.line.me/oauth2/v2.1/authorize"
LINE_TOKEN_ENDPOINT = "https://api.line.me/oauth2/v2.1/token"
LINE_PROFILE_ENDPOINT = "https://api.line.me/v2/profile"


class LineOAuthService:
    """
    LINE OAuth 専用サービス。

    - OAuth URL 生成
    - code → access_token
    - access_token → profile
    """

    def __init__(self) -> None:
        self.channel_id = os.environ["LINE_CHANNEL_ID"]
        self.channel_secret = os.environ["LINE_CHANNEL_SECRET"]
        self.redirect_uri = os.environ["LINE_LOGIN_REDIRECT_URI"]

    # ============================================================
    # Login URL
    # ============================================================

    def build_login_url(
        self,
        *,
        return_to: str,
        extra_state: Dict[str, Any] | None = None,
    ) -> str:
        """
        LINE ログイン URL を生成する。
        """
        payload = {"return_to": return_to}
        if extra_state:
            payload.update(extra_state)

        state = sign_state(payload, secret=self.channel_secret)

        return build_redirect_url(
            LINE_AUTH_BASE,
            query={
                "response_type": "code",
                "client_id": self.channel_id,
                "redirect_uri": self.redirect_uri,
                "state": state,
                "scope": "profile openid",
            },
        )

    # ============================================================
    # Callback
    # ============================================================

    def exchange_code_for_profile(self, *, code: str, state: str) -> Dict[str, Any]:
        """
        callback で受け取った code / state から
        LINE profile を取得する。

        戻り値:
          {
            "line_user_id": "...",
            "display_name": "...",
            "picture_url": "..."
          }
        """
        payload = verify_state(state, secret=self.channel_secret)

        token = self._fetch_access_token(code)
        profile = self._fetch_profile(token["access_token"])

        return {
            "line_user_id": profile["userId"],
            "display_name": profile.get("displayName"),
            "picture_url": profile.get("pictureUrl"),
            "state_payload": payload,
        }

    # ============================================================
    # Internal
    # ============================================================

    def _fetch_access_token(self, code: str) -> Dict[str, Any]:
        resp = requests.post(
            LINE_TOKEN_ENDPOINT,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": self.redirect_uri,
                "client_id": self.channel_id,
                "client_secret": self.channel_secret,
            },
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()

    def _fetch_profile(self, access_token: str) -> Dict[str, Any]:
        resp = requests.get(
            LINE_PROFILE_ENDPOINT,
            headers={
                "Authorization": f"Bearer {access_token}",
            },
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()
