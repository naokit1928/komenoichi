import { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import FarmerSettingsHeader from "./FarmerSettingsHeader";
import FaceAvatar from "./FaceAvatar";
import PrGallery from "./PrGallery";
import PriceEditor from "./PriceEditor";
import PrTextEditor from "./PrTextEditor";
import PublishToggleCard from "./PublishToggleCard";
import RiceVarietyLabelEditor from "./RiceVarietyLabelEditor";
import TitleEditor from "./TitleEditor";

import { API_BASE } from "@/config/api";

type MissingItem = { key: string; label: string; hint: string };

type PrImage = { id: string; url: string; order: number };

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

// =========================================================
// 共通トーストコンポーネント
// =========================================================
function Toast({ kind, text }: { kind: "ok" | "ng"; text: string }) {
  return ReactDOM.createPortal(
    <div
      role="status"
      className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[2147483647]"
    >
      <div
        className="flex items-center gap-2 rounded-2xl px-5 py-3 shadow-2xl"
        style={{
          background: kind === "ok" ? "rgba(16,185,129,.95)" : "rgba(239,68,68,.95)",
          color: "white",
          fontSize: 15,
          fontWeight: 600,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
          {kind === "ok" ? (
            <path d="M20 6L9 17l-5-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          ) : (
            <path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          )}
        </svg>
        <span>{text}</span>
      </div>
    </div>,
    document.body
  );
}

// =========================================================
// プレビューモーダル
// =========================================================
function PreviewModal({
  farmId,
  onClose,
}: {
  farmId: number;
  onClose: () => void;
}) {
  // Escキーで閉じる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // スクロールロック
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = prev;
    };
  }, [onClose]);

  return ReactDOM.createPortal(
    <>
      {/* =====================================
          背景オーバーレイ — タップで閉じる
      ===================================== */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 2147483640,
          background: "rgba(0,0,0,0.7)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
        }}
      />

      {/* =====================================
          モーダル本体 — クリックは伝播させない
      ===================================== */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 2147483641,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px 16px",
          pointerEvents: "none",
        }}
      >
        {/* iframeコンテナ */}
        <div
          style={{
            pointerEvents: "auto",
            width: "100%",
            maxWidth: 390,
            height: "100%",
            maxHeight: 780,
            background: "#fff",
            borderRadius: 20,
            overflow: "hidden",
            boxShadow: "0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)",
            display: "flex",
            flexDirection: "column",
            position: "relative",
          }}
        >
          {/* ヘッダーバー */}
          <div
            style={{
              height: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 16px",
              borderBottom: "1px solid rgba(0,0,0,0.06)",
              background: "#FAFAFA",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#22C55E",
                  display: "inline-block",
                  boxShadow: "0 0 0 2px rgba(34,197,94,0.25)",
                }}
              />
              <span style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", letterSpacing: ".02em" }}>
                プレビュー
              </span>
            </div>
            <button
              onClick={onClose}
              aria-label="閉じる"
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                border: "none",
                background: "rgba(0,0,0,0.06)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <iframe
            src={`/farms/${farmId}?preview=true`}
            title="農家ページプレビュー"
            style={{
              width: "100%",
              flex: 1,
              border: "none",
              display: "block",
            }}
          />
        </div>
      </div>
    </>,
    document.body
  );
}

