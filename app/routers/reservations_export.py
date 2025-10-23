from datetime import datetime
from typing import List, Optional, Literal, Dict, Any, Tuple
from fastapi import APIRouter, Depends, Query, Response, Request
from fastapi.responses import HTMLResponse, PlainTextResponse, JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.database import get_db

# ルータ設定
router = APIRouter(prefix="/reservations", tags=["reservations"])

# ------------------------------
# 共通ユーティリティ
# ------------------------------
def _fmt_int(n: Optional[int]) -> str:
    return "" if n is None else f"{n:,}"

def _fmt_money(n: Optional[int], yen: bool) -> str:
    if n is None:
        return ""
    return f"¥{n:,}" if yen else f"{n:,}"

def _clone_params(request: Request, **override) -> str:
    q = dict(request.query_params)
    q.update({k: v for k, v in override.items() if v is not None})
    for k, v in list(q.items()):
        if v is None:
            q.pop(k, None)
    return ("?" + "&".join(f"{k}={v}" for k, v in q.items())) if q else ""

def _current_filters_badges(
    farm_id, user_id, status, created_from, created_to, sort, group_by, yen
) -> str:
    items = []
    def badge(label: str, val: Any) -> None:
        if val not in (None, "", False):
            items.append(f'<span class="badge">{label}: {val}</span>')
    badge("group_by", group_by)
    if yen:
        items.append('<span class="badge">currency: JPY</span>')
    badge("farm_id", farm_id)
    badge("user_id", user_id)
    badge("status", status)
    badge("from", created_from)
    badge("to", created_to)
    badge("sort", sort)
    return "".join(items)

def _where_clause_and_params(
    farm_id, user_id, status, created_from, created_to
) -> Tuple[str, Dict[str, Any]]:
    conds = []
    params: Dict[str, Any] = {}
    if farm_id is not None:
        conds.append("r.farm_id = :farm_id")
        params["farm_id"] = farm_id
    if user_id is not None:
        conds.append("r.user_id = :user_id")
        params["user_id"] = user_id
    if status:
        conds.append("r.status = :status")
        params["status"] = status
    if created_from:
        conds.append("r.created_at >= :created_from")
        params["created_from"] = created_from
    if created_to:
        conds.append("r.created_at <= :created_to")
        params["created_to"] = created_to
    where = "WHERE " + " AND ".join(conds) if conds else ""
    return where, params

def _load_rows(
    db: Session,
    farm_id, user_id, status, created_from, created_to,
    sort: Optional[str]
) -> List[Dict[str, Any]]:
    where, params = _where_clause_and_params(farm_id, user_id, status, created_from, created_to)
    base_sql = f"""
        SELECT
            r.id AS reservation_id,
            r.order_id AS order_id,
            r.user_id AS user_id,
            r.farm_id AS farm_id,
            r.item AS item,
            r.quantity AS quantity,
            r.price AS price,
            COALESCE(r.amount, r.price * r.quantity) AS amount,
            r.status AS status,
            r.created_at AS created_at
        FROM reservations r
        {where}
    """
    if sort in {"created_at_asc","created_at_desc"}:
        sort_sql = "ORDER BY r.created_at ASC" if sort == "created_at_asc" else "ORDER BY r.created_at DESC"
    elif sort in {"amount_asc","amount_desc"}:
        sort_sql = "ORDER BY amount ASC" if sort == "amount_asc" else "ORDER BY amount DESC"
    elif sort in {"order_id_asc","order_id_desc"}:
        sort_sql = "ORDER BY r.order_id ASC NULLS LAST" if sort == "order_id_asc" else "ORDER BY r.order_id DESC NULLS LAST"
    else:
        sort_sql = "ORDER BY r.created_at DESC"

    rows = []
    for row in db.execute(text(f"{base_sql}\n{sort_sql}"), params).mappings().all():
        d = dict(row)
        ca = d.get("created_at")
        if isinstance(ca, datetime):
            d["created_at"] = ca.isoformat(timespec="seconds")
        rows.append(d)
    return rows

def _totals(rows: List[Dict[str, Any]]) -> Dict[str, int]:
    return {
        "count": len(rows),
        "total_quantity": sum(int(r.get("quantity") or 0) for r in rows),
        "total_amount": sum(int(r.get("amount") or 0) for r in rows),
    }

def _group_by_order(rows: List[Dict[str, Any]]) -> Dict[Optional[str], Dict[str, Any]]:
    groups: Dict[Optional[str], Dict[str, Any]] = {}
    for r in rows:
        k = r.get("order_id")
        groups.setdefault(k, {"lines": []})["lines"].append(r)
    for k, g in groups.items():
        g["totals"] = _totals(g["lines"])
    return groups

