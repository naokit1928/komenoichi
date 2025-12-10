// frontend/src/pages/farmer/FarmerReservationNoticeModal.tsx

import React from "react";
import styles from "./FarmerReservationTable.module.css";

type FarmerReservationNoticeModalProps = {
  /** モーダルを表示するかどうか */
  isOpen: boolean;
  /** 「次回から表示しない」の現在値（親から渡す） */
  dontShowAgain: boolean;
  /** チェックボックス変更時に呼ばれる（親の state を更新） */
  onChangeDontShowAgain: (value: boolean) => void;
  /** 単純に閉じる（オーバーレイクリック、右上×） */
  onClose: () => void;
  /** 下部のメイン「閉じる」ボタン。ここで永続化を反映させる */
  onPrimaryClose: () => void;
};

/**
 * 農家向けの予約運用ルール説明モーダル。
 */
const FarmerReservationNoticeModal: React.FC<
  FarmerReservationNoticeModalProps
> = ({
  isOpen,
  dontShowAgain,
  onChangeDontShowAgain,
  onClose,
  onPrimaryClose,
}) => {
  if (!isOpen) return null;

  const handleOverlayClick = () => {
    onClose();
  };

  const handleCardClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
    e.stopPropagation();
  };

  const handlePrimaryClose = () => {
    // 永続化の実処理は親側に任せる
    onPrimaryClose();
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
          {/* 小さなリード文 */}
          <p
            className={styles.noticeLead}
            style={{ margin: 0, textAlign: "center" }}
          >
            必ず一度はお読みください。
          </p>

          {/* 本文エリア（スクロール可能） */}
          <div className={styles.noticeScrollArea}>
            <h3 style={{ fontWeight: 600, marginBottom: 2 }}>
              ① 予約の締め切りは受け渡し開始時刻の3時間前です。
            </h3>
            <p style={{ marginTop: 0, marginBottom: 8 }}>
              その時点でその週の予約表が確定し、それ以降の新規予約はすべて翌週扱いに
              なります。
            </p>

            <h3 style={{ fontWeight: 600, marginBottom: 2 }}>
              ② 無断キャンセルへの補償はありません
            </h3>
            <p style={{ marginTop: 0, marginBottom: 8 }}>
              ただし、農家さんの負担を減らすため、無断キャンセルを繰り返す利用者には予約制限をかける
              仕組みを運営側で設けています。
            </p>

            <h3 style={{ fontWeight: 600, marginBottom: 2 }}>
              ③ 一部だけ事前に精米・袋詰めしておくことを推奨します。
            </h3>
            <p style={{ marginTop: 0, marginBottom: 8 }}>
              予約者には、LINE で「最大10分ほどの待ち時間があり得ます」と事前に
              案内しています。待ち時間がそれ以上長くならないように、一部のお米だけ
              事前に精米・袋詰めしておくことをおすすめします。
            </p>

            <h3 style={{ fontWeight: 600, marginBottom: 2 }}>
              ④ 全ての量を事前に精米・袋詰めしておくことは推奨しません。
            </h3>
            <p style={{ marginTop: 0, marginBottom: 0 }}>
              無断キャンセルの可能性もあるため、すべてのお米を事前に精米・袋詰め
              しておくことは推奨しません。一部は事前に準備し、残りはお客さんの前で
              精米するなど、どこまで事前準備するかは各農家さんの判断にお任せします。
            </p>
          </div>

          {/* フッター：チェックボックス */}
          <div className={styles.noticeFooterRow}>
            <label className={styles.noticeFooterRowLeft}>
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => onChangeDontShowAgain(e.target.checked)}
              />
              <span>次回からこの説明を表示しない</span>
            </label>

            <button
              type="button"
              onClick={handlePrimaryClose}
              className={styles.noticeCloseButton}
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FarmerReservationNoticeModal;
