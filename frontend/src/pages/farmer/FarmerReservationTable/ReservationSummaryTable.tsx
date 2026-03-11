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
}) => {
  if (loading) {
    return <div className={styles.infoText}>読み込み中です…</div>;
  }

  if (error) {
    return <div className={styles.errorText}>{error}</div>;
  }

  if (!hasRows) {
    // 予約がない時のデザインを温かみのある表示に変更
    return (
      <div className={styles.emptyStateBox}>
        <div className={styles.emptyStateIcon}>🌾</div>
        <div>今週の予約はまだありません。</div>
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
            <th style={{ width: "24px", padding: 0 }}></th> {/* 矢印用の空ヘッダー */}
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
                    // ★ 数量が0の場合は .zeroText クラスを付与して薄くする
                    className={`${styles.cellCenter} ${qty === 0 ? styles.zeroText : ""}`}
                  >
                    {qty}
                  </td>
                );
              })}
              <td className={styles.cellRight}>
                {formatYen(row.rice_subtotal)}
              </td>
              <td className={styles.chevronCell}>›</td> {/* ここをクリックできるサインを追加 */}
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
                  // ★ 合計も0の場合は薄くする
                  className={`${styles.cellCenter} ${totalQty === 0 ? styles.zeroText : ""}`}
                >
                  {totalQty}
                </td>
              );
            })}
            <td className={styles.cellRight}>
              {formatYen(totalAmount)}
            </td>
            <td></td> {/* 矢印列の空フッター */}
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

export default ReservationSummaryTable;