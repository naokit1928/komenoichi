import { useEffect, useMemo, useState } from "react";
import type { PublicFarmDetailDTO } from "../../../../types/publicFarmDetail";
import { API_BASE } from "@/config/api";

/**
 * 収穫年度のフォールバック計算
 * ※ 原則は backend の harvest_year を信頼
 */
function calcHarvestYearFallback(): number {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  return month >= 9 ? year : year - 1;
}

type Prices = {
  5: number | null;
  10: number | null;
  25: number | null;
};

type UseFarmDetailResult = {
  farm: PublicFarmDetailDTO | null;
  loading: boolean;
  errorMsg: string | null;

  prices: Prices;
  harvestYear: number;

  ownerFullName: string | null;
  shortLocation: string | null;

  photoUrls: string[];
};

/**
 * Farm detail 取得 + 表示用正規化 hook
 *
 * - Render / Vercel 安定運用前提
 * - race condition / unmount 対策済み
 * - 「表示に必要な最小限の整形」までを責務とする
 */
export function useFarmDetail(
  farmId: string | undefined
): UseFarmDetailResult {
  const farmIdStr = String(farmId ?? "");

  const [farm, setFarm] = useState<PublicFarmDetailDTO | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [prices, setPrices] = useState<Prices>({
    5: null,
    10: null,
    25: null,
  });

  const [ownerFullName, setOwnerFullName] = useState<string | null>(null);

  useEffect(() => {
    if (!farmIdStr) {
      setFarm(null);
      setPrices({ 5: null, 10: null, 25: null });
      setOwnerFullName(null);
      setErrorMsg("農家IDが不正です");
      setLoading(false);
      return;
    }

    let aborted = false;

    (async () => {
      try {
        setLoading(true);
        setErrorMsg(null);
        setFarm(null);
        setOwnerFullName(null);
        setPrices({ 5: null, 10: null, 25: null });

        const res = await fetch(
          `${API_BASE}/api/public/farms/${encodeURIComponent(farmIdStr)}`,
          {
            method: "GET",
            credentials: "omit",
            cache: "no-store",
          }
        );

        if (!res.ok) {
          throw new Error(`fetch failed: ${res.status}`);
        }

        const json: {
          ok?: boolean;
          farm?: PublicFarmDetailDTO | null;
          message?: string | null;
        } = await res.json();

        if (aborted) return;

        if (!json.ok || !json.farm) {
          setErrorMsg(
            json.message ||
              "指定された農家は見つからないか、現在は公開されていません。"
          );
          return;
        }

        const data = json.farm;

        setFarm(data);

        // owner 名（表示用）
        const fullName = (data.owner_full_name || "").trim();
        setOwnerFullName(fullName || null);

        // 価格（DTO をそのまま信頼）
        const nextPrices: Prices = {
          5:
            typeof data.price_5kg === "number" &&
            Number.isFinite(data.price_5kg)
              ? data.price_5kg
              : null,
          10:
            typeof data.price_10kg === "number" &&
            Number.isFinite(data.price_10kg)
              ? data.price_10kg
              : null,
          25:
            typeof data.price_25kg === "number" &&
            Number.isFinite(data.price_25kg)
              ? data.price_25kg
              : null,
        };

        setPrices(nextPrices);
      } catch (err) {
        if (aborted) return;
        setErrorMsg("データ取得に失敗しました");
        setFarm(null);
        setPrices({ 5: null, 10: null, 25: null });
        setOwnerFullName(null);
      } finally {
        if (!aborted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      aborted = true;
    };
  }, [farmIdStr]);

  /**
   * harvest year（backend 優先）
   */
  const harvestYear = useMemo(() => {
    if (typeof farm?.harvest_year === "number") {
      return farm.harvest_year;
    }
    return calcHarvestYearFallback();
  }, [farm?.harvest_year]);

  /**
   * 写真（ダミー禁止）
   */
  const photoUrls = useMemo<string[]>(() => {
    if (!farm?.pr_images || !Array.isArray(farm.pr_images)) {
      return [];
    }
    return farm.pr_images.filter((v): v is string => typeof v === "string");
  }, [farm?.pr_images]);

  /**
   * 短い所在地（そのまま表示）
   */
  const shortLocation = useMemo<string | null>(() => {
    return farm?.owner_address_label ?? null;
  }, [farm?.owner_address_label]);

  return {
    farm,
    loading,
    errorMsg,

    prices,
    harvestYear,

    ownerFullName,
    shortLocation,

    photoUrls,
  };
}
