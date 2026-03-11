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

/**
 * V2 API のレスポンス型。
 * 旧 V1 の farm / profile / status 分割は廃止し、フラット構造をそのまま使う。
 */
type SettingsV2 = {
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
  const [data, setData] = useState<SettingsV2 | null>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [riceVariety, setRiceVariety] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadingFace, setUploadingFace] = useState(false);
  const [deletingFace, setDeletingFace] = useState(false);

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchAll() {
    try {
      setBusy(true);
      const res = await fetch(`${API_BASE}/api/farmer/settings-v2/me`, {
        credentials: "include",
      });
      if (!res.ok) {
        console.error("settings fetch failed:", res.status);
        return;
      }

      const v2: SettingsV2 = await res.json();
      setData(v2);
      setTitle(v2.pr_title ?? "");
      setText(v2.pr_text ?? "");
      setRiceVariety(v2.rice_variety_label ?? "");
    } catch (err) {
      console.error("settings fetch error:", err);
    } finally {
      setBusy(false);
    }
  }

  async function postMe(payload: Record<string, unknown>) {
    try {
      const res = await fetch(`${API_BASE}/api/farmer/settings-v2/me`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.text();
        console.error("postMe failed:", res.status, body);
        alert("保存に失敗しました。もう一度お試しください。");
        return;
      }
    } catch (err) {
      console.error("postMe error:", err);
      alert("通信エラーが発生しました。もう一度お試しください。");
    }
    await fetchAll();
  }

  async function uploadFaceImage(file: File) {
    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch(
        `${API_BASE}/api/farmer/settings-v2/face-image/me`,
        {
          method: "POST",
          credentials: "include",
          body: fd,
        }
      );
      if (!res.ok) {
        const body = await res.text();
        console.error("face upload failed:", res.status, body);
        if (body.includes("monthly upload limit exceeded")) {
          alert("月間アップロード上限に達しました。");
        } else {
          alert("画像のアップロードに失敗しました。");
        }
      }
    } catch (err) {
      console.error("face upload error:", err);
      alert("通信エラーが発生しました。もう一度お試しください。");
    }
  }

  const canPublish =
    !!data &&
    !!data.is_ready_to_publish &&
    !busy;

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      <FarmerSettingsHeader title="公開用プロフィール設定" />

      <div className="mx-auto max-w-3xl pb-12">
        <section className="px-4 sm:px-6 mt-6">
          <PublishToggleCard
            isOn={!!data?.is_accepting_reservations}
            disabled={!canPublish}
            onToggle={(v) =>
              postMe({ is_accepting_reservations: v })
            }
          />
        </section>

        <PrGallery
          initialImages={data?.pr_images ?? []}
          coverFallbackUrl={data?.cover_image_url ?? null}
          onChanged={fetchAll}
        />

        <PriceEditor
          initialPrice10={data?.price_10kg ?? undefined}
          onSaved={fetchAll}
          disabled={!data}
        />

        <RiceVarietyLabelEditor
          value={riceVariety}
          saving={busy}
          disabled={!data}
          onChange={setRiceVariety}
          onSave={(v) => postMe({ rice_variety_label: v })}
        />

        <FaceAvatar
          faceImageUrl={data?.face_image_url ?? null}
          uploading={uploadingFace}
          deleting={deletingFace}
          onUpload={async (f) => {
            setUploadingFace(true);
            await uploadFaceImage(f);
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
