// frontend/src/routes.tsx
import React, { Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import RequireFarmerSession from "./pages/farmer/RequireFarmerSession";

/* =========================
   Auth
   ========================= */
const AuthLoginPage = React.lazy(
  () => import("./pages/auth/AuthLoginPage")
);

const AuthEmailRegisterPage = React.lazy(
  () => import("./pages/auth/AuthEmailRegisterPage")
);

/* =========================
   Layout
   ========================= */
import FarmerLayout from "./pages/farmer/FarmerLayout";

/* =========================
   Farmer pages
   ========================= */
const FarmerReservationTable = React.lazy(
  () => import("./pages/farmer/FarmerReservationTable/FarmerReservationTable")
);

const FarmerSettingsPage = React.lazy(
  () => import("./pages/farmer/FarmerSettings/FarmerSettingsPage")
);

const FarmerPickupSettingsPage = React.lazy(
  () =>
    import("./pages/farmer/FarmerPickupSettings/FarmerPickupSettingsPage")
);

const FarmerMenu = React.lazy(
  () =>
    import("./pages/farmer/FarmerMenu/FarmerMenu")
);

const FarmerRegistrationPage = React.lazy(
  () =>
    import("./pages/farmer/FarmerRegistration/FarmerRegistrationPage")
);

/* =========================
   Public pages
   ========================= */
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
  () =>
    import("./pages/public/PaymentSuccess/PaymentSuccessPage")
);

const FeedbackPage = React.lazy(
  () => import("./pages/public/Feedback")
);

const ReservationBookedPage = React.lazy(
  () =>
    import("./pages/public/ReservationBooked/ReservationBookedPage")
);

const CancelConfirmPage = React.lazy(
  () =>
    import("./pages/public/ReservationBooked/CancelConfirmPage")
);

const ReservationsRedirectPage = React.lazy(
  () => import("./pages/public/Reservations")
);

/* =========================
   LINE
   ========================= */

const LoginLinePage = React.lazy(
  () => import("./pages/public/LoginLine/LoginLinePage")
);

const LineCallbackPage = React.lazy(
  () => import("./pages/public/LineCallback/LineCallbackPage")
);

/* =========================
   Admin
   ========================= */
const AdminReservationWeeksPage = React.lazy(
  () => import("./pages/admin/AdminReservationWeeksPage")
);

const AdminReservationEventDetailPage = React.lazy(
  () =>
    import("./pages/admin/AdminReservationEventDetailPage")
);

/* =========================
   ErrorBoundary
   ========================= */
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
            {String(
              this.state.error?.message || this.state.error
            )}
          </pre>
        </div>
      );
    }
    return this.props.children as any;
  }
}

/* =========================
   Routes
   ========================= */
export default function AppRoutes() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<div style={{ padding: 16 }}>Loading…</div>}>
        <Routes>
          {/* Top */}
          <Route path="/" element={<Navigate to="/farms" replace />} />

          {/* Auth */}
          <Route path="/auth/login" element={<AuthLoginPage />} />
          <Route
            path="/auth/email-register"
            element={<AuthEmailRegisterPage />}
          />

          {/* Public */}
          <Route path="/farms" element={<FarmsListPage />} />
          <Route path="/farms/:farmId" element={<FarmDetailPage />} />
          <Route
            path="/farms/:farmId/confirm"
            element={<ConfirmPage />}
          />
          <Route path="/feedback" element={<FeedbackPage />} />
          <Route
            path="/reservations"
            element={<ReservationsRedirectPage />}
          />
          <Route
            path="/reservation/booked"
            element={<ReservationBookedPage />}
          />
          <Route
            path="/reservation/cancel"
            element={<CancelConfirmPage />}
          />
          <Route
            path="/payment_success"
            element={<PaymentSuccessPage />}
          />
          <Route
            path="/payment/success"
            element={<Navigate to="/payment_success" replace />}
          />

          {/* LINE */}
          <Route path="/login/line" element={<LoginLinePage />} />
          <Route
            path="/login/line/callback"
            element={<LineCallbackPage />}
          />
          

          {/* Farmer Registration (outside hub) */}
          <Route
            path="/farmer/registration"
            element={<FarmerRegistrationPage />}
          />

          {/* Farmer Hub */}
          <Route path="/farmer" element={<RequireFarmerSession />}>
            <Route element={<FarmerLayout />}>
              <Route
                index
                element={<Navigate to="/farmer/reservations" replace />}
              />
              <Route
                path="reservations"
                element={<FarmerReservationTable />}
              />
              <Route
                path="settings"
                element={<FarmerSettingsPage />}
              />
              <Route
                path="pickup-settings"
                element={<FarmerPickupSettingsPage />}
              />
              <Route
                path="menu"
                element={<FarmerMenu />}
              />
            </Route>
          </Route>

          {/* Admin */}
          <Route
            path="/admin/reservations/weeks"
            element={<AdminReservationWeeksPage />}
          />
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
  );
}
