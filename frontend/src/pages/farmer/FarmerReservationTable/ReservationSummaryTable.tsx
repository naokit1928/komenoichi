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
            {/* ★ 変更：2行だったものを「受渡番号」の1行に変更し、絶対に改行させない */}
            <th style={{ whiteSpace: "nowrap" }}>
              受渡番号
            </th>
            <th>5kg</th>
            <th>10kg</th>
            <th>25kg</th>
            <th>金額</th>
            <th></th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr
              key={row.reservation_id}
              className={styles.dataRow}
              onClick={() => onRowClick(row)}
            >
              {/* ★ 変更：4桁の番号を現場でパッと見やすいように、少し強調したフォントに */}
              <td style={{ fontWeight: 600, letterSpacing: "0.05em", fontFamily: "monospace", fontSize: "15px" }}>
                {row.pickup_code}
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
          ))}
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