import React, { useCallback, useEffect, useState } from 'react';
import { Download, Plus, Printer, Search, X } from 'lucide-react';
import { apiFetch, formatDateIN, formatINR, getTodayISTClient } from '../../lib/api';
import type { PaymentRecord, SubscriptionRecord } from '../../types/gym';

export const PaymentsPage: React.FC = () => {
  const todayIST = getTodayISTClient();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [summary, setSummary] = useState({ todayCollection: 0, monthCollection: 0, filteredTotal: 0 });
  const [pendingSubs, setPendingSubs] = useState<SubscriptionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [method, setMethod] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [receiptTarget, setReceiptTarget] = useState<PaymentRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [payForm, setPayForm] = useState({
    subscription_id: '',
    amount: '',
    payment_method: 'Cash',
    payment_date: todayIST,
    reference_id: '',
    notes: '',
    send_receipt: false,
  });

  const loadPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (method !== 'all') params.set('method', method);
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);
      if (minAmount) params.set('minAmount', minAmount);
      if (maxAmount) params.set('maxAmount', maxAmount);

      const [payRes, subRes] = await Promise.all([
        apiFetch<{
          payments: PaymentRecord[];
          summary: { todayCollection: number; monthCollection: number; filteredTotal: number };
        }>(`/api/admin/payments?${params.toString()}`),
        apiFetch<{ subscriptions: SubscriptionRecord[] }>(
          '/api/admin/subscriptions?paymentStatus=pending&history=true',
        ),
      ]);
      setPayments(payRes.payments);
      setSummary(payRes.summary);
      setPendingSubs(subRes.subscriptions);
    } finally {
      setLoading(false);
    }
  }, [search, method, fromDate, toDate, minAmount, maxAmount]);

  useEffect(() => {
    const t = setTimeout(() => void loadPayments(), 180);
    return () => clearTimeout(t);
  }, [loadPayments]);

  const openModal = () => {
    const first = pendingSubs[0];
    setPayForm({
      subscription_id: first ? String(first.id) : '',
      amount: first ? String(first.pending_amount) : '',
      payment_method: 'Cash',
      payment_date: todayIST,
      reference_id: '',
      notes: '',
      send_receipt: false,
    });
    setError(null);
    setModalOpen(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch('/api/admin/payments', {
        method: 'POST',
        body: JSON.stringify({
          ...payForm,
          subscription_id: payForm.subscription_id,
          amount: Number(payForm.amount),
        }),
      });
      setModalOpen(false);
      await loadPayments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment');
    }
  };

  const downloadReceiptTxt = (p: PaymentRecord) => {
    const text = [
      "TITAN X – Faridabad's Home of Strength",
      '========================================',
      `Receipt Number : ${p.receipt_number}`,
      `Payment Date   : ${formatDateIN(p.payment_date)}`,
      `Member         : ${p.full_name} (${p.member_id})`,
      `Mobile         : +91 ${p.mobile}`,
      `Plan           : ${p.plan_name}`,
      `Amount Paid    : ${formatINR(p.amount)}`,
      `Payment Method : ${p.payment_method}`,
      `Reference ID   : ${p.reference_id || 'N/A'}`,
      '========================================',
      'Contact: +91 9217258251',
    ].join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${p.receipt_number}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-white sm:text-3xl">
            Payments & Collections
          </h1>
          <p className="mt-1 text-sm text-[#A0A0A0]">
            Record full or partial payments, track pending dues, and issue downloadable receipts.
          </p>
        </div>
        <button
          type="button"
          onClick={openModal}
          className="inline-flex items-center gap-2 rounded-md bg-[#EF1717] px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-white hover:bg-[#d11313] whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          Record Payment
        </button>
      </div>

      {/* Collection Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-white/10 bg-[#151515] p-5">
          <div className="text-xs text-[#A0A0A0]">Today's Collection</div>
          <div className="mt-1.5 font-mono-tabular text-2xl font-bold text-white">
            {formatINR(summary.todayCollection)}
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-[#151515] p-5">
          <div className="text-xs text-[#A0A0A0]">This Month's Collection</div>
          <div className="mt-1.5 font-mono-tabular text-2xl font-bold text-white">
            {formatINR(summary.monthCollection)}
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-[#151515] p-5">
          <div className="text-xs text-[#A0A0A0]">Filtered Results Total</div>
          <div className="mt-1.5 font-mono-tabular text-2xl font-bold text-[#EF1717]">
            {formatINR(summary.filteredTotal)}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="grid gap-3 rounded-lg border border-white/10 bg-[#151515] p-4 sm:grid-cols-2 lg:grid-cols-6">
        <div className="relative lg:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A0A0A0]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Receipt, Member ID, Name, Ref..."
            className="w-full rounded-md border border-white/10 bg-[#080808] py-2 pl-9 pr-3 text-sm text-white"
          />
        </div>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="rounded-md border border-white/10 bg-[#080808] px-3 py-2 text-sm text-white"
        >
          <option value="all">All Methods</option>
          <option value="Cash">Cash</option>
          <option value="UPI">UPI</option>
          <option value="Bank Transfer">Bank Transfer</option>
          <option value="Other">Other</option>
        </select>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="rounded-md border border-white/10 bg-[#080808] px-2.5 py-2 text-xs text-white"
        />
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="rounded-md border border-white/10 bg-[#080808] px-2.5 py-2 text-xs text-white"
        />
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Min ₹"
            value={minAmount}
            onChange={(e) => setMinAmount(e.target.value)}
            className="w-full rounded-md border border-white/10 bg-[#080808] px-2 py-2 text-xs text-white font-mono-tabular"
          />
          <input
            type="number"
            placeholder="Max ₹"
            value={maxAmount}
            onChange={(e) => setMaxAmount(e.target.value)}
            className="w-full rounded-md border border-white/10 bg-[#080808] px-2 py-2 text-xs text-white font-mono-tabular"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-white/10 bg-[#151515]">
        {loading ? (
          <div className="p-6 text-sm text-[#A0A0A0]">Loading payments...</div>
        ) : payments.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#A0A0A0]">No payment records found.</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs font-semibold uppercase tracking-wider text-[#A0A0A0]">
                <th className="px-4 py-3.5">Receipt</th>
                <th className="px-4 py-3.5">Date</th>
                <th className="px-4 py-3.5">Member</th>
                <th className="px-4 py-3.5">Plan</th>
                <th className="px-4 py-3.5">Method</th>
                <th className="px-4 py-3.5 text-right">Amount</th>
                <th className="px-4 py-3.5 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-mono-tabular text-xs font-semibold text-white">
                    {p.receipt_number}
                  </td>
                  <td className="px-4 py-3 font-mono-tabular text-xs text-[#D4D4D4]">
                    {formatDateIN(p.payment_date)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{p.full_name}</div>
                    <div className="font-mono-tabular text-xs text-[#A0A0A0]">{p.member_id}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#D4D4D4]">{p.plan_name}</td>
                  <td className="px-4 py-3 text-xs text-[#D4D4D4]">
                    {p.payment_method}
                    {p.reference_id && <span className="block font-mono-tabular text-[11px] text-[#A0A0A0]">{p.reference_id}</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono-tabular text-xs font-bold text-white">
                    {formatINR(p.amount)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setReceiptTarget(p)}
                      className="inline-flex items-center gap-1 rounded border border-white/15 px-2.5 py-1 text-xs text-white hover:border-[#EF1717]"
                    >
                      <Printer className="h-3 w-3" />
                      Receipt
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Record Payment Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-lg border border-white/15 bg-[#151515] p-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-display text-lg font-bold uppercase text-white">Record Payment</h3>
              <button type="button" onClick={() => setModalOpen(false)} className="text-[#A0A0A0] hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            {pendingSubs.length === 0 ? (
              <p className="py-6 text-sm text-[#A0A0A0]">
                All current subscriptions are fully paid with zero pending dues.
              </p>
            ) : (
              <form onSubmit={(e) => void handleRecordPayment(e)} className="mt-4 space-y-3">
                {error && (
                  <div className="rounded border border-[#EF1717]/40 bg-[#EF1717]/10 p-3 text-xs text-[#ff8080]">
                    {error}
                  </div>
                )}
                <div>
                  <label className="block text-xs text-[#A0A0A0]">Member with Pending Balance *</label>
                  <select
                    required
                    value={payForm.subscription_id}
                    onChange={(e) => {
                      const sub = pendingSubs.find((s) => String(s.id) === e.target.value);
                      setPayForm({
                        ...payForm,
                        subscription_id: e.target.value,
                        amount: sub ? String(sub.pending_amount) : '',
                      });
                    }}
                    className="mt-1 w-full rounded border border-white/10 bg-[#080808] px-3 py-2 text-sm text-white"
                  >
                    {pendingSubs.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.member_id} – {s.full_name} ({s.plan_name} · Due {formatINR(s.pending_amount)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
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
                  <div>
                    <label className="block text-xs text-[#A0A0A0]">Payment Method</label>
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
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#A0A0A0]">Date *</label>
                    <input
                      type="date"
                      required
                      value={payForm.payment_date}
                      onChange={(e) => setPayForm({ ...payForm, payment_date: e.target.value })}
                      className="mt-1 w-full rounded border border-white/10 bg-[#080808] px-3 py-2 text-sm text-white"
                    />
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
                </div>

                <div className="flex justify-end gap-2 pt-3">
                  <button type="button" onClick={() => setModalOpen(false)} className="rounded border border-white/15 px-4 py-2 text-xs text-[#A0A0A0]">
                    Cancel
                  </button>
                  <button type="submit" className="rounded bg-[#EF1717] px-4 py-2 text-xs font-semibold text-white">
                    Save Payment
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Receipt Preview Modal */}
      {receiptTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
          <div className="w-full max-w-md rounded-lg border border-white/20 bg-[#0F0F0F] p-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="font-display text-xl font-bold uppercase text-white">
                  TITAN <span className="text-[#EF1717]">X</span> Receipt
                </h3>
                <p className="text-xs text-[#A0A0A0]">Faridabad's Home of Strength</p>
              </div>
              <button type="button" onClick={() => setReceiptTarget(null)} className="text-[#A0A0A0] hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-[#A0A0A0]">Receipt No</span>
                <span className="font-mono-tabular font-semibold text-white">{receiptTarget.receipt_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A0A0A0]">Payment Date</span>
                <span className="font-mono-tabular text-white">{formatDateIN(receiptTarget.payment_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A0A0A0]">Member</span>
                <span className="text-white">
                  {receiptTarget.full_name} ({receiptTarget.member_id})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A0A0A0]">Plan</span>
                <span className="text-white">{receiptTarget.plan_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A0A0A0]">Method</span>
                <span className="text-white">{receiptTarget.payment_method}</span>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-3">
                <span className="font-semibold text-white">Amount Paid</span>
                <span className="font-mono-tabular text-lg font-bold text-[#EF1717]">
                  {formatINR(receiptTarget.amount)}
                </span>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => downloadReceiptTxt(receiptTarget)}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-white/15 py-2.5 text-xs font-semibold text-white hover:border-white/35"
              >
                <Download className="h-3.5 w-3.5" />
                Download Receipt
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-[#EF1717] py-2.5 text-xs font-semibold text-white hover:bg-[#d11313]"
              >
                <Printer className="h-3.5 w-3.5" />
                Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
