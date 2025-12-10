// src/components/FarmDetailProfileCard.tsx
import React, { useState } from "react";
import type { PublicFarmDetailDTO } from "../types/publicFarm";

type Props = {
  farm: PublicFarmDetailDTO | null;
  ownerFullName: string | null;
  shortLocation: string | null;
  faceImageUrl?: string | null;   // ← ★ 新規追加
};

export default function FarmDetailProfileCard({
  farm,
  ownerFullName,
  shortLocation,
  faceImageUrl,     // ← ★ 追加
}: Props) {
  const [prExpanded, setPrExpanded] = useState(false);

  // 表示用の名前：「◯◯さんのお米」
  const displayName = ownerFullName ? `${ownerFullName}さんのお米` : null;

  // 何も情報が無ければカードごと非表示
  if (!(faceImageUrl || displayName || farm?.pr_text)) {
    return null;
  }

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        background: "#fff",
        padding: 12,
        marginBottom: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {faceImageUrl && (
          <img
            src={faceImageUrl}
            alt="農家プロフィール写真"
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              border: "1px solid #d1d5db",
              objectFit: "cover",
            }}
          />
        )}

        <div>
          {displayName && (
            <div style={{ fontSize: 15, color: "#111827" }}>{displayName}</div>
          )}

          {shortLocation && (
            <div
              style={{
                fontSize: 12,
                color: "#6b7280",
                marginTop: 2,
              }}
            >
              {shortLocation}の農家
            </div>
          )}

          {farm?.farming_years != null && (
            <div
              style={{
                fontSize: 12,
                color: "#6b7280",
                marginTop: 2,
              }}
            >
              農業歴 {farm.farming_years}年
            </div>
          )}
        </div>
      </div>

      {/* PR文 折り畳み */}
      {farm?.pr_text && (
        <div style={{ marginTop: 10 }}>
          <div
            style={
              prExpanded
                ? {
                    fontSize: 14,
                    color: "#374151",
                    lineHeight: 1.6,
                  }
                : {
                    fontSize: 14,
                    color: "#374151",
                    lineHeight: 1.6,
                    display: "-webkit-box",
                    WebkitLineClamp: 8,
                    WebkitBoxOrient: "vertical" as any,
                    overflow: "hidden",
                  }
            }
          >
            {farm.pr_text}
          </div>

          <div style={{ marginTop: 6, textAlign: "center" }}>
            <button
              type="button"
              onClick={() => setPrExpanded((v) => !v)}
              style={{
                background: "transparent",
                border: "none",
                padding: 0,
                fontSize: 12.5,
                color: "#2563eb",
                cursor: "pointer",
              }}
              aria-expanded={prExpanded}
              aria-controls="pr-text"
            >
              {prExpanded ? "閉じる" : "続きを読む"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
