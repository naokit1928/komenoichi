// frontend/src/pages/farmer/FarmerReservationTable/ReservationDetailModal.tsx
import React, { useState, useEffect } from "react";
import styles from "./FarmerReservationTable.module.css";
import { API_BASE } from "@/config/api";

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
  status: string;
};

type Props = {
  row: ReservationRow;
  formatYen: (v: number | string | null | undefined) => string;
  onClose: () => void;
  onReload: () => void;
  eventEndAt?: string;
  isChecked: boolean; // ★ 追加
  onToggleCheck: (val: boolean) => void; // ★ 追加
};

const ReservationDetailModal: React.FC<Props> = ({
  row,
  formatYen,
  onClose,
  onReload,
  eventEndAt,
  isChecked, // ★
  onToggleCheck, // ★
}) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [isTimeLocked, setIsTimeLocked] = useState(true);
  const [isActionExpired, setIsActionExpired] = useState(false); 

  useEffect(() => {
    if (!eventEndAt) return;
    
    const endDt = new Date(eventEndAt);
    const unlockDt = new Date(endDt.getTime()); 
    const expireDt = new Date(endDt.getTime() + 12 * 60 * 60 * 1000); 

    const checkTime = () => {
      const now = new Date();
      setIsTimeLocked(now < unlockDt);
      setIsActionExpired(now >= expireDt); 
    };

    checkTime();
    const timer = setInterval(checkTime, 10000);
    return () => clearInterval(timer);
  }, [eventEndAt]);

  // ★ 変更：APIを叩かず、フロントエンド（LocalStorage）だけを一瞬で更新して閉じる
  const handleComplete = () => {
    onToggleCheck(true);
    onClose(); 
  };

  const handleUndoComplete = () => {
    onToggleCheck(false);
    onClose(); 
  };

  // ※ ノーショー報告は今まで通りバックエンドと通信する（本物のDB更新のため）
  const handleNoShow = async () => {
    setReporting(true);
    setErrorMsg("");
    try {
      const res = await fetch(`${API_BASE}/api/farmer/reservations/${row.reservation_id}/no_show`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || "報告に失敗しました。時間をおいて再度お試しください。");
      }
      onReload();
      onClose();
    } catch (e: any) {
      setErrorMsg(e.message);
      setReporting(false);
    }
  };

  const handleUndoNoShow = async () => {
    setReporting(true);
    try {
      const res = await fetch(`${API_BASE}/api/farmer/reservations/${row.reservation_id}/undo_no_show`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("通信エラーが発生しました。");
      
      onReload(); 
      setReporting(false);
    } catch (e: any) {
      alert(e.message);
      setReporting(false);
    }
  };

  const isNoShow = row.status === "no_show";

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={styles.modalCard}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.modalHeader}>
          <div className={styles.modalTitleBlock}>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: 600 }}>
                受渡番号
              </div>
              <div style={{ fontSize: "28px", fontWeight: 700, color: "#111827", letterSpacing: "0.1em", lineHeight: 1.1 }}>
                {row.pickup_code}
              </div>
              <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "4px", fontFamily: "monospace" }}>
                システム照会ID: #{row.reservation_id}
              </div>
            </div>
          </div>
          <button type="button" className={styles.modalCloseButton} onClick={onClose} aria-label="閉じる">
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
                  <td className={styles.cellCenter}>{item.quantity}</td>
                  <td className={`${styles.cellRight} ${styles.unitPriceCell}`}>
                    {item.unit_price != null ? item.unit_price.toLocaleString("ja-JP") : ""}
                  </td>
                  <td className={styles.cellRight}>{formatYen(item.line_total)}</td>
                </tr>
              ))}
              <tr className={styles.modalTotalRow}>
                <td colSpan={3} style={{ textAlign: "right", paddingRight: "16px", verticalAlign: "middle" }}>合計</td>
                <td className={`${styles.cellRight} ${styles.receiptTotalAmount}`}>{formatYen(row.rice_subtotal)}</td>
              </tr>
            </tbody>
          </table>

          <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px dashed #e5e7eb" }}>
            
            {/* 完了状態（DBではなくローカルのチェック状態を見る） */}
            {isChecked && !isNoShow && (
              <div style={{ textAlign: "center", padding: "12px", background: "#f3f4f6", borderRadius: "8px" }}>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#111827", marginBottom: "8px" }}>
                  ✅ 受渡完了としてチェック済み
                </div>
                {!isActionExpired && (
                  <button
                    onClick={handleUndoComplete}
                    disabled={reporting}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#6b7280",
                      fontSize: "12px",
                      textDecoration: "underline",
                      cursor: reporting ? "not-allowed" : "pointer",
                      padding: "4px 8px",
                    }}
                  >
                    チェックを外す
                  </button>
                )}
              </div>
            )}

            {/* ノーショー状態 */}
            {isNoShow && (
              <div style={{ textAlign: "center", padding: "12px", background: "#fef2f2", borderRadius: "8px" }}>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#991b1b", marginBottom: "8px" }}>
                  🚨 無断キャンセルとして報告済みです
                </div>
                {!isActionExpired && (
                  <button
                    onClick={handleUndoNoShow}
                    disabled={reporting}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#b91c1c",
                      fontSize: "12px",
                      textDecoration: "underline",
                      cursor: reporting ? "not-allowed" : "pointer",
                      padding: "4px 8px",
                    }}
                  >
                    {reporting ? "処理中..." : "報告を取り消す（遅れて到着した場合など）"}
                  </button>
                )}
              </div>
            )}

            {/* 未処理状態 */}
            {!isChecked && !isNoShow && (
              <>
                {isActionExpired ? (
                  <div style={{ textAlign: "center", padding: "12px", background: "#f9fafb", borderRadius: "8px", color: "#6b7280", fontSize: "13px" }}>
                    🔒 操作期限（受け渡し終了から12時間）を過ぎたため、現在は閲覧のみ可能です。
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <button
                      onClick={handleComplete}
                      disabled={reporting}
                      style={{
                        width: "100%",
                        background: "#111827",
                        border: "none",
                        color: "#ffffff",
                        padding: "12px 16px",
                        borderRadius: "8px",
                        fontSize: "14px",
                        fontWeight: 700,
                        cursor: reporting ? "not-allowed" : "pointer",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                        opacity: reporting ? 0.6 : 1,
                      }}
                    >
                      ✅ 受渡完了としてマークする
                    </button>

                    {!isTimeLocked && (
                      <>
                        {!showConfirm ? (
                          <div style={{ textAlign: "center", marginTop: "8px" }}>
                            <button
                              onClick={() => setShowConfirm(true)}
                              style={{
                                background: "none",
                                border: "none",
                                color: "#b91c1c",
                                fontSize: "12px",
                                fontWeight: 600,
                                cursor: "pointer",
                                textDecoration: "underline"
                              }}
                            >
                              🚨 無断キャンセル（ノーショー）として報告
                            </button>
                          </div>
                        ) : (
                          <div style={{
                            background: "#fef2f2",
                            border: "1px solid #fca5a5",
                            padding: "16px",
                            borderRadius: "8px",
                            animation: "fadeSlideUp 0.2s ease-out"
                          }}>
                            <p style={{ fontSize: "14px", fontWeight: 700, color: "#991b1b", margin: "0 0 8px", textAlign: "center" }}>
                              本当に報告しますか？
                            </p>
                            <p style={{ fontSize: "11px", color: "#b91c1c", margin: "0 0 16px", lineHeight: 1.5, textAlign: "center" }}>
                              ※この操作は取り消せません。<br />
                              ※確実にお客様が現れなかった場合のみ確定してください。
                            </p>
                            
                            <div style={{ display: "flex", gap: "10px" }}>
                              <button
                                onClick={() => setShowConfirm(false)}
                                disabled={reporting}
                                style={{
                                  flex: 1,
                                  background: "#ffffff",
                                  border: "1px solid #d1d5db",
                                  color: "#4b5563",
                                  padding: "10px",
                                  borderRadius: "6px",
                                  fontSize: "13px",
                                  fontWeight: 600,
                                  cursor: reporting ? "not-allowed" : "pointer",
                                }}
                              >
                                やめる
                              </button>
                              <button
                                onClick={handleNoShow}
                                disabled={reporting}
                                style={{
                                  flex: 1,
                                  background: "#b91c1c",
                                  border: "none",
                                  color: "#ffffff",
                                  padding: "10px",
                                  borderRadius: "6px",
                                  fontSize: "13px",
                                  fontWeight: 600,
                                  cursor: reporting ? "not-allowed" : "pointer",
                                  opacity: reporting ? 0.6 : 1,
                                }}
                              >
                                {reporting ? "処理中..." : "確定する"}
                              </button>
                            </div>

                            {errorMsg && (
                              <div style={{ color: "#b91c1c", fontSize: "12px", marginTop: "12px", fontWeight: 600, textAlign: "center" }}>
                                {errorMsg}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReservationDetailModal;