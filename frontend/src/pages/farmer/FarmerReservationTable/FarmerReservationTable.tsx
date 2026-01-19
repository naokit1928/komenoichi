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
// 型定義（親に残す）
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
// 表示用ユーティリティ（親に残す）
// -------------------------
function formatEventLabel(meta: EventMeta | null): string {
  return meta?.pickup_display ?? "";
}

// ----------------------------------------------
// FarmerReservationTable
// ----------------------------------------------
const FarmerReservationTable: React.FC<Props> = ({
  reservationId,
  mode = "farmer",
}) => {
  // -------------------------
  // データ取得（hook）
  // -------------------------
  const {
    data,
    loading,
    error,
    hasRows,
    totalBySize,
    totalAmount,
    formatYen,
  } = useFarmerReservations({
    mode,
    reservationId,
  });

  // -------------------------
  // UI state
  // -------------------------
  const [selectedRow, setSelectedRow] =
    useState<ReservationRow | null>(null);

  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [dontShowNoticeAgain, setDontShowNoticeAgain] = useState(false);

  // -------------------------
  // 初回ルールモーダル
  // -------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const ack = window.localStorage.getItem(NOTICE_STORAGE_KEY);
      if (ack === "1") {
        setDontShowNoticeAgain(true);
        setShowNoticeModal(false);
      } else {
        setDontShowNoticeAgain(false);
        setShowNoticeModal(mode === "farmer");
      }
    } catch {
      setDontShowNoticeAgain(false);
      setShowNoticeModal(mode === "farmer");
    }
  }, [mode]);

  // -------------------------
  // handlers
  // -------------------------
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

  const handleOpenNoticeModal = () => {
    setShowNoticeModal(true);
  };

  const handleCloseNoticeModal = () => {
    setShowNoticeModal(false);
  };

  const handlePrimaryCloseNoticeModal = () => {
    try {
      if (typeof window !== "undefined") {
        if (dontShowNoticeAgain) {
          window.localStorage.setItem(NOTICE_STORAGE_KEY, "1");
        } else {
          window.localStorage.removeItem(NOTICE_STORAGE_KEY);
        }
      }
    } catch {}
    setShowNoticeModal(false);
  };

  // -------------------------
  // render
  // -------------------------
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

        {/* ---------- Summary Table ---------- */}
        {mode === "farmer" && (
          <section className={styles.tableSection}>
            <ReservationSummaryTable
              loading={loading}
              error={error}
              hasRows={hasRows}
              rows={data?.rows ?? []}
              totalBySize={totalBySize}
              totalAmount={totalAmount}
              formatYen={formatYen}
              onRowClick={handleRowClick}
            />
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
