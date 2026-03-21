import React, { useEffect, useState } from "react";
import styles from "./FarmerReservationTable.module.css";
import FarmerReservationNoticeModal from "./FarmerReservationNoticeModal";
import { useFarmerReservations } from "./hooks/useFarmerReservations";
import ReservationSummaryTable from "./ReservationSummaryTable";
import ReservationDetailModal from "./ReservationDetailModal";
import ReservationHeader from "./ReservationHeader";

const NOTICE_STORAGE_KEY = "farmer_reservation_notice_ack";

type Props = {
  reservationId?: number;
  mode?: "farmer" | "admin";
};

type EventMeta = {
  pickup_slot_code: string;
  pickup_display: string;
};

type ReservationItem = {
  size_kg: number;
  quantity: number;
  unit_price: number | null;
  line_total: number | null;
};

type ReservationRow = {
  reservation_id: number;
  pickup_code: string;
  created_at: string;
  rice_subtotal: number | null;
  items: ReservationItem[];
};

function formatEventLabel(meta: EventMeta | null): string {
  return meta?.pickup_display ?? "";
}

const FarmerReservationTable: React.FC<Props> = ({
  mode = "farmer",
}) => {
  const [offset, setOffset] = useState<number>(0);
  
  const { data, loading, error } = useFarmerReservations(offset);
  const [selectedRow, setSelectedRow] = useState<ReservationRow | null>(null);
  const [showNoticeModal, setShowNoticeModal] = useState<boolean>(false);

  useEffect(() => {
    if (mode !== "farmer") return;
    const hasAck = localStorage.getItem(NOTICE_STORAGE_KEY);
    if (!hasAck) {
      setShowNoticeModal(true);
    }
  }, [mode]);

  const handleCloseNoticeModal = () => {
    localStorage.setItem(NOTICE_STORAGE_KEY, "true");
    setShowNoticeModal(false);
  };

  const handleRowClick = (row: ReservationRow) => {
    setSelectedRow(row);
  };

  const handleCloseDetailModal = () => {
    setSelectedRow(null);
  };

  const formatYen = (v: number | string | null | undefined): string => {
    if (v == null) return "---";
    const num = Number(v);
    if (isNaN(num)) return "---";
    return num.toLocaleString("ja-JP");
  };

  const handlePrint = () => {
    window.print();
  };

  const rows = data?.rows ?? [];
  const hasRows = rows.length > 0;
  
  const SIZE_COLUMNS = [5, 10, 25] as const;
  const totalBySize = SIZE_COLUMNS.map((size) => {
    if (!data || !hasRows) return 0;
    if (
      data.bundle_summary &&
      Array.isArray(data.bundle_summary.items) &&
      data.bundle_summary.items.length > 0
    ) {
      const found = data.bundle_summary.items.find((i) => i.size_kg === size);
      if (found) return found.total_quantity;
    }
    return rows.reduce((sum, r) => {
      const it = r.items.find((i) => i.size_kg === size);
      return sum + (it ? it.quantity : 0);
    }, 0);
  });

  const totalAmount = data?.bundle_summary?.total_rice_subtotal ?? 0;

  // ★ バグ修正：offsetに合わせて空文字の時のメッセージを動的に変更
  const headerSubtitleRaw = formatEventLabel(data?.event_meta || null);
  let displaySubtitle = headerSubtitleRaw || "予約データがありません";

  if (!hasRows && (displaySubtitle.includes("来週") || displaySubtitle.includes("予約データがありません") || displaySubtitle === "")) {
    if (offset === -1) displaySubtitle = "先週の予約はありません";
    else if (offset === 0) displaySubtitle = "今週の予約はありません";
    else if (offset === 1) displaySubtitle = "来週の予約はありません";
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <ReservationHeader
          subtitle={displaySubtitle}
          onPrint={handlePrint}
          onOpenNotice={() => setShowNoticeModal(true)}
        />

        {mode === "farmer" && (
          <div className={styles.segmentControl}>
            <button
              onClick={() => setOffset(-1)}
              className={`${styles.segmentTab} ${offset === -1 ? styles.active : ""}`}
              disabled={loading}
              aria-pressed={offset === -1}
            >
              先週
            </button>
            <button
              onClick={() => setOffset(0)}
              className={`${styles.segmentTab} ${offset === 0 ? styles.active : ""}`}
              disabled={loading}
              aria-pressed={offset === 0}
            >
              今週
            </button>
            <button
              onClick={() => setOffset(1)}
              className={`${styles.segmentTab} ${offset === 1 ? styles.active : ""}`}
              disabled={loading}
              aria-pressed={offset === 1}
            >
              来週
            </button>
          </div>
        )}

        {mode === "farmer" && (
          // ★ key={offset} によって、タブ切り替え時にフェードインアニメーションが発火
          <section key={`table-section-${offset}`} className={`${styles.tableSection} ${styles.tableFadeIn}`}>
            {loading ? (
              <div className={styles.infoText}>読み込み中...</div>
            ) : error ? (
              <div className={styles.errorText}>{error}</div>
            ) : (
              <ReservationSummaryTable
                loading={loading}
                error={error}
                hasRows={hasRows}
                rows={rows}
                totalBySize={totalBySize}
                totalAmount={totalAmount}
                formatYen={formatYen}
                onRowClick={handleRowClick}
                offset={offset}
              />
            )}
          </section>
        )}
      </div>

      {mode === "farmer" && (
        <FarmerReservationNoticeModal
          isOpen={showNoticeModal}
          onClose={handleCloseNoticeModal}
        />
      )}

      {selectedRow && (
        <ReservationDetailModal
          row={selectedRow}
          formatYen={formatYen}
          onClose={handleCloseDetailModal}
        />
      )}
    </div>
  );
};

export default FarmerReservationTable;