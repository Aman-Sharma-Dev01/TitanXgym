import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CreditCard,
  Edit2,
  Mail,
  MessageCircle,
  RefreshCw,
  Send,
  Trash2,
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
import type {
  MemberRecord,
  MembershipPlan,
  NotificationRecord,
  PaymentRecord,
  SubscriptionRecord,
} from '../../types/gym';

export const MemberProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const todayIST = getTodayISTClient();

  const [member, setMember] = useState<MemberRecord | null>(null);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'payments' | 'notifications'>('subscriptions');

  const [toast, setToast] = useState<{ ok: boolean; msg: string; waLink?: string } | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const [editForm, setEditForm] = useState({
    full_name: '',
    mobile: '',
    email: '',
    gender: '',
    dob: '',
    address: '',
    emergency_contact: '',
    whatsapp_opt_in: true,
    notes: '',
  });

  const [renewForm, setRenewForm] = useState({
    plan_id: '',
    plan_name: '',
    start_date: todayIST,
    expiry_date: '',
    total_fee: '',
    amount_paid: '',
    payment_method: 'Cash',
    reference_id: '',
    notes: '',
  });

  const [payForm, setPayForm] = useState({
    subscription_id: '',
    amount: '',
    payment_method: 'Cash',
    payment_date: todayIST,
    reference_id: '',
    notes: '',
    send_receipt: false,
  });

  const loadProfile = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [profileRes, plansRes] = await Promise.all([
        apiFetch<{
          member: MemberRecord;
          subscriptions: SubscriptionRecord[];
          payments: PaymentRecord[];
          notifications: NotificationRecord[];
        }>(`/api/admin/members/${id}`),
        apiFetch<{ plans: MembershipPlan[] }>('/api/admin/plans'),
      ]);
      setMember(profileRes.member);
      setSubscriptions(profileRes.subscriptions);
      setPayments(profileRes.payments);
      setNotifications(profileRes.notifications);
      setPlans(plansRes.plans.filter((p) => p.is_active));

      setEditForm({
        full_name: profileRes.member.full_name,
        mobile: profileRes.member.mobile,
        email: profileRes.member.email || '',
        gender: profileRes.member.gender || '',
        dob: profileRes.member.dob || '',
        address: profileRes.member.address || '',
        emergency_contact: profileRes.member.emergency_contact || '',
        whatsapp_opt_in: profileRes.member.whatsapp_opt_in,
        notes: profileRes.member.notes || '',
      });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const currentSub = subscriptions.find((s) => s.is_current === 1) || subscriptions[0];

  const openRenewModal = () => {
    const defaultStart =
      currentSub && currentSub.expiry_date >= todayIST
        ? addDurationClient(currentSub.expiry_date, 1, 'days')
        : todayIST;
    const firstPlan = plans[0];
    setRenewForm({
      plan_id: firstPlan ? String(firstPlan.id) : '',
      plan_name: firstPlan ? firstPlan.name : '',
      start_date: defaultStart,
      expiry_date: firstPlan ? addDurationClient(defaultStart, firstPlan.duration, firstPlan.duration_unit) : '',
      total_fee: firstPlan ? String(firstPlan.price) : '',
      amount_paid: firstPlan ? String(firstPlan.price) : '',
      payment_method: 'Cash',
      reference_id: '',
      notes: '',
    });
    setRenewOpen(true);
  };

  const openPayModal = (sub: SubscriptionRecord) => {
    setPayForm({
      subscription_id: sub.id,
      amount: String(sub.pending_amount),
      payment_method: 'Cash',
      payment_date: todayIST,
      reference_id: '',
      notes: '',
      send_receipt: Boolean(member?.email),
    });
    setPayOpen(true);
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member) return;
    try {
      await apiFetch(`/api/admin/members/${member.id}`, {
        method: 'PUT',
        body: JSON.stringify(editForm),
      });
      setEditOpen(false);
      setToast({ ok: true, msg: 'Member profile updated.' });
      await loadProfile();
    } catch (err) {
      setToast({ ok: false, msg: err instanceof Error ? err.message : 'Update failed' });
    }
  };

  const handleRenewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member) return;
    try {
      await apiFetch('/api/admin/subscriptions/renew', {
        method: 'POST',
        body: JSON.stringify({
          member_db_id: member.id,
          plan_id: renewForm.plan_id ? renewForm.plan_id : null,
          plan_name: renewForm.plan_name,
          start_date: renewForm.start_date,
          expiry_date: renewForm.expiry_date,
          total_fee: Number(renewForm.total_fee || 0),
          amount_paid: Number(renewForm.amount_paid || 0),
          payment_method: renewForm.payment_method,
          reference_id: renewForm.reference_id,
          notes: renewForm.notes,
        }),
      });
      setRenewOpen(false);
      setToast({ ok: true, msg: 'Subscription renewed successfully. History preserved.' });
      await loadProfile();
    } catch (err) {
      setToast({ ok: false, msg: err instanceof Error ? err.message : 'Renewal failed' });
    }
  };

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch<{ receipt_number: string }>('/api/admin/payments', {
        method: 'POST',
        body: JSON.stringify({
          ...payForm,
          amount: Number(payForm.amount),
        }),
      });
      setPayOpen(false);
      setToast({ ok: true, msg: `Payment recorded · Receipt ${res.receipt_number}` });
      await loadProfile();
    } catch (err) {
      setToast({ ok: false, msg: err instanceof Error ? err.message : 'Payment failed' });
    }
  };

  const handleSendManualReminder = async (channel: 'whatsapp' | 'email') => {
    if (!member) return;
    try {
      const res = await apiFetch<{ ok: boolean; error?: string; waLink?: string }>(
        '/api/admin/reminders/manual',
        {
          method: 'POST',
          body: JSON.stringify({ member_db_id: member.id, channel }),
        },
      );
      setToast({
        ok: res.ok,
        msg: res.ok
          ? `${channel === 'whatsapp' ? 'WhatsApp' : 'Email'} reminder sent.`
          : res.error || 'Delivery failed.',
        waLink: res.waLink,
      });
      await loadProfile();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Reminder failed';
      setToast({
        ok: false,
        msg,
        waLink:
          channel === 'whatsapp'
            ? buildWaLink(member.mobile, `Hello ${member.full_name}, reminder from TITAN X Gym Faridabad.`)
            : undefined,
      });
    }
  };

  const handleDelete = async () => {
    if (!member) return;
    await apiFetch(`/api/admin/members/${member.id}`, { method: 'DELETE' });
    navigate('/admin/members');
  };

  if (loading || !member) {
    return (
      <div className="space-y-4">
        <div className="h-32 animate-pulse rounded-lg border border-white/10 bg-[#151515]" />
        <div className="h-64 animate-pulse rounded-lg border border-white/10 bg-[#151515]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            to="/admin/members"
            className="inline-flex items-center gap-1.5 text-xs text-[#A0A0A0] hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Members
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-white sm:text-3xl">
              {member.full_name}
            </h1>
            <span className="font-mono-tabular text-sm text-[#A0A0A0]">{member.member_id}</span>
            {currentSub && <StatusLabel status={(currentSub as unknown as { status: string }).status} />}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openRenewModal}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#EF1717] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white hover:bg-[#d11313]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Renew Membership
          </button>
          {currentSub && currentSub.pending_amount > 0 && (
            <button
              type="button"
              onClick={() => openPayModal(currentSub)}
              className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-3.5 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/20"
            >
              <CreditCard className="h-3.5 w-3.5" />
              Collect Due ({formatINR(currentSub.pending_amount)})
            </button>
          )}
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-[#151515] px-3 py-2 text-xs font-medium text-white hover:border-white/30"
          >
            <Edit2 className="h-3.5 w-3.5" />
            Edit
          </button>
          <button
            type="button"
            onClick={() => setDeleteConfirm(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-[#151515] px-3 py-2 text-xs font-medium text-[#A0A0A0] hover:border-[#EF1717] hover:text-[#EF1717]"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      </div>

      {toast && (
        <div
          className={`flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3 text-sm ${
            toast.ok
              ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
              : 'border-[#EF1717]/40 bg-[#EF1717]/10 text-[#ff8080]'
          }`}
        >
          <span>{toast.msg}</span>
          {toast.waLink && (
            <a
              href={toast.waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Open WhatsApp Chat Fallback
            </a>
          )}
        </div>
      )}

      {/* Profile Summary Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-white/10 bg-[#151515] p-6 space-y-3 text-sm">
          <h2 className="font-display text-base font-semibold uppercase tracking-wide text-white border-b border-white/10 pb-2">
            Contact & Details
          </h2>
          <div className="flex justify-between">
            <span className="text-[#A0A0A0]">Mobile</span>
            <span className="font-mono-tabular text-white">+91 {member.mobile}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#A0A0A0]">Email</span>
            <span className="text-white">{member.email || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#A0A0A0]">Joined</span>
            <span className="font-mono-tabular text-white">{formatDateIN(member.registration_date)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#A0A0A0]">Gender / DOB</span>
            <span className="text-white">
              {member.gender || '—'} · {member.dob ? formatDateIN(member.dob) : '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#A0A0A0]">WhatsApp Opt-In</span>
            <span className="text-white">{member.whatsapp_opt_in ? 'Yes' : 'Opted Out'}</span>
          </div>
          {member.address && (
            <div className="pt-2 border-t border-white/10 text-xs text-[#A0A0A0]">
              Address: <span className="text-white">{member.address}</span>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-white/10 bg-[#151515] p-6 space-y-3 text-sm">
          <h2 className="font-display text-base font-semibold uppercase tracking-wide text-white border-b border-white/10 pb-2">
            Current Subscription
          </h2>
          {currentSub ? (
            <>
              <div className="flex justify-between">
                <span className="text-[#A0A0A0]">Plan</span>
                <span className="font-semibold text-white">{currentSub.plan_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A0A0A0]">Start Date</span>
                <span className="font-mono-tabular text-white">{formatDateIN(currentSub.start_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A0A0A0]">Expiry Date</span>
                <span className="font-mono-tabular text-white">{formatDateIN(currentSub.expiry_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A0A0A0]">Days Remaining</span>
                <span className="font-mono-tabular text-white">
                  {(currentSub as unknown as { daysRemaining: number }).daysRemaining} days
                </span>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-2">
                <span className="text-[#A0A0A0]">Fee / Paid / Pending</span>
                <span className="font-mono-tabular text-white">
                  {formatINR(currentSub.total_fee)} / {formatINR(currentSub.amount_paid)} /{' '}
                  <span className={currentSub.pending_amount > 0 ? 'text-amber-300' : 'text-emerald-400'}>
                    {formatINR(currentSub.pending_amount)}
                  </span>
                </span>
              </div>
            </>
          ) : (
            <p className="text-[#A0A0A0]">No subscription recorded yet.</p>
          )}
        </div>

        <div className="rounded-lg border border-white/10 bg-[#151515] p-6 space-y-3">
          <h2 className="font-display text-base font-semibold uppercase tracking-wide text-white border-b border-white/10 pb-2">
            Manual Reminders
          </h2>
          <p className="text-xs text-[#A0A0A0]">
            Dispatch reminders via configured Cloud API / Email or open direct WhatsApp chat.
          </p>
          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              onClick={() => void handleSendManualReminder('whatsapp')}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-white/15 bg-[#080808] py-2.5 text-xs font-semibold text-white hover:border-[#EF1717]"
            >
              <Send className="h-3.5 w-3.5 text-[#EF1717]" />
              Send WhatsApp Cloud Reminder
            </button>
            <button
              type="button"
              onClick={() => void handleSendManualReminder('email')}
              disabled={!member.email}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-white/15 bg-[#080808] py-2.5 text-xs font-semibold text-white hover:border-white/35 disabled:opacity-40"
            >
              <Mail className="h-3.5 w-3.5" />
              Send Email Reminder
            </button>
            <a
              href={buildWaLink(
                member.mobile,
                `Hello ${member.full_name}! Your TITAN X membership${
                  currentSub ? ` (${currentSub.plan_name}) is valid until ${formatDateIN(currentSub.expiry_date)}` : ''
                }. Contact 9217258251 for renewals.`,
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-md border border-emerald-500/35 bg-emerald-500/10 py-2.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Direct WhatsApp Chat Link
            </a>
          </div>
        </div>
      </div>

      {/* History Tabs */}
      <div className="rounded-lg border border-white/10 bg-[#151515]">
        <div className="flex overflow-x-auto border-b border-white/10 px-4">
          {[
            { key: 'subscriptions', label: `Subscriptions (${subscriptions.length})` },
            { key: 'payments', label: `Payments (${payments.length})` },
            { key: 'notifications', label: `Reminders Log (${notifications.length})` },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`border-b-2 px-4 py-3.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap transition-colors ${
                activeTab === tab.key
                  ? 'border-[#EF1717] text-white'
                  : 'border-transparent text-[#A0A0A0] hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4 overflow-x-auto">
          {activeTab === 'subscriptions' && (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs text-[#A0A0A0]">
                  <th className="py-2.5 pr-4">Plan</th>
                  <th className="py-2.5 pr-4">Start</th>
                  <th className="py-2.5 pr-4">Expiry</th>
                  <th className="py-2.5 pr-4 text-right">Fee</th>
                  <th className="py-2.5 pr-4 text-right">Paid</th>
                  <th className="py-2.5 pr-4 text-right">Pending</th>
                  <th className="py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {subscriptions.map((s) => (
                  <tr key={s.id}>
                    <td className="py-3 pr-4 font-medium text-white">
                      {s.plan_name}{' '}
                      {s.is_current === 1 && <span className="text-xs text-[#EF1717]">(Current)</span>}
                    </td>
                    <td className="py-3 pr-4 font-mono-tabular text-xs text-[#D4D4D4]">{formatDateIN(s.start_date)}</td>
                    <td className="py-3 pr-4 font-mono-tabular text-xs text-[#D4D4D4]">{formatDateIN(s.expiry_date)}</td>
                    <td className="py-3 pr-4 text-right font-mono-tabular text-xs">{formatINR(s.total_fee)}</td>
                    <td className="py-3 pr-4 text-right font-mono-tabular text-xs">{formatINR(s.amount_paid)}</td>
                    <td className="py-3 pr-4 text-right font-mono-tabular text-xs text-amber-300">
                      {formatINR(s.pending_amount)}
                    </td>
                    <td className="py-3">
                      <StatusLabel status={(s as unknown as { status: string }).status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'payments' && (
            payments.length === 0 ? (
              <p className="py-6 text-center text-sm text-[#A0A0A0]">No payments recorded.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs text-[#A0A0A0]">
                    <th className="py-2.5 pr-4">Receipt</th>
                    <th className="py-2.5 pr-4">Date</th>
                    <th className="py-2.5 pr-4">Plan</th>
                    <th className="py-2.5 pr-4">Method</th>
                    <th className="py-2.5 pr-4">Reference</th>
                    <th className="py-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="py-3 pr-4 font-mono-tabular text-xs text-white">{p.receipt_number}</td>
                      <td className="py-3 pr-4 font-mono-tabular text-xs text-[#D4D4D4]">{formatDateIN(p.payment_date)}</td>
                      <td className="py-3 pr-4 text-xs">{p.plan_name}</td>
                      <td className="py-3 pr-4 text-xs">{p.payment_method}</td>
                      <td className="py-3 pr-4 font-mono-tabular text-xs text-[#A0A0A0]">{p.reference_id || '—'}</td>
                      <td className="py-3 text-right font-mono-tabular text-xs font-semibold text-white">
                        {formatINR(p.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {activeTab === 'notifications' && (
            notifications.length === 0 ? (
              <p className="py-6 text-center text-sm text-[#A0A0A0]">No reminder logs yet.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs text-[#A0A0A0]">
                    <th className="py-2.5 pr-4">Channel</th>
                    <th className="py-2.5 pr-4">Title</th>
                    <th className="py-2.5 pr-4">Status</th>
                    <th className="py-2.5">Error / Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {notifications.map((n) => (
                    <tr key={n.id}>
                      <td className="py-3 pr-4 text-xs uppercase text-[#A0A0A0]">{n.channel}</td>
                      <td className="py-3 pr-4 text-xs text-white">{n.title}</td>
                      <td className="py-3 pr-4 text-xs capitalize text-[#D4D4D4]">{n.status}</td>
                      <td className="py-3 text-xs text-[#A0A0A0]">{n.error_message || n.external_message_id || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-lg border border-white/15 bg-[#151515] p-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-display text-lg font-bold uppercase text-white">Edit Member</h3>
              <button type="button" onClick={() => setEditOpen(false)} className="text-[#A0A0A0] hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={(e) => void handleEditSave(e)} className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs text-[#A0A0A0]">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={editForm.full_name}
                    onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                    className="mt-1 w-full rounded border border-white/10 bg-[#080808] px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#A0A0A0]">Mobile *</label>
                  <input
                    type="tel"
                    required
                    value={editForm.mobile}
                    onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })}
                    className="mt-1 w-full rounded border border-white/10 bg-[#080808] px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-[#A0A0A0]">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="mt-1 w-full rounded border border-white/10 bg-[#080808] px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-[#A0A0A0]">Address</label>
                <input
                  type="text"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="mt-1 w-full rounded border border-white/10 bg-[#080808] px-3 py-2 text-sm text-white"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-white pt-1">
                <input
                  type="checkbox"
                  checked={editForm.whatsapp_opt_in}
                  onChange={(e) => setEditForm({ ...editForm, whatsapp_opt_in: e.target.checked })}
                  className="accent-[#EF1717]"
                />
                WhatsApp Reminders Opt-In
              </label>
              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setEditOpen(false)} className="rounded border border-white/15 px-4 py-2 text-xs text-[#A0A0A0]">
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

      {/* Renew Modal */}
      {renewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-lg border border-white/15 bg-[#151515] p-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-display text-lg font-bold uppercase text-white">
                Renew Membership · {member.member_id}
              </h3>
              <button type="button" onClick={() => setRenewOpen(false)} className="text-[#A0A0A0] hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={(e) => void handleRenewSubmit(e)} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs text-[#A0A0A0]">Select Plan</label>
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
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.duration} {p.duration_unit}) – {formatINR(p.price)}
                    </option>
                  ))}
                </select>
              </div>

              {!renewForm.plan_id && (
                <div>
                  <label className="block text-xs text-[#A0A0A0]">Custom Plan Name *</label>
                  <input
                    type="text"
                    required
                    value={renewForm.plan_name}
                    onChange={(e) => setRenewForm({ ...renewForm, plan_name: e.target.value })}
                    className="mt-1 w-full rounded border border-white/10 bg-[#080808] px-3 py-2 text-sm text-white"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#A0A0A0]">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={renewForm.start_date}
                    onChange={(e) => {
                      const p = plans.find((x) => String(x.id) === renewForm.plan_id);
                      setRenewForm({
                        ...renewForm,
                        start_date: e.target.value,
                        expiry_date: p
                          ? addDurationClient(e.target.value, p.duration, p.duration_unit)
                          : renewForm.expiry_date,
                      });
                    }}
                    className="mt-1 w-full rounded border border-white/10 bg-[#080808] px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#A0A0A0]">Expiry Date *</label>
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
                  <label className="block text-xs text-[#A0A0A0]">Total Fee *</label>
                  <input
                    type="number"
                    min="0"
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
                    min="0"
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
                <button type="button" onClick={() => setRenewOpen(false)} className="rounded border border-white/15 px-4 py-2 text-xs text-[#A0A0A0]">
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

      {/* Collect Payment Modal */}
      {payOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-lg border border-white/15 bg-[#151515] p-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-display text-lg font-bold uppercase text-white">Record Payment</h3>
              <button type="button" onClick={() => setPayOpen(false)} className="text-[#A0A0A0] hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={(e) => void handlePaySubmit(e)} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs text-[#A0A0A0]">Amount (INR) *</label>
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
                <label className="block text-xs text-[#A0A0A0]">Reference / Transaction ID</label>
                <input
                  type="text"
                  value={payForm.reference_id}
                  onChange={(e) => setPayForm({ ...payForm, reference_id: e.target.value })}
                  className="mt-1 w-full rounded border border-white/10 bg-[#080808] px-3 py-2 text-sm text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setPayOpen(false)} className="rounded border border-white/15 px-4 py-2 text-xs text-[#A0A0A0]">
                  Cancel
                </button>
                <button type="submit" className="rounded bg-[#EF1717] px-4 py-2 text-xs font-semibold text-white">
                  Save Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-sm rounded-lg border border-white/15 bg-[#151515] p-6">
            <h3 className="font-display text-lg font-bold uppercase text-white">Delete Member?</h3>
            <p className="mt-2 text-sm text-[#A0A0A0]">
              Confirm removing <strong className="text-white">{member.full_name}</strong> ({member.member_id})?
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirm(false)}
                className="rounded border border-white/15 px-4 py-2 text-xs text-[#A0A0A0]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                className="rounded bg-[#EF1717] px-4 py-2 text-xs font-semibold text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
