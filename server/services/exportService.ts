import ExcelJS from 'exceljs';
import {
  AttendanceModel,
  MemberModel,
  PaymentModel,
  SubscriptionModel,
} from '../models/index.ts';
import { computeSubscriptionState, getTodayIST } from '../utils/time.ts';

export type ExportType =
  | 'all_members'
  | 'active_members'
  | 'expired_members'
  | 'expiring_soon'
  | 'subscription_history'
  | 'payments'
  | 'pending_dues'
  | 'attendance'
  | 'daily_revenue'
  | 'monthly_revenue';

interface ExportDataset {
  sheetName: string;
  filenamePrefix: string;
  columns: { header: string; key: string; width: number; isCurrency?: boolean }[];
  rows: Record<string, string | number>[];
}

export async function buildExportDataset(
  type: ExportType,
  filters: { startDate?: string; endDate?: string; search?: string } = {},
): Promise<ExportDataset> {
  const todayIST = getTodayIST();
  const search = (filters.search || '').trim().toLowerCase();

  if (
    type === 'all_members' ||
    type === 'active_members' ||
    type === 'expired_members' ||
    type === 'expiring_soon'
  ) {
    const members = (await MemberModel.find({ deleted_at: null }).sort({ _id: -1 }).lean()) as Array<
      Record<string, unknown>
    >;
    const currentSubs = (await SubscriptionModel.find({ is_current: true }).lean()) as Array<
      Record<string, unknown>
    >;
    const subMap = new Map(currentSubs.map((s) => [String(s.member_db_id), s]));

    const rows: Record<string, string | number>[] = [];
    for (const m of members) {
      const sub = subMap.get(String(m._id));
      const hasSub = Boolean(sub?.expiry_date);
      const state = hasSub
        ? computeSubscriptionState(
            {
              expiry_date: String(sub!.expiry_date),
              pending_amount: Number(sub!.pending_amount || 0),
              status_override: sub!.status_override ? String(sub!.status_override) : null,
            },
            todayIST,
          )
        : { status: 'No Plan', daysRemaining: 0 };

      if (type === 'active_members' && state.status !== 'Active' && state.status !== 'Pending Payment') continue;
      if (type === 'expired_members' && state.status !== 'Expired') continue;
      if (type === 'expiring_soon' && state.status !== 'Expiring Soon') continue;

      if (
        search &&
        !String(m.full_name).toLowerCase().includes(search) &&
        !String(m.mobile).toLowerCase().includes(search) &&
        !String(m.member_id).toLowerCase().includes(search)
      ) {
        continue;
      }

      if (filters.startDate && String(m.registration_date) < filters.startDate) continue;
      if (filters.endDate && String(m.registration_date) > filters.endDate) continue;

      rows.push({
        member_id: String(m.member_id),
        full_name: String(m.full_name),
        mobile: String(m.mobile),
        email: String(m.email || ''),
        registration_date: String(m.registration_date),
        plan_name: String(sub?.plan_name || 'None'),
        start_date: String(sub?.start_date || ''),
        expiry_date: String(sub?.expiry_date || ''),
        days_remaining: hasSub ? state.daysRemaining : 0,
        status: state.status,
        total_fee: Number(sub?.total_fee || 0),
        amount_paid: Number(sub?.amount_paid || 0),
        pending_amount: Number(sub?.pending_amount || 0),
      });
    }

    const titleMap: Record<string, string> = {
      all_members: 'All Members',
      active_members: 'Active Members',
      expired_members: 'Expired Members',
      expiring_soon: 'Expiring Soon',
    };

    return {
      sheetName: titleMap[type],
      filenamePrefix: `titanx_${type}`,
      columns: [
        { header: 'Member ID', key: 'member_id', width: 14 },
        { header: 'Full Name', key: 'full_name', width: 24 },
        { header: 'Mobile', key: 'mobile', width: 16 },
        { header: 'Email', key: 'email', width: 26 },
        { header: 'Registered On', key: 'registration_date', width: 14 },
        { header: 'Current Plan', key: 'plan_name', width: 20 },
        { header: 'Start Date', key: 'start_date', width: 14 },
        { header: 'Expiry Date', key: 'expiry_date', width: 14 },
        { header: 'Days Remaining', key: 'days_remaining', width: 15 },
        { header: 'Status', key: 'status', width: 16 },
        { header: 'Total Fee (INR)', key: 'total_fee', width: 16, isCurrency: true },
        { header: 'Paid (INR)', key: 'amount_paid', width: 15, isCurrency: true },
        { header: 'Pending (INR)', key: 'pending_amount', width: 16, isCurrency: true },
      ],
      rows,
    };
  }

  if (type === 'subscription_history') {
    const subs = (await SubscriptionModel.find()
      .populate('member_db_id')
      .sort({ _id: -1 })
      .lean()) as Array<Record<string, unknown>>;

    const rows = subs
      .filter((s) => {
        const mem = s.member_db_id as Record<string, unknown> | null;
        if (!mem || mem.deleted_at) return false;
        if (filters.startDate && String(s.start_date) < filters.startDate) return false;
        if (filters.endDate && String(s.start_date) > filters.endDate) return false;
        if (
          search &&
          !String(mem.full_name).toLowerCase().includes(search) &&
          !String(mem.member_id).toLowerCase().includes(search)
        ) {
          return false;
        }
        return true;
      })
      .map((s) => {
        const mem = s.member_db_id as Record<string, unknown>;
        const state = computeSubscriptionState(
          {
            expiry_date: String(s.expiry_date),
            pending_amount: Number(s.pending_amount || 0),
            status_override: s.status_override ? String(s.status_override) : null,
          },
          todayIST,
        );
        return {
          member_id: String(mem.member_id),
          full_name: String(mem.full_name),
          mobile: String(mem.mobile),
          plan_name: String(s.plan_name),
          start_date: String(s.start_date),
          expiry_date: String(s.expiry_date),
          status: state.status,
          total_fee: Number(s.total_fee || 0),
          amount_paid: Number(s.amount_paid || 0),
          pending_amount: Number(s.pending_amount || 0),
          is_current: s.is_current ? 'Current' : 'Historical',
        };
      });

    return {
      sheetName: 'Subscription History',
      filenamePrefix: 'titanx_subscriptions',
      columns: [
        { header: 'Member ID', key: 'member_id', width: 14 },
        { header: 'Member Name', key: 'full_name', width: 24 },
        { header: 'Mobile', key: 'mobile', width: 15 },
        { header: 'Plan Name', key: 'plan_name', width: 20 },
        { header: 'Start Date', key: 'start_date', width: 14 },
        { header: 'Expiry Date', key: 'expiry_date', width: 14 },
        { header: 'Status', key: 'status', width: 16 },
        { header: 'Total Fee (INR)', key: 'total_fee', width: 16, isCurrency: true },
        { header: 'Paid (INR)', key: 'amount_paid', width: 15, isCurrency: true },
        { header: 'Pending (INR)', key: 'pending_amount', width: 15, isCurrency: true },
        { header: 'Record Type', key: 'is_current', width: 14 },
      ],
      rows,
    };
  }

  if (type === 'payments') {
    const raw = (await PaymentModel.find()
      .populate('member_db_id')
      .populate('subscription_id')
      .sort({ payment_date: -1, _id: -1 })
      .lean()) as Array<Record<string, unknown>>;

    const rows = raw
      .filter((p) => {
        const mem = p.member_db_id as Record<string, unknown> | null;
        if (!mem) return false;
        if (filters.startDate && String(p.payment_date) < filters.startDate) return false;
        if (filters.endDate && String(p.payment_date) > filters.endDate) return false;
        if (
          search &&
          !String(mem.full_name).toLowerCase().includes(search) &&
          !String(mem.member_id).toLowerCase().includes(search) &&
          !String(p.receipt_number).toLowerCase().includes(search)
        ) {
          return false;
        }
        return true;
      })
      .map((p) => {
        const mem = p.member_db_id as Record<string, unknown>;
        const sub = p.subscription_id as Record<string, unknown> | null;
        return {
          receipt_number: String(p.receipt_number),
          payment_date: String(p.payment_date),
          member_id: String(mem.member_id),
          full_name: String(mem.full_name),
          mobile: String(mem.mobile),
          plan_name: String(sub?.plan_name || '—'),
          amount: Number(p.amount || 0),
          payment_method: String(p.payment_method),
          reference_id: String(p.reference_id || ''),
          notes: String(p.notes || ''),
        };
      });

    return {
      sheetName: 'Payment Records',
      filenamePrefix: 'titanx_payments',
      columns: [
        { header: 'Receipt No', key: 'receipt_number', width: 20 },
        { header: 'Payment Date', key: 'payment_date', width: 14 },
        { header: 'Member ID', key: 'member_id', width: 14 },
        { header: 'Member Name', key: 'full_name', width: 24 },
        { header: 'Mobile', key: 'mobile', width: 15 },
        { header: 'Plan', key: 'plan_name', width: 20 },
        { header: 'Amount (INR)', key: 'amount', width: 16, isCurrency: true },
        { header: 'Method', key: 'payment_method', width: 15 },
        { header: 'Reference ID', key: 'reference_id', width: 20 },
        { header: 'Notes', key: 'notes', width: 28 },
      ],
      rows,
    };
  }

  if (type === 'pending_dues') {
    const raw = (await SubscriptionModel.find({ pending_amount: { $gt: 0 } })
      .populate('member_db_id')
      .sort({ pending_amount: -1 })
      .lean()) as Array<Record<string, unknown>>;

    const rows = raw
      .filter((s) => {
        const mem = s.member_db_id as Record<string, unknown> | null;
        return Boolean(mem && !mem.deleted_at);
      })
      .map((s) => {
        const mem = s.member_db_id as Record<string, unknown>;
        return {
          member_id: String(mem.member_id),
          full_name: String(mem.full_name),
          mobile: String(mem.mobile),
          plan_name: String(s.plan_name),
          expiry_date: String(s.expiry_date),
          total_fee: Number(s.total_fee || 0),
          amount_paid: Number(s.amount_paid || 0),
          pending_amount: Number(s.pending_amount || 0),
        };
      });

    return {
      sheetName: 'Pending Dues',
      filenamePrefix: 'titanx_pending_dues',
      columns: [
        { header: 'Member ID', key: 'member_id', width: 14 },
        { header: 'Member Name', key: 'full_name', width: 24 },
        { header: 'Mobile', key: 'mobile', width: 15 },
        { header: 'Plan', key: 'plan_name', width: 20 },
        { header: 'Expiry Date', key: 'expiry_date', width: 14 },
        { header: 'Total Fee (INR)', key: 'total_fee', width: 16, isCurrency: true },
        { header: 'Paid (INR)', key: 'amount_paid', width: 15, isCurrency: true },
        { header: 'Pending Due (INR)', key: 'pending_amount', width: 18, isCurrency: true },
      ],
      rows,
    };
  }

  if (type === 'attendance') {
    const raw = (await AttendanceModel.find()
      .populate('member_db_id')
      .sort({ attendance_date: -1, check_in_time: -1 })
      .lean()) as Array<Record<string, unknown>>;

    const rows = raw
      .filter((a) => {
        if (!a.member_db_id) return false;
        if (filters.startDate && String(a.attendance_date) < filters.startDate) return false;
        if (filters.endDate && String(a.attendance_date) > filters.endDate) return false;
        return true;
      })
      .map((a) => {
        const mem = a.member_db_id as Record<string, unknown>;
        return {
          attendance_date: String(a.attendance_date),
          member_id: String(mem.member_id),
          full_name: String(mem.full_name),
          mobile: String(mem.mobile),
          check_in_time: String(a.check_in_time),
          check_out_time: String(a.check_out_time || 'Checked In'),
          source: String(a.source),
        };
      });

    return {
      sheetName: 'Attendance Records',
      filenamePrefix: 'titanx_attendance',
      columns: [
        { header: 'Date', key: 'attendance_date', width: 14 },
        { header: 'Member ID', key: 'member_id', width: 14 },
        { header: 'Member Name', key: 'full_name', width: 24 },
        { header: 'Mobile', key: 'mobile', width: 15 },
        { header: 'Check-In', key: 'check_in_time', width: 14 },
        { header: 'Check-Out', key: 'check_out_time', width: 14 },
        { header: 'Source', key: 'source', width: 14 },
      ],
      rows,
    };
  }

  if (type === 'daily_revenue') {
    const match: Record<string, unknown> = {};
    if (filters.startDate || filters.endDate) {
      const range: Record<string, string> = {};
      if (filters.startDate) range.$gte = filters.startDate;
      if (filters.endDate) range.$lte = filters.endDate;
      match.payment_date = range;
    }

    const agg = await PaymentModel.aggregate([
      ...(Object.keys(match).length ? [{ $match: match }] : []),
      {
        $group: {
          _id: '$payment_date',
          transactions: { $sum: 1 },
          total_amount: { $sum: '$amount' },
        },
      },
      { $sort: { _id: -1 } },
    ]);

    return {
      sheetName: 'Daily Revenue',
      filenamePrefix: 'titanx_daily_revenue',
      columns: [
        { header: 'Date', key: 'payment_date', width: 16 },
        { header: 'Transactions', key: 'transactions', width: 16 },
        { header: 'Total Revenue (INR)', key: 'total_amount', width: 20, isCurrency: true },
      ],
      rows: agg.map((r) => ({
        payment_date: String(r._id),
        transactions: Number(r.transactions || 0),
        total_amount: Number(r.total_amount || 0),
      })),
    };
  }

  // monthly_revenue
  const agg = await PaymentModel.aggregate([
    {
      $group: {
        _id: { $substr: ['$payment_date', 0, 7] },
        transactions: { $sum: 1 },
        total_amount: { $sum: '$amount' },
      },
    },
    { $sort: { _id: -1 } },
  ]);

  return {
    sheetName: 'Monthly Revenue',
    filenamePrefix: 'titanx_monthly_revenue',
    columns: [
      { header: 'Month (YYYY-MM)', key: 'month_key', width: 18 },
      { header: 'Transactions', key: 'transactions', width: 16 },
      { header: 'Total Revenue (INR)', key: 'total_amount', width: 20, isCurrency: true },
    ],
    rows: agg.map((r) => ({
      month_key: String(r._id),
      transactions: Number(r.transactions || 0),
      total_amount: Number(r.total_amount || 0),
    })),
  };
}

export async function generateXlsxBuffer(dataset: ExportDataset): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TITAN X – Faridabad's Home of Strength";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(dataset.sheetName);
  sheet.columns = dataset.columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width,
  }));

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFEF1717' },
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'left' };
  headerRow.height = 24;

  for (const row of dataset.rows) {
    sheet.addRow(row);
  }

  dataset.columns.forEach((col, idx) => {
    if (col.isCurrency) {
      sheet.getColumn(idx + 1).numFmt = '₹#,##0.00';
    }
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

export function generateCsvString(dataset: ExportDataset): string {
  const escapeCsv = (val: string | number) => {
    const str = String(val ?? '');
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [
    dataset.columns.map((c) => escapeCsv(c.header)).join(','),
    ...dataset.rows.map((r) => dataset.columns.map((c) => escapeCsv(r[c.key] ?? '')).join(',')),
  ];
  return lines.join('\r\n');
}
