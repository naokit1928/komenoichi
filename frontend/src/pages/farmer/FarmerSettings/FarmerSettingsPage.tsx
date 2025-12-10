/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useMemo, useState } from "react";
import FarmerSettingsHeader from "./FarmerSettingsHeader";
import FaceAvatar from "./FaceAvatar";
import PrGallery from "./PrGallery";
import PriceEditor from "./PriceEditor";
import PrTextEditor from "./PrTextEditor";
import PublishToggleCard from "./PublishToggleCard";
import RiceVarietyLabelEditor from "./RiceVarietyLabelEditor";
import TitleEditor from "./TitleEditor";


const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

type PrImage = { id: string; url: string; order: number };

type FarmerStatus = {
  is_ready_to_publish: boolean;
  missing_fields?: string[];
  thumbnail_url?: string | null;
  active_flag?: number; // 1: 通常, 0: BAN（運営用）
};

type FarmerProfile = {
  pr_title: string;
  pr_text: string;
  face_image_url?: string | null;
  cover_image_url?: string | null;
  pr_images: PrImage[];
  monthly_upload_bytes?: number;
  monthly_upload_limit?: number;
  next_reset_at?: string | null;
};

type Farm = {
  id: number;
  farm_name: string;
  price_10kg: number;
  price_5kg: number;
  price_25kg: number;
  rice_variety_label?: string | null;
  location_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  is_accepting_reservations: boolean;
  is_active: boolean;
};

type SettingsResponse = {
  farm: Farm;
  profile: FarmerProfile;
  status: FarmerStatus;
};

/**
 * v2 /api/farmer/settings-v2 のレスポンス想定
 * （必要な項目だけを定義しておく）
 */
type SettingsV2Response = {
  farm_id: number;
  farm_name?: string | null;

  rice_variety_label?: string | null;
  price_10kg?: number | null;
  price_5kg?: number | null;
  price_25kg?: number | null;

  pr_title?: string | null;
  pr_text?: string | null;

  face_image_url?: string | null;
  cover_image_url?: string | null;
  pr_images?: PrImage[];

  harvest_year?: number | null;

  is_ready_to_publish?: boolean;
  missing_fields?: string[];
  thumbnail_url?: string | null;

  active_flag?: number;
  is_accepting_reservations?: boolean;

  monthly_upload_bytes?: number;
  monthly_upload_limit?: number;
  next_reset_at?: string | null;

  // pickup 関連（公開条件の内部判定用）
  pickup_place_name?: string | null;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
};

