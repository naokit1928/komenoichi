// src/pages/public/FarmDetail/FarmDetailPage.tsx
import React, { useMemo, useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import type { PublicFarmDetailDTO } from "../../../types/publicFarmDetail";
import { API_BASE } from "@/config/api";


// 追加：カード用コンポーネント
import FarmDetailPriceCard from "./FarmDetailPriceCard";
import FarmDetailProfileCard from "./FarmDetailProfileCard";
import FarmDetailPickupTimeCard from "./FarmDetailPickupTimeCard";
import FarmDetailAreaMapCard from "./FarmDetailAreaMapCard";


// ---- 収穫年度・住所ユーティリティ ----

// 収穫年度の自動計算（9月1日〜12月31日 → その年産 / 1月1日〜8月31日 → 前年産）
// ※ 現在はバックエンドで計算済み harvest_year を受け取り、表示のみで利用。
function calcHarvestYear(): number {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  return month >= 9 ? year : year - 1;
}

// 住所から「都道府県＋市区町村」だけ抜き出す（例：徳島県徳島市）
// ※ 現在は owner_address_label（例: "徳島県徳島市伊月町の農家"）をそのまま表示に利用。
// function extractPrefCity(address?: string | null): string | null {
//   if (!address) return null;
//   const marks = ["市", "区", "郡", "町", "村"];
//   let cut = -1;
//   for (const ch of marks) {
//     const idx = address.indexOf(ch);
//     if (idx !== -1 && (cut === -1 || idx < cut)) {
//       cut = idx;
//     }
//   }
//   if (cut === -1) return address;
//   return address.slice(0, cut + 1);
// }

// ---- LocalStorage: お気に入り ----
const FAVORITES_KEY = "favoriteFarms";
const loadFavoriteIds = (): string[] => {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
};
const saveFavoriteIds = (ids: string[]) => {
  try {
    localStorage.setItem(
      FAVORITES_KEY,
      JSON.stringify(Array.from(new Set(ids)))
    );
  } catch {}
};

type Kg = 5 | 10 | 25;

// ==============================
// 価格はバックエンド V2 の PublicFarmDetailDTO
// （price_5kg / 10kg / 25kg）をそのまま利用。
// フロント側での計算や /pricing/preview 呼び出しは行わない。
// ==============================



export default function FarmDetailPage() {
  const { farmId } = useParams();
  const farmIdStr = String(farmId ?? "");
  const navigate = useNavigate();

  // 実データ
  const [farm, setFarm] = useState<PublicFarmDetailDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // オーナー姓＋名（PublicFarmDetailDTO.owner_full_name から取得）
  const [ownerFullName, setOwnerFullName] = useState<string | null>(null);

  // 価格（初期はnull：ダミー禁止）
  const [prices, setPrices] = useState<{
    5: number | null;
    10: number | null;
    25: number | null;
  }>({
    5: null,
    10: null,
    25: null,
  });

  // 初回ロード：Public V2 API から詳細1件取得
  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        setLoading(true);
        setErrorMsg(null);
        setOwnerFullName(null);

        // V2 公開用詳細の取得
        const res = await fetch(
          `${API_BASE}/api/public/farms/${encodeURIComponent(farmIdStr)}`
        );
        if (!res.ok) {
          throw new Error(
            `failed to fetch public farm detail: ${res.status}`
          );
        }

        const json: {
          ok?: boolean;
          farm?: PublicFarmDetailDTO | null;
          error_code?: string | null;
          message?: string | null;
        } = await res.json();

        if (abort) return;

        if (!json.ok || !json.farm) {
          setFarm(null);
          setPrices({ 5: null, 10: null, 25: null });
          setErrorMsg(
            json.message ||
              "指定された農家は見つからないか、現在は公開されていません。"
          );
          return;
        }

        const data = json.farm;
        setFarm(data);

        // オーナー氏名は DTO からそのまま利用
        const fullName = (data.owner_full_name || "").trim();
        setOwnerFullName(fullName || null);

        // 価格は DTO の price_5kg / 10kg / 25kg をそのまま利用
        const p5 =
          typeof data.price_5kg === "number" &&
          Number.isFinite(data.price_5kg)
            ? data.price_5kg
            : null;
        const p10 =
          typeof data.price_10kg === "number" &&
          Number.isFinite(data.price_10kg)
            ? data.price_10kg
            : null;
        const p25 =
          typeof data.price_25kg === "number" &&
          Number.isFinite(data.price_25kg)
            ? data.price_25kg
            : null;

        setPrices({ 5: p5, 10: p10, 25: p25 });
      } catch (e: any) {
        if (!abort) {
          setErrorMsg("データ取得に失敗しました");
          setFarm(null);
          setPrices({ 5: null, 10: null, 25: null });
        }
      } finally {
        if (!abort) setLoading(false);
      }
    })();
    return () => {
      abort = true;
    };
  }, [farmIdStr]);

  // 数量：サイズ別独立
  const [selectedKg, setSelectedKg] = useState<Kg>(10);
  const [qtyByKg, setQtyByKg] = useState<{ 5: number; 10: number; 25: number }>(
    {
      5: 0,
      10: 1,
      25: 0,
    }
  );

  const sizes = useMemo(
    () =>
      ([
        { kg: 5 as Kg, label: "白米5kg", price: prices[5] },
        { kg: 10 as Kg, label: "白米10kg", price: prices[10] },
        { kg: 25 as Kg, label: "白米25kg", price: prices[25] },
      ] as const),
    [prices]
  );

  const riceSubtotal = sizes.reduce(
    (sum, s) => (s.price != null ? sum + s.price * qtyByKg[s.kg] : sum),
    0
  );
  const serviceFee = 300;
  const money = (n: number) => n.toLocaleString();

  const inc = (kg: Kg) => {
    setSelectedKg(kg);
    setQtyByKg((p) => ({ ...p, [kg]: p[kg] + 1 }));
  };
  const dec = (kg: Kg) => {
    setSelectedKg(kg);
    setQtyByKg((p) => ({ ...p, [kg]: Math.max(0, p[kg] - 1) }));
  };

  const handleNext = () => {
    if (!farm) return;
    const total = riceSubtotal + serviceFee;

    // ★ ここで pickup_slot_code / next_pickup_display / next_pickup_deadline を ConfirmPage に渡す
    const pickupSlotCode = farm.pickup_slot_code ?? null;
    const nextPickupDisplay = farm.next_pickup_display ?? null;
    const clientNextPickupDeadlineIso = farm.next_pickup_deadline ?? null;

    navigate(`/farms/${farmId}/confirm`, {
      state: {
        farmId: farmIdStr,
        riceSubtotal,
        serviceFee,
        total,
        items: sizes.map((s) => ({
          kg: s.kg,
          unitPrice: s.price,
          qty: qtyByKg[s.kg],
        })),
        pickupSlotCode,
        nextPickupDisplay,
        clientNextPickupDeadlineIso,
      },
    });
  };

  // 表示用
  const titleText = farm?.pr_title ?? null;
  const goodRateText =
    (farm as any)?.good_rate != null ? `${(farm as any).good_rate}%` : null;
  const dealsCountText =
    (farm as any)?.deals_count != null
      ? `${(farm as any).deals_count}件`
      : null;
  const pickupTextCard = farm?.next_pickup_display ?? "未設定";
  const pickupTextCTA = farm?.next_pickup_display
    ? `次回受け渡し ${farm.next_pickup_display}`
    : "受け渡し日時は未設定です";

  const harvestYear = farm?.harvest_year ?? calcHarvestYear();

  // 住所ラベル（例: "徳島県徳島市伊月町の農家"）を短い所在地として利用
  const shortLocation = useMemo(
    () => farm?.owner_address_label ?? null,
    [farm?.owner_address_label]
  );

  // 写真（未設定なら何も出さない＝ダミー無し）
  const photoUrls: string[] = useMemo(
    () => (farm?.pr_images?.length ? farm.pr_images : []),
    [farm]
  );
  const [slideIndex, setSlideIndex] = useState(0);

  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) =>
    setTouchStartX(e.touches[0].clientX);
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (dx > 40)
      setSlideIndex((i) => (i - 1 + photoUrls.length) % photoUrls.length);
    if (dx < -40)
      setSlideIndex((i) => (i + 1) % photoUrls.length);
    setTouchStartX(null);
  };

  const [mouseStartX, setMouseStartX] = useState<number | null>(null);
  const onMouseDown = (e: React.MouseEvent) =>
    setMouseStartX(e.clientX);
  const finishMouseSwipe = (clientX: number) => {
    if (mouseStartX == null) return;
    const dx = clientX - mouseStartX;
    if (dx > 50)
      setSlideIndex((i) => (i - 1 + photoUrls.length) % photoUrls.length);
    if (dx < -50)
      setSlideIndex((i) => (i + 1) % photoUrls.length);
    setMouseStartX(null);
  };
  const onMouseUp = (e: React.MouseEvent) =>
    finishMouseSwipe(e.clientX);
  const onMouseLeave = (e: React.MouseEvent) =>
    finishMouseSwipe(e.clientX);

  // お気に入り
  const [isFav, setIsFav] = useState(false);
  const favAnimatingRef = useRef(false);
  useEffect(() => {
    const ids = loadFavoriteIds();
    setIsFav(ids.includes(farmIdStr));
  }, [farmIdStr]);
  const toggleFavorite = () => {
    const ids = loadFavoriteIds();
    if (ids.includes(farmIdStr)) {
      saveFavoriteIds(ids.filter((id) => id !== farmIdStr));
      setIsFav(false);
    } else {
      ids.push(farmIdStr);
      saveFavoriteIds(ids);
      setIsFav(true);
      favAnimatingRef.current = true;
      setTimeout(() => (favAnimatingRef.current = false), 300);
    }
  };

  const doShare = async () => {
    const url = (farm as any)?.share_url || window.location.href;
    const shareData = {
      title: titleText ?? undefined,
      text: "米直売＠徳島｜農家の詳細ページ",
      url,
    };
    try {
      if ((navigator as any).share) {
        await (navigator as any).share(shareData);
      } else {
        await navigator.clipboard.writeText(url);
        alert("ページURLをコピーしました。");
      }
    } catch {}
  };

  const centerLat = farm?.pickup_lat ?? undefined;
  const centerLng = farm?.pickup_lng ?? undefined;

  const riceBagIcon = undefined as string | undefined;

  return (
    <>
      {/* ===== ヒーロー写真（3:2固定） ===== */}
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        // ビューポート端まで広げ、上・左右の余白をなくす
        style={{
          position: "relative",
          width: "100vw",
          margin: "0 calc(50% - 50vw)",
          background: "#000",
          overflow: "hidden",
          userSelect: "none",
          marginTop: "-8px",
        }}
      >
        <div
          style={{
            width: "100%",
            aspectRatio: "3 / 2",
            overflow: "hidden",
            background: photoUrls.length ? "#000" : "#e5e7eb",
          }}
        >
          {photoUrls.length > 0 ? (
            <img
              src={photoUrls[slideIndex]}
              alt={`カバーフォト ${slideIndex + 1}`}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          ) : (
            <div style={{ width: "100%", height: "100%" }} />
          )}
        </div>

        {photoUrls.length > 0 && (
          <div
            style={{
              position: "absolute",
              right: 12,
              bottom: 12,
              padding: "6px 10px",
              borderRadius: 9999,
              background: "rgba(0,0,0,0.55)",
              color: "#fff",
              fontSize: 12,
            }}
          >
            {slideIndex + 1} / {photoUrls.length}
          </div>
        )}

        <Link
          to="/farms"
          aria-label="農家一覧に戻る"
          title="戻る"
          style={{
            position: "absolute",
            left: 12,
            top: 12,
            width: 38,
            height: 38,
            borderRadius: 9999,
            border: "1px solid rgba(0,0,0,0.08)",
            background: "rgba(255,255,255,0.95)",
            color: "#111827",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textDecoration: "none",
            boxShadow: "0 4px 10px rgba(0,0,0,0.12)",
            fontSize: 18,
          }}
        >
          ‹
        </Link>

        <div
          style={{
            position: "absolute",
            right: 12,
            top: 12,
            display: "flex",
            gap: 8,
          }}
        >
          <button
            onClick={doShare}
            aria-label="ページを共有"
            title="共有"
            style={{
              width: 38,
              height: 38,
              borderRadius: 9999,
              border: "1px solid rgba(0,0,0,0.08)",
              background: "rgba(255,255,255,0.95)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 4px 10px rgba(0,0,0,0.12)",
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#111827"
              strokeWidth="1.8"
            >
              <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
              <path d="M16 6l-4-4-4 4" />
              <path d="M12 2v14" />
            </svg>
          </button>

          <button
            onClick={toggleFavorite}
            aria-pressed={isFav}
            aria-label={isFav ? "お気に入りから削除" : "お気に入りに追加"}
            title={isFav ? "お気に入りから削除" : "お気に入りに追加"}
            style={{
              width: 38,
              height: 38,
              borderRadius: 9999,
              border: "1px solid rgba(0,0,0,0.08)",
              background: "rgba(255,255,255,0.95)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              padding: 0,
              boxShadow: "0 4px 10px rgba(0,0,0,0.12)",
              transition: "transform 0.15s ease",
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill={isFav ? "#dc2626" : "none"}
              stroke={isFav ? "#dc2626" : "#111827"}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20.84 4.61c-1.54-1.4-3.97-1.33-5.43.15L12 8.17l-3.41-3.4c-1.46-1.48-3.89-1.55-5.43-.15-1.74 1.58-1.82 4.28-.18 5.96l3.32 3.44L12 20.5l5.7-6.04 3.32-3.44c1.64-1.68 1.56-4.38-.18-5.96z" />
            </svg>
          </button>
        </div>

        {photoUrls.length > 0 && (
          <>
            <button
              onClick={() =>
                setSlideIndex(
                  (i) => (i - 1 + photoUrls.length) % photoUrls.length
                )
              }
              aria-label="前の写真"
              style={{
                position: "absolute",
                left: 6,
                top: "50%",
                transform: "translateY(-50%)",
                width: 32,
                height: 32,
                borderRadius: 9999,
                border: "1px solid rgba(255,255,255,0.35)",
                background: "rgba(255,255,255,0.65)",
                color: "#111827",
                cursor: "pointer",
                opacity: 0.55,
              }}
            >
              ‹
            </button>
            <button
              onClick={() =>
                setSlideIndex(
                  (i) => (i + 1) % photoUrls.length
                )
              }
              aria-label="次の写真"
              style={{
                position: "absolute",
                right: 6,
                top: "50%",
                transform: "translateY(-50%)",
                width: 32,
                height: 32,
                borderRadius: 9999,
                border: "1px solid rgba(255,255,255,0.35)",
                background: "rgba(255,255,255,0.65)",
                color: "#111827",
                cursor: "pointer",
                opacity: 0.55,
              }}
            >
              ›
            </button>
          </>
        )}
      </div>

      {/* ===== 本文 ===== */}
      <section
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "0 16px 116px 16px",
          background: "#f8fafc",
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: "18px 18px 0 0",
            marginTop: -18,
            padding: "40px 16px 16px",
            border: "1px solid #e5e7eb",
            borderBottom: "none",
            boxShadow: "0 -6px 18px rgba(0,0,0,0.06)",
          }}
        >
          {titleText && (
            <h1
              style={{
                textAlign: "center",
                fontSize: 20,
                fontWeight: 700,
                margin: "4px 0 8px",
                lineHeight: 1.35,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical" as any,
                overflow: "hidden",
              }}
              title={titleText}
            >
              {titleText}
            </h1>
          )}

          {/* タイトル直下：年度＋銘柄を中央表示 */}
          {farm?.rice_variety_label && (
            <div
              style={{
                textAlign: "center",
                fontSize: 15,
                fontWeight: 700,
                color: "#111827",
                marginTop: 4,
                marginBottom: 8,
              }}
            >
              {harvestYear}年産　{farm.rice_variety_label}
            </div>
          )}

          {(goodRateText || dealsCountText) && (
            <div
              style={{
                textAlign: "center",
                fontSize: 12.5,
                color: "#6b7280",
                marginBottom: 14,
              }}
            >
              {goodRateText && (
                <span style={{ color: "#111827" }}>
                  good率 {goodRateText}
                </span>
              )}
              {goodRateText && dealsCountText && (
                <span style={{ margin: "0 6px" }}>・</span>
              )}
              {dealsCountText && (
                <span style={{ color: "#111827" }}>
                  取引 {dealsCountText}
                </span>
              )}
            </div>
          )}

          {/* 価格カード（分離済みコンポーネント） */}
          <FarmDetailPriceCard
            loading={loading}
            errorMsg={errorMsg}
            sizes={sizes}
            selectedKg={selectedKg}
            qtyByKg={qtyByKg}
            onSelectKg={setSelectedKg}
            onInc={inc}
            onDec={dec}
            money={money}
          />

          {/* プロフィール＋PR文カード（分離済み） */}
          <FarmDetailProfileCard
            farm={farm}
            ownerFullName={ownerFullName}
            shortLocation={shortLocation}
            faceImageUrl={farm?.face_image_url}
          />

          {/* 次回受け渡し日時カード（分離済み） */}
          <FarmDetailPickupTimeCard pickupTextCard={pickupTextCard} />

          {/* 受け渡しエリア（ミニマップ）カード（分離済み） */}
          <FarmDetailAreaMapCard
            centerLat={centerLat}
            centerLng={centerLng}
            riceBagIcon={riceBagIcon}
          />
        </div>
      </section>

      {/* ===== 下固定CTA（米代のみ表示） ===== */}
      <div
        role="region"
        aria-label="予約CTA"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          background: "#ffffff",
          borderTop: "1px solid #e5e7eb",
          boxShadow: "0 -4px 12px rgba(0,0,0,0.06)",
          padding: "16px 22px",
          zIndex: 50,
        }}
      >
        <div
          style={{
            maxWidth: 720,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            gap: 16,
            paddingLeft: 12,
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 13,
                color: "#6b7280",
                marginBottom: 2,
              }}
            >
              お米代合計
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 800,
                lineHeight: 1.2,
              }}
            >
              {money(riceSubtotal)}円
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 13,
                color: "#6b7280",
              }}
            >
              {pickupTextCTA}
            </div>
          </div>
          <button
            onClick={handleNext}
            title="予約内容を確認"
            style={{
              minWidth: 184,
              padding: "11px 16px",
              background: "#1f7a36",
              color: "#fff",
              borderRadius: 9999,
              border: "none",
              outline: "none",
              boxShadow: "none",
              fontWeight: 600,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            予約内容を確認
          </button>
        </div>
      </div>
    </>
  );
}
