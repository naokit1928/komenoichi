import React, { useMemo, useRef, useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { API_BASE } from "@/config/api";
import { useFarmDetail } from "./hooks/useFarmDetail";

import FarmDetailHero from "./components/FarmDetailHero";
import FarmDetailBody from "./components/FarmDetailBody";
import FarmDetailCTA from "./components/FarmDetailCTA";

import { calcTotalKg, isOverMaxKg } from "./rules/orderRules";

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

async function fetchIdentity(): Promise<{
  is_logged_in: boolean;
  email: string | null;
} | null> {
  const res = await fetch(`${API_BASE}/api/consumers/identity`, {
    credentials: "include",
  });
  if (!res.ok) return null;
  return res.json();
}

type ConsumerState = {
  is_logged_in: boolean;
  penalty: {
    status: "none" | "locked_requestable" | "locked_cooling" | "banned";
    no_show_count: number;
  };
  pending: {
    exists: boolean;
    reservation_id: number | null;
    farm_id: number | null;
  };
  active: {
    exists: boolean;
    reservation_id: number | null;
    farm_id: number | null;
  };
};

async function fetchConsumerState(): Promise<ConsumerState> {
  const res = await fetch(`${API_BASE}/api/consumer/state`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("state の取得に失敗しました");
  return res.json();
}

export default function FarmDetailPage() {
  const { farmId } = useParams();
  const farmIdStr = String(farmId ?? "");
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();
  const isPreview = searchParams.get("preview") === "true";

  const [consumerEmail, setConsumerEmail] =
    useState<string | undefined>(undefined);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    if (isPreview) return;
    async function run() {
      const data = await fetchIdentity();
      if (data?.is_logged_in) {
        setIsLoggedIn(true);
        if (data.email) setConsumerEmail(data.email);
      } else {
        setIsLoggedIn(false);
      }
    }
    run();
  }, [isPreview]);

  const [hasActive, setHasActive] = useState<boolean | null>(null);
  const [penalty, setPenalty] = useState<ConsumerState["penalty"] | null>(null);
  const [pardoning, setPardoning] = useState(false);

  useEffect(() => {
    if (isPreview || !isLoggedIn) {
      setHasActive(false);
      setPenalty(null);
      return;
    }
    (async () => {
      try {
        const state = await fetchConsumerState();
        setHasActive(state.active.exists);
        setPenalty(state.penalty); 
      } catch {
        setHasActive(false);
        setPenalty(null);
      }
    })();
  }, [isLoggedIn, isPreview]);

  const {
    farm,
    loading,
    errorMsg,
    prices,
    harvestYear,
    ownerFullName,
    shortLocation,
    photoUrls,
  } = useFarmDetail(farmIdStr);

  const [isFav, setIsFav] = useState(false);
  const favAnimatingRef = useRef(false);

  useEffect(() => {
    if (isPreview) return;
    const ids = loadFavoriteIds();
    setIsFav(ids.includes(farmIdStr));
  }, [farmIdStr, isPreview]);

  const toggleFavorite = () => {
    if (isPreview) return;
    const ids = loadFavoriteIds();
    if (ids.includes(farmIdStr)) {
      saveFavoriteIds(ids.filter((id) => id !== farmIdStr));
      setIsFav(false);
    } else {
      saveFavoriteIds([...ids, farmIdStr]);
      setIsFav(true);
      favAnimatingRef.current = true;
      setTimeout(() => (favAnimatingRef.current = false), 300);
    }
  };

  const titleText = farm?.pr_title ?? null;

  const doShare = async () => {
    if (isPreview) return;
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

  const [selectedKg, setSelectedKg] = useState<Kg>(10);
  const [qtyByKg, setQtyByKg] = useState<{ 5: number; 10: number; 25: number }>({
    5: 0,
    10: 0,
    25: 0,
  });

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
    if (isPreview) return;
    setSelectedKg(kg);
    setQtyByKg((p) => ({ ...p, [kg]: p[kg] + 1 }));
  };

  const dec = (kg: Kg) => {
    if (isPreview) return;
    setSelectedKg(kg);
    setQtyByKg((p) => ({ ...p, [kg]: Math.max(0, p[kg] - 1) }));
  };

  const totalKg = calcTotalKg(qtyByKg);
  const isEmptySelection = totalKg === 0;
  const isOverLimit = isOverMaxKg(qtyByKg);
  const isNextDisabled = isPreview || isEmptySelection || isOverLimit;

  const pickupTextCard = farm?.next_pickup_display ?? "未設定";
  const pickupTextCTA = farm?.next_pickup_display
    ? `次回受け渡し ${farm.next_pickup_display}`
    : "受け渡し日時は未設定です";

  // ★ 変更: 丁寧な確認ダイアログ（24時間→通常数日に変更）
  const handlePardon = async () => {
    if (!window.confirm("制限の解除を申請しますか？\n※システムの反映には通常数日かかる場合があります。")) return;
    setPardoning(true);
    try {
      const res = await fetch(`${API_BASE}/api/consumer/pardon`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("申請に失敗しました。");
      const newState = await fetchConsumerState();
      setPenalty(newState.penalty);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setPardoning(false);
    }
  };

  const handleNext = async () => {
    if (isPreview || !farm || isNextDisabled) return;

    const form = {
      farm_id: Number(farmIdStr),
      pickup_slot_code: farm.pickup_slot_code,
      pickup_display: farm.next_pickup_display,
      items: sizes
        .filter((s) => qtyByKg[s.kg] > 0)
        .map((s) => ({
          size_kg: s.kg,
          quantity: qtyByKg[s.kg],
        })),
      client_next_pickup_deadline_iso: farm.next_pickup_deadline ?? null,
    };

    if (!isLoggedIn) {
      sessionStorage.setItem("CONFIRM_CTX", JSON.stringify(form));
      navigate(`/login?mode=confirm&farmId=${farmIdStr}`);
      return;
    }

    if (hasActive) {
      navigate(`/farms/${farmIdStr}/active`);
      return;
    }

    const res = await fetch(`${API_BASE}/api/confirm/sessions`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      alert("予約セッションの作成に失敗しました");
      return;
    }

    const data = await res.json();
    const cs = data.confirm_session_id;
    if (!cs) {
      alert("confirm_session_id が取得できません");
      return;
    }

    navigate(`/farms/${farmIdStr}/confirm?cs=${encodeURIComponent(cs)}`);
  };

  const centerLat = farm?.pickup_lat ?? undefined;
  const centerLng = farm?.pickup_lng ?? undefined;

  const isAccepting = farm?.is_accepting_reservations === undefined 
    ? true 
    : Boolean(farm.is_accepting_reservations);

  return (
    <>
      <FarmDetailHero
        farmId={farmIdStr}
        photoUrls={photoUrls}
        titleText={titleText}
        isFav={isFav}
        onToggleFav={toggleFavorite}
        onShare={doShare}
        onBack={() => {
          if (isPreview) return;
          navigate("/farms");
        }}
      />

      <section
        style={{
          width: "100vw",
          margin: "0 calc(50% - 50vw)",
          background: "#ffffff",
          padding: "24px 0 116px",
        }}
      >
        <div
          style={{
            maxWidth: 520,
            margin: "0 auto",
            padding: "0 16px",
          }}
        >
          <FarmDetailBody
            titleText={titleText}
            harvestYear={harvestYear}
            riceVarietyLabel={farm?.rice_variety_label}
            loading={loading}
            errorMsg={errorMsg}
            sizes={sizes}
            selectedKg={selectedKg}
            qtyByKg={qtyByKg}
            onSelectKg={isPreview ? () => {} : setSelectedKg}
            onInc={inc}
            onDec={dec}
            money={money}
            farm={farm}
            ownerFullName={ownerFullName}
            shortLocation={shortLocation}
            pickupTextCard={pickupTextCard}
            centerLat={centerLat}
            centerLng={centerLng}
            isAccepting={isAccepting}
          />
        </div>
      </section>

      {/* ★ 変更: ペナルティUI（完全BAN時は無機質に、解除待機は「数日」に変更） */}
      {isAccepting ? (
        penalty?.status === "banned" ? (
          <div
            style={{
              position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
              background: "rgba(255, 255, 255, 0.95)",
              backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
              borderTop: "1px solid #e5e7eb",
              padding: "16px 20px calc(16px + env(safe-area-inset-bottom))",
              textAlign: "center", boxShadow: "0 -4px 20px rgba(0,0,0,0.05)",
            }}
          >
            {/* ★ 赤色や怒りの表現を消し、無機質なグレーでシャットアウト */}
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#4b5563" }}>
              現在、このアカウントからはご予約手続きを行うことができません。
            </p>
          </div>
        ) : penalty?.status === "locked_cooling" ? (
          <div
            style={{
              position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
              background: "rgba(255, 255, 255, 0.95)",
              backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
              borderTop: "1px solid #e5e7eb",
              padding: "16px 20px calc(16px + env(safe-area-inset-bottom))",
              textAlign: "center", boxShadow: "0 -4px 20px rgba(0,0,0,0.05)",
            }}
          >
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#4b5563" }}>
              制限の解除申請を受け付けました。
            </p>
            {/* ★ 24時間ではなく「通常数日」に変更 */}
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
              システムの反映には通常数日かかります。<br/>恐れ入りますが、日を改めて再度ご予約をお試しください。
            </p>
          </div>
        ) : penalty?.status === "locked_requestable" ? (
          <div
            style={{
              position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
              background: "rgba(255, 255, 255, 0.95)",
              backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
              borderTop: "1px solid #fecaca",
              padding: "12px 20px calc(12px + env(safe-area-inset-bottom))",
              textAlign: "center", boxShadow: "0 -4px 20px rgba(0,0,0,0.05)",
            }}
          >
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#dc2626", lineHeight: 1.4 }}>
              農家より複数回の無断キャンセルが報告されたため、現在一時的に予約が制限されています。
            </p>
            <p style={{ margin: "4px 0 10px", fontSize: 11, color: "#7f1d1d", lineHeight: 1.4 }}>
              ※もし無断キャンセルに心当たりがない場合、または今後の確実なお受け取りをお約束いただける場合は、以下のボタンより制限の解除を申請してください。
            </p>
            <button
              onClick={handlePardon}
              disabled={pardoning}
              style={{
                width: "100%", maxWidth: 400, padding: "10px",
                background: "#ffffff", color: "#dc2626", border: "1px solid #fca5a5",
                borderRadius: 8, fontSize: 13, fontWeight: 700,
                cursor: pardoning ? "not-allowed" : "pointer",
                opacity: pardoning ? 0.6 : 1,
              }}
            >
              {pardoning ? "処理中..." : "制限の解除を申請する"}
            </button>
          </div>
        ) : (
          <FarmDetailCTA
            riceSubtotal={riceSubtotal}
            pickupTextCTA={pickupTextCTA}
            onNext={handleNext}
            money={money}
            disabled={isNextDisabled}
            isOverLimit={isOverLimit}
          />
        )
      ) : (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 50,
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            borderTop: "1px solid #e8e2d8",
            padding: "16px 20px calc(16px + env(safe-area-inset-bottom))",
            textAlign: "center",
            boxShadow: "0 -4px 20px rgba(0,0,0,0.05)",
          }}
        >
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#C62828" }}>
            現在、こちらの農家さんは予約受付をお休みしています
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#7a6c58", lineHeight: 1.5 }}>
            在庫調整や農作業のため、農家さん自身が一時的に予約をストップしています。<br />
            次回の受付再開をお待ちください。
          </p>
        </div>
      )}
    </>
  );
}