export default function FarmerSettingsPage() {
  const params = new URLSearchParams(location.search);
  const farmId = useMemo(() => Number(params.get("farm_id") ?? "0"), []);

  const [initial, setInitial] = useState<SettingsResponse | null>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [riceVariety, setRiceVariety] = useState("");

  const [busy, setBusy] = useState(false);
  const [uploadingFace, setUploadingFace] = useState(false);
  const [deletingFace, setDeletingFace] = useState(false);

  useEffect(() => {
    if (!farmId || Number.isNaN(farmId)) return;
    fetchAll();
  }, [farmId]);

  async function fetchAll() {
    try {
      const res = await fetch(
        `${API_BASE}/api/farmer/settings-v2?farm_id=${encodeURIComponent(
          farmId
        )}`
      );
      if (!res.ok) {
        console.error("fetch settings-v2 failed", res.status, await res.text());
        return;
      }
      const v2: SettingsV2Response = await res.json();

      const mapped: SettingsResponse = {
        farm: {
          id: v2.farm_id ?? farmId,
          farm_name: v2.farm_name ?? "",
          price_10kg: v2.price_10kg ?? 0,
          price_5kg: v2.price_5kg ?? 0,
          price_25kg: v2.price_25kg ?? 0,
          rice_variety_label: v2.rice_variety_label ?? null,
          // SettingsPage では location 情報は主に「公開準備OKかどうか」の補助程度なので、
          // v2 の pickup_* をそのままマッピングしておく
          location_name: v2.pickup_place_name ?? null,
          latitude: v2.pickup_lat ?? null,
          longitude: v2.pickup_lng ?? null,
          is_accepting_reservations: !!v2.is_accepting_reservations,
          is_active: (v2.active_flag ?? 1) === 1,
        },
        profile: {
          pr_title: v2.pr_title ?? "",
          pr_text: v2.pr_text ?? "",
          face_image_url: v2.face_image_url ?? null,
          cover_image_url: v2.cover_image_url ?? null,
          pr_images: v2.pr_images ?? [],
          monthly_upload_bytes: v2.monthly_upload_bytes,
          monthly_upload_limit: v2.monthly_upload_limit,
          next_reset_at: v2.next_reset_at,
        },
        status: {
          is_ready_to_publish: v2.is_ready_to_publish ?? false,
          missing_fields: v2.missing_fields ?? [],
          thumbnail_url: v2.thumbnail_url ?? v2.cover_image_url ?? null,
          active_flag:
            typeof v2.active_flag === "number" ? v2.active_flag : 1,
        },
      };

      setInitial(mapped);
      setTitle(mapped.profile.pr_title ?? "");
      setText(mapped.profile.pr_text ?? "");
      setRiceVariety(mapped.farm.rice_variety_label ?? "");
    } catch (e) {
      console.error("fetch settings-v2 error", e);
    }
  }

  // 予約受付トグル（v2）
  async function toggleAccepting(next: boolean) {
    if (!farmId) return;
    try {
      setBusy(true);
      const res = await fetch(`${API_BASE}/api/farmer/settings-v2`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          farm_id: Number(farmId),
          is_accepting_reservations: next,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const v2: SettingsV2Response = await res.json();

      setInitial((prev) => {
        const base: SettingsResponse =
          prev ??
          {
            farm: {
              id: farmId,
              farm_name: v2.farm_name ?? "",
              price_10kg: v2.price_10kg ?? 0,
              price_5kg: v2.price_5kg ?? 0,
              price_25kg: v2.price_25kg ?? 0,
              rice_variety_label: v2.rice_variety_label ?? null,
              location_name: v2.pickup_place_name ?? null,
              latitude: v2.pickup_lat ?? null,
              longitude: v2.pickup_lng ?? null,
              is_accepting_reservations: !!v2.is_accepting_reservations,
              is_active: (v2.active_flag ?? 1) === 1,
            },
            profile: {
              pr_title: v2.pr_title ?? "",
              pr_text: v2.pr_text ?? "",
              face_image_url: v2.face_image_url ?? null,
              cover_image_url: v2.cover_image_url ?? null,
              pr_images: v2.pr_images ?? [],
              monthly_upload_bytes: v2.monthly_upload_bytes,
              monthly_upload_limit: v2.monthly_upload_limit,
              next_reset_at: v2.next_reset_at,
            },
            status: {
              is_ready_to_publish: v2.is_ready_to_publish ?? false,
              missing_fields: v2.missing_fields ?? [],
              thumbnail_url: v2.thumbnail_url ?? v2.cover_image_url ?? null,
              active_flag:
                typeof v2.active_flag === "number" ? v2.active_flag : 1,
            },
          };

        return {
          ...base,
          farm: {
            ...base.farm,
            is_accepting_reservations: !!v2.is_accepting_reservations,
          },
          status: {
            ...base.status,
            active_flag:
              typeof v2.active_flag === "number"
                ? v2.active_flag
                : base.status.active_flag,
          },
        };
      });
    } catch (e) {
      console.error(e);
      alert("公開設定の更新に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  async function saveTitle(nextTitle: string) {
    if (!farmId) return;
    try {
      setBusy(true);
      const res = await fetch(`${API_BASE}/api/farmer/settings-v2`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          farm_id: Number(farmId),
          pr_title: nextTitle,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      await fetchAll();
    } catch (e) {
      console.error(e);
      alert("タイトルの保存に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  async function savePrText(nextText: string) {
    if (!farmId) return;
    try {
      setBusy(true);
      const res = await fetch(`${API_BASE}/api/farmer/settings-v2`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          farm_id: Number(farmId),
          pr_text: nextText,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      await fetchAll();
    } catch (e) {
      console.error(e);
      alert("紹介文の保存に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  async function saveRiceVariety(nextLabel: string) {
    if (!farmId) return;
    try {
      setBusy(true);
      const res = await fetch(`${API_BASE}/api/farmer/settings-v2`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          farm_id: Number(farmId),
          rice_variety_label: nextLabel,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      await fetchAll();
    } catch (e) {
      console.error(e);
      alert("品種ラベルの保存に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  /**
   * 画像アップロード（顔 / カバー）
   * - ここはすでに v2 の /face-image /cover-image を叩く版
   */
  async function uploadSingle(kind: "face" | "cover", file: File) {
    if (!farmId) return;

    const endpoint =
      kind === "face"
        ? `${API_BASE}/api/farmer/settings-v2/face-image?farm_id=${encodeURIComponent(
            farmId
          )}`
        : `${API_BASE}/api/farmer/settings-v2/cover-image?farm_id=${encodeURIComponent(
            farmId
          )}`;

    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch(endpoint, {
      method: "POST",
      body: fd,
    });
    if (!res.ok) {
      throw new Error(await res.text());
    }
  }

  /**
   * 顔画像削除
   * v1 の /farmer/settings/face-image/delete を使わず、
   * v2 の settings-v2 に face_image_url を空文字で上書きして消す。
   */
  async function deleteFace() {
    if (!farmId) return;

    const res = await fetch(`${API_BASE}/api/farmer/settings-v2`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        farm_id: Number(farmId),
        face_image_url: "",
      }),
    });
    if (!res.ok) {
      throw new Error(await res.text());
    }
  }

  const publishReady = initial?.status?.is_ready_to_publish ?? false;
  const activeFlag = initial?.status?.active_flag ?? 1;

  const isToggleOn =
    activeFlag === 1 && !!initial?.farm?.is_accepting_reservations;

  const toggleDisabled =
    !initial || busy || activeFlag !== 1 || !publishReady;

  if (!farmId || Number.isNaN(farmId)) {
    return (
      <div className="p-4">
        <h1 className="text-xl font-extrabold mb-3 text-center">
          公開用プロフィール設定
        </h1>
        <p className="text-sm">
          URL に <code>?farm_id=1</code> のように <b>farm_id</b> を指定してください。
        </p>
      </div>
    );
  }

  return (
    <div
      className="
        min-h-screen
        bg-[#F7F7F7]
        pt-[80px]
        sm:pt-[96px]
      "
    >
      <FarmerSettingsHeader
        title="公開用プロフィール設定"
        backTo="/line/farmer-menu"
      />

      {/* 本体 */}
      <div className="mx-auto max-w-3xl pb-12">
        {/* 予約受付トグルカード */}
        <section className="mb-0 px-4 sm:px-6">
          <div className="w-full max-w-[calc(100%-24px)]">
            <PublishToggleCard
              isOn={isToggleOn}
              disabled={toggleDisabled}
              onToggle={toggleAccepting}
              className="mx-auto"
            />
          </div>
        </section>

        <div style={{ height: 12 }} />

        {/* スライド(PR)写真カード */}
        <section className="mt-2 px-4 sm:px-6">
          <div className="w-full max-w-[calc(100%-24px)]">
            <PrGallery
              farmId={farmId}
              initialImages={initial?.profile?.pr_images ?? []}
              coverFallbackUrl={initial?.profile?.cover_image_url ?? null}
              onChanged={fetchAll}
            />
          </div>
        </section>

        {/* 価格カード */}
        <div className="mt-8 px-4 sm:px-6">
          <PriceEditor
            farmId={farmId}
            initialPrice10={initial?.farm?.price_10kg}
            onSaved={fetchAll}
            disabled={!initial}
          />
        </div>

        {/* 品種ラベルカード */}
        <section className="mt-4 mb-4 px-4 sm:px-6">
          <RiceVarietyLabelEditor
            value={riceVariety}
            maxLength={30}
            saving={busy}
            disabled={!initial}
            onChange={setRiceVariety}
            onSave={saveRiceVariety}
          />
        </section>

        {/* プロフィール写真カード */}
        <section className="mb-8 px-4 sm:px-6">
          <div className="w-full max-w-[calc(100%-24px)]">
            <FaceAvatar
              className="mb-0"
              faceImageUrl={initial?.profile?.face_image_url ?? null}
              uploading={uploadingFace}
              deleting={deletingFace}
              onUpload={async (file) => {
                try {
                  setUploadingFace(true);
                  await uploadSingle("face", file);
                  await fetchAll();
                } catch (e) {
                  console.error(e);
                  alert("顔画像のアップロードに失敗しました。");
                } finally {
                  setUploadingFace(false);
                }
              }}
              onDelete={async () => {
                try {
                  setDeletingFace(true);
                  await deleteFace();
                  await fetchAll();
                } catch (e) {
                  console.error(e);
                  alert("顔画像の削除に失敗しました。");
                } finally {
                  setDeletingFace(false);
                }
              }}
            />
          </div>
        </section>

        {/* タイトルカード */}
        <section className="mb-6 px-4 sm:px-6">
          <TitleEditor
            value={title}
            maxLength={30}
            saving={busy}
            onChange={setTitle}
            onSave={saveTitle}
          />
          {!publishReady && (title ?? "") === "" && (
            <p className="text-xs text-red-500 mt-1">
              公開にはタイトルの入力が必要です。
            </p>
          )}
        </section>

        {/* 説明文カード（下にも余白） */}
        <section className="mb-16 px-4 sm:px-6">
          <PrTextEditor
            value={text}
            maxLength={800}
            saving={busy}
            onChange={setText}
            onSave={savePrText}
          />
        </section>

        {/* 公開に必要な項目リスト */}
        {initial?.status?.missing_fields &&
          initial.status.missing_fields.length > 0 && (
            <section className="mb-8 px-4 sm:px-6">
              <h2 className="text-sm font-semibold mb-2">
                公開までに必要な項目
              </h2>
              <ul className="list-disc list-inside text-xs text-gray-700">
                {initial.status.missing_fields.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </section>
          )}
      </div>
    </div>
  );
}
