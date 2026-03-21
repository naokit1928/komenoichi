// frontend/src/pages/admin/AdminReservationWeeksPage.tsx
import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { API_BASE } from "@/config/api";
import type {
  AdminReservationWeekSummary,
  AdminReservationWeekListResponse,
  AdminReservationListItemDTO,
  AdminReservationListResponse,
} from "../../types/adminReservations";

const formatNumber = (n: number) =>
  new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 }).format(n);

const getCancelRateClass = (rate: number | null): string => {
  if (rate == null) return "text-gray-500";
  if (rate >= 30) return "text-red-600 font-semibold";
  if (rate >= 10) return "text-yellow-600 font-semibold";
  return "text-gray-700";
};

type FarmerInfo = {
  owner_last_name?: string;
  owner_first_name?: string;
  owner_last_kana?: string;
  owner_first_kana?: string;
  owner_postcode?: string;
  owner_address_line?: string;
  owner_phone?: string;  // ★追加
  owner_email?: string;  // ★追加
};

const AdminReservationWeeksPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const farmIdParam = searchParams.get("farm_id");
  const farmId = farmIdParam ? Number(farmIdParam) : null;

  const [weeks, setWeeks] = useState<AdminReservationWeekSummary[]>([]);
  const [farmerInfo, setFarmerInfo] = useState<FarmerInfo | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!farmId) return;

    const controller = new AbortController();

    const fetchAll = async () => {
      setLoading(true);
      setError(null);
      setFarmerInfo(null);

      try {
        const weeksParams = new URLSearchParams({ farm_id: String(farmId) });
        const weeksRes = await fetch(`${API_BASE}/api/admin/reservations/weeks?` + weeksParams.toString(), {
          signal: controller.signal,
        });

        if (!weeksRes.ok) throw new Error(`HTTP ${weeksRes.status}`);

        const weeksData: AdminReservationWeekListResponse = await weeksRes.json();
        
        const sorted = [...(weeksData.items ?? [])].sort(
          (a, b) => new Date(b.event_start).getTime() - new Date(a.event_start).getTime()
        );
        setWeeks(sorted);

        const headerParams = new URLSearchParams({ farm_id: String(farmId), limit: "1", offset: "0" });
        const headerRes = await fetch(`${API_BASE}/api/admin/reservations?` + headerParams.toString(), {
          signal: controller.signal,
        });

        if (headerRes.ok) {
          const headerData: AdminReservationListResponse = await headerRes.json();
          const first: AdminReservationListItemDTO | undefined = headerData.items?.[0];

          if (first) {
            setFarmerInfo({
              owner_last_name: first.owner_last_name || undefined,
              owner_first_name: first.owner_first_name || undefined,
              owner_last_kana: first.owner_last_kana || undefined,
              owner_first_kana: first.owner_first_kana || undefined,
              owner_postcode: first.owner_postcode || undefined,
              owner_address_line: first.owner_address_line || undefined,
              owner_phone: first.owner_phone || undefined, // ★追加
              owner_email: first.owner_email || undefined, // ★追加
            });
          }
        }
      } catch (e: any) {
        if (e.name === "AbortError") return;
        console.error(e);
        setError("受け渡しイベント一覧の取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
    return () => controller.abort();
  }, [farmId]);

  if (!farmId) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-5xl rounded-md border border-red-200 bg-red-50 p-4 text-red-700">
          farm_id が指定されていません。
          <button onClick={() => navigate("/admin")} className="ml-4 font-bold underline">
            ダッシュボードに戻る
          </button>
        </div>
      </div>
    );
  }

  const fullName = (farmerInfo?.owner_last_name ?? "") + " " + (farmerInfo?.owner_first_name ?? "");
  const fullKana = (farmerInfo?.owner_last_kana ?? "") + " " + (farmerInfo?.owner_first_kana ?? "");

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-6">
        
        {/* ヘッダ & 戻るボタン */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">予約タイムライン</h1>
            <p className="mt-1 text-sm text-gray-600">
              受け渡し回ごとのキャンセル率と売上合計を確認します。
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/admin")}
            className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 shadow-sm"
          >
            ← ダッシュボードに戻る
          </button>
        </div>

        {/* 農家ヘッダ */}
        {farmerInfo && (
          <div className="mb-6 rounded-lg border border-gray-200 bg-white px-5 py-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-bold text-gray-900">
                  {fullName.trim() || "農家情報"}
                  {fullKana.trim() && <span className="ml-2 text-xs font-normal text-gray-500">({fullKana.trim()})</span>}
                </div>
                <div className="mt-2 space-y-1 text-sm text-gray-600">
                  <div>郵便番号：{farmerInfo.owner_postcode || "（未登録）"}</div>
                  <div>住所：{farmerInfo.owner_address_line || "（未登録）"}</div>
                  <div>電話番号：{farmerInfo.owner_phone || "（未登録）"}</div> {/* ★追加 */}
                  <div>Email：{farmerInfo.owner_email || "（未登録）"}</div>     {/* ★追加 */}
                </div>
              </div>
              <div className="text-right text-sm font-mono text-gray-500 bg-gray-100 px-3 py-1 rounded h-fit">
                Farm ID: {farmId}
              </div>
            </div>
          </div>
        )}

        {error && <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {loading && <div className="mb-6 text-sm text-gray-600">読み込み中…</div>}

        {!loading && weeks.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold text-gray-600">受け渡し日時</th>
                  <th className="px-5 py-3 text-left font-semibold text-gray-600">ステータス別</th>
                  <th className="px-5 py-3 text-right font-semibold text-gray-600">キャンセル率</th>
                  <th className="px-5 py-3 text-right font-semibold text-gray-600">お米合計（Cのみ）</th>
                  <th className="px-5 py-3 text-right font-semibold text-gray-600">アクション</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {weeks.map((w) => {
                  const denom = w.confirmed_count + w.cancelled_count;
                  const cancelRate = denom === 0 ? null : Math.round((w.cancelled_count / denom) * 100);

                  return (
                    <tr key={`${w.pickup_slot_code}-${w.event_start}`} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4 font-medium text-gray-900">
                        {w.pickup_display}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="text-green-700 bg-green-50 px-2 py-1 rounded font-semibold border border-green-100">
                            確定 {w.confirmed_count}
                          </span>
                          <span className="text-red-700 bg-red-50 px-2 py-1 rounded font-semibold border border-red-100">
                            キャンセル {w.cancelled_count}
                          </span>
                        </div>
                      </td>
                      <td className={`px-5 py-4 text-right font-bold ${getCancelRateClass(cancelRate)}`}>
                        {cancelRate == null ? "-" : `${cancelRate}%`}
                      </td>
                      <td className="px-5 py-4 text-right font-bold text-gray-900">
                        {formatNumber(w.rice_subtotal)} 円
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/reservations/event?farm_id=${farmId}&event_start=${encodeURIComponent(w.event_start)}`)}
                          className="rounded bg-gray-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700 shadow-sm"
                        >
                          詳細を見る →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && farmId !== null && weeks.length === 0 && !error && (
         <div className="mt-6 rounded-lg bg-white p-8 text-center text-gray-500 border border-gray-200">
           この農家の受け渡しイベント（確定またはキャンセルの予約）はまだありません。
         </div>
        )}

      </div>
    </div>
  );
};

export default AdminReservationWeeksPage;