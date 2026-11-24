import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowRight, Plus, RefreshCw } from 'lucide-react';
import { apiFetch, formatDateIN, formatINR } from '../../lib/api';
import { StatusLabel } from '../../components/StatusBadge';
import type { DashboardPayload } from '../../types/gym';

const CHART_COLORS = ['#EF1717', '#FFFFFF', '#737373', '#B91C1C', '#D4D4D4'];

export const DashboardOverview: React.FC = () => {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<DashboardPayload>('/api/admin/dashboard');
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg border border-white/10 bg-[#151515]" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-72 animate-pulse rounded-lg border border-white/10 bg-[#151515]" />
          <div className="h-72 animate-pulse rounded-lg border border-white/10 bg-[#151515]" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-[#EF1717]/40 bg-[#151515] p-6 text-sm text-[#ff8080]">
        {error || 'Unable to load dashboard.'}
      </div>
    );
  }

  const kpiCards = [
    { label: 'Total Members', value: data.kpis.totalMembers, to: '/admin/members' },
    { label: 'Active Members', value: data.kpis.activeMembers, to: '/admin/subscriptions' },
    { label: 'Expired Members', value: data.kpis.expiredMembers, to: '/admin/expired-members', alert: data.kpis.expiredMembers > 0 },
    { label: 'Expiring Soon', value: data.kpis.expiringSoon, to: '/admin/expiring-soon', warn: data.kpis.expiringSoon > 0 },
    { label: "Today's New Registrations", value: data.kpis.todaysRegistrations, to: '/admin/members' },
    { label: 'Total Revenue', value: formatINR(data.kpis.totalRevenue), to: '/admin/payments' },
    { label: 'Pending Payments', value: formatINR(data.kpis.pendingPayments), to: '/admin/payments', warn: data.kpis.pendingPayments > 0 },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-white sm:text-3xl">
            Gym Overview
          </h1>
          <p className="mt-1 text-sm text-[#A0A0A0]">
            Real-time metrics calculated from member, subscription, and payment records.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-[#151515] px-3.5 py-2 text-xs font-medium text-white hover:border-white/30 whitespace-nowrap"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
          <Link
            to="/admin/members/new"
            className="inline-flex items-center gap-2 rounded-md bg-[#EF1717] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white hover:bg-[#d11313] whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            Add Member
          </Link>
        </div>
      </div>

      {/* 8 KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((card) => (
          <Link
            key={card.label}
            to={card.to}
            className="rounded-lg border border-white/10 bg-[#151515] p-5 transition-colors hover:border-white/25"
          >
            <div className="text-xs font-medium text-[#A0A0A0]">{card.label}</div>
            <div
              className={`mt-2 font-mono-tabular text-2xl font-bold ${
                card.alert ? 'text-[#ff6b6b]' : card.warn ? 'text-amber-300' : 'text-white'
              }`}
            >
              {card.value}
            </div>
          </Link>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly Revenue Chart */}
        <div className="rounded-lg border border-white/10 bg-[#151515] p-5">
          <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-white">
            Monthly Revenue (INR)
          </h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.charts.monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                <XAxis dataKey="month" stroke="#A0A0A0" fontSize={12} />
                <YAxis stroke="#A0A0A0" fontSize={12} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F0F0F', border: '1px solid #333', color: '#fff' }}
                  formatter={(value: unknown) => formatINR(Number(value))}
                />
                <Bar dataKey="revenue" fill="#EF1717" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Registration Trend Chart */}
        <div className="rounded-lg border border-white/10 bg-[#151515] p-5">
          <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-white">
            New Member Registration Trend
          </h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.charts.registrationTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                <XAxis dataKey="month" stroke="#A0A0A0" fontSize={12} />
                <YAxis stroke="#A0A0A0" fontSize={12} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F0F0F', border: '1px solid #333', color: '#fff' }}
                />
                <Line
                  type="monotone"
                  dataKey="registrations"
                  stroke="#EF1717"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#EF1717' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Membership Distribution */}
        <div className="rounded-lg border border-white/10 bg-[#151515] p-5">
          <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-white">
            Membership Distribution
          </h2>
          {data.charts.membershipDistribution.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-[#A0A0A0]">
              No active subscriptions recorded yet.
            </div>
          ) : (
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.charts.membershipDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={88}
                    label={({ name, value }) => `${name} (${value})`}
                  >
                    {data.charts.membershipDistribution.map((_, idx) => (
                      <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F0F0F', border: '1px solid #333', color: '#fff' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Expired vs Active */}
        <div className="rounded-lg border border-white/10 bg-[#151515] p-5">
          <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-white">
            Expired vs Active Members
          </h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.charts.expiredVsActive} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                <XAxis type="number" stroke="#A0A0A0" fontSize={12} allowDecimals={false} />
                <YAxis type="category" dataKey="name" stroke="#A0A0A0" fontSize={12} width={72} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F0F0F', border: '1px solid #333', color: '#fff' }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {data.charts.expiredVsActive.map((entry, idx) => (
                    <Cell key={idx} fill={entry.name === 'Active' ? '#22C55E' : '#EF1717'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Payments & Registrations */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-[#151515]">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-white">
              Recent Payments
            </h2>
            <Link to="/admin/payments" className="inline-flex items-center gap-1 text-xs text-[#EF1717] hover:underline">
              View All <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {data.recentPayments.length === 0 ? (
            <div className="p-6 text-sm text-[#A0A0A0]">No payments recorded yet.</div>
          ) : (
            <div className="divide-y divide-white/10">
              {data.recentPayments.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <div>
                    <div className="font-medium text-white">
                      {p.full_name} <span className="font-mono-tabular text-xs text-[#A0A0A0]">· {p.member_id}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-[#A0A0A0]">
                      {p.receipt_number} · {p.payment_method} · {formatDateIN(p.payment_date)}
                    </div>
                  </div>
                  <div className="font-mono-tabular font-semibold text-white">
                    {formatINR(p.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-white/10 bg-[#151515]">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-white">
              Recent Member Registrations
            </h2>
            <Link to="/admin/members" className="inline-flex items-center gap-1 text-xs text-[#EF1717] hover:underline">
              View All <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {data.recentRegistrations.length === 0 ? (
            <div className="p-6 text-sm text-[#A0A0A0]">
              No members registered yet.{' '}
              <Link to="/admin/members/new" className="text-[#EF1717] hover:underline">
                Register first member
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {data.recentRegistrations.map((m) => (
                <Link
                  key={m.id}
                  to={`/admin/members/${m.id}`}
                  className="flex items-center justify-between px-5 py-3 text-sm hover:bg-white/[0.02]"
                >
                  <div>
                    <div className="font-medium text-white">
                      {m.full_name} <span className="font-mono-tabular text-xs text-[#A0A0A0]">· {m.member_id}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-[#A0A0A0]">
                      {m.plan_name} · Joined {formatDateIN(m.registration_date)}
                    </div>
                  </div>
                  <StatusLabel status={m.status} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
