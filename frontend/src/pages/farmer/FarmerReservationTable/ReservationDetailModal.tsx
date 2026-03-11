import React from "react";
import styles from "./FarmerReservationTable.module.css";

type ReservationItem = {
  size_kg: number;
  quantity: number;
  unit_price: number | null;
  line_total: number | null;
};

type ReservationRow = {
  reservation_id: number;
  pickup_code: string;
  rice_subtotal: number | null;
  items: ReservationItem[];
};

type Props = {
  row: ReservationRow;
  formatYen: (v: number | string | null | undefined) => string;
  onClose: () => void;
};

const ReservationDetailModal: React.FC<Props> = ({
  row,
  formatYen,
  onClose,
}) => {
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={styles.modalCard}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.modalHeader}>
          <div className={styles.modalTitleBlock}>
            <div className={styles.modalTitleRow}>
              <div className={styles.modalTitle}>
                予約コード {row.pickup_code}
              </div>
              <div className={styles.modalId}>
                内部ID：{row.reservation_id}
              </div>
            </div>
          </div>

          <button
            type="button"
            className={styles.modalCloseButton}
            onClick={onClose}
          >
            ×
          </button>
        </header>

        {/* ★ 新しい警告ボックス（注意書きを置き換え、目立たせる） */}
        <div className={styles.warningBox}>
          ⚠️ 以下の単価は「予約時の価格」です。<br />
          必ずこの単価・金額で会計してください。
        </div>

        <div className={styles.modalBody}>
          <table className={styles.modalTable}>
            <thead>
              <tr>
                <th>品名</th>
                <th className={styles.cellCenter}>数量</th>
                <th className={styles.cellRight}>単価</th>
                <th className={styles.cellRight}>金額</th>
              </tr>
            </thead>

            <tbody>
              {row.items.map((item, idx) => (
                <tr key={idx}>
                  <td>白米{item.size_kg}kg</td>
                  <td className={styles.cellCenter}>
                    {item.quantity}
                  </td>
                  
                   <td className={`${styles.cellRight} ${styles.unitPriceCell}`}>
                     {item.unit_price != null
                       ? item.unit_price.toLocaleString("ja-JP")
                       : ""}
                   </td>

                  <td className={styles.cellRight}>
                    {formatYen(item.line_total)}
                  </td>
                </tr>
              ))}

              {/* ★ 合計金額をレシート風に強調（文字を大きく、太く） */}
              <tr className={styles.modalTotalRow}>
                <td colSpan={3} style={{ textAlign: "right", paddingRight: "16px", verticalAlign: "middle" }}>
                  合計
                </td>
                <td className={`${styles.cellRight} ${styles.receiptTotalAmount}`}>
                  {formatYen(row.rice_subtotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ReservationDetailModal;