import React, { useState, useRef, useEffect } from "react";
import styles from "./FarmerReservationTable.module.css";

type Props = {
  subtitle: string;
  onPrint: () => void;
  onOpenNotice: () => void;
  showCancelButton?: boolean;
  onOpenCancel?: () => void;
};

const ReservationHeader: React.FC<Props> = ({
  subtitle,
  onPrint,
  onOpenNotice,
  showCancelButton,
  onOpenCancel,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // メニューの外側をクリックした時に閉じる処理
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen]);

  const handleOpenNotice = () => {
    setIsMenuOpen(false);
    onOpenNotice();
  };

  const handleOpenCancel = () => {
    setIsMenuOpen(false);
    if (onOpenCancel) onOpenCancel();
  };

  return (
    <header className={styles.header}>
      <div className={styles.titleBlock}>
        <div className={styles.mainTitle}>{subtitle}</div>
      </div>

      <div className={styles.headerActions}>
        {/* ハンバーガーメニュー */}
        <div style={{ position: "relative" }} ref={menuRef}>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="メニュー"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>

          {/* ドロップダウンメニュー */}
          {isMenuOpen && (
            <div className={styles.dropdownMenu}>
              {showCancelButton && (
                <button
                  type="button"
                  className={styles.dropdownItemDanger}
                  onClick={handleOpenCancel}
                >
                  今週の予約をキャンセル
                </button>
              )}
              <button
                type="button"
                className={styles.dropdownItem}
                onClick={handleOpenNotice}
              >
                ルールを確認
              </button>
            </div>
          )}
        </div>

        {/* 印刷ボタン */}
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