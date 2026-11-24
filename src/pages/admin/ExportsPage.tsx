import React, { useCallback, useEffect, useState } from 'react';
import { Download, FileSpreadsheet, Search } from 'lucide-react';
import { apiFetch } from '../../lib/api';

const REPORT_TYPES = [
  { key: 'all_members', label: 'All Members' },
  { key: 'active_members', label: 'Active Members' },
  { key: 'expired_members', label: 'Expired Members' },
  { key: 'expiring_soon', label: 'Expiring Soon Members' },
  { key: 'subscription_history', label: 'Subscription History' },
  { key: 'payments', label: 'Payment Records' },
  { key: 'pending_dues', label: 'Pending Dues' },
  { key: 'daily_revenue', label: 'Daily Revenue' },
  { key: 'monthly_revenue', label: 'Monthly Revenue' },
];

export const ExportsPage: React.FC = () => {
  const [reportType, setReportType] = useState('all_members');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<{
    sheetName: string;
    columns: Array<{ header: string; key: string }>;
    totalRows: number;
    previewRows: Array<Record<string, string | number>>;
  } | null>(null);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type: reportType });
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (search.trim()) params.set('search', search.trim());

      const res = await apiFetch<{
        sheetName: string;
        columns: Array<{ header: string; key: string }>;
        totalRows: number;
        previewRows: Array<Record<string, string | number>>;
      }>(`/api/admin/exports/preview?${params.toString()}`);
      setPreview(res);
    } finally {
      setLoading(false);
    }
  }, [reportType, startDate, endDate, search]);

  useEffect(() => {
    const t = setTimeout(() => void loadPreview(), 180);
    return () => clearTimeout(t);
  }, [loadPreview]);

  const buildDownloadUrl = (format: 'xlsx' | 'csv') => {
    const params = new URLSearchParams({ type: reportType, format });
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    if (search.trim()) params.set('search', search.trim());
    return `/api/admin/exports/download?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-white sm:text-3xl">
            Reports & Excel Exports
          </h1>
          <p className="mt-1 text-sm text-[#A0A0A0]">
            Preview filtered gym datasets and download formatted XLSX spreadsheets or CSV files.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <a
            href={buildDownloadUrl('csv')}
            className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-[#151515] px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-white hover:border-white/35 whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </a>
          <a
            href={buildDownloadUrl('xlsx')}
            className="inline-flex items-center gap-2 rounded-md bg-[#EF1717] px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-white hover:bg-[#d11313] whitespace-nowrap"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Download Excel (.xlsx)
          </a>
        </div>
      </div>

      {/* Report Type Selector */}
      <div className="flex flex-wrap gap-1.5 rounded-lg border border-white/10 bg-[#151515] p-2">
        {REPORT_TYPES.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => setReportType(r.key)}
            className={`rounded px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              reportType === r.key
                ? 'bg-[#EF1717] text-white'
                : 'text-[#A0A0A0] hover:bg-white/5 hover:text-white'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Date Range & Search Filter */}
      <div className="grid gap-3 rounded-lg border border-white/10 bg-[#151515] p-4 sm:grid-cols-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A0A0A0]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by member, ID, or receipt..."
            className="w-full rounded-md border border-white/10 bg-[#080808] py-2 pl-9 pr-3 text-sm text-white"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#A0A0A0] whitespace-nowrap">From:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-md border border-white/10 bg-[#080808] px-3 py-2 text-xs text-white"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#A0A0A0] whitespace-nowrap">To:</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded-md border border-white/10 bg-[#080808] px-3 py-2 text-xs text-white"
          />
        </div>
      </div>

      {/* Preview Table */}
      <div className="rounded-lg border border-white/10 bg-[#151515]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-xs">
          <span className="font-semibold uppercase tracking-wider text-white">
            {preview?.sheetName || 'Preview'}
          </span>
          <span className="font-mono-tabular text-[#A0A0A0]">
            {preview ? `${preview.totalRows} matching rows` : ''}
          </span>
        </div>

        <div className="overflow-x-auto">
          {loading || !preview ? (
            <div className="p-6 text-sm text-[#A0A0A0]">Generating preview...</div>
          ) : preview.previewRows.length === 0 ? (
            <div className="p-10 text-center text-sm text-[#A0A0A0]">
              No records match the selected report and filters.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-[#A0A0A0]">
                  {preview.columns.map((c) => (
                    <th key={c.key} className="px-4 py-3 font-semibold uppercase whitespace-nowrap">
                      {c.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {preview.previewRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.02]">
                    {preview.columns.map((c) => (
                      <td key={c.key} className="px-4 py-2.5 font-mono-tabular text-[#D4D4D4] whitespace-nowrap">
                        {String(row[c.key] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
