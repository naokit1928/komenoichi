// frontend/src/pages/admin/AdminDashboardPage.tsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "@/config/api";
import type { AdminAlertsResponse, AdminReservationListItemDTO } from "../../types/adminReservations";

type FarmOwnerMatch = {
  farm_id: number;
  owner_full_name: string;
  owner_full_kana: string;
};

const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();

  // アラート用State
  const [alerts, setAlerts] = useState<AdminAlertsResponse | null>(null);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [alertError, setAlertError] = useState<string | null>(null);

  // 検索用State
  const [farmIdInput, setFarmIdInput] = useState<string>("");
  const [reservationIdInput, setReservationIdInput] = useState<string>("");
  const [ownerKanaInput, setOwnerKanaInput] = useState<string>("");
  const [ownerKanaMatches, setOwnerKanaMatches] = useState<FarmOwnerMatch[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // --------------------------------------------------------
  // 初期ロード：アラートの取得
  // --------------------------------------------------------
  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/reservations/alerts`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setAlerts(data);
      } catch (err) {
        console.error(err);
        setAlertError("アラートの取得に失敗しました。サーバーログを確認してください。");
      } finally {
        setLoadingAlerts(false);
      }
    };
    fetchAlerts();
  }, []);

  // --------------------------------------------------------
  // 検索ハンドラ
  // --------------------------------------------------------
  const handleFarmSearch = () => {
    const n = Number(farmIdInput);
    if (!Number.isFinite(n) || n <= 0) {
      setSearchError("Farm ID が不正です。正の整数を入力してください。");
      return;
    }
    navigate(`/admin/reservations/weeks?farm_id=${n}`);
  };

  const handleReservationSearch = async () => {
    const n = Number(reservationIdInput);
    if (!Number.isFinite(n) || n <= 0) {
      setSearchError("システム照会ID が不正です。");
      return;
    }
    setSearchError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/reservations/resolve-by-reservation-id?reservation_id=${n}`);
      if (!res.ok) throw new Error("Not Found");
      const data = await res.json();
      navigate(`/admin/reservations/event?farm_id=${data.farm_id}&event_start=${encodeURIComponent(data.event_start)}&highlight_reservation_id=${data.reservation_id}`);
    } catch (e) {
      setSearchError("システム照会ID からの検索に失敗しました。");
    }
  };

  const handleOwnerKanaSearch = async () => {
    const q = ownerKanaInput.trim();
    if (!q) {
      setSearchError("農家名（ひらがな）を入力してください。");
      return;
    }
    setSearchError(null);
    setSearchLoading(true);
    setOwnerKanaMatches([]);
    try {
      const res = await fetch(`${API_BASE}/api/admin/farms/resolve-by-owner-kana?query=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error("API Error");
      const data = await res.json();
      const matches = Array.isArray(data.matches) ? data.matches : [];
      setOwnerKanaMatches(matches);
      if (matches.length === 0) setSearchError("該当する農家が見つかりませんでした。");
    } catch (e) {
      setSearchError("農家検索に失敗しました。");
    } finally {
      setSearchLoading(false);
    }
  };

  // --------------------------------------------------------
  // アラート行の描画ヘルパー
  // --------------------------------------------------------
  const renderAlertRow = (r: AdminReservationListItemDTO) => (
    <div key={r.reservation_id} className="border-b border-gray-200 py-3 last:border-0">
      <div className="flex items-center justify-between mb-1">
        <div className="font-mono text-sm font-semibold text-gray-900">
          #{r.reservation_id}{" "}
          <span className="ml-2 text-xs text-gray-500 font-sans">Farm: {r.farm_id}</span>
        </div>
        <div className="text-xs text-gray-500">
          {r.created_at ? new Date(r.created_at).toLocaleString("ja-JP") : "-"}
        </div>
      </div>
      <div className="text-xs text-gray-700 grid grid-cols-2 gap-2 mt-2">
        <div><span className="text-gray-500">Email:</span> {r.consumer_email || "不明"}</div>
        <div><span className="text-gray-500">Stripe PI:</span> {r.payment_intent_id || "なし"}</div>
        <div><span className="text-gray-500">CS:</span> {r.confirm_session_id || "なし"}</div>
        <div><span className="text-gray-500">Payment:</span> <span className="font-semibold">{r.payment_status || "なし"}</span></div>
      </div>
      <div className="mt-2 text-right">
         <button
            onClick={() => {
              navigate(`/admin/reservations/event?farm_id=${r.farm_id}&event_start=${encodeURIComponent(r.pickup_start)}&highlight_reservation_id=${r.reservation_id}`);
            }}
            className="text-xs text-blue-600 hover:underline"
          >
            予約詳細を見る →
          </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">システム監視ダッシュボード</h1>

        {/* ======================= アラートセクション ======================= */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* 異常検知 (決済済み未確定) */}
          <div className="bg-white rounded-lg border border-red-300 shadow-sm overflow-hidden">
            <div className="bg-red-50 border-b border-red-200 px-4 py-3 flex justify-between items-center">
              <h2 className="font-semibold text-red-800 flex items-center gap-2">
                <span>🚨</span> 決済不整合（Succeeded & Not Confirmed）
              </h2>
              <span className="bg-red-200 text-red-800 text-xs font-bold px-2 py-1 rounded-full">
                {alerts?.payment_anomalies?.length || 0}
              </span>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto">
              {loadingAlerts ? (
                <div className="text-sm text-gray-500">読み込み中...</div>
              ) : alertError ? (
                <div className="text-sm text-red-600">{alertError}</div>
              ) : alerts?.payment_anomalies && alerts.payment_anomalies.length > 0 ? (
                alerts.payment_anomalies.map(renderAlertRow)
              ) : (
                <div className="text-sm text-green-700 font-medium">✅ 現在このエラーは発生していません。</div>
              )}
            </div>
          </div>

          {/* ゾンビ予約 (長期間 PENDING) */}
          <div className="bg-white rounded-lg border border-yellow-300 shadow-sm overflow-hidden">
            <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-3 flex justify-between items-center">
              <h2 className="font-semibold text-yellow-800 flex items-center gap-2">
                <span>🧟</span> ゾンビ予約（1時間以上 PENDING）
              </h2>
              <span className="bg-yellow-200 text-yellow-800 text-xs font-bold px-2 py-1 rounded-full">
                {alerts?.zombies?.length || 0}
              </span>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto">
              {loadingAlerts ? (
                <div className="text-sm text-gray-500">読み込み中...</div>
              ) : alerts?.zombies && alerts.zombies.length > 0 ? (
                alerts.zombies.map(renderAlertRow)
              ) : (
                <div className="text-sm text-green-700 font-medium">✅ ゾンビ予約はありません。</div>
              )}
            </div>
          </div>
        </div>

        {/* ======================= 検索セクション ======================= */}
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span>🔍</span> データ検索・調査
        </h2>
        
        {searchError && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200">{searchError}</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* 左カラム：お客様対応用（通常検索） */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-4 border-b pb-2">📞 お問い合わせ対応</h3>
            
            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-600">農家名（ひらがな）から検索</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={ownerKanaInput} 
                    onChange={(e) => setOwnerKanaInput(e.target.value)} 
                    placeholder="例: たなか" 
                    className="border border-gray-300 rounded px-3 py-1.5 text-sm w-48" 
                  />
                  <button onClick={handleOwnerKanaSearch} disabled={searchLoading} className="bg-gray-800 text-white px-4 py-1.5 rounded text-sm hover:bg-gray-700 disabled:bg-gray-400">検索</button>
                </div>
              </div>

              {ownerKanaMatches.length > 0 && (
                <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
                  {ownerKanaMatches.map((m) => (
                    <button key={m.farm_id} onClick={() => navigate(`/admin/reservations/weeks?farm_id=${m.farm_id}`)} className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm">
                      <span className="font-semibold text-gray-900">{m.owner_full_name}</span>
                      <span className="ml-2 text-xs text-gray-500">({m.owner_full_kana})</span>
                    </button>
                  ))}
                </div>
              )}
              
              <div className="text-xs text-gray-400 mt-4">
                ※農家さんから「来週の予約の件で」と連絡が来た際はこちらから検索してください。
              </div>
            </div>
          </div>

          {/* 右カラム：システム調査用（ID検索） */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-4 border-b pb-2">💻 システム調査・ログ照合</h3>
            
            <div className="space-y-5">
              {/* ★変更：Reservation ID を システム照会ID に統一 */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-600">システム照会ID から直接開く</label>
                <div className="flex gap-2">
                  <input 
                    type="number" 
                    value={reservationIdInput} 
                    onChange={(e) => setReservationIdInput(e.target.value)} 
                    placeholder="例: 100" 
                    className="border border-gray-300 rounded px-3 py-1.5 text-sm w-48" 
                  />
                  <button onClick={handleReservationSearch} className="bg-gray-800 text-white px-4 py-1.5 rounded text-sm hover:bg-gray-700">開く</button>
                </div>
                <div className="text-[10px] text-gray-500">Stripeやエラーログに出ている照会ID（旧：予約ID）を直接調べます。</div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-600">Farm ID から直接開く</label>
                <div className="flex gap-2">
                  <input 
                    type="number" 
                    value={farmIdInput} 
                    onChange={(e) => setFarmIdInput(e.target.value)} 
                    placeholder="例: 1" 
                    className="border border-gray-300 rounded px-3 py-1.5 text-sm w-48" 
                  />
                  <button onClick={handleFarmSearch} className="bg-gray-800 text-white px-4 py-1.5 rounded text-sm hover:bg-gray-700">開く</button>
                </div>
                <div className="text-[10px] text-gray-500">農家IDが事前にわかっている場合のショートカットです。</div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AdminDashboardPage;