// =========================================================
// メインページ
// =========================================================
export default function FarmerSettingsPage() {
  const [data, setData] = useState<SettingsV2 | null>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [riceVariety, setRiceVariety] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadingFace, setUploadingFace] = useState(false);
  const [deletingFace, setDeletingFace] = useState(false);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);

  // 公開切り替え確認モーダル
  const [publishConfirm, setPublishConfirm] = useState<{ next: boolean } | null>(null);

  const [toast, setToast] = useState<{ kind: "ok" | "ng"; text: string } | null>(null);
  const showToast = (kind: "ok" | "ng", text: string) => {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 1500);
  };

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

  async function postMe(payload: Record<string, unknown>, successMsg = "保存しました。") {
    try {
      const res = await fetch(`${API_BASE}/api/farmer/settings-v2/me`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        showToast("ng", "保存に失敗しました。もう一度お試しください。");
        return;
      }
      showToast("ok", successMsg);
    } catch (err) {
      showToast("ng", "通信エラーが発生しました。");
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
        if (body.includes("monthly upload limit exceeded")) {
          showToast("ng", "月間アップロード上限に達しました。");
        } else {
          showToast("ng", "画像のアップロードに失敗しました。");
        }
        return;
      }
      showToast("ok", "プロフィール写真を保存しました。");
    } catch (err) {
      showToast("ng", "通信エラーが発生しました。");
    }
  }

  const canPublish = !!data && !!data.is_ready_to_publish && !busy;

  const MISSING_FIELD_INFO: Record<string, MissingItem> = {
    rice_variety_label: { key: "rice_variety_label", label: "お米の品種（銘柄）", hint: "例：コシヒカリ、あきたこまち" },
    price_10kg:         { key: "price_10kg",         label: "10kgの価格",         hint: "5,000〜9,900円で設定" },
    pr_title:           { key: "pr_title",            label: "タイトル",           hint: "3〜25文字で農家の紹介文を" },
    face_image_url:     { key: "face_image_url",      label: "プロフィール写真",   hint: "ご本人の顔が映った写真を推奨" },
    pr_images:          { key: "pr_images",           label: "スライド写真",       hint: "1枚以上アップロードしてください" },
  };
  const missingItems: MissingItem[] = (data?.missing_fields ?? [])
    .map((f) => MISSING_FIELD_INFO[f])
    .filter((x): x is MissingItem => !!x);

  return (
    <div className="min-h-screen bg-[#F7F7F7] pb-52">
      <FarmerSettingsHeader title="農家ページの設定" />

      <div className="mx-auto max-w-3xl">
        <section className="px-4 sm:px-6 mt-6">
          {/* 公開前バナー — ピルタグ形式 */}
          {!canPublish && data && missingItems.length > 0 && (
            <div
              style={{
                background: "#FFFFFF",
                border: "1px solid rgba(0,0,0,0.07)",
                borderRadius: 16,
                padding: "12px 14px",
                marginBottom: 16,
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#374151", whiteSpace: "nowrap" }}>
                  受付開始まであと{missingItems.length}項目
                </span>
                {missingItems.map((item) => (
                  <span
                    key={item.key}
                    style={{
                      fontSize: 11,
                      background: "#F3F4F6",
                      color: "#374151",
                      borderRadius: 9999,
                      padding: "2px 8px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
          )}
          <PublishToggleCard
            className="!mt-0"
            isOn={!!data?.is_accepting_reservations}
            disabled={!canPublish}
            onToggle={(v) => setPublishConfirm({ next: v })}
          />
        </section>

        <PrGallery
          farmId={data?.farm_id ?? 0}
          initialImages={data?.pr_images ?? []}
          coverFallbackUrl={data?.cover_image_url ?? null}
          onChanged={fetchAll}
        />

        <div className="px-4 sm:px-6">
          <PriceEditor
            initialPrice10={data?.price_10kg ?? undefined}
            onSaved={fetchAll}
            onError={(msg) => showToast("ng", msg)}
            disabled={!data}
          />

          <RiceVarietyLabelEditor
            value={riceVariety}
            saving={busy}
            disabled={!data}
            onChange={setRiceVariety}
            onSave={(v) => postMe({ rice_variety_label: v }, "品種（銘柄）を保存しました。")}
          />

          <FaceAvatar
            faceImageUrl={data?.face_image_url ?? null}
            uploading={uploadingFace}
            deleting={deletingFace}
            onCropOpenChange={setCropOpen}
            onUpload={async (f) => {
              setUploadingFace(true);
              await uploadFaceImage(f);
              await fetchAll();
              setUploadingFace(false);
            }}
            onDelete={async () => {
              setDeletingFace(true);
              await postMe({ face_image_url: "" }, "プロフィール写真を削除しました。");
              setDeletingFace(false);
            }}
          />

          <TitleEditor
            value={title}
            saving={busy}
            onChange={setTitle}
            onSave={(v) => postMe({ pr_title: v }, "タイトルを保存しました。")}
          />

          <PrTextEditor
            value={text}
            saving={busy}
            onChange={setText}
            onSave={(v) => postMe({ pr_text: v }, "メッセージを保存しました。")}
          />
        </div>
      </div>

      {/* =========================================
          フローティングプレビューボタン
      ========================================= */}
      {!previewOpen && !cropOpen && (
        <div
          style={{
            position: "fixed",
            bottom: 108,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 60,
          }}
        >
          <button
            onClick={() => {
              if (!data?.farm_id) {
                alert("farm_idが取得できていません。ページを再読み込みしてください。");
                return;
              }
              setPreviewOpen(true);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 22px",
              background: "#111",
              color: "#fff",
              border: "none",
              borderRadius: 9999,
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: ".02em",
              cursor: "pointer",
              boxShadow: "0 4px 20px rgba(0,0,0,0.28), 0 1px 4px rgba(0,0,0,0.15)",
              whiteSpace: "nowrap",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            プレビューを確認
          </button>
        </div>
      )}

      {/* =========================================
          プレビューモーダル
      ========================================= */}
      {previewOpen && data?.farm_id && (
        <PreviewModal
          farmId={data.farm_id}
          onClose={() => setPreviewOpen(false)}
        />
      )}

      {/* =========================================
          公開切り替え確認モーダル（変更部分）
      ========================================= */}
      {publishConfirm && ReactDOM.createPortal(
        <>
          <div
            onClick={() => setPublishConfirm(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 2147483646 }}
          />
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: "fixed",
              top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 2147483647,
              width: "min(400px, 88vw)",
              background: "#fff",
              borderRadius: 24,
              padding: "24px 20px 20px",
              boxShadow: "0 24px 60px rgba(0,0,0,0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 8 }}>
              {publishConfirm.next ? "予約受付を再開しますか？" : "予約受付を一時停止しますか？"}
            </p>
            <p style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.7, marginBottom: 20 }}>
              {publishConfirm.next
                ? "再開すると、消費者がお米を予約できるようになります。"
                : "一時停止しても既存の予約はキャンセルされず、農家一覧から非表示になります。"}
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setPublishConfirm(null)}
                style={{
                  flex: 1, height: 48, borderRadius: 9999,
                  border: "1px solid #D1D5DB", background: "#fff",
                  color: "#374151", fontWeight: 600, fontSize: 14, cursor: "pointer",
                }}
              >
                キャンセル
              </button>
              <button
                onClick={() => {
                  const v = publishConfirm.next;
                  setPublishConfirm(null);
                  postMe(
                    { is_accepting_reservations: v },
                    v ? "予約受付を再開しました！" : "予約受付を一時停止しました。"
                  );
                }}
                style={{
                  flex: 1, height: 48, borderRadius: 9999,
                  border: "none",
                  background: publishConfirm.next ? "#111827" : "#C62828",
                  color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer",
                }}
              >
                {publishConfirm.next ? "再開する" : "一時停止する"}
              </button>
            </div>
          </div>
        </>,
        document.body
      )}

      {toast && <Toast kind={toast.kind} text={toast.text} />}
    </div>
  );
}