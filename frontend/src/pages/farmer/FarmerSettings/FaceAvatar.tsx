import React, { useEffect, useRef, useState } from "react";
import Cropper from "react-easy-crop";

type Props = {
  faceImageUrl?: string | null;
  onUpload: (file: File) => void;
  onDelete?: () => void;
  uploading?: boolean;
  deleting?: boolean;
  className?: string;
  title?: string;
};

type Area = { x: number; y: number; width: number; height: number };

// ====== 調整ポイント ======
const AVATAR_PX_BASE = 168;
const AVATAR_PX_SM = 200;
const AVATAR_PX_LG = 224;
const CROP_AREA_MAX_PX = 360;
const MODAL_MAX_W = 440;
const MAX_FILE_BYTES = 15 * 1024 * 1024;

// ボタンはアバター基準で下に少しはみ出す（負値ほど下）
const EDIT_BTN_OVERLAP_PX = -20;
// ボタンの高さぶん、カード下にスペースを確保（ボタンの被り防止用）
const SPACER_BELOW_BTN_PX = 44;
// ==========================

export default function FaceAvatar({
  faceImageUrl,
  onUpload,
  onDelete: _onDelete,   // ← unused 回避
  uploading,
  deleting,
  className = "",
}: Props) {

  const inputRef = useRef<HTMLInputElement | null>(null);

  const [preview, setPreview] = useState<string | null>(faceImageUrl ?? null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [isCropOpen, setCropOpen] = useState(false);
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [uploadingLocal, setUploadingLocal] = useState(false);

  useEffect(() => {
    setPreview(faceImageUrl ?? null);
  }, [faceImageUrl]);

  useEffect(() => {
    return () => {
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
      if (cropSrc?.startsWith("blob:")) URL.revokeObjectURL(cropSrc);
    };
  }, [preview, cropSrc]);

  const disabled = !!uploading || !!deleting || uploadingLocal;
  const isBusy = disabled;

  const pickFile = () => {
    if (isBusy) return;
    inputRef.current?.click();
  };

  const onFileChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) {
      alert("ファイルサイズが大きすぎます。最大15MBまでアップロードできます。");
      e.currentTarget.value = "";
      return;
    }
    const url = URL.createObjectURL(f);
    setCropSrc(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCropOpen(true);
  };

  const onCropComplete = (_: Area, cropped: Area) => {
    setCroppedAreaPixels(cropped);
  };

  function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function decideOutputSize(): number {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const isNarrow = window.innerWidth < 480;
    const base = isNarrow ? 512 : 640;
    return Math.round(base * dpr);
  }

  async function getCroppedBlob(imageSrc: string, pixelCrop: Area, outputSize = 640): Promise<Blob> {
    const img = await loadImage(imageSrc);
    const canvas = document.createElement("canvas");
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");

    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      img,
      pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
      0, 0, outputSize, outputSize
    );

    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", 0.92);
    });
    return blob;
  }

  const confirmCropAndUpload = async () => {
    if (!cropSrc || !croppedAreaPixels) return;
    try {
      setUploadingLocal(true);
      const output = decideOutputSize();
      const blob = await getCroppedBlob(cropSrc, croppedAreaPixels, output);

      if (blob.size > MAX_FILE_BYTES) {
        alert("出力画像が大きすぎます。もう少し縮小して再度お試しください。");
        setUploadingLocal(false);
        return;
      }

      const file = new File([blob], "avatar_cropped.jpg", { type: "image/jpeg" });

      const url = URL.createObjectURL(blob);
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
      setPreview(url);

      await onUpload(file);
    } finally {
      setUploadingLocal(false);
      setCropOpen(false);
      if (cropSrc?.startsWith("blob:")) URL.revokeObjectURL(cropSrc);
      setCropSrc(null);
    }
  };

  const imageSrc = preview ?? "";

  return (
    <section className={`w-full ${className}`}>
      <style>{`
        .fa-avatar { width: ${AVATAR_PX_BASE}px; height: ${AVATAR_PX_BASE}px; border-radius: 9999px; overflow: hidden; background: #f3f4f6; }
        @media (min-width: 640px) { .fa-avatar { width: ${AVATAR_PX_SM}px; height: ${AVATAR_PX_SM}px; } }
        @media (min-width: 1024px) { .fa-avatar { width: ${AVATAR_PX_LG}px; height: ${AVATAR_PX_LG}px; } }

        .fa-modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.48); display:flex; align-items:center; justify-content:center; z-index:60; padding:16px; }
        .fa-modal { width:100%; max-width:${MODAL_MAX_W}px; background:#fff; border-radius:16px; box-shadow:0 10px 28px rgba(0,0,0,0.25); overflow:hidden; position:relative; }
        .fa-modal-header { padding:12px 14px; font-weight:700; border-bottom:1px solid rgba(0,0,0,0.06); }
        .fa-modal-body { padding:12px; }
        .fa-modal-footer { padding:10px 12px 14px 12px; display:flex; gap:8px; justify-content:flex-end; border-top:1px solid rgba(0,0,0,0.06); }
        .fa-action-btn { display:inline-flex; align-items:center; justify-content:center; padding:10px 16px; min-width:110px; border-radius:9999px; border:1px solid rgba(0,0,0,0.08); box-shadow:0 8px 18px rgba(0,0,0,0.18); font-weight:600; font-size:15px; cursor:pointer; }
        .fa-action-black { background:#000; color:#fff; }
        .fa-action-ghost { background:#fff; color:#111; }
        .fa-slider { width:100%; }
        .fa-crop-area { position:relative; width:100%; aspect-ratio:1/1; background:#111; border-radius:12px; overflow:hidden; max-width:${CROP_AREA_MAX_PX}px; margin:0 auto; }
        .fa-hint { color:#6B7280; font-size:12.5px; line-height:1.6; margin-top:8px; text-align:center; }
        .fa-busy-overlay { position:absolute; inset:0; background:rgba(255,255,255,0.65); display:flex; align-items:center; justify-content:center; z-index:50; backdrop-filter:blur(1px); }
        .fa-spinner { width:28px; height:28px; border:3px solid rgba(0,0,0,0.15); border-top-color:#000; border-radius:50%; animation:fa-spin 0.9s linear infinite; }
        @keyframes fa-spin { to { transform: rotate(360deg); } }
        .fa-busy-text { margin-top:10px; font-size:12.5px; color:#111; }
        .fa-busy-wrap { display:flex; flex-direction:column; align-items:center; }
      `}</style>

      <div
        className="w-full"
        style={{
          background: "#FFFFFF",
          border: "1px solid rgba(0,0,0,0.07)",
          borderRadius: 24,
          padding: "18px 20px 24px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.04)",
          marginTop: 24,
          marginBottom: 24
        }}
        aria-busy={isBusy}
        aria-live="polite"
      >
        {/* タイトル中央・余白は詰め気味 */}
        <h2 className="text-[26px] font-extrabold tracking-tight text-gray-800 text-center">
          プロフィール写真
        </h2>

        {/* アバターとボタン（中央寄せ） */}
        <div className="w-full flex justify-center" style={{ position: "relative", marginTop: 10 }}>
          <div className="fa-avatar">
            {imageSrc && (
              <img
                src={imageSrc}
                alt="プロフィール画像"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                draggable={false}
              />
            )}
            {isBusy && (
              <div className="fa-busy-overlay">
                <div className="fa-busy-wrap">
                  <div className="fa-spinner" />
                  <div className="fa-busy-text">アップロード中…</div>
                </div>
              </div>
            )}
          </div>

          {/* アバター基準で重ねる */}
          <button
            type="button"
            onClick={pickFile}
            disabled={isBusy}
            aria-label="編集する"
            className="fa-action-btn fa-action-black"
            style={{
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              bottom: EDIT_BTN_OVERLAP_PX
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 5l1.5-2h3L15 5h3a3 3 0 013 3v9a3 3 0 01-3 3H6a3 3 0 01-3-3V8a3 3 0 013-3h3zm3 13a5 5 0 100-10 5 5 0 000 10z" fill="currentColor" />
            </svg>
            <span style={{ marginLeft: 6 }}>編集する</span>
          </button>
        </div>

        {/* ボタンの分だけ下に余白を作り、その下に注意書きを中央表示 */}
        <div style={{ height: SPACER_BELOW_BTN_PX }} />
        <p
          className="text-center"
          style={{ color: "#6B7280", fontSize: 12.5, lineHeight: 1.6, marginTop: 4 }}
        >
          ※ イラストや風景ではなく、<strong>ご本人の顔が映った写真</strong>を推奨しています。
        </p>

        {/* input */}
        <input ref={inputRef} type="file" accept="image/*" onChange={onFileChange} className="hidden" />
      </div>

      {/* ===== Crop モーダル ===== */}
      {isCropOpen && cropSrc && (
        <div className="fa-modal-backdrop" role="dialog" aria-modal="true">
          <div className="fa-modal">
            {isBusy && (
              <div className="fa-busy-overlay" style={{ borderRadius: 16 }}>
                <div className="fa-busy-wrap">
                  <div className="fa-spinner" />
                  <div className="fa-busy-text">アップロード中…</div>
                </div>
              </div>
            )}
            <div className="fa-modal-header">トリミングの調整</div>
            <div className="fa-modal-body">
              <div className="fa-crop-area">
                <Cropper
                  image={cropSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                  objectFit="contain"
                />
              </div>
              <div style={{ marginTop: 10 }}>
                <input
                  className="fa-slider"
                  type="range"
                  min={1}
                  max={4}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  aria-label="ズーム"
                  disabled={isBusy}
                />
              </div>
              <div className="fa-hint">指またはドラッグで位置を調整、スライダーで拡大縮小できます。</div>
            </div>
            <div className="fa-modal-footer">
              <button
                type="button"
                className="fa-action-btn fa-action-ghost"
                onClick={() => {
                  if (isBusy) return;
                  setCropOpen(false);
                  if (cropSrc?.startsWith("blob:")) URL.revokeObjectURL(cropSrc);
                  setCropSrc(null);
                }}
                disabled={isBusy}
              >
                キャンセル
              </button>
              <button
                type="button"
                className="fa-action-btn fa-action-black"
                onClick={confirmCropAndUpload}
                disabled={isBusy}
              >
                この位置で保存
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
