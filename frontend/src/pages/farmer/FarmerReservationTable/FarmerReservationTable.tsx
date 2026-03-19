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
  // ★ offset は 0(今週) か 1(来週) のみを取る
  const [offset, setOffset] = useState(0);

  const { data, loading, error, hasRows, totalBySize, totalAmount, formatYen } = useFarmerReservations(offset);

  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [selectedRow, setSelectedRow] = useState<ReservationRow | null>(null);

  useEffect(() => {
    const ack = localStorage.getItem(NOTICE_STORAGE_KEY);
    if (!ack && mode === "farmer") {
      setShowNoticeModal(true);
    }
  }, [mode]);

  const handleCloseNoticeModal = () => {
    localStorage.setItem(NOTICE_STORAGE_KEY, "true");
    setShowNoticeModal(false);
  };

  const handleOpenNoticeModal = () => setShowNoticeModal(true);
  
  const handlePrint = () => {
    window.print();
  };

  const handleRowClick = (row: ReservationRow) => {
    setSelectedRow(row);
  };
  
  const handleCloseDetailModal = () => {
    setSelectedRow(null);
  };

  const rows = data?.rows ?? [];

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {mode === "farmer" && (
          <ReservationHeader
            subtitle={formatEventLabel(data?.event_meta ?? null)}
            onPrint={handlePrint}
            onOpenNotice={handleOpenNoticeModal}
          />
        )}

        {/* ---------- 週切り替えナビゲーション（セグメントコントロール） ---------- */}
        {mode === "farmer" && (
          <div className={styles.segmentControl}>
            {/* ★ アニメーション用のアクティブスライダー */}
            <div 
              className={styles.segmentSlider} 
              style={{ transform: `translateX(${offset * 100}%)` }} 
            />
            
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
          <section className={styles.tableSection}>
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