import React from "react";
import {
  DndContext,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
} from "@dnd-kit/sortable";

import {
  MAX_IMAGES,
  byOrder,
  optimizeCloudinary,
} from "./usePrGalleryUpload";
import { usePrGalleryUpload } from "./usePrGalleryUpload";
import type { PrGalleryProps } from "./usePrGalleryUpload";
import {
  Spinner,
  UploadToast,
  SortableItem,
  PreviewModal,
} from "./PrGalleryParts";

/* ================================================================
 * PrGallery メインコンポーネント
 * ================================================================ */

export default function PrGallery({
  farmId,
  initialImages,
  onChanged,
}: PrGalleryProps) {
  const {
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
  } = usePrGalleryUpload({ initialImages, onChanged });

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

      {/* 外枠を div に変更済み（エラー対策） */}
      <div
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
        <div
          className="flex items-center justify-between"
          style={{ marginLeft: -16, marginRight: -16 }}
        >
          <h2 className="text-[20px] font-extrabold tracking-tight">
            スライド写真
          </h2>
          <div className="flex items-center" style={{ gap: 10 }}>
            <button
              type="button"
              onClick={nudgeWiggle}
              className="inline-flex items-center rounded-full text-[12px] font-medium"
              style={{
                background: "#F2F2F2",
                color: "#222222",
                padding: "10px 16px",
                border: "none",
                boxShadow: "0 1px 0 rgba(0,0,0,.04)",
              }}
              title="写真をドラッグして順番を変えられます"
            >
              {uploading ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner size={16} /> アップロード中…
                </span>
              ) : (
                "順番入替え"
              )}
            </button>
          </div>
        </div>

        {/* grid */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ marginLeft: -46, marginRight: -46 }}
        >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext items={ids} strategy={rectSortingStrategy}>
              <div
                className="mt-4 grid"
                style={{
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 12,
                  paddingLeft: 12,
                  paddingRight: 12,
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
                      ref={fileInputRef}
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
      </div>

      {/* オーバーレイ：文言を変更しました */}
      {uploading && <UploadToast text="アップロードしています…" />}

      {preview && preview.img && (
        <PreviewModal
          preview={preview}
          askDelete={askDelete}
          setAskDelete={setAskDelete}
          onDelete={deleteImage}
          onClose={closePreview}
        />
      )}
    </section>
  );
}