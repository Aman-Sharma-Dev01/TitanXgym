import React from 'react';
import { AlertTriangle, CheckCircle2, Clock, PauseCircle, XCircle } from 'lucide-react';
import type { ComputedSubStatus } from '../types/gym';

export const StatusLabel: React.FC<{ status: ComputedSubStatus | string }> = ({ status }) => {
  if (status === 'Active') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400 whitespace-nowrap">
        <CheckCircle2 className="h-3 w-3 shrink-0" />
        Active
      </span>
    );
  }
  if (status === 'Expiring Soon') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-300 whitespace-nowrap">
        <Clock className="h-3 w-3 shrink-0" />
        Expiring Soon
      </span>
    );
  }
  if (status === 'Expired') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded border border-[#EF1717]/40 bg-[#EF1717]/15 px-2 py-0.5 text-xs font-medium text-[#ff6b6b] whitespace-nowrap">
        <XCircle className="h-3 w-3 shrink-0" />
        Expired
      </span>
    );
  }
  if (status === 'Pending Payment') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded border border-orange-500/35 bg-orange-500/10 px-2 py-0.5 text-xs font-medium text-orange-300 whitespace-nowrap">
        <AlertTriangle className="h-3 w-3 shrink-0" />
        Pending Payment
      </span>
    );
  }
  if (status === 'Suspended') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded border border-white/20 bg-white/5 px-2 py-0.5 text-xs font-medium text-[#A0A0A0] whitespace-nowrap">
        <PauseCircle className="h-3 w-3 shrink-0" />
        Suspended
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded border border-white/15 bg-white/5 px-2 py-0.5 text-xs font-medium text-[#A0A0A0] whitespace-nowrap">
      {status}
    </span>
  );
};
