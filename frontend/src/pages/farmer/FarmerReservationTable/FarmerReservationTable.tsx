import React, { useEffect, useState } from "react";
import styles from "./FarmerReservationTable.module.css";
import FarmerReservationNoticeModal from "./FarmerReservationNoticeModal";
import { useFarmerReservations } from "./hooks/useFarmerReservations";
import ReservationSummaryTable from "./ReservationSummaryTable";
import ReservationDetailModal from "./ReservationDetailModal";
import ReservationHeader from "./ReservationHeader";

const NOTICE_STORAGE_KEY = "farmer_reservation_notice_ack";

// -------------------------
// Props
// -------------------------
type Props = {
  reservationId?: number;
  mode?: "farmer" | "admin";
};

// -------------------------
// 型定義
// -------------------------
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

// -------------------------
// 表示用ユーティリティ
// -------------------------
function formatEventLabel(meta: EventMeta | null): string {
  return meta?.pickup_display ?? "";
}

const FarmerReservationTable: React.FC<Props> = ({
  mode = "farmer",
}) => {
  // ★ 週の切り替え用ステート
  const [offset, setOffset] = useState(0);

  // ★ フックに offset を渡す
  const { data, loading, error, hasRows, totalBySize, totalAmount, formatYen } = useFarmerReservations(offset);

  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [dontShowNoticeAgain, setDontShowNoticeAgain] = useState(false);
  const [selectedRow, setSelectedRow] = useState<ReservationRow | null>(null);

  useEffect(() => {
    const ack = localStorage.getItem(NOTICE_STORAGE_KEY);
    if (ack === "true") {
      setDontShowNoticeAgain(true);
    } else {
      if (mode === "farmer") {
        setShowNoticeModal(true);
      }
    }
  }, [mode]);

  const handleCloseNoticeModal = () => setShowNoticeModal(false);
  
  const handlePrimaryCloseNoticeModal = () => {
    if (dontShowNoticeAgain) {
      localStorage.setItem(NOTICE_STORAGE_KEY, "true");
    } else {
      localStorage.removeItem(NOTICE_STORAGE_KEY);
    }
    setShowNoticeModal(false);
  };

  const handleOpenNoticeModal = () => setShowNoticeModal(true);
  
  const handleBack = () => {
    window.history.back();
  };
  
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
        {/* ---------- Header ---------- */}
        {mode === "farmer" && (
          <ReservationHeader
            title="予約一覧"
            subtitle={formatEventLabel(data?.event_meta ?? null)}
            onBack={handleBack}
            onPrint={handlePrint}
            onOpenNotice={handleOpenNoticeModal}
          />
        )}

        {/* ---------- 週切り替えナビゲーション ---------- */}
        {mode === "farmer" && (
          <div className={styles.weekNav}>
            <button 
              onClick={() => setOffset((o) => o - 1)} 
              className={styles.weekNavBtn}
              disabled={loading}
            >
              ＜ 先週
            </button>
            <span className={styles.weekNavLabel}>
              {offset === 0 ? "今週" : offset < 0 ? `${Math.abs(offset)}週間前` : `${offset}週間後`}
            </span>
            <button 
              onClick={() => setOffset((o) => o + 1)} 
              className={styles.weekNavBtn}
              disabled={loading}
            >
              来週 ＞
            </button>
          </div>
        )}

        {/* ---------- Summary Table ---------- */}
        {mode === "farmer" && (
          <section className={styles.tableSection}>
            {loading ? (
              <div className={styles.infoText}>読み込み中...</div>
            ) : error ? (
              <div className={styles.errorText}>{error}</div>
            ) : !hasRows ? (
              <div className={styles.emptyState}>
                <p className={styles.emptyText}>
                  まだ予約はありません。<br />
                  新しい予約が入るとここに表示されます。
                </p>
              </div>
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
              />
            )}
          </section>
        )}
      </div>

      {/* ---------- Notice Modal ---------- */}
      {mode === "farmer" && (
        <FarmerReservationNoticeModal
          isOpen={showNoticeModal}
          dontShowAgain={dontShowNoticeAgain}
          onChangeDontShowAgain={setDontShowNoticeAgain}
          onClose={handleCloseNoticeModal}
          onPrimaryClose={handlePrimaryCloseNoticeModal}
        />
      )}

      {/* ---------- Detail Modal ---------- */}
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