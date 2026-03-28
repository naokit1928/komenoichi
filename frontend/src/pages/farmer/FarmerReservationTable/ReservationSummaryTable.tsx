// frontend/src/pages/farmer/FarmerReservationTable/ReservationSummaryTable.tsx
import React from "react";
import styles from "./FarmerReservationTable.module.css";

type ReservationItem = {
  size_kg: number;
  quantity: number;
};

type ReservationRow = {
  reservation_id: number;
  pickup_code: string;
  rice_subtotal: number | null;
  items: ReservationItem[];
  status: string; 
};

const SIZE_COLUMNS = [5, 10, 25] as const;

function quantityForSize(
  items: { size_kg: number; quantity: number }[],
  sizeKg: number
): number {
  const found = items.find((i) => i.size_kg === sizeKg);
  return found ? found.quantity : 0;
}

type Props = {
  loading: boolean;
  error: string | null;
  hasRows: boolean;
  rows: ReservationRow[];
  totalBySize: number[];
  totalAmount: number;
  formatYen: (v: number | string | null | undefined) => string;
  onRowClick: (row: ReservationRow) => void;
  offset: number;
  checkedIds: number[]; // ★ 追加
};

const ReservationSummaryTable: React.FC<Props> = ({
  loading,
  error,
  hasRows,
  rows,
  totalBySize,
  totalAmount,
  formatYen,
  onRowClick,
  offset,
  checkedIds, // ★ 追加
}) => {
  if (loading) return null;
  if (error) return null;

  if (!hasRows) {
    let emptyMessage = "予約はまだありません。";
    if (offset === -1) emptyMessage = "先週の予約はありません。";
    else if (offset === 0) emptyMessage = "今週の予約はまだありません。";
    else if (offset === 1) emptyMessage = "来週の予約はまだありません。";

    return (
      <div className={styles.emptyStateBox}>
        <p className={styles.emptyText}>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th style={{ whiteSpace: "nowrap" }}>受渡番号</th>
            <th>5kg</th>
            <th>10kg</th>
            <th>25kg</th>
            <th>金額</th>
            <th></th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => {
            // ★ 変更：DBのstatusではなく、ローカルのチェック状態を参照する
            const isCompleted = checkedIds.includes(row.reservation_id);
            const isNoShow = row.status === "no_show";
            
            let rowClass = styles.dataRow;
            if (isCompleted) rowClass += ` ${styles.rowCompleted}`;
            if (isNoShow) rowClass += ` ${styles.rowNoShow}`;

            return (
              <tr
                key={row.reservation_id}
                className={rowClass}
                onClick={() => onRowClick(row)}
              >
                <td style={{ fontWeight: 600, letterSpacing: "0.05em", fontFamily: "monospace", fontSize: "15px" }}>
                  {row.pickup_code}
                  {isCompleted && !isNoShow && <span className={`${styles.statusBadge} ${styles.badgeCompleted}`}>済</span>}
                  {isNoShow && <span className={`${styles.statusBadge} ${styles.badgeNoShow}`}>無断</span>}
                </td>
                {SIZE_COLUMNS.map((size) => {
                  const qty = quantityForSize(row.items, size);
                  return (
                    <td
                      key={size}
                      className={`${styles.cellCenter} ${qty === 0 ? styles.zeroText : ""}`}
                    >
                      {qty}
                    </td>
                  );
                })}
                <td className={styles.cellRight}>
                  {formatYen(row.rice_subtotal)}
                </td>
                <td className={styles.chevronCell}>›</td>
              </tr>
            );
          })}
        </tbody>

        <tfoot>
          <tr className={styles.totalRow}>
            <td>合計</td>
            {SIZE_COLUMNS.map((_, idx) => {
              const totalQty = totalBySize[idx];
              return (
                <td
                  key={idx}
                  className={`${styles.cellCenter} ${totalQty === 0 ? styles.zeroText : ""}`}
                >
                  {totalQty}
                </td>
              );
            })}
            <td className={styles.cellRight}>
              {formatYen(totalAmount)}
            </td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

export default ReservationSummaryTable;