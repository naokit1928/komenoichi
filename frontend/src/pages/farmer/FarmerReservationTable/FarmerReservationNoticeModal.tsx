import React from "react";
import styles from "./FarmerReservationTable.module.css";

type FarmerReservationNoticeModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const FarmerReservationNoticeModal: React.FC<
  FarmerReservationNoticeModalProps
> = ({ isOpen, onClose }) => {
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
                  一部だけ事前に精米・袋詰めしておくことを推奨します
                </div>
                <p className={styles.ruleDesc}>
                  予約者には「最大10分ほどの待ち時間があり得ます」と事前に案内しています。待ち時間が長引きすぎないよう、一部のお米だけ事前に準備しておくことをおすすめします。
                </p>
              </div>

              <div className={styles.ruleItem}>
                <div className={styles.ruleTitle}>
                  <span className={styles.ruleIcon}>④</span>
                  全ての量を事前に準備しておくことは推奨しません
                </div>
                <p className={styles.ruleDesc}>
                  無断キャンセルのリスクもあるため、すべてのお米を事前に精米しておくことは推奨しません。どこまで事前準備するかは、各農家さんのご判断にお任せしています。
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

          {/* フッター：チェックボックスを廃止し、中央揃えのボタンのみに */}
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