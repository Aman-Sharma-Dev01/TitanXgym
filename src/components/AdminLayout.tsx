import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Bell,
  CalendarClock,
  CalendarX2,
  CreditCard,
  FileSpreadsheet,
  LayoutDashboard,
  Layers,
  LogOut,
  Menu,
  Search,
  Settings,
  UserPlus,
  Users,
  X,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, formatINR } from '../lib/api';
import { PWAInstallButton } from './PWAControls';
import type { NotificationRecord } from '../types/gym';

const NAV_ITEMS = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/members', label: 'Members', icon: Users, end: true },
  { to: '/admin/members/new', label: 'Add New Member', icon: UserPlus, end: true },
  { to: '/admin/plans', label: 'Membership Plans', icon: Layers, end: true },
  { to: '/admin/subscriptions', label: 'Subscriptions', icon: CalendarClock, end: true },
  { to: '/admin/expiring-soon', label: 'Expiring Soon', icon: AlertCircle, end: true },
  { to: '/admin/expired-members', label: 'Expired Members', icon: CalendarX2, end: true },
  { to: '/admin/payments', label: 'Payments', icon: CreditCard, end: true },
  { to: '/admin/notifications', label: 'Reminders & Notifications', icon: Bell, end: true },
  { to: '/admin/exports', label: 'Reports & Exports', icon: FileSpreadsheet, end: true },
  { to: '/admin/settings', label: 'Settings', icon: Settings, end: true },
];

