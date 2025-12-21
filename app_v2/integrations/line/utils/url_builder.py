from __future__ import annotations

from urllib.parse import urlencode, urlparse, parse_qsl, urlunparse
from typing import Dict, Any


def append_query_params(url: str, params: Dict[str, Any]) -> str:
    """
    既存 URL にクエリパラメータを追加する。

    - 既存クエリは保持
    - 同名キーは上書き
    - None の値は無視
    """
    parsed = urlparse(url)
    query = dict(parse_qsl(parsed.query))

    for k, v in params.items():
        if v is None:
            continue
        query[k] = str(v)

    new_query = urlencode(query, doseq=True)

    return urlunparse(
        (
            parsed.scheme,
            parsed.netloc,
            parsed.path,
            parsed.params,
            new_query,
            parsed.fragment,
        )
    )


def build_redirect_url(
    base_url: str,
    *,
    path: str = "",
    query: Dict[str, Any] | None = None,
) -> str:
    """
    base_url + path + query から redirect URL を組み立てる。

    例:
      build_redirect_url(
        "https://example.com",
        path="/callback",
        query={"state": "..."}
      )
    """
    if path:
        base = base_url.rstrip("/") + "/" + path.lstrip("/")
    else:
        base = base_url

    if query:
        return append_query_params(base, query)

    return base
