import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  if (rate == null) return "text-gray-800";
  if (rate >= 30) return "text-red-600 font-semibold";
  if (rate >= 10) return "text-yellow-600 font-semibold";
  return "text-gray-800";
};

type FarmerInfo = {
  owner_last_name?: string;
  owner_first_name?: string;
  owner_last_kana?: string;
  owner_first_kana?: string;
  owner_postcode?: string;
  owner_address_line?: string;
};

type FarmOwnerMatch = {
  farm_id: number;
  owner_full_name: string;
  owner_full_kana: string;
};

const AdminReservationWeeksPage: React.FC = () => {
  const navigate = useNavigate();

  const [farmIdInput, setFarmIdInput] = useState<string>("");
  const [farmId, setFarmId] = useState<number | null>(null);
  const [reservationIdInput, setReservationIdInput] = useState<string>("");

  const [ownerKanaInput, setOwnerKanaInput] = useState<string>("");
  const [ownerKanaMatches, setOwnerKanaMatches] = useState<FarmOwnerMatch[]>([]);
  const [ownerKanaLoading, setOwnerKanaLoading] = useState<boolean>(false);

  const [weeks, setWeeks] = useState<AdminReservationWeekSummary[]>([]);
  const [farmerInfo, setFarmerInfo] = useState<FarmerInfo | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoad = () => {
    const n = Number(farmIdInput);
    if (!Number.isFinite(n) || n <= 0) {
      setError("farm_id が不正です。正の整数を入力してください。");
      return;
    }
    setError(null);
    setFarmId(n);
  };

  const handleOwnerKanaSearch = async () => {
    const q = ownerKanaInput.trim();
    if (!q) {
      setError("owner_kana を入力してください。");
      return;
    }

    setError(null);
    setOwnerKanaLoading(true);
    setOwnerKanaMatches([]);

    try {
      const res = await fetch(
        `${API_BASE}/api/admin/farms/resolve-by-owner-kana?query=${encodeURIComponent(
          q
        )}`
      );
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      const matches: FarmOwnerMatch[] = Array.isArray(data.matches)
        ? data.matches
        : [];
      setOwnerKanaMatches(matches);

      if (matches.length === 0) {
        setError("該当する農家が見つかりませんでした。");
      }
    } catch (e) {
      console.error(e);
      setError("owner_kana からの農家検索に失敗しました。");
    } finally {
      setOwnerKanaLoading(false);
    }
  };

  const handleSelectOwnerMatch = (m: FarmOwnerMatch) => {
    setError(null);
    setOwnerKanaMatches([]);
    setOwnerKanaInput(m.owner_full_kana);
    setFarmIdInput(String(m.farm_id));
    setFarmId(m.farm_id);
  };

  const handleReservationIdSearch = async () => {
    const n = Number(reservationIdInput);
    if (!Number.isFinite(n) || n <= 0) {
      setError("reservation_id が不正です。正の整数を入力してください。");
      return;
    }

    setError(null);

    try {
      const res = await fetch(
        `${API_BASE}/api/admin/reservations/resolve-by-reservation-id?reservation_id=${n}`
      );
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();

      navigate(
        `/admin/reservations/event?farm_id=${data.farm_id}&event_start=${encodeURIComponent(
          data.event_start
        )}&highlight_reservation_id=${data.reservation_id}`
      );
    } catch (e) {
      console.error(e);
      setError("reservation_id からの検索に失敗しました。");
    }
  };

  useEffect(() => {
    if (farmId == null) return;

    const controller = new AbortController();

    const fetchAll = async () => {
      setLoading(true);
      setError(null);
      setFarmerInfo(null);

      try {
        const weeksParams = new URLSearchParams({
          farm_id: String(farmId),
        });

        const weeksRes = await fetch(
          `${API_BASE}/api/admin/reservations/weeks?` +
            weeksParams.toString(),
          { signal: controller.signal }
        );
        if (!weeksRes.ok) {
          throw new Error(`HTTP ${weeksRes.status}`);
        }

        const weeksData: AdminReservationWeekListResponse = await weeksRes.json();
        setWeeks([...(weeksData.items ?? [])].sort((a, b) => new Date(b.event_start).getTime() - new Date(a.event_start).getTime()));


const sorted = [...(weeksData.items ?? [])].sort(
  (a, b) =>
    new Date(b.event_start).getTime() -
    new Date(a.event_start).getTime()
);

setWeeks(sorted);


        const headerParams = new URLSearchParams({
          farm_id: String(farmId),
          limit: "1",
          offset: "0",
        });

        const headerRes = await fetch(
          `${API_BASE}/api/admin/reservations?` +
            headerParams.toString(),
          { signal: controller.signal }
        );

        if (headerRes.ok) {
          const headerData: AdminReservationListResponse =
            await headerRes.json();
          const first: AdminReservationListItemDTO | undefined =
            headerData.items?.[0];

          if (first) {
            setFarmerInfo({
              owner_last_name: first.owner_last_name,
              owner_first_name: first.owner_first_name,
              owner_last_kana: first.owner_last_kana,
              owner_first_kana: first.owner_first_kana,
              owner_postcode: first.owner_postcode,
              owner_address_line: first.owner_address_line,
            });
          } else {
            setFarmerInfo(null);
          }
        } else if (headerRes.status === 404) {
          setFarmerInfo(null);
        } else {
          throw new Error(`HTTP ${headerRes.status}`);
        }
      } catch (e: any) {
        if (e.name === "AbortError") return;
        console.error(e);
        setError(
          "受け渡しイベント一覧の取得に失敗しました。サーバーログを確認してください。"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
    return () => controller.abort();
  }, [farmId]);

  const fullName =
    (farmerInfo?.owner_last_name ?? "") +
    (farmerInfo?.owner_first_name ?? "");
  const fullKana =
    (farmerInfo?.owner_last_kana ?? "") +
    (farmerInfo?.owner_first_kana ?? "");

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-6">
        {/* ヘッダ */}
        <div className="mb-4">
          <h1 className="text-2xl font-semibold text-gray-900">
            予約タイムライン（受け渡し回一覧）
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            農家ごとの「受け渡し1回（FarmerReservationTableの1マス）」単位で、
            キャンセル率と確定予約ベースのお米合計を確認します。
          </p>
        </div>

        {/* farm_id 入力 */}
        <div className="mb-4 flex items-center gap-2 text-sm">
          <label className="text-gray-700">
            farm_id:
            <input
              type="number"
              value={farmIdInput}
              onChange={(e) => setFarmIdInput(e.target.value)}
              className="ml-1 w-24 rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={handleLoad}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            読み込む
          </button>
        </div>


        {/* reservation_id 入力 */}
        <div className="mb-4 flex items-center gap-2 text-sm">
          <label className="text-gray-700">
            reservation_id:
            <input
              type="number"
              value={reservationIdInput}
              onChange={(e) => setReservationIdInput(e.target.value)}
              className="ml-1 w-28 rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={handleReservationIdSearch}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            検索
          </button>
        </div>


        {/* owner_kana 入力 */}
        <div className="mb-4">
          <div className="flex items-center gap-2 text-sm">
            <label className="text-gray-700">
              owner_kana:
              <input
                type="text"
                value={ownerKanaInput}
                onChange={(e) => setOwnerKanaInput(e.target.value)}
                placeholder="例：たなか"
                className="ml-1 w-60 rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </label>

            <button
              type="button"
              onClick={handleOwnerKanaSearch}
              className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              disabled={ownerKanaLoading}
            >
              検索
            </button>

            {ownerKanaLoading && (
              <span className="text-xs text-gray-500">検索中…</span>
            )}
          </div>

          {ownerKanaMatches.length > 0 && (
            <div className="mt-2 grid gap-2">
              {ownerKanaMatches.map((m) => (
                <button
                  key={m.farm_id}
                  type="button"
                  onClick={() => handleSelectOwnerMatch(m)}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-left text-sm hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-gray-900">
                        {m.owner_full_name}
                        <span className="ml-2 text-xs text-gray-500">
                          （{m.owner_full_kana}）
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      farm_id: {m.farm_id}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 農家ヘッダ */}
        {farmerInfo && (
          <div className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-base font-semibold text-gray-900">
                  {fullName || "農家情報"}
                  {fullKana && (
                    <span className="ml-2 text-xs text-gray-500">
                      ({fullKana})
                    </span>
                  )}
                </div>
                <div className="mt-1 space-y-0.5 text-xs text-gray-600">
                  <div>
                    郵便番号：{farmerInfo.owner_postcode || "（未登録）"}
                  </div>
                  <div>
                    住所：
                    {farmerInfo.owner_address_line || "（未登録）"}
                  </div>
                </div>
              </div>
              <div className="text-right text-xs text-gray-500">
                <div>farm_id: {farmId}</div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        {loading && (
          <div className="mb-3 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
            読み込み中…
          </div>
        )}

        {!loading && weeks.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-gray-300 bg-white">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">
                    受け渡し日時
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">
                    ステータス別
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">
                    キャンセル率
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">
                    お米合計（Cのみ）
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">
                    詳細
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {weeks.map((w) => {
                  const denom =
                    w.confirmed_count + w.cancelled_count;
                  const cancelRate =
                    denom === 0
                      ? null
                      : Math.round(
                          (w.cancelled_count / denom) * 100
                        );

                  return (
                    <tr
                      key={`${w.pickup_slot_code}-${w.event_start}`}
                    >
                      <td className="px-4 py-2 align-top text-xs text-gray-900">
                        <div>{w.pickup_display}</div>
                      </td>
                      <td className="px-4 py-2 align-middle text-xs text-gray-800">
                        <span className="font-semibold text-green-600">
                          🟩 確定 {w.confirmed_count}
                        </span>
                        <span className="mx-1 text-gray-400">
                          ｜</span>
                        <span className="font-semibold text-red-600">
                          🟥 キャンセル {w.cancelled_count}
                        </span>
                      </td>
                      <td
                        className={
                          "px-4 py-2 align-middle text-right text-sm " +
                          getCancelRateClass(cancelRate)
                        }
                      >
                        {cancelRate == null
                          ? "-"
                          : `${cancelRate}%`}
                      </td>
                      <td className="px-4 py-2 align-middle text-right text-sm text-gray-900">
                        {formatNumber(w.rice_subtotal)} 円
                      </td>
                      <td className="px-4 py-2 align-middle text-right">
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `/admin/reservations/event?farm_id=${farmId}&event_start=${encodeURIComponent(
                                w.event_start
                              )}`
                            )
                          }
                          className="rounded border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          詳細を見る
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
         <div className="mt-3 text-sm text-gray-600">
           対象の受け渡しイベントはありません。
         </div>
        )}

      </div>
    </div>
  );
};

export default AdminReservationWeeksPage;
