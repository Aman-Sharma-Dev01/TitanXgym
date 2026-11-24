import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CreditCard,
  Edit2,
  Eye,
  Mail,
  MessageCircle,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import {
  addDurationClient,
  apiFetch,
  buildWaLink,
  formatDateIN,
  formatINR,
  getTodayISTClient,
} from '../../lib/api';
import { StatusLabel } from '../../components/StatusBadge';
import type { MembershipPlan, SubscriptionRecord } from '../../types/gym';

export const SubscriptionsPage: React.FC<{ defaultStatus?: string; pageTitle?: string }> = ({
  defaultStatus = 'all',
  pageTitle = 'Subscriptions',
}) => {
  const todayIST = getTodayISTClient();
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const [status, setStatus] = useState(defaultStatus);
  const [planId, setPlanId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [expFrom, setExpFrom] = useState('');
  const [expTo, setExpTo] = useState('');
  const [toast, setToast] = useState<{ ok: boolean; msg: string; waLink?: string } | null>(null);

  const [renewTarget, setRenewTarget] = useState<SubscriptionRecord | null>(null);
  const [renewForm, setRenewForm] = useState({
    plan_id: '',
    plan_name: '',
    start_date: todayIST,
    expiry_date: '',
    total_fee: '',
    amount_paid: '',
    payment_method: 'Cash',
  });

  const [editTarget, setEditTarget] = useState<SubscriptionRecord | null>(null);
  const [editForm, setEditForm] = useState({
    start_date: '',
    expiry_date: '',
    total_fee: '',
    status_override: 'none',
    notes: '',
  });

  const [payTarget, setPayTarget] = useState<SubscriptionRecord | null>(null);
  const [payForm, setPayForm] = useState({
    amount: '',
    payment_method: 'Cash',
    payment_date: todayIST,
    reference_id: '',
  });

  useEffect(() => {
    setStatus(defaultStatus);
  }, [defaultStatus]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status !== 'all') params.set('status', status);
      if (planId) params.set('planId', planId);
      if (paymentStatus !== 'all') params.set('paymentStatus', paymentStatus);
      if (search.trim()) params.set('search', search.trim());
      if (expFrom) params.set('expFrom', expFrom);
      if (expTo) params.set('expTo', expTo);

      const [subRes, planRes] = await Promise.all([
        apiFetch<{ subscriptions: SubscriptionRecord[] }>(`/api/admin/subscriptions?${params.toString()}`),
        apiFetch<{ plans: MembershipPlan[] }>('/api/admin/plans'),
      ]);
      setSubscriptions(subRes.subscriptions);
      setPlans(planRes.plans);
    } finally {
      setLoading(false);
    }
  }, [status, planId, paymentStatus, search, expFrom, expTo]);

  useEffect(() => {
    const t = setTimeout(() => void loadData(), 180);
    return () => clearTimeout(t);
  }, [loadData]);

  const openRenew = (s: SubscriptionRecord) => {
    const defaultStart =
      s.expiry_date >= todayIST ? addDurationClient(s.expiry_date, 1, 'days') : todayIST;
    const activePlans = plans.filter((p) => p.is_active);
    const first = activePlans[0];
    setRenewTarget(s);
    setRenewForm({
      plan_id: first ? String(first.id) : '',
      plan_name: first ? first.name : s.plan_name,
      start_date: defaultStart,
      expiry_date: first ? addDurationClient(defaultStart, first.duration, first.duration_unit) : '',
      total_fee: first ? String(first.price) : String(s.total_fee),
      amount_paid: first ? String(first.price) : String(s.total_fee),
      payment_method: 'Cash',
    });
  };

  const openEdit = (s: SubscriptionRecord) => {
    setEditTarget(s);
    setEditForm({
      start_date: s.start_date,
      expiry_date: s.expiry_date,
      total_fee: String(s.total_fee),
      status_override: s.status_override || 'none',
      notes: s.notes || '',
    });
  };

  const openPay = (s: SubscriptionRecord) => {
    setPayTarget(s);
    setPayForm({
      amount: String(s.pending_amount),
      payment_method: 'Cash',
      payment_date: todayIST,
      reference_id: '',
    });
  };

  const handleRenewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewTarget) return;
    await apiFetch('/api/admin/subscriptions/renew', {
      method: 'POST',
      body: JSON.stringify({
        member_db_id: renewTarget.member_db_id,
        plan_id: renewForm.plan_id ? renewForm.plan_id : null,
        plan_name: renewForm.plan_name,
        start_date: renewForm.start_date,
        expiry_date: renewForm.expiry_date,
        total_fee: Number(renewForm.total_fee || 0),
        amount_paid: Number(renewForm.amount_paid || 0),
        payment_method: renewForm.payment_method,
      }),
    });
    setRenewTarget(null);
    setToast({ ok: true, msg: `Renewed membership for ${renewTarget.full_name}.` });
    await loadData();
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    await apiFetch(`/api/admin/subscriptions/${editTarget.id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...editForm, total_fee: Number(editForm.total_fee) }),
    });
    setEditTarget(null);
    setToast({ ok: true, msg: 'Subscription updated.' });
    await loadData();
  };

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payTarget) return;
    const res = await apiFetch<{ receipt_number: string }>('/api/admin/payments', {
      method: 'POST',
      body: JSON.stringify({
        subscription_id: payTarget.id,
        amount: Number(payForm.amount),
        payment_method: payForm.payment_method,
        payment_date: payForm.payment_date,
        reference_id: payForm.reference_id,
      }),
    });
    setPayTarget(null);
    setToast({ ok: true, msg: `Payment recorded (${res.receipt_number}).` });
    await loadData();
  };

  const sendEmailReminder = async (s: SubscriptionRecord) => {
    try {
      await apiFetch('/api/admin/reminders/manual', {
        method: 'POST',
        body: JSON.stringify({ member_db_id: s.member_db_id, channel: 'email' }),
      });
      setToast({ ok: true, msg: `Email sent to ${s.full_name}.` });
    } catch (err) {
      setToast({ ok: false, msg: err instanceof Error ? err.message : 'Email failed' });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-white sm:text-3xl">
          {pageTitle}
        </h1>
        <p className="mt-1 text-sm text-[#A0A0A0]">
          Date-driven subscription tracking, expiry alerts, pending dues, and quick renewals.
        </p>
      </div>

      {toast && (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            toast.ok
              ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
              : 'border-[#EF1717]/40 bg-[#EF1717]/10 text-[#ff8080]'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Segmented Quick Filters */}
      <div className="flex flex-wrap gap-1.5 rounded-lg border border-white/10 bg-[#151515] p-2">
        {[
          'all',
          'Active',
          'Expiring in 7 Days',
          'Expiring in 3 Days',
          'Expiring Tomorrow',
          'Expired',
          'Pending Payment',
          'Suspended',
        ].map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setStatus(st)}
            className={`rounded px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              status === st
                ? 'bg-[#EF1717] text-white'
                : 'text-[#A0A0A0] hover:bg-white/5 hover:text-white'
            }`}
          >
            {st === 'all' ? 'All Subscriptions' : st}
          </button>
        ))}
      </div>

      {/* Advanced Filters */}
      <div className="grid gap-3 rounded-lg border border-white/10 bg-[#151515] p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative lg:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A0A0A0]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Member ID, Name, Mobile..."
            className="w-full rounded-md border border-white/10 bg-[#080808] py-2 pl-9 pr-3 text-sm text-white placeholder-[#737373] focus:border-[#EF1717] focus:outline-none"
          />
        </div>
        <select
          value={planId}
          onChange={(e) => setPlanId(e.target.value)}
          className="rounded-md border border-white/10 bg-[#080808] px-3 py-2 text-sm text-white"
        >
          <option value="">All Plans</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={paymentStatus}
          onChange={(e) => setPaymentStatus(e.target.value)}
          className="rounded-md border border-white/10 bg-[#080808] px-3 py-2 text-sm text-white"
        >
          <option value="all">All Payment States</option>
          <option value="paid">Fully Paid</option>
          <option value="pending">Pending Dues</option>
        </select>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={expFrom}
            onChange={(e) => setExpFrom(e.target.value)}
            title="Expiry From"
            className="w-full rounded-md border border-white/10 bg-[#080808] px-2 py-2 text-xs text-white"
          />
          <input
            type="date"
            value={expTo}
            onChange={(e) => setExpTo(e.target.value)}
            title="Expiry To"
            className="w-full rounded-md border border-white/10 bg-[#080808] px-2 py-2 text-xs text-white"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-white/10 bg-[#151515]">
        {loading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-white/5" />
            ))}
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#A0A0A0]">
            No subscriptions match these filters.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs font-semibold uppercase tracking-wider text-[#A0A0A0]">
                <th className="px-4 py-3.5">Member</th>
                <th className="px-4 py-3.5">Plan</th>
                <th className="px-4 py-3.5">Validity</th>
                <th className="px-4 py-3.5 text-right">Days Left</th>
                <th className="px-4 py-3.5 text-right">Fee / Paid / Due</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {subscriptions.map((s) => (
                <tr key={s.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <Link to={`/admin/members/${s.member_db_id}`} className="font-medium text-white hover:text-[#EF1717]">
                      {s.full_name}
                    </Link>
                    <div className="font-mono-tabular text-xs text-[#A0A0A0]">
                      {s.member_id} · {s.mobile}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#D4D4D4]">{s.plan_name}</td>
                  <td className="px-4 py-3 font-mono-tabular text-xs text-[#D4D4D4]">
                    <div>{formatDateIN(s.start_date)}</div>
                    <div className="text-[#A0A0A0]">to {formatDateIN(s.expiry_date)}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono-tabular text-xs font-semibold">
                    <span className={s.days_remaining < 0 ? 'text-[#ff6b6b]' : s.days_remaining <= 7 ? 'text-amber-300' : 'text-white'}>
                      {s.days_remaining}d
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono-tabular text-xs">
                    <div className="text-white">{formatINR(s.total_fee)}</div>
                    <div className="text-[#A0A0A0]">
                      Paid {formatINR(s.amount_paid)}
                      {s.pending_amount > 0 && (
                        <span className="text-amber-300"> · Due {formatINR(s.pending_amount)}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusLabel status={s.computed_status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <Link
                        to={`/admin/members/${s.member_db_id}`}
                        className="rounded border border-white/15 p-1.5 text-[#A0A0A0] hover:text-white"
                        title="View Profile"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => openRenew(s)}
                        className="rounded border border-white/15 p-1.5 text-[#EF1717] hover:border-[#EF1717]"
                        title="Renew Membership"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(s)}
                        className="rounded border border-white/15 p-1.5 text-[#A0A0A0] hover:text-white"
                        title="Edit Subscription"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      {s.pending_amount > 0 && (
                        <button
                          type="button"
                          onClick={() => openPay(s)}
                          className="rounded border border-amber-500/40 p-1.5 text-amber-300"
                          title="Record Payment"
                        >
                          <CreditCard className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <a
                        href={buildWaLink(
                          s.mobile,
                          `Hello ${s.full_name}, your TITAN X (${s.plan_name}) membership ${
                            s.days_remaining < 0
                              ? `expired on ${formatDateIN(s.expiry_date)}`
                              : `expires on ${formatDateIN(s.expiry_date)}`
                          }. Please renew to continue training.`,
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded border border-white/15 p-1.5 text-emerald-400 hover:border-emerald-500/50"
                        title="Contact via WhatsApp"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </a>
                      {s.email && (
                        <button
                          type="button"
                          onClick={() => void sendEmailReminder(s)}
                          className="rounded border border-white/15 p-1.5 text-[#A0A0A0] hover:text-white"
                          title="Send Email Reminder"
                        >
                          <Mail className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Renew Modal */}
      {renewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-lg rounded-lg border border-white/15 bg-[#151515] p-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-display text-lg font-bold uppercase text-white">
                Renew · {renewTarget.full_name}
              </h3>
              <button type="button" onClick={() => setRenewTarget(null)} className="text-[#A0A0A0] hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={(e) => void handleRenewSubmit(e)} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs text-[#A0A0A0]">Membership Plan</label>
                <select
                  value={renewForm.plan_id}
                  onChange={(e) => {
                    const p = plans.find((x) => String(x.id) === e.target.value);
                    if (!p) {
                      setRenewForm({ ...renewForm, plan_id: '' });
                      return;
                    }
                    setRenewForm({
                      ...renewForm,
                      plan_id: String(p.id),
                      plan_name: p.name,
                      expiry_date: addDurationClient(renewForm.start_date, p.duration, p.duration_unit),
                      total_fee: String(p.price),
                      amount_paid: String(p.price),
                    });
                  }}
                  className="mt-1 w-full rounded border border-white/10 bg-[#080808] px-3 py-2 text-sm text-white"
                >
                  <option value="">Custom Plan</option>
                  {plans.filter((p) => p.is_active).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.duration} {p.duration_unit}) – {formatINR(p.price)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#A0A0A0]">Start Date</label>
                  <input
                    type="date"
                    required
                    value={renewForm.start_date}
                    onChange={(e) => setRenewForm({ ...renewForm, start_date: e.target.value })}
                    className="mt-1 w-full rounded border border-white/10 bg-[#080808] px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#A0A0A0]">Expiry Date</label>
                  <input
                    type="date"
                    required
                    value={renewForm.expiry_date}
                    onChange={(e) => setRenewForm({ ...renewForm, expiry_date: e.target.value })}
                    className="mt-1 w-full rounded border border-white/10 bg-[#080808] px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-[#A0A0A0]">Total Fee</label>
                  <input
                    type="number"
                    required
                    value={renewForm.total_fee}
                    onChange={(e) => setRenewForm({ ...renewForm, total_fee: e.target.value })}
                    className="mt-1 w-full rounded border border-white/10 bg-[#080808] px-3 py-2 text-sm text-white font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#A0A0A0]">Paid Now</label>
                  <input
                    type="number"
                    value={renewForm.amount_paid}
                    onChange={(e) => setRenewForm({ ...renewForm, amount_paid: e.target.value })}
                    className="mt-1 w-full rounded border border-white/10 bg-[#080808] px-3 py-2 text-sm text-white font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#A0A0A0]">Method</label>
                  <select
                    value={renewForm.payment_method}
                    onChange={(e) => setRenewForm({ ...renewForm, payment_method: e.target.value })}
                    className="mt-1 w-full rounded border border-white/10 bg-[#080808] px-3 py-2 text-sm text-white"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setRenewTarget(null)} className="rounded border border-white/15 px-4 py-2 text-xs text-[#A0A0A0]">
                  Cancel
                </button>
                <button type="submit" className="rounded bg-[#EF1717] px-4 py-2 text-xs font-semibold text-white">
                  Confirm Renewal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Subscription Modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-lg border border-white/15 bg-[#151515] p-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-display text-lg font-bold uppercase text-white">
                Edit Subscription · {editTarget.member_id}
              </h3>
              <button type="button" onClick={() => setEditTarget(null)} className="text-[#A0A0A0] hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={(e) => void handleEditSubmit(e)} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#A0A0A0]">Start Date</label>
                  <input
                    type="date"
                    required
                    value={editForm.start_date}
                    onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
                    className="mt-1 w-full rounded border border-white/10 bg-[#080808] px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#A0A0A0]">Expiry Date</label>
                  <input
                    type="date"
                    required
                    value={editForm.expiry_date}
                    onChange={(e) => setEditForm({ ...editForm, expiry_date: e.target.value })}
                    className="mt-1 w-full rounded border border-white/10 bg-[#080808] px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#A0A0A0]">Total Fee</label>
                  <input
                    type="number"
                    required
                    value={editForm.total_fee}
                    onChange={(e) => setEditForm({ ...editForm, total_fee: e.target.value })}
                    className="mt-1 w-full rounded border border-white/10 bg-[#080808] px-3 py-2 text-sm text-white font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#A0A0A0]">Status Override</label>
                  <select
                    value={editForm.status_override}
                    onChange={(e) => setEditForm({ ...editForm, status_override: e.target.value })}
                    className="mt-1 w-full rounded border border-white/10 bg-[#080808] px-3 py-2 text-sm text-white"
                  >
                    <option value="none">Automatic (Date-Based)</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setEditTarget(null)} className="rounded border border-white/15 px-4 py-2 text-xs text-[#A0A0A0]">
                  Cancel
                </button>
                <button type="submit" className="rounded bg-[#EF1717] px-4 py-2 text-xs font-semibold text-white">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Due Modal */}
      {payTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-lg border border-white/15 bg-[#151515] p-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-display text-lg font-bold uppercase text-white">
                Record Payment · {payTarget.member_id}
              </h3>
              <button type="button" onClick={() => setPayTarget(null)} className="text-[#A0A0A0] hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={(e) => void handlePaySubmit(e)} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs text-[#A0A0A0]">Amount (INR)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={payForm.amount}
                  onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                  className="mt-1 w-full rounded border border-white/10 bg-[#080808] px-3 py-2 text-sm text-white font-mono-tabular"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#A0A0A0]">Method</label>
                  <select
                    value={payForm.payment_method}
                    onChange={(e) => setPayForm({ ...payForm, payment_method: e.target.value })}
                    className="mt-1 w-full rounded border border-white/10 bg-[#080808] px-3 py-2 text-sm text-white"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[#A0A0A0]">Date</label>
                  <input
                    type="date"
                    required
                    value={payForm.payment_date}
                    onChange={(e) => setPayForm({ ...payForm, payment_date: e.target.value })}
                    className="mt-1 w-full rounded border border-white/10 bg-[#080808] px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-[#A0A0A0]">Reference ID</label>
                <input
                  type="text"
                  value={payForm.reference_id}
                  onChange={(e) => setPayForm({ ...payForm, reference_id: e.target.value })}
                  className="mt-1 w-full rounded border border-white/10 bg-[#080808] px-3 py-2 text-sm text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setPayTarget(null)} className="rounded border border-white/15 px-4 py-2 text-xs text-[#A0A0A0]">
                  Cancel
                </button>
                <button type="submit" className="rounded bg-[#EF1717] px-4 py-2 text-xs font-semibold text-white">
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
