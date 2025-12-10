// frontend/src/App.tsx
import React, { Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import LineHomePage from "./pages/farmer/LineHome/LineHomePage";
import FarmerPickupSettingsPage from "./pages/farmer/FarmerPickupSettings/FarmerPickupSettingsPage";

const FarmsListPage = React.lazy(
  () => import("./pages/public/FarmsList/FarmsListPage")
);
const FarmDetailPage = React.lazy(
  () => import("./pages/public/FarmDetail/FarmDetailPage")
);
const ConfirmPage = React.lazy(
  () => import("./pages/public/Confirm/ConfirmPage")
);

const PaymentSuccessPage = React.lazy(
  () => import("./pages/public/PaymentSuccess/PaymentSuccessPage")
);

const FarmerSettingsPage = React.lazy(
  () => import("./pages/farmer/FarmerSettings/FarmerSettingsPage")
);

const LoginLinePage = React.lazy(
  () => import("./pages/public/LoginLine/LoginLinePage")
);

const LineCallbackPage = React.lazy(
  () => import("./pages/public/LineCallback/LineCallbackPage")
);

const FarmerReservationTable = React.lazy(
  () => import("./pages/farmer/FarmerReservationTable/FarmerReservationTable")
);

const FarmerRegistrationPage = React.lazy(
  () => import("./pages/farmer/FarmerRegistration/FarmerRegistrationPage")
);

const FeedbackPage = React.lazy(
  () => import("./pages/public/Feedback")
);

const ReservationBookedPage = React.lazy(
  () => import("./pages/public/ReservationBooked/ReservationBookedPage")
);

// ★ 新しいキャンセル確認ページ
const CancelConfirmPage = React.lazy(
  () => import("./pages/public/ReservationBooked/CancelConfirmPage")
);

// ★ Admin 予約タイムライン（週一覧）
const AdminReservationWeeksPage = React.lazy(
  () => import("./pages/admin/AdminReservationWeeksPage")
);

// ★ Admin 予約イベント詳細（1マス内の予約一覧）
const AdminReservationEventDetailPage = React.lazy(
  () => import("./pages/admin/AdminReservationEventDetailPage")
);

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: any }
> {
  constructor(props: any) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: 16,
            color: "#b91c1c",
            fontFamily: "monospace",
          }}
        >
          <h2>Runtime Error in Route</h2>
          <pre style={{ whiteSpace: "pre-wrap" }}>
            {String(this.state.error?.message || this.state.error)}
          </pre>
        </div>
      );
    }
    return this.props.children as any;
  }
}

export default function App() {
  return (
    <div>
      <ErrorBoundary>
        <Suspense fallback={<div style={{ padding: 16 }}>Loading…</div>}>
          <Routes>
            {/* トップ → 農家一覧へ */}
            <Route path="/" element={<Navigate to="/farms" replace />} />

            {/* 一般ユーザー向け */}
            <Route path="/farms" element={<FarmsListPage />} />
            <Route path="/farms/:farmId" element={<FarmDetailPage />} />
            <Route path="/farms/:farmId/confirm" element={<ConfirmPage />} />

            <Route path="/feedback" element={<FeedbackPage />} />

            {/* 予約キャンセル（LINE から遷移） */}
            <Route
              path="/reservation/cancel"
              element={<CancelConfirmPage />}
            />

            {/* 支払い系 */}
            <Route path="/payment_success" element={<PaymentSuccessPage />} />
            <Route
              path="/payment/success"
              element={<Navigate to="/payment_success" replace />}
            />

            {/* 認証まわり（LINE） */}
            <Route path="/login/line" element={<LoginLinePage />} />
            <Route
              path="/login/line/callback"
              element={<LineCallbackPage />}
            />

            {/* 農家向け */}
            <Route
              path="/farmer/settings"
              element={<FarmerSettingsPage />}
            />
            <Route
              path="/farmer/reservations"
              element={<FarmerReservationTable />}
            />
            <Route
              path="/farmer/registration"
              element={<FarmerRegistrationPage />}
            />

            {/* LINEリッチメニュー系 */}
            <Route path="/line/home" element={<LineHomePage />} />
            <Route
              path="/line/farmer-pickup"
              element={<FarmerPickupSettingsPage />}
            />

            {/* 予約確認ページ */}
            <Route
              path="/reservation/booked"
              element={<ReservationBookedPage />}
            />

            {/* Admin 予約タイムライン（週一覧） */}
            <Route
              path="/admin/reservations/weeks"
              element={<AdminReservationWeeksPage />}
            />

            {/* Admin 予約イベント詳細（1マス内の予約一覧） */}
            <Route
              path="/admin/reservations/event"
              element={<AdminReservationEventDetailPage />}
            />

            {/* 404 */}
            <Route
              path="*"
              element={
                <div style={{ padding: 16 }}>
                  <h1 style={{ fontSize: 18, fontWeight: 700 }}>
                    404 Not Found
                  </h1>
                  <p style={{ marginTop: 8 }}>
                    ページが見つかりません。
                    <a
                      href="/farms"
                      style={{ textDecoration: "underline" }}
                    >
                      農家一覧
                    </a>
                    へ戻る
                  </p>
                </div>
              }
            />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
