// frontend/src/pages/admin/AdminReservationEventDetailPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { API_BASE } from "@/config/api";

import type {
  AdminReservationListItemDTO,
  AdminReservationListResponse,
} from "../../types/adminReservations";

const AdminReservationEventDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const farmIdParam = searchParams.get("farm_id");
  const eventStartParam = searchParams.get("event_start");
  const highlightReservationId = searchParams.get("highlight_reservation_id");
  const highlightId = highlightReservationId
    ? Number(highlightReservationId)
    : null;

  const farmId = farmIdParam ? Number(farmIdParam) : null;

  const [items, setItems] = useState<AdminReservationListItemDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─────────────────────────────
  // 予約一覧の取得
  // ─────────────────────────────
  useEffect(() => {
    if (farmId == null || !eventStartParam) return;

    const controller = new AbortController();

    const fetchReservations = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          farm_id: String(farmId),
          event_start: eventStartParam,
        });

        const res = await fetch(
          `${API_BASE}/api/admin/reservations?` + params.toString(),
          { signal: controller.signal }
        );

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data: AdminReservationListResponse = await res.json();
        setItems(data.items || []);
      } catch (e: any) {
        if (e.name !== "AbortError") {
          console.error(e);
          setError("予約一覧の取得に失敗しました。サーバーログを確認してください。");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchReservations();
    return () => controller.abort();
  }, [farmId, eventStartParam]);

  // ヘッダ表示用
  const headerPickupDisplay = items[0]?.pickup_display ?? "";
  const headerPickupPlaceName = items[0]?.pickup_place_name ?? "";
  const headerPickupMapUrl = items[0]?.pickup_map_url ?? "";
  const headerPickupDetailMemo = items[0]?.pickup_detail_memo ?? "";

  // 農家情報
  const ownerName =
    items.length > 0
      ? `${items[0].owner_last_name ?? ""} ${items[0].owner_first_name ?? ""}`.trim()
      : "";
  const ownerKana =
    items.length > 0
      ? `${items[0].owner_last_kana ?? ""} ${items[0].owner_first_kana ?? ""}`.trim()
      : "";
  const ownerPostalCode = items[0]?.owner_postcode ?? "";
  const ownerAddressLine = items[0]?.owner_address_line ?? "";
  const ownerPhone = items[0]?.owner_phone ?? "";
  const ownerEmail = items[0]?.owner_email ?? ""; 

  // C / X 集計
  const { confirmedCount, cancelledCount } = useMemo(() => {
    let confirmed = 0;
    let cancelled = 0;
    items.forEach((r) => {
      if (r.reservation_status === "confirmed") confirmed += 1;
      else if (r.reservation_status === "cancelled") cancelled += 1;
    });
    return { confirmedCount: confirmed, cancelledCount: cancelled };
  }, [items]);

  const reservationCount = confirmedCount;

  // キャンセル率
  const cancelRate: number | null = useMemo(() => {
    const denom = confirmedCount + cancelledCount;
    if (denom === 0) return null;
    return Math.round((cancelledCount / denom) * 100);
  }, [confirmedCount, cancelledCount]);

  const getCancelRateClass = (rate: number | null): string => {
    if (rate == null) return "text-gray-500";
    if (rate >= 30) return "text-red-600 font-semibold";
    if (rate >= 10) return "text-yellow-600 font-semibold";
    return "text-gray-700";
  };

  // C / X フィルタ
  const confirmedItems = useMemo(
    () => items.filter((r) => r.reservation_status === "confirmed"),
    [items]
  );
  const feeItems = useMemo(
    () =>
      items.filter(
        (r) =>
          r.reservation_status === "confirmed" ||
          r.reservation_status === "cancelled"
      ),
    [items]
  );
  const visibleItems = useMemo(
    () =>
      items.filter(
        (r) =>
          r.reservation_status !== "pending" ||
          highlightId === Number(r.reservation_id)
      ),
    [items, highlightId]
  );

  const sumRiceSubtotal = useMemo(
    () => confirmedItems.reduce((sum, r) => sum + r.rice_subtotal, 0),
    [confirmedItems]
  );

  const formatNumber = (n: number) =>
    new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 }).format(n);

  // クエリ不足
  if (!farmIdParam || !eventStartParam) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-5xl px-4 py-6">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mb-4 text-sm text-gray-600 underline"
          >
            一覧に戻る
          </button>
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            farm_id または event_start が指定されていません。
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────
  // UI
  // ─────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-6">
        {/* ヘッダ */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">予約イベント詳細</h1>
            <p className="mt-1 text-sm text-gray-600">
              1回の受け渡し回に含まれる予約一覧です。
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            一覧に戻る
          </button>
        </div>

        {/* エラー / ローディング */}
        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        {loading && (
          <div className="mb-4 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
            読み込み中…
          </div>
        )}

        {/* 農家情報 */}
        {!loading && !error && items.length > 0 && (
          <>
            <div className="mb-3 rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-800">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    {ownerName}
                    {ownerKana && (
                      <span className="ml-2 text-xs text-gray-500">({ownerKana})</span>
                    )}
                  </div>
                  <div className="mt-1 space-y-0.5 text-xs text-gray-600">
                    <div>郵便番号：{ownerPostalCode || "（未登録）"}</div>
                    <div>住所：{ownerAddressLine || "（未登録）"}</div>
                    <div>電話番号：{ownerPhone || "（未登録）"}</div>
                    <div>Email：{ownerEmail || "（未登録）"}</div>
                  </div>
                </div>

                <div className="text-right text-xs text-gray-500">
                  <div className="bg-gray-100 px-2 py-1 rounded font-mono">farm_id: {farmIdParam}</div>
                </div>
              </div>
            </div>

            {/* イベント集計 */}
            <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div className="flex-1">
                  <div className="text-xs text-gray-500">受け渡し日時</div>
                  <div className="mt-1 text-base font-semibold text-gray-900">
                    {headerPickupDisplay}
                  </div>

                  {(headerPickupPlaceName ||
                    headerPickupDetailMemo ||
                    headerPickupMapUrl) && (
                    <div className="mt-3 space-y-1 text-xs text-gray-700">
                      <div className="font-semibold text-gray-600">受け渡し場所</div>
                      {headerPickupPlaceName && <div>{headerPickupPlaceName}</div>}
                      {headerPickupDetailMemo && (
                        <div className="whitespace-pre-line text-[11px] text-gray-500">
                          {headerPickupDetailMemo}
                        </div>
                      )}
                      {headerPickupMapUrl && (
                        <a
                          href={headerPickupMapUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-[11px] text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          地図を開く（Googleマップ）
                        </a>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid flex-1 grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <div className="text-xs text-gray-500">予約件数（Cのみ）</div>
                    <div className="mt-1 text-base font-semibold text-gray-900">
                      {reservationCount} 件
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">ステータス別</div>
                    <div className="mt-1 text-xs text-gray-800">
                      <span className="font-semibold text-green-600">
                        🟩 確定 {confirmedCount}
                      </span>
                      <span className="mx-1 text-gray-400">｜</span>
                      <span className="font-semibold text-red-600">
                        🟥 キャンセル {cancelledCount}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">キャンセル率</div>
                    <div className={"mt-1 text-base " + getCancelRateClass(cancelRate)}>
                      {cancelRate == null ? "-" : `${cancelRate}%`}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">お米合計（Cのみ）</div>
                    <div className="mt-1 text-base font-semibold text-gray-900">
                      {formatNumber(sumRiceSubtotal)} 円
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* 予約なし */}
        {!loading && !error && items.length === 0 && (
          <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
            この受け渡し回に属する予約はありません。
          </div>
        )}

        {/* 一覧テーブル */}
        {!loading && visibleItems.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {/* ★ 変更：ヘッダーの名称を整理 */}
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">
                    受渡番号・照会ID / 注文内容
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">
                    Email / User ID
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">
                    Stripe決済情報
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">
                    作成日時
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 whitespace-nowrap">
                    お米代
                  </th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 whitespace-nowrap">
                    ステータス
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 bg-white">
                {visibleItems.map((r) => {
                  const statusLabel =
                    r.reservation_status === "confirmed"
                      ? "確 定"
                      : r.reservation_status === "cancelled"
                      ? "キャンセル"
                      : r.reservation_status;

                  const statusClass =
                    r.reservation_status === "confirmed"
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : r.reservation_status === "cancelled"
                      ? "bg-red-50 text-red-700 border border-red-200"
                      : "bg-gray-100 text-gray-600";

                  return (
                    <tr
                      key={r.reservation_id}
                      className={
                        highlightId === Number(r.reservation_id)
                          ? "bg-blue-50 hover:bg-blue-100"
                          : "hover:bg-gray-50"
                      }
                    >
                      {/* ★ 変更：受渡番号と注文数量を整理して表示 */}
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-baseline gap-2">
                            <span className="font-bold text-gray-900 text-lg tracking-wider">
                              {/* データがない古い予約は「未発行」と表示してレイアウト崩れを防ぐ */}
                              {r.pickup_code || <span className="text-gray-400 text-sm font-normal">未発行</span>}
                            </span>
                            <span className="font-mono text-gray-500 text-xs">
                              (ID: #{r.reservation_id})
                            </span>
                          </div>
                          <div className="text-sm font-semibold text-gray-700">
                            {r.items_display}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-sm align-top whitespace-nowrap">
                        <div className="text-gray-900">
                          {r.consumer_email || (
                            <span className="text-gray-400">Email未取得</span>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-gray-500 font-mono">
                          User ID: {r.customer_user_id || "-"}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-sm align-top whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">PI:</span>
                          {r.payment_intent_id ? (
                            <code
                              className="cursor-pointer rounded bg-gray-100 px-1 py-0.5 text-xs hover:bg-gray-200"
                              onClick={() =>
                                navigator.clipboard.writeText(
                                  r.payment_intent_id!
                                )
                              }
                              title="クリックでコピー"
                            >
                              {r.payment_intent_id.substring(0, 14)}...
                            </code>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-gray-600">
                          Status:{" "}
                          <span
                            className={
                              r.payment_status === "succeeded"
                                ? "font-semibold text-green-600"
                                : ""
                            }
                          >
                            {r.payment_status || "-"}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-sm align-top whitespace-nowrap">
                        <div className="text-xs text-gray-800">
                          {r.created_at
                            ? new Date(r.created_at).toLocaleString("ja-JP", {
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "-"}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right text-sm align-top whitespace-nowrap">
                        <div className="font-semibold text-gray-900">
                          {formatNumber(r.rice_subtotal)} 円
                        </div>
                      </td>

                      <td className="px-4 py-3 text-center align-top whitespace-nowrap">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusClass}`}
                        >
                          {statusLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && items.length > 0 && visibleItems.length === 0 && (
          <div className="mt-3 text-xs text-gray-500">
            ※ この受け渡し回には pending の予約のみ存在します。
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminReservationEventDetailPage;