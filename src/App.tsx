import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AdminLayout } from './components/AdminLayout';
import { OfflineIndicator } from './components/PWAControls';
import { LandingPage } from './pages/LandingPage';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { DashboardOverview } from './pages/admin/DashboardOverview';
import { MembersPage } from './pages/admin/MembersPage';
import { MemberFormPage } from './pages/admin/MemberFormPage';
import { MemberProfilePage } from './pages/admin/MemberProfilePage';
import { PlansPage } from './pages/admin/PlansPage';
import { SubscriptionsPage } from './pages/admin/SubscriptionsPage';
import { PaymentsPage } from './pages/admin/PaymentsPage';
import { NotificationsPage } from './pages/admin/NotificationsPage';
import { ExportsPage } from './pages/admin/ExportsPage';
import { SettingsPage } from './pages/admin/SettingsPage';

const ProtectedAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080808] text-sm text-[#A0A0A0]">
        Loading TITAN X Admin...
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }
  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <OfflineIndicator />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />

          <Route
            path="/admin"
            element={
              <ProtectedAdminRoute>
                <AdminLayout />
              </ProtectedAdminRoute>
            }
          >
            <Route index element={<DashboardOverview />} />
            <Route path="members" element={<MembersPage />} />
            <Route path="members/new" element={<MemberFormPage />} />
            <Route path="members/:id" element={<MemberProfilePage />} />
            <Route path="plans" element={<PlansPage />} />
            <Route
              path="subscriptions"
              element={<SubscriptionsPage defaultStatus="all" pageTitle="Subscriptions" />}
            />
            <Route
              path="expiring-soon"
              element={
                <SubscriptionsPage defaultStatus="Expiring Soon" pageTitle="Expiring Soon Members" />
              }
            />
            <Route
              path="expired-members"
              element={<SubscriptionsPage defaultStatus="Expired" pageTitle="Expired Members" />}
            />
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="exports" element={<ExportsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
