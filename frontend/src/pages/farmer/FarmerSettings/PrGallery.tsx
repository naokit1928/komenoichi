import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";
const MAX_IMAGES = 4;
const MAX_BYTES_PER_FILE = 15 * 1024 * 1024; // ★ 15MB

type PrImage = { id: string; url: string; order: number };

type Props = {
  farmId: number;
  initialImages: PrImage[];
  coverFallbackUrl?: string | null;
  onChanged?: () => void;
};

const byOrder = (a: PrImage, b: PrImage) => (a.order ?? 0) - (b.order ?? 0);

/* ---------------- Cloudinary URL 最適化（表示時のみ） ---------------- */
function optimizeCloudinary(url: string | undefined | null, size: number): string {
  if (!url) return "";
  const uploadToken = "/image/upload/";
  const idx = url.indexOf(uploadToken);
  if (idx === -1) return url;
  const prefix = url.slice(0, idx + uploadToken.length);
  const rest = url.slice(idx + uploadToken.length);
  const versionMatch = rest.match(/v\d+/);
  let tail = rest;
  if (versionMatch && versionMatch.index !== undefined) {
    tail = rest.slice(versionMatch.index);
  }
  const transform = `f_auto,q_auto,w_${size}/`;
  return `${prefix}${transform}${tail}`;
}

/* ---------------- utilities ---------------- */
function useDisableScroll(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, [active]);
}

function getImageSize(file: File): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      URL.revokeObjectURL(url);
      resolve({ w, h });
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

/** 1:1より縦長（h > w）は除外。1:1は許可。 */
async function filterLandscapeOrSquare(
  files: FileList | File[]
): Promise<{ ok: File[]; rejected: number }> {
  const arr = Array.from(files);
  const results = await Promise.allSettled(arr.map(getImageSize));
  const ok: File[] = [];
  let rejected = 0;
  results.forEach((r, idx) => {
    if (r.status !== "fulfilled") {
      rejected += 1;
      return;
    }
    const { w, h } = r.value;
    if (h > w) {
      rejected += 1;
    } else {
      ok.push(arr[idx]);
    }
  });
  return { ok, rejected };
}

/** ★ 15MB を超えるファイルを除外（形式は問わない） */
function filterByMaxSize(
  files: FileList | File[],
  maxBytes: number
): { ok: File[]; rejectedNames: string[] } {
  const ok: File[] = [];
  const rejectedNames: string[] = [];
  for (const f of Array.from(files)) {
    if (typeof f.size === "number" && f.size > maxBytes) {
      rejectedNames.push(f.name || "unknown");
    } else {
      ok.push(f);
    }
  }
  return { ok, rejectedNames };
}

/** bytes → MB 表示用 */
function toMB(bytes: number, fractionDigits = 1): string {
  if (!bytes || bytes <= 0) return "0";
  const mb = bytes / (1024 * 1024);
  return mb.toFixed(fractionDigits);
}

/* ---------------- portal modal ---------------- */
function CenterModal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  useDisableScroll(true);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const node = (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          zIndex: 2147483646,
        }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 2147483647,
          maxWidth: "96vw",
          maxHeight: "90vh",
        }}
      >
        {children}
      </div>
    </>
  );
  return ReactDOM.createPortal(node, document.body);
}

/* ---------------- small spinner ---------------- */
function Spinner({ size = 18 }: { size?: number }) {
  const s = size;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-label="loading" role="status">
      <g fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" opacity="0.18" />
        <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round">
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 12 12"
            to="360 12 12"
            dur="0.9s"
            repeatCount="indefinite"
          />
        </path>
      </g>
    </svg>
  );
}

/* ---------------- uploading toast ---------------- */
function UploadToast({ text }: { text: string }) {
  return ReactDOM.createPortal(
    <div
      style={{
        position: "fixed",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 2147483647,
      }}
    >
      <div
        className="flex items-center gap-3"
        style={{
          padding: "12px 16px",
          background: "rgba(34,34,34,0.92)",
          color: "white",
          borderRadius: 14,
          boxShadow: "0 8px 30px rgba(0,0,0,.35)",
          fontSize: 14,
        }}
      >
        <Spinner />
        <span>{text}</span>
      </div>
    </div>,
    document.body
  );
}

