import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, MessageCircle, Plus, Search, Trash2 } from 'lucide-react';
import { apiFetch, buildWaLink, formatDateIN, formatINR } from '../../lib/api';
import { StatusLabel } from '../../components/StatusBadge';
import type { MemberRecord } from '../../types/gym';

export const MembersPage: React.FC = () => {
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState<MemberRecord | null>(null);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const data = await apiFetch<{ members: MemberRecord[] }>(`/api/admin/members?${params.toString()}`);
      setMembers(data.members);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadMembers();
    }, 180);
    return () => clearTimeout(timer);
  }, [loadMembers]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await apiFetch(`/api/admin/members/${deleteTarget.id}`, { method: 'DELETE' });
    setDeleteTarget(null);
    await loadMembers();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-white sm:text-3xl">
            Members Directory
          </h1>
          <p className="mt-1 text-sm text-[#A0A0A0]">
            Manage gym members, view profiles, track dues, and initiate renewals.
          </p>
        </div>
        <Link
          to="/admin/members/new"
          className="inline-flex items-center gap-2 rounded-md bg-[#EF1717] px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-white hover:bg-[#d11313] whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          Add New Member
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-[#151515] p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A0A0A0]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Name, Mobile, or TX ID..."
            className="w-full rounded-md border border-white/10 bg-[#080808] py-2 pl-9 pr-3 text-sm text-white placeholder-[#737373] focus:border-[#EF1717] focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-white/10 bg-[#080808] px-3 py-2 text-sm text-white focus:border-[#EF1717] focus:outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Expiring Soon">Expiring Soon</option>
          <option value="Expired">Expired</option>
          <option value="Pending Payment">Pending Payment</option>
          <option value="Suspended">Suspended</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-white/10 bg-[#151515]">
        {loading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-white/5" />
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-[#A0A0A0]">No members match the selected search or filter.</p>
            <Link
              to="/admin/members/new"
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-[#EF1717] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              Register Member
            </Link>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs font-semibold uppercase tracking-wider text-[#A0A0A0]">
                <th className="px-4 py-3.5">ID</th>
                <th className="px-4 py-3.5">Member</th>
                <th className="px-4 py-3.5">Plan</th>
                <th className="px-4 py-3.5">Expiry</th>
                <th className="px-4 py-3.5 text-right">Pending</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-mono-tabular text-xs font-semibold text-white">
                    {m.member_id}
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/admin/members/${m.id}`} className="font-medium text-white hover:text-[#EF1717]">
                      {m.full_name}
                    </Link>
                    <div className="font-mono-tabular text-xs text-[#A0A0A0]">{m.mobile}</div>
                  </td>
                  <td className="px-4 py-3 text-[#D4D4D4]">{m.plan_name || '—'}</td>
                  <td className="px-4 py-3 font-mono-tabular text-xs text-[#D4D4D4]">
                    {formatDateIN(m.expiry_date)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono-tabular text-xs font-semibold text-amber-300">
                    {Number(m.pending_amount || 0) > 0 ? formatINR(m.pending_amount) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusLabel status={m.computed_status || 'No Plan'} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        to={`/admin/members/${m.id}`}
                        className="rounded border border-white/15 p-1.5 text-[#A0A0A0] hover:border-white/35 hover:text-white"
                        title="View Profile"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Link>
                      <a
                        href={buildWaLink(
                          m.mobile,
                          `Hello ${m.full_name}, this is TITAN X Gym Faridabad.`,
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded border border-white/15 p-1.5 text-emerald-400 hover:border-emerald-500/50"
                        title="Chat on WhatsApp"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(m)}
                        className="rounded border border-white/15 p-1.5 text-[#A0A0A0] hover:border-[#EF1717] hover:text-[#EF1717]"
                        title="Delete Member"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-sm rounded-lg border border-white/15 bg-[#151515] p-6">
            <h3 className="font-display text-lg font-bold uppercase text-white">Delete Member?</h3>
            <p className="mt-2 text-sm text-[#A0A0A0]">
              Remove <strong className="text-white">{deleteTarget.full_name}</strong> ({deleteTarget.member_id})
              from the active directory? Historical payment and subscription records remain archived.
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
                onClick={() => void handleDelete()}
                className="rounded-md bg-[#EF1717] px-4 py-2 text-xs font-semibold text-white hover:bg-[#d11313]"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