export const AdminLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{
    members: Array<{ id: string; member_id: string; full_name: string; mobile: string }>;
    payments: Array<{ id: string; receipt_number: string; amount: number; full_name: string; member_id: string }>;
  } | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const [unreadCount, setUnreadCount] = useState(0);
  const [recentAlerts, setRecentAlerts] = useState<NotificationRecord[]>([]);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const alertsRef = useRef<HTMLDivElement>(null);

  const loadNotificationsSummary = async () => {
    try {
      const data = await apiFetch<{ notifications: NotificationRecord[] }>(
        '/api/admin/notifications?channel=in_app',
      );
      const unread = data.notifications.filter((n) => n.status === 'unread');
      setUnreadCount(unread.length);
      setRecentAlerts(data.notifications.slice(0, 6));
    } catch {
      // Ignore transient errors
    }
  };

  useEffect(() => {
    void loadNotificationsSummary();
  }, [location.pathname]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(() => {
      void apiFetch<{
        members: Array<{ id: string; member_id: string; full_name: string; mobile: string }>;
        payments: Array<{ id: string; receipt_number: string; amount: number; full_name: string; member_id: string }>;
      }>(`/api/admin/search?q=${encodeURIComponent(searchQuery.trim())}`)
        .then(setSearchResults)
        .catch(() => setSearchResults(null));
    }, 220);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchResults(null);
      }
      if (alertsRef.current && !alertsRef.current.contains(e.target as Node)) {
        setAlertsOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const handleMarkAllRead = async () => {
    await apiFetch('/api/admin/notifications/mark-read', {
      method: 'POST',
      body: JSON.stringify({ all: true }),
    });
    await loadNotificationsSummary();
  };

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white flex">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/75 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col border-r border-white/10 bg-[#0F0F0F] transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
          <Link to="/admin" className="flex items-center gap-3">
            <img
              src="/src/assets/images/titanx_logo_1795517847867.jpg"
              alt="TITAN X Logo"
              className="h-9 w-9 rounded object-cover border border-white/15"
              referrerPolicy="no-referrer"
            />
            <div>
              <span className="font-display text-lg font-bold tracking-wider text-white">
                TITAN <span className="text-[#EF1717]">X</span>
              </span>
              <p className="text-[11px] text-[#A0A0A0]">Admin Console</p>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded p-1.5 text-[#A0A0A0] hover:text-white lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Admin Navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-[#EF1717] text-white'
                      : 'text-[#A0A0A0] hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4 space-y-3">
          <PWAInstallButton variant="sidebar" />
          <Link
            to="/"
            className="flex items-center justify-center gap-2 rounded-md border border-white/10 px-3 py-2 text-xs font-medium text-[#A0A0A0] transition-colors hover:border-white/25 hover:text-white"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View Public Website
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-white/10 bg-[#080808]/95 px-4 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3 flex-1 max-w-xl">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-md border border-white/10 p-2 text-white hover:bg-white/5 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="relative flex-1" ref={searchRef}>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A0A0A0]" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search members by name, TX ID, mobile, or receipt..."
                className="w-full rounded-md border border-white/10 bg-[#151515] py-2 pl-9 pr-4 text-sm text-white placeholder-[#737373] focus:border-[#EF1717] focus:outline-none"
              />
              {searchResults && (
                <div className="absolute left-0 right-0 top-full mt-2 rounded-md border border-white/15 bg-[#151515] p-2 shadow-2xl z-50">
                  {searchResults.members.length === 0 && searchResults.payments.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-[#A0A0A0]">No matching records found.</p>
                  ) : (
                    <>
                      {searchResults.members.length > 0 && (
                        <div className="mb-1">
                          <div className="px-3 py-1 text-[11px] font-semibold text-[#A0A0A0]">
                            Members
                          </div>
                          {searchResults.members.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setSearchResults(null);
                                setSearchQuery('');
                                navigate(`/admin/members/${m.id}`);
                              }}
                              className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm hover:bg-white/5"
                            >
                              <span className="font-medium text-white">{m.full_name}</span>
                              <span className="font-mono-tabular text-xs text-[#A0A0A0]">
                                {m.member_id} · {m.mobile}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                      {searchResults.payments.length > 0 && (
                        <div>
                          <div className="px-3 py-1 text-[11px] font-semibold text-[#A0A0A0]">
                            Payment Receipts
                          </div>
                          {searchResults.payments.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setSearchResults(null);
                                setSearchQuery('');
                                navigate('/admin/payments');
                              }}
                              className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm hover:bg-white/5"
                            >
                              <span className="font-mono-tabular text-xs text-white">
                                {p.receipt_number} · {p.full_name}
                              </span>
                              <span className="font-mono-tabular text-xs text-[#EF1717]">
                                {formatINR(p.amount)}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Notification Bell */}
            <div className="relative" ref={alertsRef}>
              <button
                type="button"
                onClick={() => setAlertsOpen((v) => !v)}
                className="relative rounded-md border border-white/10 bg-[#151515] p-2 text-[#A0A0A0] transition-colors hover:border-white/25 hover:text-white"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#EF1717] px-1 font-mono-tabular text-[10px] font-bold text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {alertsOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 rounded-md border border-white/15 bg-[#151515] shadow-2xl z-50">
                  <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                    <span className="text-sm font-semibold text-white">Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={() => void handleMarkAllRead()}
                        className="text-xs font-medium text-[#EF1717] hover:underline"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 divide-y divide-white/10 overflow-y-auto">
                    {recentAlerts.length === 0 ? (
                      <p className="p-4 text-xs text-[#A0A0A0]">No alerts yet.</p>
                    ) : (
                      recentAlerts.map((n) => (
                        <div
                          key={n.id}
                          className={`px-4 py-3 text-xs ${
                            n.status === 'unread' ? 'bg-white/[0.03]' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-white">{n.title}</span>
                            {n.status === 'unread' && (
                              <span className="text-[10px] font-semibold text-[#EF1717]">New</span>
                            )}
                          </div>
                          <p className="mt-1 text-[#A0A0A0] leading-relaxed">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="border-t border-white/10 p-2.5 text-center">
                    <Link
                      to="/admin/notifications"
                      onClick={() => setAlertsOpen(false)}
                      className="text-xs font-medium text-white hover:text-[#EF1717]"
                    >
                      Open Notification Center
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <div className="hidden sm:block text-right">
              <div className="text-xs font-semibold text-white">{user?.name}</div>
              <div className="text-[11px] text-[#A0A0A0] capitalize">{user?.role}</div>
            </div>

            <button
              type="button"
              onClick={() => void handleLogout()}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-[#151515] px-3 py-2 text-xs font-medium text-[#A0A0A0] transition-colors hover:border-[#EF1717]/60 hover:text-white whitespace-nowrap"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
