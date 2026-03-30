import React, { Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import RequireFarmerSession from "./pages/farmer/RequireFarmerSession";
import HomeRedirectPage from "./pages/public/HomeRedirectPage";

const AuthLoginPage = React.lazy(() => import("./pages/auth/AuthLoginPage"));
const AuthEmailRegisterPage = React.lazy(
  () => import("./pages/auth/AuthEmailRegisterPage")
);

import FarmerLayout from "./pages/farmer/FarmerLayout";

import AdminGuard from "./components/AdminGuard";

const FarmerReservationTable = React.lazy(
  () => import("./pages/farmer/FarmerReservationTable/FarmerReservationTable")
);
const FarmerSettingsPage = React.lazy(
  () => import("./pages/farmer/FarmerSettings/FarmerSettingsPage")
);
const FarmerPickupSettingsPage = React.lazy(
  () => import("./pages/farmer/FarmerPickupSettings/FarmerPickupSettingsPage")
);
const FarmerMenu = React.lazy(
  () => import("./pages/farmer/FarmerMenu/FarmerMenu")
);
const FarmerRegistrationPage = React.lazy(
  () => import("./pages/farmer/FarmerRegistration/FarmerRegistrationPage")
);
const FarmerSalesPage = React.lazy(
  () => import("./pages/farmer/FarmerSalesPage")
);
const FarmerPromotionPage = React.lazy(
  () => import("./pages/farmer/FarmerPromotion/FarmerPromotionPage")
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
  () => import("./pages/public/Confirm/ActiveReservationGuardPage")
);
const AccountSettingsPage = React.lazy(
  () => import("./pages/public/AccountSettings/AccountSettingsPage")
);
const PaymentSuccessPage = React.lazy(
  () => import("./pages/public/PaymentSuccess/PaymentSuccessPage")
);
const ReservationBookedPage = React.lazy(
  () => import("./pages/public/ReservationBooked/ReservationBookedPage")
);
const CancelConfirmPage = React.lazy(
  () => import("./pages/public/ReservationBooked/CancelConfirmPage")
);
const ReservationsRedirectPage = React.lazy(
  () => import("./pages/public/Reservations")
);
const LoginOrRegisterPage = React.lazy(
  () => import("./pages/public/LoginOrRegister/LoginOrRegisterPage")
);
const FavoritesPage = React.lazy(
  () => import("./pages/public/Favorites/FavoritesPage")
);
const LoginOnlyPage = React.lazy(
  () => import("./pages/public/Login/LoginOnlyPage")
);

const FarmerLandingPage = React.lazy(
  () => import("./pages/public/FarmerLanding/FarmerLandingPage")
);

const FarmerApplyPage = React.lazy(
  () => import("./pages/public/FarmerApply/FarmerApplyPage")
);

// ===== 法務・ポリシー系ページ =====
const LawPage = React.lazy(() => import("./pages/public/Legal/LawPage"));
const TermsPage = React.lazy(() => import("./pages/public/Legal/TermsPage"));
const PrivacyPage = React.lazy(() => import("./pages/public/Legal/PrivacyPage"));
const FarmerTermsPage = React.lazy(
  () => import("./pages/public/Legal/FarmerTermsPage")
);

const AdminDashboardPage = React.lazy(
  () => import("./pages/admin/AdminDashboardPage")
);
const AdminFarmsListPage = React.lazy(
  () => import("./pages/admin/AdminFarmsListPage")
);
const AdminReservationWeeksPage = React.lazy(
  () => import("./pages/admin/AdminReservationWeeksPage")
);
const AdminReservationEventDetailPage = React.lazy(
  () => import("./pages/admin/AdminReservationEventDetailPage")
);

// ===== ErrorBoundary =====
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
    const error = this.state.error;

    if (error) {
      const isChunkLoadError =
        error?.message?.includes('Failed to fetch dynamically imported module') ||
        error?.message?.includes('Importing a module script failed');

      if (isChunkLoadError) {
        const lastReload = sessionStorage.getItem('lastChunkReload');
        const now = Date.now();
        if (!lastReload || now - Number(lastReload) > 5000) {
          sessionStorage.setItem('lastChunkReload', String(now));
          window.location.reload();
          return null;
        }
      }

      // 自動リロード不可 or その他エラー → 日本語画面
      return (
        <div style={{ padding: '40px 20px', textAlign: 'center', fontFamily: 'sans-serif' }}>
          <p style={{ fontSize: '16px', color: '#333', marginBottom: '16px' }}>
            ページの読み込みに失敗しました
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 24px',
              backgroundColor: '#C62828',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            再読み込み
          </button>
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
          <Route path="/auth/email-register" element={<AuthEmailRegisterPage />} />
          <Route path="/login" element={<LoginOrRegisterPage />} />
          <Route path="/login-only" element={<LoginOnlyPage />} />
          <Route path="/favorites" element={<FavoritesPage />} />
          <Route path="/account/settings" element={<AccountSettingsPage />} />
          <Route path="/farms" element={<FarmsListPage />} />
          <Route path="/farms/:farmId" element={<FarmDetailPage />} />
          <Route path="/farms/:farmId/confirm" element={<ConfirmPage />} />
          <Route path="/farms/:farmId/active" element={<ActiveReservationGuardPage />} />
          <Route path="/reservations" element={<ReservationsRedirectPage />} />
          <Route path="/reservation/booked" element={<ReservationBookedPage />} />
          <Route path="/cancel/confirm" element={<CancelConfirmPage />} />
          <Route path="/payment_success" element={<PaymentSuccessPage />} />
          <Route path="/payment/success" element={<Navigate to="/payment_success" replace />} />

          <Route path="/about-farmer" element={<FarmerLandingPage />} />

          <Route path="/apply" element={<FarmerApplyPage />} />

          {/* ===== 法務・ポリシー系ルート ===== */}
          <Route path="/law" element={<LawPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms/farmer" element={<FarmerTermsPage />} />

          <Route path="/farmer/registration" element={<FarmerRegistrationPage />} />
          <Route path="/farmer" element={<RequireFarmerSession />}>
            <Route element={<FarmerLayout />}>
              <Route index element={<Navigate to="/farmer/reservations" replace />} />
              <Route path="reservations" element={<FarmerReservationTable />} />
              <Route path="settings" element={<FarmerSettingsPage />} />
              <Route path="pickup-settings" element={<FarmerPickupSettingsPage />} />
              <Route path="menu" element={<FarmerMenu />} />
              <Route path="sales" element={<FarmerSalesPage />} />
              <Route path="promotion" element={<FarmerPromotionPage />} />
            </Route>
          </Route>

          {/* 管理者専用ルート（AdminGuardで保護） */}
          <Route path="/admin" element={<AdminGuard />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="farms" element={<AdminFarmsListPage />} />
            <Route path="reservations/weeks" element={<AdminReservationWeeksPage />} />
            <Route path="reservations/event" element={<AdminReservationEventDetailPage />} />
          </Route>

          <Route
            path="*"
            element={
              <div style={{ padding: 16 }}>
                <h1 style={{ fontSize: 18, fontWeight: 700 }}>404 Not Found</h1>
                <p style={{ marginTop: 8 }}>
                  ページが見つかりません。
                  <a href="/farms" style={{ textDecoration: 'underline' }}>農家一覧</a>
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