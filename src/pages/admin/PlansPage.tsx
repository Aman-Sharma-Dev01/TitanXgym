import React, { useEffect, useState } from 'react';
import { Edit2, Plus, Power, Trash2, X } from 'lucide-react';
import { apiFetch, formatINR } from '../../lib/api';
import type { MembershipPlan } from '../../types/gym';

export const PlansPage: React.FC = () => {
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MembershipPlan | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MembershipPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    duration: '1',
    duration_unit: 'months' as 'days' | 'months' | 'years',
    price: '',
    description: '',
    is_active: true,
  });

  const loadPlans = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ plans: MembershipPlan[] }>('/api/admin/plans');
      setPlans(data.plans);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPlans();
  }, []);

  const openCreate = () => {
    setEditingPlan(null);
    setForm({ name: '', duration: '1', duration_unit: 'months', price: '', description: '', is_active: true });
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (plan: MembershipPlan) => {
    setEditingPlan(plan);
    setForm({
      name: plan.name,
      duration: String(plan.duration),
      duration_unit: plan.duration_unit,
      price: String(plan.price),
      description: plan.description || '',
      is_active: plan.is_active,
    });
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const payload = {
        name: form.name,
        duration: Number(form.duration),
        duration_unit: form.duration_unit,
        price: Number(form.price),
        description: form.description,
        is_active: form.is_active,
      };
      if (editingPlan) {
        await apiFetch(`/api/admin/plans/${editingPlan.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/admin/plans', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setModalOpen(false);
      await loadPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save plan');
    }
  };

  const toggleActive = async (plan: MembershipPlan) => {
    await apiFetch(`/api/admin/plans/${plan.id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...plan, is_active: !plan.is_active }),
    });
    await loadPlans();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await apiFetch(`/api/admin/plans/${deleteTarget.id}`, { method: 'DELETE' });
    setDeleteTarget(null);
    await loadPlans();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-white sm:text-3xl">
            Membership Plans
          </h1>
          <p className="mt-1 text-sm text-[#A0A0A0]">
            Configure monthly, quarterly, annual, or custom duration plans and pricing in INR.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-md bg-[#EF1717] px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-white hover:bg-[#d11313] whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          Create Plan
        </button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-lg border border-white/10 bg-[#151515]" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-[#151515] p-10 text-center">
          <h3 className="font-display text-xl font-semibold uppercase text-white">
            No Membership Plans Configured
          </h3>
          <p className="mt-2 text-sm text-[#A0A0A0]">
            Add your gym's actual membership plans (e.g. Monthly, 3 Months, 6 Months, 12 Months) so
            they can be assigned to members and shown on the website.
          </p>
          <button
            type="button"
            onClick={openCreate}
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-[#EF1717] px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-white hover:bg-[#d11313]"
          >
            <Plus className="h-4 w-4" />
            Add First Plan
          </button>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="flex flex-col justify-between rounded-lg border border-white/10 bg-[#151515] p-6"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-xl font-bold uppercase text-white">
                      {plan.name}
                    </h3>
                    <div className="mt-1 font-mono-tabular text-xs text-[#A0A0A0]">
                      {plan.duration} {plan.duration_unit} · {plan.is_active ? 'Active' : 'Inactive'}
                    </div>
                  </div>
                  <span className="font-mono-tabular text-xl font-bold text-white">
                    {formatINR(plan.price)}
                  </span>
                </div>
                {plan.description && (
                  <p className="mt-4 text-sm text-[#A0A0A0] leading-relaxed">{plan.description}</p>
                )}
              </div>

              <div className="mt-6 flex items-center gap-2 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={() => openEdit(plan)}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded border border-white/15 py-2 text-xs font-medium text-white hover:border-white/30"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => void toggleActive(plan)}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded border border-white/15 py-2 text-xs font-medium text-[#A0A0A0] hover:text-white"
                >
                  <Power className="h-3.5 w-3.5" />
                  {plan.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(plan)}
                  className="rounded border border-white/15 p-2 text-[#A0A0A0] hover:border-[#EF1717] hover:text-[#EF1717]"
                  aria-label="Delete plan"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-lg rounded-lg border border-white/15 bg-[#151515] p-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h2 className="font-display text-xl font-bold uppercase text-white">
                {editingPlan ? 'Edit Membership Plan' : 'New Membership Plan'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-[#A0A0A0] hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={(e) => void handleSave(e)} className="mt-5 space-y-4">
              {error && (
                <div className="rounded border border-[#EF1717]/40 bg-[#EF1717]/10 p-3 text-xs text-[#ff8080]">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[#A0A0A0]">Plan Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Monthly, 3 Months, 6 Months, Annual"
                  className="mt-1.5 w-full rounded-md border border-white/10 bg-[#080808] px-3.5 py-2.5 text-sm text-white focus:border-[#EF1717] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#A0A0A0]">Duration *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={form.duration}
                    onChange={(e) => setForm({ ...form, duration: e.target.value })}
                    className="mt-1.5 w-full rounded-md border border-white/10 bg-[#080808] px-3.5 py-2.5 text-sm text-white focus:border-[#EF1717] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#A0A0A0]">Unit *</label>
                  <select
                    value={form.duration_unit}
                    onChange={(e) =>
                      setForm({ ...form, duration_unit: e.target.value as 'days' | 'months' | 'years' })
                    }
                    className="mt-1.5 w-full rounded-md border border-white/10 bg-[#080808] px-3 py-2.5 text-sm text-white focus:border-[#EF1717] focus:outline-none"
                  >
                    <option value="days">Days</option>
                    <option value="months">Months</option>
                    <option value="years">Years</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#A0A0A0]">Price (INR) *</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="0"
                    className="mt-1.5 w-full rounded-md border border-white/10 bg-[#080808] px-3.5 py-2.5 text-sm text-white focus:border-[#EF1717] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A0A0A0]">Description</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional plan details..."
                  className="mt-1.5 w-full rounded-md border border-white/10 bg-[#080808] px-3.5 py-2.5 text-sm text-white focus:border-[#EF1717] focus:outline-none"
                />
              </div>

              <label className="flex items-center gap-2.5 text-sm text-white">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="h-4 w-4 accent-[#EF1717]"
                />
                Plan is active and visible
              </label>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-md border border-white/15 px-4 py-2 text-xs font-medium text-[#A0A0A0] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-[#EF1717] px-5 py-2 text-xs font-semibold uppercase tracking-wider text-white hover:bg-[#d11313]"
                >
                  Save Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-sm rounded-lg border border-white/15 bg-[#151515] p-6">
            <h3 className="font-display text-lg font-bold uppercase text-white">
              Delete Membership Plan?
            </h3>
            <p className="mt-2 text-sm text-[#A0A0A0]">
              Are you sure you want to remove <strong className="text-white">{deleteTarget.name}</strong>?
              Existing member subscriptions using this plan will retain their historical records.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-md border border-white/15 px-4 py-2 text-xs font-medium text-[#A0A0A0] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                className="rounded-md bg-[#EF1717] px-4 py-2 text-xs font-semibold text-white hover:bg-[#d11313]"
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
