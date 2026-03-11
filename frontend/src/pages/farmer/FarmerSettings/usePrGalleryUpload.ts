import { useEffect, useState, useRef, useCallback } from "react";
import {
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import imageCompression from "browser-image-compression";

/* ================================================================
 * 共有型・定数
 * ================================================================ */

export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";
export const MAX_IMAGES = 4;

// ★追加: サイズ制限設定
const MAX_FILE_SIZE_PRE_MB = 30;  // 圧縮前: 30MBまで (ブラウザ保護)
const MAX_FILE_SIZE_POST_MB = 5;  // 圧縮後: 5MBまで (サーバー保護)

export type PrImage = { id: string; url: string; order: number };

export type PrGalleryProps = {
  farmId: number;
  initialImages: PrImage[];
  coverFallbackUrl?: string | null;
  onChanged?: () => void;
};

export const byOrder = (a: PrImage, b: PrImage) => (a.order ?? 0) - (b.order ?? 0);

/* ================================================================
 * ユーティリティ関数
 * ================================================================ */

/** Cloudinary URL 最適化（表示時のみ） */
export function optimizeCloudinary(
  url: string | undefined | null,
  size: number
): string {
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

/** bytes → MB 表示用 */
function toMB(bytes: number, fractionDigits = 1): string {
  if (!bytes || bytes <= 0) return "0";
  const mb = bytes / (1024 * 1024);
  return mb.toFixed(fractionDigits);
}

/* ================================================================
 * useDisableScroll
 * ================================================================ */

export function useDisableScroll(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, [active]);
}

/* ================================================================
 * メインフック
 * ================================================================ */

export function usePrGalleryUpload({
  initialImages,
  onChanged,
}: {
  initialImages: PrImage[];
  onChanged?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [images, setImages] = useState<PrImage[]>(
    [...(initialImages ?? [])].sort(byOrder)
  );
  const [preview, setPreview] = useState<{
    img: PrImage;
    index: number;
  } | null>(null);
  const [askDelete, setAskDelete] = useState(false);
  const [wiggle, setWiggle] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setImages([...(initialImages ?? [])].sort(byOrder));
  }, [initialImages]);

  /* ---------- DnD sensors ---------- */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 5 },
    })
  );

  const ids = images
    .slice()
    .sort(byOrder)
    .map((img) => img.id);

  /* ---------- 画像圧縮＆アップロード ---------- */
  async function handleChooseFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    // ★追加 1: 圧縮前のサイズチェック (30MB制限)
    const tooLargeFiles = Array.from(fileList).filter(
      (f) => f.size > MAX_FILE_SIZE_PRE_MB * 1024 * 1024
    );
    if (tooLargeFiles.length > 0) {
      alert(
        `ファイルサイズが大きすぎます（${MAX_FILE_SIZE_PRE_MB}MB以下にしてください）。\n対象: ${tooLargeFiles
          .map((f) => f.name)
          .join(", ")}`
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    let filtered: File[] = [];
    let rejectedCount = 0;
    try {
      const res = await filterLandscapeOrSquare(fileList);
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
      const compressOptions = {
        maxSizeMB: 2,           // 目標: 2MB
        maxWidthOrHeight: 1920, // 長辺: 1920px
        useWebWorker: true,
        fileType: "image/jpeg",
      };

      // 圧縮処理と、圧縮後のサイズチェック
      const compressedFiles = await Promise.all(
        toAdd.map(async (file) => {
          try {
            const compressedBlob = await imageCompression(file, compressOptions);
            
            // ★追加 2: 圧縮後のサイズチェック (5MB制限)
            if (compressedBlob.size > MAX_FILE_SIZE_POST_MB * 1024 * 1024) {
               // 圧縮しても大きすぎる場合はエラーとして投げる（catchへ飛ぶ）
               throw new Error(`COMPRESSION_TOO_LARGE:${file.name}`);
            }

            return new File([compressedBlob], file.name, {
              type: compressedBlob.type,
              lastModified: Date.now(),
            });
          } catch (e) {
            console.error("Image compression failed or too large:", e);
            // エラーの内容によってはアラートを出すことも可能ですが、
            // ここでは「失敗したら元のファイルを返す」実装は危険なので(サイズオーバーの可能性)、
            // nullを返して後でフィルタリングするか、処理を続行するなら元のファイルを返します。
            // 今回は安全策として、圧縮失敗orサイズ超過なら「アップロードしない(null)」扱いにします。
            return null; 
          }
        })
      );

      // 有効なファイル（nullでないもの）だけを追加
      let validCount = 0;
      for (const f of compressedFiles) {
        if (f) {
          fd.append("files", f);
          validCount++;
        }
      }

      if (validCount === 0) {
        alert("画像の圧縮に失敗したか、圧縮後もサイズが大きすぎるためアップロードできませんでした。");
        return; 
      }

      const res = await fetch(
        `${API_BASE}/api/farmer/settings-v2/me/pr-images`,
        { method: "POST", credentials: "include", body: fd }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status} ${text}`);
      }
      onChanged?.();

    } catch (err) {
      console.error(err);
      let showedLimitMessage = false;

      try {
        const msg = String((err as any)?.message ?? "");
        // 特定のエラーメッセージ（圧縮サイズ超過など）もここで拾えます
        if (msg.includes("COMPRESSION_TOO_LARGE")) {
           alert("一部の画像は圧縮後もサイズが大きすぎるためスキップされました。");
           showedLimitMessage = true;
        }
        else if (
          msg.includes("413") ||
          msg.includes("monthly upload limit exceeded")
        ) {
          const res2 = await fetch(`${API_BASE}/api/farmer/settings-v2/me`);
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
      onChanged?.();
    } finally {
      setBusy(false);
      setTimeout(() => setUploading(false), 250);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  /* ---------- 並び替え ---------- */
  async function pushOrder(arr: PrImage[]) {
    const image_ids = arr
      .slice()
      .sort(byOrder)
      .map((p) => p.id);
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
      onChanged?.();
    } catch (e) {
      console.error(e);
      alert("並び替えの保存に失敗しました。");
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  /* ---------- プレビュー ---------- */
  const openPreview = useCallback((img: PrImage, index: number) => {
    setPreview({ img, index });
    setAskDelete(false);
  }, []);

  const closePreview = useCallback(() => {
    if (busy) return;
    setPreview(null);
    setAskDelete(false);
  }, [busy]);

  /* ---------- ウィグル ---------- */
  function nudgeWiggle() {
    setWiggle(true);
    window.setTimeout(() => setWiggle(false), 2000);
  }

  /* ---------- 削除 ---------- */
  async function deleteImage(imageId: string) {
    try {
      const url = `${API_BASE}/api/farmer/settings-v2/me/pr-images?image_id=${encodeURIComponent(
        imageId
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
      onChanged?.();
      closePreview();
    }
  }

  return {
    busy,
    uploading,
    images,
    preview,
    askDelete,
    setAskDelete,
    wiggle,
    fileInputRef,
    sensors,
    ids,
    handleChooseFiles,
    onDragEnd,
    openPreview,
    closePreview,
    nudgeWiggle,
    deleteImage,
  } as const;
}