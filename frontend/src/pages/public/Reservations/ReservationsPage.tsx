import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PublicBottomBar } from "@/components/PublicBottomBar";
import { API_BASE } from "@/config/api";
import { LoginBottomSheet } from "@/components/LoginBottomSheet"; // ★追加

const C = {
  ink:       "#1a1108",
  ink2:      "#4b3e2a",
  ink3:      "#7a6c58",
  border:    "#e8e2d8",
  bgPale:    "#f4f1ed",
  bgBase:    "#fdfcfa",
} as const;

type HistoryItem = {
  reservation_id: number;
  farm_id: number;
  farm_name: string;
  last_name?: string | null;
  pickup_display: string;
  total_amount: number;
  status_category: "upcoming" | "completed" | "canceled";
};

export default function ReservationsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [consumerEmail, setConsumerEmail] = useState<string | null>(null);

  const [showAuthModal, setShowAuthModal] = useState(false); // これだけでOK
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        
        const idRes = await fetch(`${API_BASE}/api/consumers/identity`, { credentials: "include" });
        if (!idRes.ok) throw new Error("Not logged in");
        const idData = await idRes.json();
        
        setIsLoggedIn(idData.is_logged_in);

        if (!idData.is_logged_in) {
          setLoading(false);
          return;
        }
        setConsumerEmail(idData.email);

        const histRes = await fetch(`${API_BASE}/api/public/reservations/history`, { credentials: "include" });
        if (histRes.ok) {
          const histData: HistoryItem[] = await histRes.json();
          setItems(histData);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const formatFarmName = (item: HistoryItem) => {
    if (item.last_name) return `${item.last_name}さんのお米`;
    if (item.farm_name.endsWith("農園") || item.farm_name.endsWith("ファーム")) return item.farm_name;
    return `${item.farm_name}さんのお米`;
  };

  const upcomingItems = items.filter((i) => i.status_category === "upcoming");
  const pastItems = items.filter((i) => i.status_category !== "upcoming");

  const renderLayout = (child: React.ReactNode) => (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", backgroundColor: C.bgBase }}>
      <div style={{ flexGrow: 1, padding: "24px 16px 80px", maxWidth: 640, margin: "0 auto", width: "100%" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: C.ink, marginBottom: 20, textAlign: "center" }}>
          予約・履歴
        </h1>
        {child}
      </div>
      <PublicBottomBar consumerEmail={consumerEmail} />
    </div>
  );

  if (loading) {
    return renderLayout(
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
        <div style={{ color: C.ink3, fontWeight: 600 }}>読み込み中...</div>
      </div>
    );
  }

  // 未ログイン時
  if (!isLoggedIn) {
    return renderLayout(
      <>
        <div style={{ textAlign: "center", padding: "48px 0" }}>
          <div style={{ fontSize: 18, color: C.ink, fontWeight: 700, marginBottom: 12 }}>
            ログインして、予約・履歴を確認
          </div>
          <div style={{ fontSize: 14, color: C.ink3, marginBottom: 32, lineHeight: 1.6 }}>
            これまでの予約履歴や、今後の受け取り予定を<br />ここで確認できます。
          </div>
          <button
            onClick={() => setShowAuthModal(true)}
            style={{
              padding: "14px 48px", borderRadius: 8, backgroundColor: "#222222", 
              color: "#fff", border: "none", fontWeight: 600, fontSize: 16, cursor: "pointer",
              transition: "transform 0.1s ease"
            }}
            onMouseDown={(e) => e.currentTarget.style.transform = "scale(0.98)"}
            onMouseUp={(e) => e.currentTarget.style.transform = "scale(1)"}
          >
            ログインまたは登録
          </button>
        </div>

        {/* ★ 共通化されたボトムシートを呼び出すだけ！ */}
        <LoginBottomSheet 
          isOpen={showAuthModal} 
          onClose={() => setShowAuthModal(false)} 
          redirectPath="/reservations" 
        />
      </>
    );
  }

  // ログイン時
  return renderLayout(
    <>
      <div style={{ display: "flex", backgroundColor: "#fff", borderRadius: 9999, padding: 4, border: `1px solid ${C.border}`, marginBottom: 24 }}>
        <button
          onClick={() => setActiveTab("upcoming")}
          style={{
            flex: 1, padding: "10px 0", borderRadius: 9999, border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
            backgroundColor: activeTab === "upcoming" ? C.ink2 : "transparent", color: activeTab === "upcoming" ? "#fff" : C.ink3,
          }}
        >
          予約中
        </button>
        <button
          onClick={() => setActiveTab("past")}
          style={{
            flex: 1, padding: "10px 0", borderRadius: 9999, border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
            backgroundColor: activeTab === "past" ? C.ink2 : "transparent", color: activeTab === "past" ? "#fff" : C.ink3,
          }}
        >
          過去の履歴
        </button>
      </div>

      <div>
        {activeTab === "upcoming" && (
          <div>
            {upcomingItems.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {upcomingItems.map((upcomingItem) => (
                  <div
                    key={upcomingItem.reservation_id}
                    onClick={() => navigate(`/reservation/booked?reservation_id=${upcomingItem.reservation_id}`)}
                    style={{ backgroundColor: "#fff", border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
                  >
                    <div style={{ display: "inline-block", backgroundColor: C.bgPale, color: C.ink2, fontSize: 11, fontWeight: 600, padding: "4px 8px", borderRadius: 9999, marginBottom: 12 }}>受け取り待ち</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 8 }}>{formatFarmName(upcomingItem)}</div>
                    <div style={{ fontSize: 14, color: C.ink, marginBottom: 4, fontWeight: 700 }}>予約日時: {upcomingItem.pickup_display}</div>
                    <div style={{ fontSize: 14, color: C.ink }}>お米代合計: {upcomingItem.total_amount.toLocaleString()}円（現金）</div>
                    <div style={{ marginTop: 16, padding: "12px 0", backgroundColor: C.bgPale, borderRadius: 8, color: C.ink2, fontSize: 13, fontWeight: 700, textAlign: "center" }}>
                      予約詳細を見る ＞
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "48px 0" }}>
                <div style={{ fontSize: 15, color: C.ink, fontWeight: 600, marginBottom: 8 }}>現在、ご予約中の受け渡しはありません。</div>
                <div style={{ fontSize: 13, color: C.ink3, marginBottom: 24 }}>おいしいお米を直接農家から購入してみましょう。</div>
                <button onClick={() => navigate("/farms")} style={{ padding: "12px 32px", borderRadius: 9999, backgroundColor: "#222222", color: "#fff", border: "none", fontWeight: 600, cursor: "pointer" }}>農家を探す</button>
              </div>
            )}
          </div>
        )}

        {activeTab === "past" && (
          <div>
            {pastItems.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {pastItems.map((res) => (
                  <div key={res.reservation_id} style={{ backgroundColor: "#fff", border: `1px solid ${C.border}`, borderRadius: 16, padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{formatFarmName(res)}</div>
                        <div style={{ fontSize: 13, color: C.ink3, fontWeight: 600 }}>{res.pickup_display}</div>
                        <div style={{ fontSize: 13, color: C.ink3, marginTop: 2 }}>お米代合計: {res.total_amount.toLocaleString()}円</div>
                      </div>
                      <div style={{
                        fontSize: 11, fontWeight: 600, padding: "4px 8px", borderRadius: 9999,
                        backgroundColor: res.status_category === "completed" ? C.bgPale : "#fef2f2",
                        color: res.status_category === "completed" ? C.ink2 : "#b91c1c",
                        border: res.status_category === "canceled" ? "1px solid #fee2e2" : "none",
                      }}>
                        {res.status_category === "completed" ? "お取引終了" : "キャンセル"}
                      </div>
                    </div>
                    {res.status_category === "completed" && (
                      <button onClick={() => navigate(`/farms/${res.farm_id}`)} style={{ width: "100%", padding: "10px 0", borderRadius: 9999, backgroundColor: "#fff", color: C.ink2, border: `1px solid ${C.border}`, fontWeight: 600, fontSize: 13, cursor: "pointer", marginTop: 8 }}>
                        もう一度この農家を見る
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "48px 0", color: C.ink3, fontSize: 14 }}>過去の履歴はまだありません。</div>
            )}
          </div>
        )}
      </div>
    </>
  );
}