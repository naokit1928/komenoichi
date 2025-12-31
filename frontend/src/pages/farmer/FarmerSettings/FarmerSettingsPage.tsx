/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from "react";
import FarmerSettingsHeader from "./FarmerSettingsHeader";
import FaceAvatar from "./FaceAvatar";
import PrGallery from "./PrGallery";
import PriceEditor from "./PriceEditor";
import PrTextEditor from "./PrTextEditor";
import PublishToggleCard from "./PublishToggleCard";
import RiceVarietyLabelEditor from "./RiceVarietyLabelEditor";
import TitleEditor from "./TitleEditor";

import { API_BASE } from "@/config/api";

type PrImage = { id: string; url: string; order: number };

type FarmerStatus = {
  is_ready_to_publish: boolean;
  missing_fields?: string[];
  thumbnail_url?: string | null;
  active_flag?: number;
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
  is_ready_to_publish?: boolean;
  missing_fields?: string[];
  thumbnail_url?: string | null;
  active_flag?: number;
  is_accepting_reservations?: boolean;
  monthly_upload_bytes?: number;
  monthly_upload_limit?: number;
  next_reset_at?: string | null;
  pickup_place_name?: string | null;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
};

export default function FarmerSettingsPage() {
  const [initial, setInitial] = useState<SettingsResponse | null>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [riceVariety, setRiceVariety] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadingFace, setUploadingFace] = useState(false);
  const [deletingFace, setDeletingFace] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    try {
      setBusy(true);
      const res = await fetch(`${API_BASE}/api/farmer/settings-v2/me`, {
        credentials: "include",
      });
      if (!res.ok) return;

      const v2: SettingsV2Response = await res.json();

      const mapped: SettingsResponse = {
        farm: {
          id: v2.farm_id,
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
          active_flag: v2.active_flag ?? 1,
        },
      };

      setInitial(mapped);
      setTitle(mapped.profile.pr_title);
      setText(mapped.profile.pr_text);
      setRiceVariety(mapped.farm.rice_variety_label ?? "");
    } finally {
      setBusy(false);
    }
  }

  async function postMe(payload: any) {
    await fetch(`${API_BASE}/api/farmer/settings-v2/me`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    await fetchAll();
  }

  async function uploadSingle(kind: "face" | "cover", file: File) {
    const fd = new FormData();
    fd.append("file", file);

    const endpoint =
      kind === "face"
        ? `${API_BASE}/api/farmer/settings-v2/face-image/me`
        : `${API_BASE}/api/farmer/settings-v2/cover-image/me`;

    await fetch(endpoint, {
      method: "POST",
      credentials: "include",
      body: fd,
    });
  }

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      <FarmerSettingsHeader title="公開用プロフィール設定" />

      <div className="mx-auto max-w-3xl pb-12">
        <section className="px-4 sm:px-6 mt-6">
          <PublishToggleCard
            isOn={!!initial?.farm.is_accepting_reservations}
            disabled={!initial || busy}
            onToggle={(v) => postMe({ is_accepting_reservations: v })}
          />
        </section>

        <PrGallery
          initialImages={initial?.profile.pr_images ?? []}
          coverFallbackUrl={initial?.profile.cover_image_url ?? null}
          onChanged={fetchAll}
        />

        <PriceEditor
          initialPrice10={initial?.farm.price_10kg}
          onSaved={fetchAll}
          disabled={!initial}
        />

        <RiceVarietyLabelEditor
          value={riceVariety}
          saving={busy}
          disabled={!initial}
          onChange={setRiceVariety}
          onSave={(v) => postMe({ rice_variety_label: v })}
        />

        <FaceAvatar
          faceImageUrl={initial?.profile.face_image_url ?? null}
          uploading={uploadingFace}
          deleting={deletingFace}
          onUpload={async (f) => {
            setUploadingFace(true);
            await uploadSingle("face", f);
            await fetchAll();
            setUploadingFace(false);
          }}
          onDelete={async () => {
            setDeletingFace(true);
            await postMe({ face_image_url: "" });
            setDeletingFace(false);
          }}
        />

        <TitleEditor
          value={title}
          saving={busy}
          onChange={setTitle}
          onSave={(v) => postMe({ pr_title: v })}
        />

        <PrTextEditor
          value={text}
          saving={busy}
          onChange={setText}
          onSave={(v) => postMe({ pr_text: v })}
        />
      </div>
    </div>
  );
}