# ------------------------------
# CSV/TSV/HTML 出力
# ------------------------------
def _csv_or_tsv(rows: List[Dict[str, Any]], group_by_order: bool, tsv: bool) -> str:
    cols = ["reservation_id","order_id","user_id","farm_id","item","quantity","price","amount","status","created_at"]
    sep = "\t" if tsv else ","
    def esc(v: Any) -> str:
        s = "" if v is None else str(v)
        if tsv:
            return s.replace("\t"," ").replace("\r"," ").replace("\n"," ")
        if any(ch in s for ch in [",","\"","\n","\r"]):
            s = "\"" + s.replace("\"","\"\"") + "\""
        return s
    lines = [sep.join(cols)]
    if group_by_order:
        groups = _group_by_order(rows)
        for order_id, g in groups.items():
            for r in g["lines"]:
                lines.append(sep.join(esc(r.get(c)) for c in cols))
            t = g["totals"]
            subtotal_row = {
                "reservation_id":"__subtotal__","order_id":order_id or "","user_id":"","farm_id":"",
                "item":"","quantity":t["total_quantity"],"price":"","amount":t["total_amount"],
                "status":"","created_at":""
            }
            lines.append(sep.join(esc(subtotal_row.get(c)) for c in cols))
    else:
        for r in rows:
            lines.append(sep.join(esc(r.get(c)) for c in cols))
    tt = _totals(rows)
    total_row = {
        "reservation_id":"__totals__","order_id":"","user_id":"","farm_id":"",
        "item":"","quantity":tt["total_quantity"],"price":"","amount":tt["total_amount"],
        "status":"","created_at":""
    }
    lines.append(sep.join(esc(total_row.get(c)) for c in cols))
    return "\n".join(lines) + "\n"

def _html_table(request: Request, rows: List[Dict[str, Any]], group_by: Optional[str], yen: bool, badges_html: str) -> str:
    cols = ["reservation_id","order_id","user_id","farm_id","item","quantity","price","amount","status","created_at"]
    labels = {c: c for c in cols}

    # ★ 修正：URLオブジェクトを文字列化
    q_html = _clone_params(request, format="html")
    q_csv = _clone_params(request, format="csv")
    q_tsv = _clone_params(request, format="tsv")
    q_json = _clone_params(request, format="json")

    base = str(request.url_for("reservations_export"))
    html_url = base + q_html
    csv_url = base + q_csv
    tsv_url = base + q_tsv
    json_url = base + q_json

    def render_body(rows_: List[Dict[str, Any]]) -> str:
        trs = []
        for r in rows_:
            tds = []
            for c in cols:
                v = r.get(c)
                if c in ("quantity","price","amount"):
                    cell = _fmt_money(v, yen) if c in ("price","amount") else _fmt_int(v)
                    tds.append(f'<td class="num">{cell}</td>')
                else:
                    tds.append(f"<td>{'' if v is None else str(v)}</td>")
            trs.append("<tr>" + "".join(tds) + "</tr>")
        return "".join(trs)

    sections = []
    if group_by == "order":
        groups = _group_by_order(rows)
        for order_id, g in groups.items():
            subt = g["totals"]
            sections.append(f"""
            <section class="section">
              <h3 class="section-title">Order: {order_id or '(null)'}</h3>
              <div class="table-wrapper">
                <table class="table">
                  <thead><tr>{''.join(f'<th scope="col">{labels[c]}</th>' for c in cols)}</tr></thead>
                  <tbody>{render_body(g['lines'])}</tbody>
                  <tfoot><tr class="subtotal">
                    <td colspan="5" class="subtotal-label">小計</td>
                    <td class="num">{_fmt_int(subt['total_quantity'])}</td>
                    <td></td>
                    <td class="num">{_fmt_money(subt['total_amount'], yen)}</td>
                    <td></td><td></td>
                  </tr></tfoot>
                </table>
              </div>
            </section>""")
    else:
        sections.append(f"""
        <section class="section">
          <div class="table-wrapper">
            <table class="table">
              <thead><tr>{''.join(f'<th scope="col">{labels[c]}</th>' for c in cols)}</tr></thead>
              <tbody>{render_body(rows)}</tbody>
            </table>
          </div>
        </section>""")

    tt = _totals(rows)
    totals_html = f"""
    <div class="totals">
      <div class="totals-item"><span class="label">Count</span><span class="val">{_fmt_int(tt['count'])}</span></div>
      <div class="totals-item"><span class="label">Total Quantity</span><span class="val">{_fmt_int(tt['total_quantity'])}</span></div>
      <div class="totals-item"><span class="label">Total Amount</span><span class="val">{_fmt_money(tt['total_amount'], yen)}</span></div>
    </div>"""

    return f"""<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Reservations Export</title>
<style>
  body {{ font-family: system-ui, "Noto Sans JP"; margin:0; }}
  .table-wrapper {{ overflow-x:auto; }}
  th,td {{ padding:6px 8px; border-bottom:1px solid #ddd; }}
  th {{ position:sticky; top:0; background:#fff; }}
  td.num {{ text-align:right; font-variant-numeric:tabular-nums; }}
  .subtotal {{ background:#f9fafc; }}
  .subtotal-label {{ text-align:right; }}
</style>
</head>
<body>
<header>
  <h1>Reservations Export</h1>
  <div class="actions">
    <a href="{html_url}">HTML</a> |
    <a href="{csv_url}">CSV</a> |
    <a href="{tsv_url}">TSV</a> |
    <a href="{json_url}">JSON</a>
  </div>
  <div>{badges_html}</div>
</header>
<main>{''.join(sections)}{totals_html}</main>
</body>
</html>"""

