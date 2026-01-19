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
          gap: 8,
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
        >
          <span className={styles.iconPrint} />
        </button>
      </div>
    </header>
  );
};

export default ReservationHeader;
