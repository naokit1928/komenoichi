import React, { useMemo, useRef, useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { API_BASE } from "@/config/api";
import { useFarmDetail } from "./hooks/useFarmDetail";

import FarmDetailHero from "./components/FarmDetailHero";
import FarmDetailBody from "./components/FarmDetailBody";
import FarmDetailCTA from "./components/FarmDetailCTA";

// ★ 注文ルール
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

/* ===== identity ===== */
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

/* ===== state API ===== */
type ConsumerState = {
  is_logged_in: boolean;
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

  const [consumerEmail, setConsumerEmail] =
    useState<string | undefined>(undefined);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
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
  }, []);

  /* ===== Active 判定は state API を正とする ===== */
  const [hasActive, setHasActive] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isLoggedIn) {
      setHasActive(false);
      return;
    }

    (async () => {
      try {
        const state = await fetchConsumerState();
        setHasActive(state.active.exists);
      } catch {
        setHasActive(false);
      }
    })();
  }, [isLoggedIn]);

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
    const ids = loadFavoriteIds();
    setIsFav(ids.includes(farmIdStr));
  }, [farmIdStr]);

  const toggleFavorite = () => {
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
    setSelectedKg(kg);
    setQtyByKg((p) => ({ ...p, [kg]: p[kg] + 1 }));
  };

  const dec = (kg: Kg) => {
    setSelectedKg(kg);
    setQtyByKg((p) => ({ ...p, [kg]: Math.max(0, p[kg] - 1) }));
  };

  const totalKg = calcTotalKg(qtyByKg);
  const isEmptySelection = totalKg === 0;
  const isOverLimit = isOverMaxKg(qtyByKg);
  const isNextDisabled = isEmptySelection || isOverLimit;

  const pickupTextCard = farm?.next_pickup_display ?? "未設定";
  const pickupTextCTA = farm?.next_pickup_display
    ? `次回受け渡し ${farm.next_pickup_display}`
    : "受け渡し日時は未設定です";

  const handleNext = async () => {
    if (!farm || isNextDisabled) return;

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

    // 未ログイン → MagicLink 経由
    if (!isLoggedIn) {
      sessionStorage.setItem("CONFIRM_CTX", JSON.stringify(form));
      navigate(`/login?mode=confirm&farmId=${farmIdStr}`);
      return;
    }

    // アクティブ予約あり
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

  return (
    <>
      <FarmDetailHero
        farmId={farmIdStr}
        photoUrls={photoUrls}
        titleText={titleText}
        isFav={isFav}
        onToggleFav={toggleFavorite}
        onShare={doShare}
        onBack={() => navigate("/farms")} // ★ 一律で /farms へ戻す
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
            onSelectKg={setSelectedKg}
            onInc={inc}
            onDec={dec}
            money={money}
            farm={farm}
            ownerFullName={ownerFullName}
            shortLocation={shortLocation}
            pickupTextCard={pickupTextCard}
            centerLat={centerLat}
            centerLng={centerLng}
          />
        </div>
      </section>

      <FarmDetailCTA
        riceSubtotal={riceSubtotal}
        pickupTextCTA={pickupTextCTA}
        onNext={handleNext}
        money={money}
        disabled={isNextDisabled}
        isOverLimit={isOverLimit}
      />
    </>
  );
}