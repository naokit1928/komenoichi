import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FarmCard, type FarmCardData } from "../FarmsList/components/FarmCard";
import { PublicBottomBar } from "@/components/PublicBottomBar";
import Footer from "@/components/Footer";
import { API_BASE } from "@/config/api";

const C = {
  ink:       "#1a1108",
  ink2:      "#4b3e2a",
  ink3:      "#7a6c58",
  border:    "#e8e2d8",
  bgPale:    "#f4f1ed",
  bgBase:    "#fdfcfa",
} as const;

export default function FavoritesPage() {
  const navigate = useNavigate();
  const [farms, setFarms] = useState<FarmCardData[] | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [consumerEmail, setConsumerEmail] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        // 1. ログイン確認
        const idRes = await fetch(`${API_BASE}/api/consumers/identity`, { credentials: "include" });
        if (!idRes.ok) throw new Error("Not logged in");
        const idData = await idRes.json();
        
        if (!idData.is_logged_in) {
          navigate("/login-only?redirect=/favorites", { replace: true });
          return;
        }
        setConsumerEmail(idData.email);

        // 2. お気に入り農家の詳細リストを取得
        const favRes = await fetch(`${API_BASE}/api/public/favorites/farms`, { credentials: "include" });
        if (favRes.ok) {
          const favData = await favRes.json();
          const mapped: FarmCardData[] = favData.farms.map((f: any) => ({
            id: f.farm_id,
            name: f.owner_label,
            price10kg: Number(f.price_10kg || 0),
            avatarUrl: f.face_image_url || "",
            images: f.pr_images || [],
            title: f.pr_title || "",
            addressLabel: f.owner_address_label || "",
            pickupTime: f.next_pickup_display || "",
            lat: f.pickup_lat,
            lng: f.pickup_lng,
          }));
          setFarms(mapped);
          setFavoriteIds(mapped.map(f => String(f.id)));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [navigate]);

  const toggleFav = async (id: number, e?: React.MouseEvent) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    const sid = String(id);
    const isFav = favoriteIds.includes(sid);
    
    setFavoriteIds(prev => isFav ? prev.filter(x => x !== sid) : [...prev, sid]);

    try {
      const method = isFav ? "DELETE" : "POST";
      await fetch(`${API_BASE}/api/public/favorites/${id}`, {
        method,
        credentials: "include",
      });
    } catch (err) {
      setFavoriteIds(prev => isFav ? [...prev, sid] : prev.filter(x => x !== sid));
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", backgroundColor: C.bgBase }}>
      <div style={{ flexGrow: 1 }}>
        
        {/* ★ ロゴの代わりに、「予約・履歴」ページと全く同じフォント指定・サイズ感のヘッダーを配置 */}
        <div style={{ paddingTop: 32, paddingBottom: 16, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.ink, margin: 0 }}>
            お気に入り
          </h1>
          <p style={{ fontSize: 13, color: C.ink3, marginTop: 8 }}>
            保存した農家さんの一覧です。
          </p>
        </div>

        {/* ★ カードの配置（maxWidthやGrid設定）は農家一覧と完全に同一 */}
        <section style={{ padding: "16px 16px 40px", maxWidth: 540, margin: "0 auto" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: C.ink3, fontSize: 14 }}>
              読み込み中...
            </div>
          ) : farms && farms.filter(f => favoriteIds.includes(String(f.id))).length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
              {farms.filter(f => favoriteIds.includes(String(f.id))).map((f) => (
                <Link key={f.id} to={`/farms/${f.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                  <FarmCard farm={f} isFav={true} toggleFav={toggleFav} />
                </Link>
              ))}
            </div>
          ) : (
             <div style={{ textAlign: "center", padding: "48px 0" }}>
              <div style={{ fontSize: 15, color: C.ink, fontWeight: 600, marginBottom: 8 }}>
                お気に入りの農家はまだありません。
              </div>
              <div style={{ fontSize: 13, color: C.ink3, marginBottom: 24, lineHeight: 1.6 }}>
                農家一覧からハートマークを押して、<br />気になったお米を保存しましょう。
              </div>
              <button
                onClick={() => navigate("/farms")}
                style={{ padding: "12px 32px", borderRadius: 9999, backgroundColor: C.ink2, color: "#fff", border: "none", fontWeight: 600, cursor: "pointer" }}
              >
                農家を探す
              </button>
            </div>
          )}
        </section>

      </div>
      <Footer />
      <PublicBottomBar consumerEmail={consumerEmail} />
    </div>
  );
}