import React, { Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import RequireFarmerSession from "./pages/farmer/RequireFarmerSession";

import HomeRedirectPage from "./pages/public/HomeRedirectPage";

const AuthLoginPage = React.lazy(() => import("./pages/auth/AuthLoginPage"));
const AuthEmailRegisterPage = React.lazy(
  () => import("./pages/auth/AuthEmailRegisterPage")
);

import FarmerLayout from "./pages/farmer/FarmerLayout";

const FarmerReservationTable = React.lazy(
  () =>
    import(
      "./pages/farmer/FarmerReservationTable/FarmerReservationTable"
    )
);
const FarmerSettingsPage = React.lazy(
  () => import("./pages/farmer/FarmerSettings/FarmerSettingsPage")
);
const FarmerPickupSettingsPage = React.lazy(
  () =>
    import(
      "./pages/farmer/FarmerPickupSettings/FarmerPickupSettingsPage"
    )
);
const FarmerMenu = React.lazy(
  () => import("./pages/farmer/FarmerMenu/FarmerMenu")
);
const FarmerRegistrationPage = React.lazy(
  () =>
    import(
      "./pages/farmer/FarmerRegistration/FarmerRegistrationPage"
    )
);

const FarmsListPage = React.lazy(
  () => import("./pages/public/FarmsList/FarmsListPage")
);
const FarmDetailPage = React.lazy(
  () => import("./pages/public/FarmDetail/FarmDetailPage")
);
const ConfirmPage = React.lazy(
  () => import("./pages/public/Confirm/ConfirmPage")
);
const ActiveReservationGuardPage = React.lazy(
  () =>
    import(
      "./pages/public/Confirm/ActiveReservationGuardPage"
    )
);
const AccountSettingsPage = React.lazy(
  () =>
    import(
      "./pages/public/AccountSettings/AccountSettingsPage"
    )
);
const PaymentSuccessPage = React.lazy(
  () => import("./pages/public/PaymentSuccess/PaymentSuccessPage")
);
const ReservationBookedPage = React.lazy(
  () =>
    import(
      "./pages/public/ReservationBooked/ReservationBookedPage"
    )
);
const CancelConfirmPage = React.lazy(
  () =>
    import(
      "./pages/public/ReservationBooked/CancelConfirmPage"
    )
);
const ReservationsRedirectPage = React.lazy(
  () => import("./pages/public/Reservations")
);

const LoginOrRegisterPage = React.lazy(
  () =>
    import(
      "./pages/public/LoginOrRegister/LoginOrRegisterPage"
    )
);

const FavoritesPage = React.lazy(
  () => import("./pages/public/Favorites/FavoritesPage")
);

const LoginOnlyPage = React.lazy(
  () =>
    import("./pages/public/Login/LoginOnlyPage")
);

// ===== 法務・ポリシー系ページ =====
const LawPage = React.lazy(
  () => import("./pages/public/Legal/LawPage")
);
const TermsPage = React.lazy(
  () => import("./pages/public/Legal/TermsPage")
);
const PrivacyPage = React.lazy(
  () => import("./pages/public/Legal/PrivacyPage")
);
// ★追加: 農家向け利用規約のインポート
const FarmerTermsPage = React.lazy(
  () => import("./pages/public/Legal/FarmerTermsPage")
);

const AdminReservationWeeksPage = React.lazy(
  () => import("./pages/admin/AdminReservationWeeksPage")
);
const AdminReservationEventDetailPage = React.lazy(
  () =>
    import(
      "./pages/admin/AdminReservationEventDetailPage"
    )
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

export default function AppRoutes() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<div style={{ padding: 16 }}>Loading…</div>}>
        <Routes>
          <Route path="/" element={<HomeRedirectPage />} />

          <Route path="/auth/login" element={<AuthLoginPage />} />
          <Route
            path="/auth/email-register"
            element={<AuthEmailRegisterPage />}
          />

          <Route path="/login" element={<LoginOrRegisterPage />} />
          <Route path="/login-only" element={<LoginOnlyPage />} />
          
          <Route path="/favorites" element={<FavoritesPage />} />
          
          <Route
            path="/account/settings"
            element={<AccountSettingsPage />}
          />
          <Route path="/farms" element={<FarmsListPage />} />
          <Route path="/farms/:farmId" element={<FarmDetailPage />} />
          <Route
            path="/farms/:farmId/confirm"
            element={<ConfirmPage />}
          />
          <Route
            path="/farms/:farmId/active"
            element={<ActiveReservationGuardPage />}
          />

          <Route
            path="/reservations"
            element={<ReservationsRedirectPage />}
          />
          <Route
            path="/reservation/booked"
            element={<ReservationBookedPage />}
          />
          <Route
            path="/cancel/confirm"
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

          {/* ===== 法務・ポリシー系ルート ===== */}
          <Route path="/law" element={<LawPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          {/* ★追加: 農家向け利用規約のルート */}
          <Route path="/terms/farmer" element={<FarmerTermsPage />} />

          <Route
            path="/farmer/registration"
            element={<FarmerRegistrationPage />}
          />
          <Route path="/farmer" element={<RequireFarmerSession />}>
            <Route element={<FarmerLayout />}>
              <Route
                index
                element={
                  <Navigate to="/farmer/reservations" replace />
                }
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
              <Route path="menu" element={<FarmerMenu />} />
            </Route>
          </Route>

          <Route
            path="/admin/reservations/weeks"
            element={<AdminReservationWeeksPage />}
          />
          <Route
            path="/admin/reservations/event"
            element={<AdminReservationEventDetailPage />}
          />

          <Route
            path="*"
            element={
              <div style={{ padding: 16 }}>
                <h1
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                  }}
                >
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