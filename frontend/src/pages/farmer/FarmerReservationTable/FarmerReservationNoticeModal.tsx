// frontend/src/pages/farmer/FarmerReservationTable/FarmerReservationNoticeModal.tsx
import React from "react";
import styles from "./FarmerReservationTable.module.css";

type FarmerReservationNoticeModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const FarmerReservationNoticeModal: React.FC<FarmerReservationNoticeModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const handleOverlayClick = () => onClose();
  const handleCardClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
    e.stopPropagation();
  };

  return (
    <div className={styles.modalOverlay} onClick={handleOverlayClick}>
      <div className={styles.modalCard} onClick={handleCardClick}>
        <header className={styles.modalHeader}>
          <div
            className={styles.modalTitleBlock}
            style={{
              justifyContent: "center",
              alignItems: "center",
              textAlign: "center",
              flex: 1,
            }}
          >
            <div className={styles.modalTitle}>予約運用ルールのご案内</div>
          </div>

          <button
            type="button"
            className={styles.modalCloseButton}
            onClick={onClose}
            aria-label="閉じる"
          >
            ×
          </button>
        </header>

        <div className={styles.modalBody}>
          <div className={styles.noticeLeadBox}>
            安全な運用のために、必ず一度はお読みください。
          </div>

          <div className={styles.noticeScrollArea}>
            <div className={styles.ruleList}>

              {/* ① 事前精米・袋詰め */}
              <div className={styles.ruleItem}>
                <div className={styles.ruleTitle}>
                  <span className={styles.ruleIcon}>①</span>
                  お米はすべて事前に精米・袋詰めしておいてください
                </div>
                <p className={styles.ruleDesc}>
                  受け渡し日までに全量を精米・袋詰めしておくことを推奨します。当日のお待たせを防ぎ、万一キャンセルが出ても翌週に回せます。
                </p>
              </div>

              {/* ② 精米タイミング */}
              <div className={styles.ruleItem}>
                <div className={styles.ruleTitle}>
                  <span className={styles.ruleIcon}>②</span>
                  精米は受け渡しの3時間前以降に行ってください
                </div>
                <p className={styles.ruleDesc}>
                  受け渡し開始の3時間前に新規予約の受付が締め切られ、それ以降のキャンセルはユーザーに強く自制を求める仕様になっています。つまり<b>3時間前の時点で、その週の予約数がほぼ確定します</b>。精米はそのタイミング以降に行うことで、実際の注文数に合わせた量だけ精米できます。
                </p>
              </div>

              {/* ③ 余った白米の翌週持ち越し */}
              <div className={styles.ruleItem}>
                <div className={styles.ruleTitle}>
                  <span className={styles.ruleIcon}>③</span>
                  余った白米は翌週に回せます（再来週への繰り越しは禁止）
                </div>
                <p className={styles.ruleDesc}>
                  やむを得ず余った分は冷蔵または冷暗所で保管し、翌週の販売に充てることができます。ただし<b>精米後8日を超えた販売</b>、および<b>再来週以降への繰り越しは禁止</b>です。翌週も売れ残った分はご自身でご消費ください。
                </p>
              </div>

              {/* ④ 品質トラブル */}
              <div className={styles.ruleItem}>
                <div className={styles.ruleTitle}>
                  <span className={styles.ruleIcon}>④</span>
                  品質トラブルは当事者間でご解決ください
                </div>
                <p className={styles.ruleDesc}>
                  返品・交換の申し出は受け渡し当日その場で。運営は品質に関するトラブルへの介入を行いません。
                </p>
              </div>

              {/* ⑤ 無断キャンセル報告 */}
              <div className={styles.ruleItem}>
                <div className={styles.ruleTitle}>
                  <span className={styles.ruleIcon}>⑤</span>
                  無断キャンセルが出た場合はシステムから報告をお願いします
                </div>
                <p className={styles.ruleDesc}>
                  受け渡し時刻を過ぎても来られなかった場合、受け渡し画面から「無断キャンセル報告」が行えます。報告していただくことで、同じ予約者による再発を防ぐシステム上の対策が機能します。なお<b>代金の補償は運営では行いません</b>。
                </p>
              </div>

            </div>
          </div>

          <div className={styles.noticeFooterRow} style={{ justifyContent: "center", marginTop: "16px" }}>
            <button
              type="button"
              onClick={onClose}
              className={styles.noticeCloseButton}
              style={{ width: "auto", padding: "8px 24px", fontSize: "14px" }}
            >
              確認して閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FarmerReservationNoticeModal;