/* ---------------- sortable tile ---------------- */
function SortableItem(props: {
  img: PrImage;
  index: number;
  wiggle: boolean;
  onOpenPreview: (img: PrImage, index: number) => void;
}) {
  const { img, index, wiggle, onOpenPreview } = props;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: img.id, disabled: false });

  const isCover = index === 0;

    return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        touchAction: "manipulation",               // ← ★ここ
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={[
        "relative overflow-hidden rounded-[18px]",
        "shadow-sm hover:shadow-md transition-shadow",
        "cursor-grab active:cursor-grabbing",
        wiggle ? "prg-wiggle" : "",
      ].join(" ")}
      aria-label={`写真 ${index + 1}${isCover ? "（カバー）" : ""}`}
      onClickCapture={() => onOpenPreview(img, index)}
    >

      <div
        className="grid w-full h-full"
        style={{
          aspectRatio: "3 / 2",
          gridTemplateRows: "1fr",
          gridTemplateColumns: "1fr",
        }}
      >
        <img
          src={optimizeCloudinary(img.url, 600)}
          alt={`PR #${index + 1}`}
          className={[
            "block w-full h-full object-cover",
            isDragging ? "cursor-grabbing" : "",
            "transition-[filter]",
          ].join(" ")}
          style={{ gridRow: 1, gridColumn: 1 }}
          draggable={false}
        />

        <div style={{ gridRow: 1, gridColumn: 1 }} className="relative">
          {isCover && (
            <span
              className="absolute inline-flex items-center text-gray-900 font-semibold shadow"
              style={{
                top: 12,
                left: 14,
                background: "white",
                borderRadius: 9999,
                fontSize: 13,
                lineHeight: 1,
                padding: "8px 12px",
                boxShadow: "0 2px 8px rgba(0,0,0,.12)",
                whiteSpace: "nowrap",
              }}
            >
              カバー写真
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- main ---------------- */
export default function PrGallery({ farmId, initialImages, onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [images, setImages] = useState<PrImage[]>(
    [...(initialImages ?? [])].sort(byOrder)
  );
  const [preview, setPreview] = useState<{ img: PrImage; index: number } | null>(
    null
  );
  const [askDelete, setAskDelete] = useState(false);
  const [wiggle, setWiggle] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setImages([...(initialImages ?? [])].sort(byOrder));
  }, [initialImages]);

const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  useSensor(TouchSensor, {
    activationConstraint: {
      delay: 120,
      tolerance: 5,
    },
  })
);

const ids = images
  .slice()
  .sort(byOrder)
  .map((img) => img.id);


  async function handleChooseFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    const { ok: sizeOkFiles, rejectedNames } = filterByMaxSize(
      fileList,
      MAX_BYTES_PER_FILE
    );
    if (rejectedNames.length > 0) {
      const list =
        rejectedNames.slice(0, 5).join(", ") +
        (rejectedNames.length > 5 ? " ほか" : "");
      alert(`ファイルサイズが大きすぎます（上限 15MB/枚）。対象: ${list}`);
    }
    if (sizeOkFiles.length === 0) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    let filtered: File[] = [];
    let rejectedCount = 0;
    try {
      const res = await filterLandscapeOrSquare(sizeOkFiles);
      filtered = res.ok;
      rejectedCount = res.rejected;
    } catch {
      alert("画像の判定に失敗しました。もう一度お試しください。");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const slots = Math.max(0, MAX_IMAGES - images.length);
    const toAdd = filtered.slice(0, slots);

    if (rejectedCount > 0) {
      alert(
        "縦長の写真はアップロードできません。サイズが1:1より横長の写真だけアップロード可能です。"
      );
    }
    if (toAdd.length === 0) {
      if (filtered.length > 0 && slots === 0) {
        alert(`画像は最大 ${MAX_IMAGES} 枚までです。`);
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    try {
      setBusy(true);
      setUploading(true);
      const fd = new FormData();
      for (const f of toAdd) fd.append("files", f);
      // ★ v2: PR画像アップロード
      const res = await fetch(
        `${API_BASE}/api/farmer/settings-v2/me/pr-images`,
        {
         method: "POST",
         credentials: "include",
         body: fd,
         }
      );
      if (!res.ok) {
        // エラーテキストを取得して Error に詰める
        const text = await res.text();
        throw new Error(`${res.status} ${text}`);
      }
      onChanged && onChanged();
    } catch (err) {
      console.error(err);
      let showedLimitMessage = false;

      try {
        const msg = String((err as any)?.message ?? "");
        // monthly upload limit exceeded の場合（413 など）
        if (
          msg.includes("413") ||
          msg.includes("monthly upload limit exceeded")
        ) {
          const res2 = await fetch(
            `${API_BASE}/api/farmer/settings-v2/me`
          );
          if (res2.ok) {
            const data = await res2.json();
            const usedBytes = Number(data.monthly_upload_bytes ?? 0);
            const limitBytes = Number(data.monthly_upload_limit ?? 0);
            const usedMb = toMB(usedBytes, 1);
            const limitMb = toMB(limitBytes || 50 * 1024 * 1024, 0);

            alert(
              `50MBを超えています。今月はこれ以上アップロードできません。\n\n現在 約 ${usedMb}MB / ${limitMb}MB 使用中`
            );
            showedLimitMessage = true;
          }
        }
      } catch (e2) {
        console.error("failed to show monthly limit message", e2);
      }

      if (!showedLimitMessage) {
        alert("PR画像のアップロードに失敗しました。");
      }

      onChanged && onChanged();
    } finally {
      setBusy(false);
      setTimeout(() => setUploading(false), 250);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function pushOrder(arr: PrImage[]) {
    const image_ids = arr
      .slice()
      .sort(byOrder)
      .map((p) => p.id);
    // ★ v2: 並び順更新
    const res = await fetch(
       `${API_BASE}/api/farmer/settings-v2/me/pr-images/order`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ image_ids }),
      }
    );
    if (!res.ok) throw new Error(await res.text());
  }

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const cur = images.slice().sort(byOrder);
    const from = cur.findIndex((x) => x.id === active.id);
    const to = cur.findIndex((x) => x.id === over.id);
    const arranged = arrayMove(cur, from, to).map((p, i) => ({
      ...p,
      order: i,
    }));
    try {
      setBusy(true);
      setImages(arranged);
      await pushOrder(arranged);
      onChanged && onChanged();
    } catch (e) {
      console.error(e);
      alert("並び替えの保存に失敗しました。");
      onChanged && onChanged();
    } finally {
      setBusy(false);
    }
  }

  function openPreview(img: PrImage, index: number) {
    setPreview({ img, index });
    setAskDelete(false);
  }
  function closePreview() {
    if (busy) return;
    setPreview(null);
    setAskDelete(false);
  }
  function nudgeWiggle() {
    setWiggle(true);
    window.setTimeout(() => setWiggle(false), 2000);
  }

  return (
    <section className="mb-10 px-4 sm:px-6">
      <style>{`
        @keyframes prg-wiggle-kf {
          0% { transform: rotate(-0.35deg) }
          50% { transform: rotate(0.35deg) }
          100% { transform: rotate(-0.35deg) }
        }
        .prg-wiggle { animation: prg-wiggle-kf 0.35s ease-in-out infinite; }
      `}</style>

      <button
        type="button"
        className="w-full bg-white"
        style={{
          backgroundColor: "#FFFFFF",
          border: "1px solid rgba(0,0,0,0.07)",
          borderRadius: 24,
          padding: "44px 46px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.04)",
          textAlign: "left",
          cursor: "default",
        }}
      >
        {/* header */}
        <div className="flex items-center justify-between">
          <h2 className="text-[26px] font-extrabold tracking-tight">
            スライド写真
          </h2>

          <div
            className="flex items-center"
            style={{ gap: 10, transform: "translateX(-5px)" }}
          >
            
            <label
              className="grid place-items-center rounded-full"
              title="写真を追加"
              style={{
                width: 40,
                height: 40,
                background: "#F2F2F2",
                color: "#222222",
                border: "none",
                boxShadow: "0 1px 0 rgba(0,0,0,.04)",
                cursor: uploading ? "not-allowed" : "pointer",
                opacity: uploading ? 0.6 : 1,
                marginLeft: 8,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {uploading ? (
                <Spinner />
              ) : (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    d="M12 5v14M5 12h14"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleChooseFiles(e.currentTarget.files)}
                disabled={busy}
                aria-label="写真を追加"
              />
            </label>
          </div>
        </div>

        {/* grid */}
        <div onClick={(e) => e.stopPropagation()}>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext items={ids} strategy={rectSortingStrategy}>
              <div
                className="mt-4 grid"
                style={{
                  gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                  gap: 12,
                }}
              >
                {images
                  .slice()
                  .sort(byOrder)
                  .map((img, idx) => (
                    <SortableItem
                      key={img.id}
                      img={{
                        ...img,
                        url: optimizeCloudinary(img.url, 600),
                      }}
                      index={idx}
                      wiggle={wiggle}
                      onOpenPreview={openPreview}
                    />
                  ))}
                {images.length < MAX_IMAGES && (
                  <label
                    className="relative rounded-[18px] overflow-hidden grid place-items-center text-sm text-gray-700 cursor-pointer"
                    style={{ aspectRatio: "3 / 2", background: "#F7F7F7" }}
                    title="写真を追加"
                  >
                    <div className="text-center">
                      <div className="text-base font-medium">＋ 追加</div>
                      <div className="text-[11px] mt-1 text-gray-500">
                        残り {Math.max(0, MAX_IMAGES - images.length)} /{" "}
                        {MAX_IMAGES}
                      </div>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => handleChooseFiles(e.currentTarget.files)}
                      disabled={busy}
                      aria-label="写真を追加"
                    />
                  </label>
                )}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </button>

      {/* ▲▲ カードここまで。以下はページ全体オーバーレイ等（カード外のまま） ▲▲ */}
      {uploading && <UploadToast text="画像をアップロードしています…" />}

      {preview && preview.img && (
        <CenterModal onClose={closePreview}>
          <div
            className="relative"
            style={{ width: "96vw", maxWidth: "1200px", maxHeight: "90vh" }}
          >
            <img
              src={optimizeCloudinary(preview.img.url, 1500)}
              alt={`preview ${preview.index + 1}`}
              className="block"
              style={{
                width: "100%",
                height: "auto",
                maxHeight: "90vh",
                objectFit: "contain",
              }}
              draggable={false}
            />

            <div
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                zIndex: 3,
              }}
            >
              <button
                type="button"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 9999,
                  background: "rgba(255,255,255,0.96)",
                  border: "none",
                  outline: "none",
                  boxShadow: "0 6px 18px rgba(0,0,0,.22)",
                  cursor: "pointer",
                }}
                title="この写真を削除"
                aria-label="この写真を削除"
                onClick={() => setAskDelete(true)}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 6.3h16" />
                  <path d="M10 4.2h4" />
                  <rect
                    x="6.5"
                    y="4"
                    width="11"
                    height="21"
                    rx="2.4"
                    ry="2.4"
                  />
                  <path d="M10.5 10v7.5" />
                  <path d="M13.5 10v7.5" />
                  <path d="M7.4 22.5h9.2" />
                </svg>
              </button>
            </div>

            {askDelete && (
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  bottom: -12,
                  transform: "translate(-50%, 100%)",
                  width: "min(92vw, 680px)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 16,
                  padding: 14,
                  borderRadius: 18,
                  background: "rgba(255,255,255,0.98)",
                  boxShadow: "0 10px 34px rgba(0,0,0,.25)",
                  border: "1px solid rgba(0,0,0,.05)",
                  overflow: "hidden",
                  zIndex: 4,
                }}
              >
                <div style={{ fontSize: 15, color: "#111827" }}>
                  この写真を削除しますか？
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                  }}
                >
                  <button
                    type="button"
                    style={{
                      borderRadius: 9999,
                      padding: "10px 16px",
                      fontSize: 14,
                      background: "#F3F4F6",
                      color: "#111827",
                      border: "none",
                      boxShadow: "0 1px 0 rgba(0,0,0,.04)",
                      cursor: "pointer",
                    }}
                    onClick={() => setAskDelete(false)}
                  >
                    やめる
                  </button>
                  <button
                    type="button"
                    style={{
                      borderRadius: 9999,
                      padding: "10px 18px",
                      fontSize: 14,
                      background: "#E11D48",
                      color: "white",
                      border: "none",
                      boxShadow: "none",
                      outline: "none",
                      transform: "translateZ(0)",
                      cursor: "pointer",
                    }}
                    onClick={async () => {
                      try {
                        // ★ v2: 削除エンドポイント
                        const url = `${API_BASE}/api/farmer/settings-v2/me/pr-images?image_id=${encodeURIComponent(
                          preview.img.id
                        )}`;
                        const res = await fetch(url, {
                          method: "DELETE",
                          credentials: "include",
                        });
                        if (!res.ok) throw new Error(await res.text());
                      } catch (e) {
                        console.error(e);

                        const msg = String((e as any)?.message ?? "");

                        if (msg.includes("at least one pr image")) {
                          alert("PR画像が1枚のみの場合は削除できません。");
                        } else {
                          alert("PR画像の削除に失敗しました。");
                        }
                      } finally {
                        onChanged && onChanged();
                        closePreview();
                      }
                    }}
                  >
                    削除する
                  </button>
                </div>
              </div>
            )}
          </div>
        </CenterModal>
      )}
    </section>
  );
}
