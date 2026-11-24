import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { addDurationClient, apiFetch, formatINR, getTodayISTClient } from '../../lib/api';
import type { MembershipPlan } from '../../types/gym';

export const MemberFormPage: React.FC = () => {
  const navigate = useNavigate();
  const todayIST = getTodayISTClient();
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    full_name: '',
    mobile: '',
    email: '',
    gender: '',
    dob: '',
    address: '',
    photo_url: '',
    emergency_contact: '',
    registration_date: todayIST,
    plan_id: '',
    plan_name: '',
    start_date: todayIST,
    expiry_date: '',
    total_fee: '',
    amount_paid: '',
    payment_method: 'Cash',
    reference_id: '',
    whatsapp_opt_in: true,
    notes: '',
  });

  useEffect(() => {
    apiFetch<{ plans: MembershipPlan[] }>('/api/admin/plans')
      .then((res) => {
        const active = res.plans.filter((p) => p.is_active);
        setPlans(active);
        if (active.length > 0) {
          const first = active[0];
          const exp = addDurationClient(todayIST, first.duration, first.duration_unit);
          setForm((prev) => ({
            ...prev,
            plan_id: String(first.id),
            plan_name: first.name,
            expiry_date: exp,
            total_fee: String(first.price),
            amount_paid: String(first.price),
          }));
        }
      })
      .catch(() => undefined);
  }, [todayIST]);

  const handlePlanChange = (planIdStr: string) => {
    const selected = plans.find((p) => String(p.id) === planIdStr);
    if (!selected) {
      setForm((prev) => ({ ...prev, plan_id: '', plan_name: '' }));
      return;
    }
    const exp = addDurationClient(form.start_date || todayIST, selected.duration, selected.duration_unit);
    setForm((prev) => ({
      ...prev,
      plan_id: String(selected.id),
      plan_name: selected.name,
      expiry_date: exp,
      total_fee: String(selected.price),
      amount_paid: String(selected.price),
    }));
  };

  const handleStartDateChange = (newStart: string) => {
    const selected = plans.find((p) => String(p.id) === form.plan_id);
    const nextExpiry = selected
      ? addDurationClient(newStart, selected.duration, selected.duration_unit)
      : form.expiry_date;
    setForm((prev) => ({
      ...prev,
      start_date: newStart,
      expiry_date: nextExpiry,
    }));
  };

  const totalFeeNum = Number(form.total_fee || 0);
  const amountPaidNum = Number(form.amount_paid || 0);
  const pendingAmount = Math.max(0, totalFeeNum - amountPaidNum);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<{ id: string; member_id: string }>('/api/admin/members', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          plan_id: form.plan_id ? form.plan_id : null,
          total_fee: Number(form.total_fee || 0),
          amount_paid: Number(form.amount_paid || 0),
        }),
      });
      navigate(`/admin/members/${res.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register member');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/admin/members"
            className="inline-flex items-center gap-1.5 text-xs text-[#A0A0A0] hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Members
          </Link>
          <h1 className="mt-2 font-display text-2xl font-bold uppercase tracking-wide text-white sm:text-3xl">
            Add New Member
          </h1>
          <p className="mt-1 text-sm text-[#A0A0A0]">
            Member ID (e.g. TX0001) is generated automatically with duplicate mobile validation.
          </p>
        </div>
      </div>

      {plans.length === 0 && (
        <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 p-4 text-sm text-amber-200">
          No active membership plans found. You can enter a custom plan name & fee below, or{' '}
          <Link to="/admin/plans" className="font-semibold underline">
            create Membership Plans first
          </Link>
          .
        </div>
      )}

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="space-y-8 rounded-lg border border-white/10 bg-[#151515] p-6 sm:p-8"
      >
        {error && (
          <div className="rounded-md border border-[#EF1717]/40 bg-[#EF1717]/10 p-4 text-sm text-[#ff8080]">
            {error}
          </div>
        )}

        {/* Section 1: Member Identity */}
        <div>
          <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-white border-b border-white/10 pb-2">
            01. Member Details
          </h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-[#A0A0A0]">Full Name *</label>
              <input
                type="text"
                required
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="Member full name"
                className="mt-1.5 w-full rounded-md border border-white/10 bg-[#080808] px-3.5 py-2.5 text-sm text-white focus:border-[#EF1717] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#A0A0A0]">Mobile Number *</label>
              <input
                type="tel"
                required
                value={form.mobile}
                onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                placeholder="10-digit mobile number"
                className="mt-1.5 w-full rounded-md border border-white/10 bg-[#080808] px-3.5 py-2.5 text-sm text-white focus:border-[#EF1717] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#A0A0A0]">Email (Optional)</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="member@example.com"
                className="mt-1.5 w-full rounded-md border border-white/10 bg-[#080808] px-3.5 py-2.5 text-sm text-white focus:border-[#EF1717] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#A0A0A0]">Gender</label>
                <select
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value })}
                  className="mt-1.5 w-full rounded-md border border-white/10 bg-[#080808] px-3 py-2.5 text-sm text-white focus:border-[#EF1717] focus:outline-none"
                >
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A0A0A0]">Date of Birth</label>
                <input
                  type="date"
                  value={form.dob}
                  onChange={(e) => setForm({ ...form, dob: e.target.value })}
                  className="mt-1.5 w-full rounded-md border border-white/10 bg-[#080808] px-3 py-2.5 text-sm text-white focus:border-[#EF1717] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#A0A0A0]">Emergency Contact</label>
              <input
                type="text"
                value={form.emergency_contact}
                onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })}
                placeholder="Name & phone"
                className="mt-1.5 w-full rounded-md border border-white/10 bg-[#080808] px-3.5 py-2.5 text-sm text-white focus:border-[#EF1717] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#A0A0A0]">Registration Date</label>
              <input
                type="date"
                required
                value={form.registration_date}
                onChange={(e) => setForm({ ...form, registration_date: e.target.value })}
                className="mt-1.5 w-full rounded-md border border-white/10 bg-[#080808] px-3.5 py-2.5 text-sm text-white focus:border-[#EF1717] focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[#A0A0A0]">Address (Optional)</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Sector / Area in Faridabad"
                className="mt-1.5 w-full rounded-md border border-white/10 bg-[#080808] px-3.5 py-2.5 text-sm text-white focus:border-[#EF1717] focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[#A0A0A0]">Profile Photo URL (Optional)</label>
              <input
                type="url"
                value={form.photo_url}
                onChange={(e) => setForm({ ...form, photo_url: e.target.value })}
                placeholder="https://..."
                className="mt-1.5 w-full rounded-md border border-white/10 bg-[#080808] px-3.5 py-2.5 text-sm text-white focus:border-[#EF1717] focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Subscription & Payment */}
        <div>
          <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-white border-b border-white/10 pb-2">
            02. Subscription & Payment
          </h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-[#A0A0A0]">Membership Plan *</label>
              {plans.length > 0 ? (
                <select
                  value={form.plan_id}
                  onChange={(e) => handlePlanChange(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-white/10 bg-[#080808] px-3 py-2.5 text-sm text-white focus:border-[#EF1717] focus:outline-none"
                >
                  <option value="">Custom Plan</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.duration} {p.duration_unit}) – {formatINR(p.price)}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  required
                  value={form.plan_name}
                  onChange={(e) => setForm({ ...form, plan_name: e.target.value })}
                  placeholder="e.g. Monthly"
                  className="mt-1.5 w-full rounded-md border border-white/10 bg-[#080808] px-3.5 py-2.5 text-sm text-white focus:border-[#EF1717] focus:outline-none"
                />
              )}
            </div>

            {plans.length > 0 && !form.plan_id && (
              <div>
                <label className="block text-xs font-medium text-[#A0A0A0]">Custom Plan Name *</label>
                <input
                  type="text"
                  required
                  value={form.plan_name}
                  onChange={(e) => setForm({ ...form, plan_name: e.target.value })}
                  placeholder="Custom duration name"
                  className="mt-1.5 w-full rounded-md border border-white/10 bg-[#080808] px-3.5 py-2.5 text-sm text-white focus:border-[#EF1717] focus:outline-none"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#A0A0A0]">Subscription Start Date *</label>
              <input
                type="date"
                required
                value={form.start_date}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-white/10 bg-[#080808] px-3.5 py-2.5 text-sm text-white focus:border-[#EF1717] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#A0A0A0]">Subscription Expiry Date *</label>
              <input
                type="date"
                required
                value={form.expiry_date}
                onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                className="mt-1.5 w-full rounded-md border border-white/10 bg-[#080808] px-3.5 py-2.5 text-sm text-white focus:border-[#EF1717] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#A0A0A0]">Total Fee (INR) *</label>
              <input
                type="number"
                min="0"
                required
                value={form.total_fee}
                onChange={(e) => setForm({ ...form, total_fee: e.target.value })}
                className="mt-1.5 w-full rounded-md border border-white/10 bg-[#080808] px-3.5 py-2.5 text-sm text-white font-mono-tabular focus:border-[#EF1717] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#A0A0A0]">Amount Paid Now (INR)</label>
              <input
                type="number"
                min="0"
                max={form.total_fee || undefined}
                value={form.amount_paid}
                onChange={(e) => setForm({ ...form, amount_paid: e.target.value })}
                className="mt-1.5 w-full rounded-md border border-white/10 bg-[#080808] px-3.5 py-2.5 text-sm text-white font-mono-tabular focus:border-[#EF1717] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#A0A0A0]">Pending Amount (Auto)</label>
              <div className="mt-1.5 rounded-md border border-white/10 bg-[#0F0F0F] px-3.5 py-2.5 font-mono-tabular text-sm font-semibold text-amber-300">
                {formatINR(pendingAmount)}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#A0A0A0]">Payment Method</label>
              <select
                value={form.payment_method}
                onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                className="mt-1.5 w-full rounded-md border border-white/10 bg-[#080808] px-3 py-2.5 text-sm text-white focus:border-[#EF1717] focus:outline-none"
              >
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#A0A0A0]">Transaction / Reference ID</label>
              <input
                type="text"
                value={form.reference_id}
                onChange={(e) => setForm({ ...form, reference_id: e.target.value })}
                placeholder="UPI ref or receipt note"
                className="mt-1.5 w-full rounded-md border border-white/10 bg-[#080808] px-3.5 py-2.5 text-sm text-white focus:border-[#EF1717] focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[#A0A0A0]">Additional Notes</label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="mt-1.5 w-full rounded-md border border-white/10 bg-[#080808] px-3.5 py-2.5 text-sm text-white focus:border-[#EF1717] focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="flex items-center gap-2.5 text-sm text-white">
                <input
                  type="checkbox"
                  checked={form.whatsapp_opt_in}
                  onChange={(e) => setForm({ ...form, whatsapp_opt_in: e.target.checked })}
                  className="h-4 w-4 accent-[#EF1717]"
                />
                Member has opted in to receive WhatsApp membership reminders
              </label>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-6">
          <Link
            to="/admin/members"
            className="rounded-md border border-white/15 px-5 py-2.5 text-xs font-medium text-[#A0A0A0] hover:text-white"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-md bg-[#EF1717] px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-white hover:bg-[#d11313] disabled:opacity-60"
          >
            <CheckCircle2 className="h-4 w-4" />
            {submitting ? 'Registering...' : 'Register Member'}
          </button>
        </div>
      </form>
    </div>
  );
};
