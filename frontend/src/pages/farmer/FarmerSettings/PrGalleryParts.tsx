import React, { useEffect } from "react";
import ReactDOM from "react-dom";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDisableScroll, optimizeCloudinary } from "./usePrGalleryUpload";
import type { PrImage } from "./usePrGalleryUpload";

/* ================================================================
 *  CenterModal（portal）
 * ================================================================ */

export function CenterModal({
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

  return ReactDOM.createPortal(
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
    </>,
    document.body
  );
}

/* ================================================================
 *  Spinner
 * ================================================================ */

export function Spinner({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-label="loading"
      role="status"
    >
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

/* ================================================================
 *  UploadToast
 * ================================================================ */

export function UploadToast({ text }: { text: string }) {
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

/* ================================================================
 *  SortableItem（グリッドタイル）
 * ================================================================ */

export function SortableItem(props: {
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
        touchAction: "none",
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
      onClickCapture={() => {
        if (isDragging) return;
        onOpenPreview(img, index);
      }}
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

/* ================================================================
 *  PreviewModal（プレビュー＋削除確認）
 * ================================================================ */

export function PreviewModal({
  preview,
  askDelete,
  setAskDelete,
  onDelete,
  onClose,
}: {
  preview: { img: PrImage; index: number };
  askDelete: boolean;
  setAskDelete: (v: boolean) => void;
  onDelete: (imageId: string) => void;
  onClose: () => void;
}) {
  return (
    <CenterModal onClose={onClose}>
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

        {/* 削除ボタン */}
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
              <rect x="6.5" y="4" width="11" height="21" rx="2.4" ry="2.4" />
              <path d="M10.5 10v7.5" />
              <path d="M13.5 10v7.5" />
              <path d="M7.4 22.5h9.2" />
            </svg>
          </button>
        </div>

        {/* 削除確認 */}
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
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
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
                onClick={() => onDelete(preview.img.id)}
              >
                削除する
              </button>
            </div>
          </div>
        )}
      </div>
    </CenterModal>
  );
}
