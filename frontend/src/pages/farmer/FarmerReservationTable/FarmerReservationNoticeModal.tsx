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

              <div className={styles.ruleItem}>
                <div className={styles.ruleTitle}>
                  <span className={styles.ruleIcon}>①</span>
                  新規予約の受付は開始時刻の3時間前に締め切られます
                </div>
                <p className={styles.ruleDesc}>
                  それ以降の新規予約はすべて翌週扱いになります。ただし、<b>予約者からのキャンセル手続きは直前まで可能</b>な仕様となっています。受け渡しに向かう前に、必ず最新の予約一覧をご確認ください。
                </p>
              </div>

              <div className={styles.ruleItem}>
                <div className={styles.ruleTitle}>
                  <span className={styles.ruleIcon}>②</span>
                  無断キャンセルへの補償・運営の介入はありません
                </div>
                <p className={styles.ruleDesc}>
                  お米代は現地での現金決済となるため、無断キャンセル（ノーショー）が発生した場合の補償や、運営側での仲裁・ペナルティ付与等はいたしかねます。あらかじめご了承ください。
                </p>
              </div>

              <div className={styles.ruleItem}>
                <div className={styles.ruleTitle}>
                  <span className={styles.ruleIcon}>③</span>
                  お米はすべて事前に精米・袋詰めしておいてください
                </div>
                <p className={styles.ruleDesc}>
                  予約者をお待たせしないため、受け渡し日までにすべての予約分を事前に精米・袋詰めしておくことを推奨します。無断キャンセルが発生した場合でも、精米済みのお米は<b>翌週の販売に回すことができます</b>（次のルールをご確認ください）。
                </p>
              </div>

              <div className={styles.ruleItem}>
                <div className={styles.ruleTitle}>
                  <span className={styles.ruleIcon}>④</span>
                  余った白米は翌週に回せます（再来週への繰り越しは禁止）
                </div>
                <p className={styles.ruleDesc}>
                  無断キャンセルにより精米済みのお米がやむを得ず余った場合、冷蔵庫または冷暗所で保管のうえ、<b>翌週の販売に回すことができます</b>。ただし、こめのいちで販売できるのは<b>精米後8日以内</b>のお米に限ります。再来週以降への繰り越しは品質上の理由から<b>固くお断りしています</b>。翌週も売れなかった分はご自身でご消費ください。
                </p>
              </div>

              <div className={styles.ruleItem}>
                <div className={styles.ruleTitle}>
                  <span className={styles.ruleIcon}>⑤</span>
                  品質等に関するトラブルは当事者間でご解決ください
                </div>
                <p className={styles.ruleDesc}>
                  運営は品質に関するクレームに一切関与いたしません。なお、予約者には「返品・交換の申し出は受け渡し時にその場で行うこと」と規約で定めています。受け渡し日以降の返品対応は原則不要ですが、実際の対応は各農家さんのご判断にお任せします。
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