def _set_total_headers(resp: Response, totals: Dict[str, int]) -> None:
    resp.headers["X-Total-Count"] = str(totals["count"])
    resp.headers["X-Total-Quantity"] = str(totals["total_quantity"])
    resp.headers["X-Total-Amount"] = str(totals["total_amount"])

# ------------------------------
# メインAPI
# ------------------------------
@router.get("/export", name="reservations_export")
def export_reservations(
    request: Request,
    response: Response,
    format: Literal["html","csv","json","tsv"] = Query("html"),
    group_by: Optional[Literal["order"]] = Query(None),
    farm_id: Optional[int] = Query(None),
    user_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    created_from: Optional[str] = Query(None),
    created_to: Optional[str] = Query(None),
    sort: Optional[str] = Query(None),
    yen: Optional[bool] = Query(False),
    db: Session = Depends(get_db),
):
    rows = _load_rows(db, farm_id, user_id, status, created_from, created_to, sort)
    totals = _totals(rows)
    _set_total_headers(response, totals)

    if format == "json":
        return JSONResponse({"rows": rows, "totals": totals})
    if format in ("csv","tsv"):
        content = _csv_or_tsv(rows, group_by == "order", tsv=(format == "tsv"))
        if format == "csv":
            return PlainTextResponse("\ufeff" + content, media_type="text/csv; charset=utf-8")
        return PlainTextResponse(content, media_type="text/tab-separated-values; charset=utf-8")

    badges_html = _current_filters_badges(farm_id, user_id, status, created_from, created_to, sort, group_by, bool(yen))
    html = _html_table(request, rows, group_by, bool(yen), badges_html)
    return HTMLResponse(html)

# ------------------------------
# export_smart
# ------------------------------
@router.get("/export_smart", response_class=HTMLResponse, name="reservations_export_smart")
def export_smart(
    request: Request,
    group_by: Optional[Literal["order"]] = Query(None),
    farm_id: Optional[int] = Query(None),
    user_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    created_from: Optional[str] = Query(None),
    created_to: Optional[str] = Query(None),
    sort: Optional[str] = Query(None),
    yen: Optional[bool] = Query(False),
):
    ua = (request.headers.get("user-agent") or "").lower()
    is_mobile = any(k in ua for k in ["iphone","android","mobile"])

    q_html = _clone_params(request, format="html")
    q_csv = _clone_params(request, format="csv")
    q_tsv = _clone_params(request, format="tsv")
    q_json = _clone_params(request, format="json")

    base = str(request.url_for("reservations_export"))
    html_url = base + q_html
    csv_url = base + q_csv
    tsv_url = base + q_tsv
    json_url = base + q_json
    preferred = html_url if is_mobile else csv_url

    badges_html = _current_filters_badges(farm_id, user_id, status, created_from, created_to, sort, group_by, bool(yen))

    return HTMLResponse(f"""<!doctype html>
<html lang="ja"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Export Smart</title>
</head><body>
<h1>Export</h1>
<p>端末に最適な形式でエクスポートします。</p>
<div>{badges_html}</div>
<ul>
  <li><a href="{html_url}">HTML</a></li>
  <li><a href="{csv_url}">CSV</a></li>
  <li><a href="{tsv_url}">TSV</a></li>
  <li><a href="{json_url}">JSON</a></li>
</ul>
<p><a href="{preferred}">→ 端末に合わせてすぐ開く</a></p>
</body></html>""")
