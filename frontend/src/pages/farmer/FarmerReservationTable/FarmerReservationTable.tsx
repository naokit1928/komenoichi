import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import styles from "./FarmerReservationTable.module.css";
import FarmerReservationNoticeModal from "./FarmerReservationNoticeModal";

const API_BASE = "http://127.0.0.1:8000";
const NOTICE_STORAGE_KEY = "farmer_reservation_notice_ack";

// -------------------------
// ★ Admin モード追加
// -------------------------
type Props = {
  reservationId?: number;
  mode?: "farmer" | "admin";
};

type EventMeta = {
  pickup_slot_code: string;
  event_start: string;
  event_end: string;
  deadline: string;
  grace_until: string;
  display_label?: string | null;
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

type SummaryItem = {
  size_kg: number;
  total_quantity: number;
  total_kg: number;
  rice_subtotal: number;
};

type BundleSummary = {
  items: SummaryItem[];
  total_rice_subtotal: number | null;
};

type ExpandedReservationResponse = {
  ok?: boolean;
  event_meta: EventMeta | null;
  rows: ReservationRow[];
  bundle_summary?: BundleSummary | null;
};

const SIZE_COLUMNS = [5, 10, 25] as const;

// 金額表示ユーティリティ
function formatYen(value: number | string | null | undefined): string {
  let num: number;

  if (typeof value === "number") {
    num = value;
  } else if (typeof value === "string") {
    const parsed = Number(value);
    num = Number.isNaN(parsed) ? 0 : parsed;
  } else if (typeof value === "boolean") {
    num = value ? 1 : 0;
  } else {
    num = 0;
  }

  try {
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: "JPY",
      maximumFractionDigits: 0,
    }).format(num);
  } catch {
    return `¥${num.toString()}`;
  }
}

