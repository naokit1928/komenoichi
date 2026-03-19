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
  if (loading) {
    return <div className={styles.infoText}>読み込み中です…</div>;
  }

  if (error) {
    return <div className={styles.errorText}>{error}</div>;
  }

  if (!hasRows) {
    // ★ offset は 0 か 1 しかないので、条件分岐もシンプルに
    const emptyMessage = offset === 0 
      ? "今週の予約はまだありません。" 
      : "来週の予約はまだありません。";

    return (
      <div className={styles.emptyStateBox}>
        {/* 絵文字は排除し、文字だけを中央に置くストイックなスタイル */}
        <div className={styles.emptyText}>{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.thCompact}>
              <span className={styles.thTop}>予約</span>
              <span className={styles.thBottom}>コード</span>
            </th>
            <th className={styles.thCompact}>5kg</th>
            <th className={styles.thCompact}>10kg</th>
            <th className={styles.thCompact}>25kg</th>
            <th className={styles.thCompact}>合計金額</th>
            <th style={{ width: "24px", padding: 0 }}></th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr
              key={row.reservation_id}
              className={styles.dataRow}
              onClick={() => onRowClick(row)}
            >
              <td>{row.pickup_code}</td>
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