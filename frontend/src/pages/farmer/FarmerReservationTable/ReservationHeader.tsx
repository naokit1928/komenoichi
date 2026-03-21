import React from "react";
import styles from "./FarmerReservationTable.module.css";

type Props = {
  // title: string; は削除
  subtitle: string;
  onPrint: () => void;
  onOpenNotice: () => void;
};

const ReservationHeader: React.FC<Props> = ({
  subtitle,
  onPrint,
  onOpenNotice,
}) => {
  return (
    <header className={styles.header}>
      <div className={styles.titleBlock}>
        {/* subtitleをメインタイトルとして大きく表示 */}
        <div className={styles.mainTitle}>{subtitle}</div>
      </div>

      {/* ★ 変更：インラインスタイルを削除し、CSSクラス「.headerActions」に変更 */}
      <div className={styles.headerActions}>
        {/* 目立ちすぎないアウトラインボタンに変更 */}
        <button
          type="button"
          className={styles.headerRuleButton}
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
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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