function formatEventLabel(meta: EventMeta | null): string {
  if (!meta) return "";
  if (meta.display_label) return meta.display_label;
  const d = new Date(meta.event_start);
  if (Number.isNaN(d.getTime())) return "";
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${month}月${day}日の受け渡し分`;
}

function quantityForSize(
  items: { size_kg: number; quantity: number }[],
  sizeKg: number
): number {
  const found = items.find((i) => i.size_kg === sizeKg);
  return found ? found.quantity : 0;
}

function quantityForSizeFromRows(
  rows: Pick<ReservationRow, "items">[],
  sizeKg: number
): number {
  return rows.reduce((sum, row) => {
    const found = row.items.find((i) => i.size_kg === sizeKg);
    return sum + (found ? found.quantity : 0);
  }, 0);
}

function totalRiceSubtotalFromRows(rows: ReservationRow[]): number {
  return rows.reduce((sum, row) => {
    const v = typeof row.rice_subtotal === "number" ? row.rice_subtotal : 0;
    return sum + v;
  }, 0);
}

// ----------------------------------------------
// ★ 既存を壊さないため、Farmer デフォルト + Admin 拡張
// ----------------------------------------------
const FarmerReservationTable: React.FC<Props> = ({
  reservationId,
  mode = "farmer",
}) => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const farmIdParam = searchParams.get("farm_id");
  const farmId = farmIdParam ? Number(farmIdParam) : NaN;

  const [data, setData] =
    useState<ExpandedReservationResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] =
    useState<ReservationRow | null>(null);

  // 利用ルールモーダルの表示状態
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [dontShowNoticeAgain, setDontShowNoticeAgain] = useState(false);

  // ----------------------------------------------------------
  // ★ Admin モード：単体予約モーダルだけ表示したいので新規 fetch
  // ----------------------------------------------------------
  useEffect(() => {
    if (mode !== "admin") return;
    if (!reservationId) return;

    const fetchAdminReservation = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${API_BASE}/api/admin/reservations?reservation_id=${reservationId}`
        );
        const json = await res.json();
        const item = json.items?.[0];

        if (!item) {
          setData(null);
          setLoading(false);
          return;
        }

        // items_json は Farmer の詳細APIから取得
        const detailRes = await fetch(
          `${API_BASE}/reservations/${item.reservation_id}`
        );
        const detailJson = await detailRes.json();

        // FarmerReservationTable が期待する rows 構造へ整形
        setData({
          event_meta: null,
          rows: [
            {
              reservation_id: item.reservation_id,
              pickup_code: `R${item.reservation_id}-${item.user_id}`,
              created_at: item.created_at,
              rice_subtotal: item.rice_subtotal,
              items: detailJson.items,
            },
          ],
        });
      } catch (e) {
        console.error("admin fetch error", e);
        setError("管理画面用の予約データ取得に失敗しました");
      } finally {
        setLoading(false);
      }
    };

    fetchAdminReservation();
  }, [mode, reservationId]);

  // ----------------------------------------------------------
  // ★ Farmer モードの既存の一覧フェッチ（1行も削らない）
  // ----------------------------------------------------------
  useEffect(() => {
    if (mode === "admin") return; // ★追加：Admin のときは一覧取得しない

    if (!farmIdParam || Number.isNaN(farmId)) {
      setError("farm_id が指定されていません。URL を確認してください。");
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${API_BASE}/reservations/expanded?farm_id=${farmId}`
        );
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json =
          (await res.json()) as ExpandedReservationResponse;
        if (!cancelled) {
          setData(json);
        }
      } catch (e) {
        if (!cancelled) {
          console.error(
            "Failed to fetch /reservations/expanded",
            e
          );
          setError(
            "予約一覧の取得に失敗しました。時間をおいて再度お試しください。"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [mode, farmId, farmIdParam]);

  // ---------------------------------------------------
  // 既存 ― 初回アクセス時に説明モーダルを表示
  // ---------------------------------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const ack = window.localStorage.getItem(NOTICE_STORAGE_KEY);
      if (ack === "1") {
        setDontShowNoticeAgain(true);
        setShowNoticeModal(false);
      } else {
        setDontShowNoticeAgain(false);
        setShowNoticeModal(mode === "farmer"); // ★Admin の時は出さない
      }
    } catch {
      setDontShowNoticeAgain(false);
      setShowNoticeModal(mode === "farmer");
    }
  }, [mode]);

  const hasRows =
    !!data && Array.isArray(data.rows) && data.rows.length > 0;

  // サイズ別合計
  const totalBySize = SIZE_COLUMNS.map((size) => {
    if (!data || !hasRows) return 0;
    if (
      data.bundle_summary &&
      Array.isArray(data.bundle_summary.items) &&
      data.bundle_summary.items.length > 0
    ) {
      const found =
        data.bundle_summary.items.find(
          (i) => i.size_kg === size
        );
      if (found) return found.total_quantity;
    }
    return quantityForSizeFromRows(data.rows, size);
  });

  const totalAmount: number =
    data && hasRows
      ? data.bundle_summary &&
        typeof data.bundle_summary.total_rice_subtotal ===
          "number"
        ? data.bundle_summary.total_rice_subtotal
        : totalRiceSubtotalFromRows(data.rows)
      : 0;

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

  // 利用ルール
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

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* ----------------------------------------------- */}
        {/* Farmer モードのみヘッダー表示（既存 UI 完全維持） */}
        {/* ----------------------------------------------- */}
        {mode === "farmer" && (
          <header className={styles.header}>
            <button
              type="button"
              className={styles.iconButton}
              onClick={handleBack}
              aria-label="戻る"
            >
              <span className={styles.iconArrow} />
            </button>

            <div className={styles.titleBlock}>
              <div className={styles.title}>予約一覧</div>
              <div className={styles.subtitle}>
                {formatEventLabel(data?.event_meta ?? null)}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <button
                type="button"
                className={styles.noticeCloseButton}
                onClick={handleOpenNoticeModal}
                aria-label="利用ルールを表示"
              >
                ルール
              </button>

              <button
                type="button"
                className={styles.iconButton}
                onClick={handlePrint}
                aria-label="印刷"
              >
                <span className={styles.iconPrint} />
              </button>
            </div>
          </header>
        )}

        {/* ----------------------------------------------- */}
        {/* Farmer モード：既存の一覧テーブル UI 完全保持 */}
        {/* Admin モード：一覧は非表示 → モーダルだけ使う */}
        {/* ----------------------------------------------- */}
        {mode === "farmer" && (
          <section className={styles.tableSection}>
            {loading && (
              <div className={styles.infoText}>
                読み込み中です…
              </div>
            )}
            {error && !loading && (
              <div className={styles.errorText}>{error}</div>
            )}
            {!loading && !error && !hasRows && (
              <div className={styles.infoText}>
                今週の予約はまだありません。
              </div>
            )}

            {!loading && !error && hasRows && (
              <div className={styles.tableWrapper}>
                <table
                  className={styles.table}
                  aria-label="予約サマリー"
                >
                  <colgroup>
                    <col className={styles.colPin} />
                    <col className={styles.colKg} />
                    <col className={styles.colKg} />
                    <col className={styles.colKg} />
                    <col className={styles.colAmount} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>予約番号</th>
                      <th>5kg</th>
                      <th>10kg</th>
                      <th>25kg</th>
                      <th>合計金額</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data!.rows.map((row) => (
                      <tr
                        key={row.reservation_id}
                        className={styles.dataRow}
                        onClick={() => handleRowClick(row)}
                      >
                        <td>{row.pickup_code || "-"}</td>
                        {SIZE_COLUMNS.map((size) => (
                          <td
                            key={size}
                            className={styles.cellCenter}
                          >
                            {quantityForSize(row.items, size)}
                          </td>
                        ))}
                        <td className={styles.cellRight}>
                          {formatYen(row.rice_subtotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className={styles.totalRow}>
                      <td>合計</td>
                      {SIZE_COLUMNS.map((size, idx) => (
                        <td
                          key={size}
                          className={styles.cellCenter}
                        >
                          {totalBySize[idx]}
                        </td>
                      ))}
                      <td className={styles.cellRight}>
                        {formatYen(totalAmount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>
        )}
      </div>

      {/* Farmer モード：既存のルールモーダル（Admin では非表示） */}
      {mode === "farmer" && (
        <FarmerReservationNoticeModal
          isOpen={showNoticeModal}
          dontShowAgain={dontShowNoticeAgain}
          onChangeDontShowAgain={setDontShowNoticeAgain}
          onClose={handleCloseNoticeModal}
          onPrimaryClose={handlePrimaryCloseNoticeModal}
        />
      )}

      {/* ------------------------------------------------- */}
      {/* 予約詳細モーダル（Farmer / Admin どちらも共通） */}
      {/* ------------------------------------------------- */}
      {selectedRow && (
        <div
          className={styles.modalOverlay}
          onClick={handleCloseDetailModal}
        >
          <div
            className={styles.modalCard}
            onClick={(e) => e.stopPropagation()}
          >
            <header className={styles.modalHeader}>
              <div className={styles.modalTitleBlock}>
                <div className={styles.modalTitleRow}>
                  <div className={styles.modalTitle}>
                    予約コード {selectedRow.pickup_code}
                  </div>
                  <div className={styles.modalId}>
                    内部ID：{selectedRow.reservation_id}
                  </div>
                </div>

                <div
                  className={styles.modalNote}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    marginTop: 2,
                  }}
                >
                  ※ 単価は予約時の価格です。この価格で会計をしてください。
                </div>
              </div>

              <button
                type="button"
                className={`${styles.modalCloseButton} ${styles.modalCloseButtonReservation}`}
                onClick={handleCloseDetailModal}
                aria-label="閉じる"
              >
                ×
              </button>
            </header>

            <div className={styles.modalBody}>
              <table className={styles.modalTable}>
                <thead>
                  <tr>
                    <th>商品</th>
                    <th className={styles.cellCenter}>数量</th>
                    <th className={styles.cellRight}>単価</th>
                    <th className={styles.cellRight}>小計</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedRow.items.map((item, idx) => (
                    <tr
                      key={`${selectedRow.reservation_id}-${idx}`}
                    >
                      <td>白米{item.size_kg}kg</td>
                      <td className={styles.cellCenter}>
                        {item.quantity}
                      </td>
                      <td className={styles.cellRight}>
                        {formatYen(item.unit_price)}
                      </td>
                      <td className={styles.cellRight}>
                        {formatYen(item.line_total)}
                      </td>
                    </tr>
                  ))}
                  <tr className={styles.modalTotalRow}>
                    <td>合計</td>
                    <td />
                    <td />
                    <td className={styles.cellRight}>
                      {formatYen(selectedRow.rice_subtotal)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FarmerReservationTable;
