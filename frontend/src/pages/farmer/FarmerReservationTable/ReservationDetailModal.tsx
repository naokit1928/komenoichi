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
          
          {/* ★ 変更：名称と視覚的ヒエラルキー（大きさ・色）に圧倒的な差をつける */}
          <div className={styles.modalTitleBlock}>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {/* 現場で一番大事な「4桁」を巨大化 */}
              <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: 600 }}>
                受渡番号
              </div>
              <div style={{ fontSize: "28px", fontWeight: 700, color: "#111827", letterSpacing: "0.1em", lineHeight: 1.1 }}>
                {row.pickup_code}
              </div>
              
              {/* システム用IDはハッシュタグ付きで小さく薄く配置 */}
              <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "4px", fontFamily: "monospace" }}>
                システム照会ID: #{row.reservation_id}
              </div>
            </div>
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
          <table className={styles.modalTable}>
            <thead>
              <tr>
                <th className={styles.cellLeft}>商品</th>
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