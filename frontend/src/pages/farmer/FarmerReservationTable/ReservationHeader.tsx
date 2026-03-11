import React from "react";
import styles from "./FarmerReservationTable.module.css";

type Props = {
  title: string;
  subtitle: string;
  onPrint: () => void;
  onOpenNotice: () => void;
};

const ReservationHeader: React.FC<Props> = ({
  title,
  subtitle,
  onPrint,
  onOpenNotice,
}) => {
  return (
    <header className={styles.header}>
      <div className={styles.titleBlock}>
        <div className={styles.title}>{title}</div>
        <div className={styles.subtitle}>{subtitle}</div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12, // アイコン同士の隙間を少し調整
        }}
      >
        <button
          type="button"
          className={styles.noticeCloseButton}
          onClick={onOpenNotice}
        >
          ルール
        </button>

        <button
          type="button"
          className={styles.iconButton}
          onClick={onPrint}
          aria-label="印刷"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 8,
            color: "#111827",
          }}
        >
          {/* ★ 一般的なプリンターのアイコン（SVG）に変更 */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 6 2 18 2 18 9"></polyline>
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
            <rect x="6" y="14" width="12" height="8"></rect>
          </svg>
        </button>
      </div>
    </header>
  );
};

export default ReservationHeader;